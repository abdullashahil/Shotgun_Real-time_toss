"use client";

import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';

interface User {
  userId: string;
  username: string;
  isHost: boolean;
}

interface DisconnectNotification {
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

export default function Lobby({ socket, roomId, username, onStart }: { socket: Socket; roomId: string; username: string; onStart: () => void }) {
  const [users, setUsers] = useState<User[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [disconnectNotifications, setDisconnectNotifications] = useState<DisconnectNotification[]>([]);

  useEffect(() => {
    console.log('Lobby component mounted for user:', username, 'Socket ID:', socket.id);

    // Listen for user list updates
    socket.on('user-list', (userList: User[]) => {
      console.log('🎯 Lobby received user list:', userList, 'for user:', username);
      setUsers(userList);
      // Check if current user is host
      const currentUser = userList.find(u => u.username === username);
      setIsHost(currentUser?.isHost || false);
      setIsLoading(false);
    });

    // Listen for individual user joins
    socket.on('user-joined', ({ username: joinedUsername, userId }) => {
      console.log(`${joinedUsername} joined the room`);
    });

    // Listen for errors
    socket.on('error', ({ message }) => {
      setError(message);
      setIsLoading(false);
    });

    // Listen for room events
    socket.on('room-created', ({ hostId, isHost: hostStatus }) => {
      setIsHost(hostStatus || socket.id === hostId);
      setIsLoading(false);
    });

    socket.on('room-joined', ({ hostId, isHost: hostStatus }) => {
      setIsHost(hostStatus || socket.id === hostId);
      setIsLoading(false);
    });

    // Clear error when component mounts
    setError('');

    // Listen for disconnect notifications
    socket.on('user-disconnected', ({ userId, username, message }) => {
      console.log('👋 User disconnected in lobby:', { userId, username, message });

      const notification: DisconnectNotification = {
        userId,
        username,
        message,
        timestamp: Date.now()
      };

      setDisconnectNotifications(prev => [notification, ...prev.slice(0, 2)]); // Keep last 3

      // Auto-remove notification after 4 seconds
      setTimeout(() => {
        setDisconnectNotifications(prev => prev.filter(n => n.timestamp !== notification.timestamp));
      }, 4000);
    });

    // Listen for user reconnections
    socket.on('user-reconnected', ({ userId, username, message }) => {
      console.log('🔄 User reconnected in lobby:', { userId, username, message });

      const notification: DisconnectNotification = {
        userId,
        username,
        message,
        timestamp: Date.now()
      };

      setDisconnectNotifications(prev => [notification, ...prev.slice(0, 2)]);

      // Auto-remove notification after 3 seconds
      setTimeout(() => {
        setDisconnectNotifications(prev => prev.filter(n => n.timestamp !== notification.timestamp));
      }, 3000);
    });

    // Listen for host changes
    socket.on('host-changed', ({ newHostId, newHostUsername, message }) => {
      console.log('👑 Host changed in lobby:', { newHostId, newHostUsername, message });

      const notification: DisconnectNotification = {
        userId: newHostId,
        username: newHostUsername,
        message,
        timestamp: Date.now()
      };

      setDisconnectNotifications(prev => [notification, ...prev.slice(0, 2)]);

      setTimeout(() => {
        setDisconnectNotifications(prev => prev.filter(n => n.timestamp !== notification.timestamp));
      }, 4000);
    });

    // Request user list as fallback (in case we missed the initial broadcast)
    setTimeout(() => {
      console.log('Requesting user list for room:', roomId);
      socket.emit('get-user-list', roomId);
    }, 1000);

    return () => {
      socket.off('user-list');
      socket.off('user-joined');
      socket.off('error');
      socket.off('room-created');
      socket.off('room-joined');
      socket.off('user-disconnected');
      socket.off('user-reconnected');
      socket.off('host-changed');
    };
  }, [socket, username]);

  if (isLoading) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading room...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Disconnect Notifications */}
      {disconnectNotifications.length > 0 && (
        <div className="fixed top-4 right-4 z-50 space-y-2">
          {disconnectNotifications.map((notification) => (
            <div
              key={notification.timestamp}
              className={`p-3 rounded-lg shadow-lg max-w-sm transition-all duration-300 ${
                notification.message.includes('reconnected')
                  ? 'bg-green-100 border-l-4 border-green-500 text-green-800'
                  : notification.message.includes('host')
                  ? 'bg-purple-100 border-l-4 border-purple-500 text-purple-800'
                  : 'bg-red-100 border-l-4 border-red-500 text-red-800'
              }`}
            >
              <div className="flex items-start">
                <div className="flex-1">
                  <p className="text-sm font-medium">{notification.message}</p>
                  <p className="text-xs opacity-75 mt-1">
                    {new Date(notification.timestamp).toLocaleTimeString()}
                  </p>
                </div>
                <button
                  onClick={() => setDisconnectNotifications(prev =>
                    prev.filter(n => n.timestamp !== notification.timestamp)
                  )}
                  className="ml-2 text-gray-400 hover:text-gray-600"
                >
                  ×
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="max-w-md mx-auto bg-white rounded-lg shadow-md p-6">
        <h2 className="text-2xl font-bold text-center mb-4">Room: {roomId}</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-2">Players in Room ({users.length})</h3>
        {users.length === 0 ? (
          <div className="text-center text-gray-500 py-4">
            No players in room yet...
          </div>
        ) : (
          <ul className="space-y-2">
            {users.map(user => (
              <li key={user.userId} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold mr-3">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <span className="font-medium">{user.username}</span>
                  {user.username === username && (
                    <span className="ml-2 text-xs text-gray-500">(You)</span>
                  )}
                </div>
                {user.isHost && (
                  <span className="bg-blue-500 text-white text-xs px-2 py-1 rounded">HOST</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mb-4 text-center">
        {isHost && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
            <p className="text-blue-800 text-sm">
              🎯 You are the host! You can start the team selection when ready.
            </p>
          </div>
        )}
      </div>

      {users.length >= 2 ? (
        isHost ? (
          <button
            className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 px-4 rounded-lg transition duration-200 shadow-md"
            onClick={onStart}
          >
            🚀 Start Team Selection
          </button>
        ) : (
          <div className="text-center bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-yellow-800">
              ⏳ Waiting for host to start the selection...
            </p>
          </div>
        )
      ) : (
        <div className="text-center bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-gray-600">
            👥 Waiting for more players to join... (Need at least 2 players)
          </p>
          <p className="text-sm text-gray-500 mt-2">
            Share room code: <span className="font-mono font-bold">{roomId}</span>
          </p>
        </div>
      )}
      </div>
    </>
  );
}
