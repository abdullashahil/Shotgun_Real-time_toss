const socketIo = require('socket.io');

// Predefined cricket players (20 players)
const ALL_PLAYERS = [
  { id: 1, name: 'Virat Kohli' },
  { id: 2, name: 'Rohit Sharma' },
  { id: 3, name: 'MS Dhoni' },
  { id: 4, name: 'Sachin Tendulkar' },
  { id: 5, name: 'Sourav Ganguly' },
  { id: 6, name: 'Anil Kumble' },
  { id: 7, name: 'Kapil Dev' },
  { id: 8, name: 'Rahul Dravid' },
  { id: 9, name: 'VVS Laxman' },
  { id: 10, name: 'Yuvraj Singh' },
  { id: 11, name: 'Hardik Pandya' },
  { id: 12, name: 'Jasprit Bumrah' },
  { id: 13, name: 'Ravindra Jadeja' },
  { id: 14, name: 'Bhuvneshwar Kumar' },
  { id: 15, name: 'Shikhar Dhawan' },
  { id: 16, name: 'KL Rahul' },
  { id: 17, name: 'Shreyas Iyer' },
  { id: 18, name: 'Rishabh Pant' },
  { id: 19, name: 'Mohammed Shami' },
  { id: 20, name: 'Ishant Sharma' }
];

// In-memory storage for rooms: key = roomId, value = { host, users, status, availablePlayers, turnOrder, currentTurnIndex, timer }
const rooms = new Map();

// Store disconnected users for reconnection (userId -> { roomId, username, disconnectedAt, players })
const disconnectedUsers = new Map();

// Reconnection timeout (5 minutes)
const RECONNECTION_TIMEOUT = 5 * 60 * 1000;

// Cleanup interval for expired disconnected users (run every minute)
const CLEANUP_INTERVAL = 60 * 1000;

// Start cleanup interval for disconnected users
setInterval(() => {
  cleanupExpiredDisconnectedUsers();
}, CLEANUP_INTERVAL);

