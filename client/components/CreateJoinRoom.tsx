"use client";

import { useState, useEffect } from 'react';
import { socket } from '@/lib/socket';

export default function CreateJoinRoom({ onReady }: { onReady: (roomId: string, username: string) => void }) {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [isConnected, setIsConnected] = useState(socket.connected);

  useEffect(() => {
    // Handle connection status
    socket.on('connect', () => {
      console.log('Socket connected');
      setIsConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setIsConnected(false);
    });

    // Handle room-created and room-joined events
    socket.on('room-created', ({ roomId, hostId, isHost }) => {
      console.log('Room created:', { roomId, hostId, isHost });
      // Mark this as a created room so the room page knows not to join again
      sessionStorage.setItem(`created-${roomId}`, 'true');
      onReady(roomId, username);
    });

    socket.on('room-joined', ({ roomId, hostId, isHost }) => {
      console.log('Room joined:', { roomId, hostId, isHost });
      onReady(roomId, username);
    });

    socket.on('error', ({ message }) => {
      console.error('Room error:', message);
      alert(`Error: ${message}`);
    });

    return () => {
      socket.off('connect');
      socket.off('disconnect');
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('error');
    };
  }, [username, onReady]);

  const join = () => {
    if (!username || !roomId) {
      alert('Please enter both username and room ID');
      return;
    }
    console.log('Attempting to join room:', roomId, 'with username:', username);
    socket.emit('join-room', { roomId: roomId.toUpperCase(), username: username.trim() });
  };

  const create = () => {
    if (!username) {
      alert('Please enter a username');
      return;
    }
    console.log('Attempting to create room with username:', username);
    socket.emit('create-room', username.trim());
  };

  return (
    <div className="flex flex-col items-center p-6 space-y-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold text-center">Cricket Team Selection</h2>

      {/* Connection Status */}
      <div className={`text-sm px-3 py-1 rounded-full ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
        {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <input
        className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Enter your username"
        value={username}
        onChange={e => setUsername(e.target.value)}
      />

      <div className="w-full space-y-3">
        <button
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
          onClick={create}
          disabled={!username || !isConnected}
        >
          🎯 Create New Room
        </button>

        <div className="text-center text-gray-500">or</div>

        <div className="space-y-2">
          <input
            className="w-full border border-gray-300 p-3 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
            placeholder="Enter Room ID"
            value={roomId}
            onChange={e => setRoomId(e.target.value.toUpperCase())}
          />
          <button
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition duration-200"
            onClick={join}
            disabled={!username || !roomId || !isConnected}
          >
            🚪 Join Room
          </button>
        </div>
      </div>
    </div>
  );
}