function registerSocketHandlers(server) {
  const io = socketIo(server, {
    cors: {
      origin: ['http://localhost:3000', 'https://shotgun-real-time-toss.vercel.app'],
      methods: ['GET', 'POST'],
      credentials: true
    },
    allowEIO3: true
  });

  io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    // Create room
    socket.on('create-room', (username) => {
      if (!username || username.trim() === '') {
        socket.emit('error', { message: 'Username is required' });
        return;
      }

      const roomId = generateRoomId();
      rooms.set(roomId, {
        host: socket.id,
        users: new Map([[socket.id, { username: username.trim(), players: [] }]]),
        status: 'waiting',
        availablePlayers: [...ALL_PLAYERS],
        turnOrder: [],
        currentTurnIndex: 0,
        timer: null,
        countdownInterval: null
      });
      socket.join(roomId);

      // inform creator
      socket.emit('room-created', { roomId, hostId: socket.id, isHost: true });

      // broadcast full user list
      const userList = getUserList(roomId);
      io.to(roomId).emit('user-list', userList);

      console.log(`Room ${roomId} created by ${username.trim()}`);
    });

    // Join room
    socket.on('join-room', ({ roomId, username }) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'waiting') {
        socket.emit('error', { message: 'Invalid room or already started' });
        return;
      }

      // Check if this socket is already in the room
      const isAlreadyInRoom = room.users.has(socket.id);

      if (!isAlreadyInRoom) {
        // Check if username is already taken by a different socket
        const existingUser = Array.from(room.users.entries()).find(([socketId, user]) =>
          user.username === username && socketId !== socket.id
        );
        if (existingUser) {
          socket.emit('error', { message: 'Username already taken in this room' });
          return;
        }

        // Add user to room
        room.users.set(socket.id, { username, players: [] });
        console.log(`${username} joined room ${roomId}. Total users: ${room.users.size}`);
      } else {
        console.log(`${username} rejoined room ${roomId} with same socket`);
      }

      // Always join the socket to the room (handles reconnections)
      socket.join(roomId);

      // confirm join
      socket.emit('room-joined', { roomId, hostId: room.host, isHost: socket.id === room.host });

      // broadcast updated user list to all users in room
      const userList = getUserList(roomId);
      console.log(`Broadcasting user list to room ${roomId}:`, userList);
      io.to(roomId).emit('user-list', userList);

      // notify others that someone joined (only if new user)
      if (!isAlreadyInRoom) {
        socket.to(roomId).emit('user-joined', { username, userId: socket.id });
      }
    });

    // Send available players
    socket.on('get-players', (roomId) => {
      const room = rooms.get(roomId);
      if (room) socket.emit('player-list', room.availablePlayers);
    });

    // Handle turn order sync requests (fallback for missing turn order)
    socket.on('request-turn-order-sync', (roomId) => {
      const room = rooms.get(roomId);
      if (!room || room.status !== 'selection') {
        return;
      }

      const turnOrderWithNames = room.turnOrder.map(id => ({
        userId: id,
        username: room.users.get(id)?.username || 'Unknown'
      }));

      // Send turn order sync to the requesting client
      socket.emit('turn-order-sync', {
        turnOrder: turnOrderWithNames,
        currentUserId: room.turnOrder[room.currentTurnIndex],
        currentUsername: room.users.get(room.turnOrder[room.currentTurnIndex])?.username || 'Unknown',
        currentTurnIndex: room.currentTurnIndex,
        totalTurns: room.turnOrder.length
      });

      console.log(`Turn order sync sent to ${socket.id} in room ${roomId}`);
    });

    // Send user list (fallback for clients that missed the broadcast)
    socket.on('get-user-list', (roomId) => {
      const room = rooms.get(roomId);
      if (room) {
        const userList = getUserList(roomId);
        console.log(`Sending user list to ${socket.id} for room ${roomId}:`, userList);
        socket.emit('user-list', userList);
      }
    });

    // Start selection - for host
    socket.on('start-selection', (roomId) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (socket.id !== room.host) {
        socket.emit('error', { message: 'Only the host can start the selection' });
        return;
      }
      if (room.status !== 'waiting') {
        socket.emit('error', { message: 'Selection has already started or completed' });
        return;
      }
      if (room.users.size < 2) {
        socket.emit('error', { message: 'Need at least 2 players to start' });
        return;
      }

      room.status = 'selection';
      room.turnOrder = shuffleArray([...room.users.keys()]);
      room.currentTurnIndex = 0;

      const turnOrderWithNames = room.turnOrder.map(id => ({
        userId: id,
        username: room.users.get(id)?.username || 'Unknown'
      }));

      // notify start and turn order with complete information
      io.to(roomId).emit('selection-started', {
        turnOrder: turnOrderWithNames,
        currentUserId: room.turnOrder[0],
        currentUsername: room.users.get(room.turnOrder[0])?.username || 'Unknown',
        currentTurnIndex: 0,
        totalTurns: room.turnOrder.length
      });

      console.log(`Selection in room ${roomId} started. Turn order:`, turnOrderWithNames.map(u => u.username).join(' → '));

      // Add a small delay to ensure all clients process the selection-started event
      // before receiving the first turn-update event
      setTimeout(() => {
        advanceTurn(io, roomId);
      }, 100); // 100ms delay should be sufficient for event processing
    });

    // Player selects
    socket.on('select-player', ({ roomId, playerId }) => {
      const room = rooms.get(roomId);
      if (!room) {
        socket.emit('error', { message: 'Room not found' });
        return;
      }
      if (room.status !== 'selection') {
        socket.emit('error', { message: 'Selection is not active' });
        return;
      }
      if (!room.users.has(socket.id)) {
        socket.emit('error', { message: 'You are not in this room' });
        return;
      }

      processSelection(io, roomId, socket.id, playerId, false);
    });

    // Comprehensive disconnect handling
    socket.on('disconnect', (reason) => {
      console.log(`Socket ${socket.id} disconnected. Reason: ${reason}`);
      handleUserDisconnect(io, socket.id, reason);
    });

    // Handle reconnection attempts
    socket.on('reconnect-to-room', ({ roomId, username }) => {
      handleUserReconnection(io, socket, roomId, username);
    });
  });
}

// Helpers
function generateRoomId() {
  return Math.random().toString(36).slice(2,7).toUpperCase();
}
function shuffleArray(arr) {
  return arr.sort(() => Math.random()-0.5);
}
function getUserList(roomId) {
  const room = rooms.get(roomId);
  if (!room) return [];
  return Array.from(room.users.entries()).map(([id, u]) => ({ userId: id, username: u.username, isHost: id===room.host }));
}

function advanceTurn(io, roomId) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'selection') return;

  // Clear any existing timers
  if (room.timer) clearTimeout(room.timer);
  if (room.countdownInterval) clearInterval(room.countdownInterval);

  const currentUserId = room.turnOrder[room.currentTurnIndex];
  const currentUser = room.users.get(currentUserId);

  if (!currentUser) {
    console.error(`User not found for turn: ${currentUserId} in room ${roomId}`);
    return;
  }

  console.log(`Turn advanced in room ${roomId}: ${currentUser.username}'s turn (${room.currentTurnIndex + 1}/${room.turnOrder.length})`);

  // Send comprehensive turn update with all necessary info
  const turnData = {
    currentUserId,
    currentUsername: currentUser.username,
    timeLeft: 10,
    turnOrder: room.turnOrder.map(id => ({
      userId: id,
      username: room.users.get(id)?.username || 'Unknown'
    })),
    currentTurnIndex: room.currentTurnIndex,
    totalTurns: room.turnOrder.length
  };

  io.to(roomId).emit('turn-update', turnData);

  // Start countdown timer with proper cleanup
  let timeLeft = 10;
  room.countdownInterval = setInterval(() => {
    timeLeft--;
    io.to(roomId).emit('timer-tick', { timeLeft });

    if (timeLeft <= 0) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
    }
  }, 1000);

  // Auto-select after 10 seconds
  room.timer = setTimeout(() => {
    if (room.countdownInterval) {
      clearInterval(room.countdownInterval);
      room.countdownInterval = null;
    }

    const roomRef = rooms.get(roomId);
    if (!roomRef || !roomRef.availablePlayers.length) return;

    const rand = roomRef.availablePlayers[Math.floor(Math.random() * roomRef.availablePlayers.length)];
    processSelection(io, roomId, currentUserId, rand.id, true);
  }, 10000);
}

function processSelection(io, roomId, userId, playerId, isAuto) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'selection') return;

  // Clear any existing timers
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
  }
  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
  }

  const current = room.turnOrder[room.currentTurnIndex];
  if (userId!==current) return;  // not this user's turn

  const idx = room.availablePlayers.findIndex(p=>p.id===playerId);
  if (idx<0) return;

  const [player] = room.availablePlayers.splice(idx,1);
  room.users.get(userId).players.push(player);

  // Emit different events for manual vs auto selection
  if (isAuto) {
    io.to(roomId).emit('auto-selected', {
      userId,
      username: room.users.get(userId).username,
      player,
      message: `${room.users.get(userId).username} was auto-assigned ${player.name}`
    });
  } else {
    io.to(roomId).emit('player-selected', {
      userId,
      username: room.users.get(userId).username,
      player
    });
  }

  // Send updated available players list
  io.to(roomId).emit('player-list', room.availablePlayers);

  // Check if selection is complete
  const done = Array.from(room.users.values()).every(u=>u.players.length===5);
  if (done) {
    room.status = 'completed';
    const finalTeams = getUserList(roomId).map(u => ({
      userId: u.userId,
      username: u.username,
      players: room.users.get(u.userId).players,
      isHost: u.isHost
    }));
    io.to(roomId).emit('selection-ended', { teams: finalTeams });
    return;
  }

  // Move to next turn
  room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length;
  advanceTurn(io, roomId);
}

// Comprehensive disconnect handling function
function handleUserDisconnect(io, socketId, reason) {
  rooms.forEach((room, roomId) => {
    if (room.users.has(socketId)) {
      const user = room.users.get(socketId);
      const wasHost = room.host === socketId;
      const wasCurrentTurn = room.status === 'selection' && room.turnOrder[room.currentTurnIndex] === socketId;

      console.log(`User ${user?.username || socketId} disconnecting from room ${roomId}. Was host: ${wasHost}, Was current turn: ${wasCurrentTurn}`);

      // Store user data for potential reconnection (only during selection phase)
      if (room.status === 'selection' && user) {
        disconnectedUsers.set(socketId, {
          roomId,
          username: user.username,
          players: user.players || [],
          disconnectedAt: Date.now(),
          wasHost
        });

        // Set cleanup timeout for disconnected user data
        setTimeout(() => {
          disconnectedUsers.delete(socketId);
          console.log(`Cleaned up disconnected user data for ${socketId}`);
        }, RECONNECTION_TIMEOUT);
      }

      // Remove user from room
      room.users.delete(socketId);

      // Handle empty room
      if (room.users.size === 0) {
        cleanupRoom(roomId, room);
        return;
      }

      // Handle host migration
      if (wasHost) {
        const newHostId = room.users.keys().next().value;
        const newHost = room.users.get(newHostId);
        room.host = newHostId;

        console.log(`Host migrated in room ${roomId}: ${newHost?.username} (${newHostId})`);

        // Notify all users about host change
        io.to(roomId).emit('host-changed', {
          newHostId,
          newHostUsername: newHost?.username,
          message: `${newHost?.username} is now the host`
        });
      }

      // Handle turn order updates during selection
      if (room.status === 'selection' && room.turnOrder.includes(socketId)) {
        handleTurnOrderUpdate(io, roomId, socketId, wasCurrentTurn);
      }

      // Notify remaining users about disconnection
      io.to(roomId).emit('user-disconnected', {
        userId: socketId,
        username: user?.username || 'Unknown',
        message: `${user?.username || 'A player'} has left the game`
      });

      // Update user list for remaining users
      io.to(roomId).emit('user-list', getUserList(roomId));

      console.log(`Removed ${user?.username || socketId} from room ${roomId}. Remaining users: ${room.users.size}`);
    }
  });
}

// Handle turn order updates when a user disconnects during selection
function handleTurnOrderUpdate(io, roomId, disconnectedSocketId, wasCurrentTurn) {
  const room = rooms.get(roomId);
  if (!room || room.status !== 'selection') return;

  const disconnectedIndex = room.turnOrder.indexOf(disconnectedSocketId);
  if (disconnectedIndex === -1) return;

  // Remove disconnected user from turn order
  room.turnOrder.splice(disconnectedIndex, 1);

  // Adjust current turn index if necessary
  if (disconnectedIndex < room.currentTurnIndex) {
    room.currentTurnIndex--;
  } else if (disconnectedIndex === room.currentTurnIndex) {
    // If it was the disconnected user's turn, don't increment the index
    // as the next player is now at the same index
    if (room.currentTurnIndex >= room.turnOrder.length) {
      room.currentTurnIndex = 0; // Wrap around
    }
  }

  // Ensure we have valid turn order
  if (room.turnOrder.length === 0) {
    // No players left in selection
    room.status = 'completed';
    io.to(roomId).emit('selection-ended', {
      teams: [],
      message: 'Selection ended - no players remaining'
    });
    return;
  }

  // Create updated turn order with names
  const turnOrderWithNames = room.turnOrder.map(id => ({
    userId: id,
    username: room.users.get(id)?.username || 'Unknown'
  }));

  // Broadcast updated turn order
  io.to(roomId).emit('turn-order-updated', {
    turnOrder: turnOrderWithNames,
    currentTurnIndex: room.currentTurnIndex,
    message: `Turn order updated - ${room.turnOrder.length} players remaining`
  });

  // If it was the disconnected user's turn, advance to next player
  if (wasCurrentTurn) {
    console.log(`Advancing turn after disconnect in room ${roomId}`);
    advanceTurn(io, roomId);
  }
}

// Clean up room and all associated resources
function cleanupRoom(roomId, room) {
  console.log(`Cleaning up empty room ${roomId}`);

  // Use comprehensive cleanup
  cleanupRoomResources(roomId, room);

  // Remove room from memory
  rooms.delete(roomId);

  console.log(`Room ${roomId} deleted - no users remaining`);
}

// Handle user reconnection
function handleUserReconnection(io, socket, roomId, username) {
  const room = rooms.get(roomId);
  if (!room) {
    socket.emit('error', { message: 'Room not found or no longer exists' });
    return;
  }

  // Check if user was previously disconnected
  const disconnectedData = disconnectedUsers.get(socket.id);

  if (disconnectedData && disconnectedData.roomId === roomId && disconnectedData.username === username) {
    // Restore user to room
    room.users.set(socket.id, {
      username,
      players: disconnectedData.players
    });

    // Restore host status if they were the host
    if (disconnectedData.wasHost && room.host !== socket.id) {
      // Only restore host if current host agrees or if there's no current host
      const currentHost = room.users.get(room.host);
      if (!currentHost) {
        room.host = socket.id;
        io.to(roomId).emit('host-changed', {
          newHostId: socket.id,
          newHostUsername: username,
          message: `${username} has reconnected and resumed as host`
        });
      }
    }

    // Add back to turn order if selection is in progress
    if (room.status === 'selection' && !room.turnOrder.includes(socket.id)) {
      room.turnOrder.push(socket.id);

      const turnOrderWithNames = room.turnOrder.map(id => ({
        userId: id,
        username: room.users.get(id)?.username || 'Unknown'
      }));

      io.to(roomId).emit('turn-order-updated', {
        turnOrder: turnOrderWithNames,
        currentTurnIndex: room.currentTurnIndex,
        message: `${username} has reconnected and rejoined the turn order`
      });
    }

    // Clean up disconnected user data
    disconnectedUsers.delete(socket.id);

    socket.join(roomId);
    socket.emit('room-rejoined', {
      roomId,
      hostId: room.host,
      isHost: socket.id === room.host,
      message: 'Successfully reconnected to the game'
    });

    // Notify others about reconnection
    io.to(roomId).emit('user-reconnected', {
      userId: socket.id,
      username,
      message: `${username} has reconnected to the game`
    });

    // Send current game state
    sendGameStateSync(socket, roomId);

    console.log(`User ${username} successfully reconnected to room ${roomId}`);
  } else {
    // Regular join for new connection
    socket.emit('join-room', { roomId, username });
  }
}

// Send complete game state to a reconnecting user
function sendGameStateSync(socket, roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  // Send user list
  socket.emit('user-list', getUserList(roomId));

  // Send available players
  socket.emit('player-list', room.availablePlayers);

  // If selection is in progress, send current state
  if (room.status === 'selection') {
    const turnOrderWithNames = room.turnOrder.map(id => ({
      userId: id,
      username: room.users.get(id)?.username || 'Unknown'
    }));

    socket.emit('selection-state-sync', {
      status: room.status,
      turnOrder: turnOrderWithNames,
      currentUserId: room.turnOrder[room.currentTurnIndex],
      currentUsername: room.users.get(room.turnOrder[room.currentTurnIndex])?.username || 'Unknown',
      currentTurnIndex: room.currentTurnIndex,
      totalTurns: room.turnOrder.length,
      availablePlayers: room.availablePlayers
    });
  }
}

// Clean up expired disconnected users
function cleanupExpiredDisconnectedUsers() {
  const now = Date.now();
  const expiredUsers = [];

  disconnectedUsers.forEach((userData, socketId) => {
    if (now - userData.disconnectedAt > RECONNECTION_TIMEOUT) {
      expiredUsers.push(socketId);
    }
  });

  expiredUsers.forEach(socketId => {
    const userData = disconnectedUsers.get(socketId);
    disconnectedUsers.delete(socketId);
    console.log(`Cleaned up expired disconnected user: ${userData?.username} (${socketId})`);
  });

  if (expiredUsers.length > 0) {
    console.log(`Cleaned up ${expiredUsers.length} expired disconnected users`);
  }
}

// Enhanced room cleanup with comprehensive resource management
function cleanupRoomResources(roomId, room) {
  console.log(`Starting comprehensive cleanup for room ${roomId}`);

  // Clear all timers and intervals
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = null;
    console.log(`Cleared timer for room ${roomId}`);
  }

  if (room.countdownInterval) {
    clearInterval(room.countdownInterval);
    room.countdownInterval = null;
    console.log(`Cleared countdown interval for room ${roomId}`);
  }

  // Clear any user-specific timers (if we had any)
  // This is where we'd clean up any per-user timers if implemented

  // Remove all disconnected users associated with this room
  const disconnectedInRoom = [];
  disconnectedUsers.forEach((userData, socketId) => {
    if (userData.roomId === roomId) {
      disconnectedInRoom.push(socketId);
    }
  });

  disconnectedInRoom.forEach(socketId => {
    disconnectedUsers.delete(socketId);
  });

  if (disconnectedInRoom.length > 0) {
    console.log(`Cleaned up ${disconnectedInRoom.length} disconnected users for room ${roomId}`);
  }

  // Reset room data structure
  room.users.clear();
  room.turnOrder = [];
  room.availablePlayers = [];
  room.currentTurnIndex = 0;
  room.status = 'deleted';

  console.log(`Comprehensive cleanup completed for room ${roomId}`);
}

module.exports = { registerSocketHandlers };