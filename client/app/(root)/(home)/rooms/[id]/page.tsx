"use client";

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { socket } from '@/lib/socket';
import Lobby from '@/components/Lobby';
import SelectionBoard from '@/components/SelectionBoard';

export default function RoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const roomId = params.id as string;
  const initialUser = searchParams.get('user') || '';

  const [step, setStep] = useState<'lobby' | 'selection'>('lobby');
  const [username] = useState(initialUser);
  const [isLoading, setIsLoading] = useState(true);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [reconnectionMessage, setReconnectionMessage] = useState('');

  useEffect(() => {
    if (!initialUser) {
      console.log('No username found, redirecting to rooms page');
      window.location.href = '/rooms';
      return;
    }
    setIsLoading(false);
  }, [initialUser]);

  useEffect(() => {
    if (!roomId || !username) return;

    console.log('Attempting to join room:', roomId, 'with username:', username);

    // Always join the room to ensure the current socket connection is in the room
    // This handles cases where the socket connection changed during navigation
    console.log('Joining room with current socket connection:', roomId, 'Socket ID:', socket.id);
    socket.emit('join-room', { roomId, username });

    // Listen for server events
    socket.on('room-joined', ({ roomId: joinedRoomId, isHost }) => {
      console.log('Successfully joined room:', joinedRoomId, 'isHost:', isHost);
    });

    socket.on('room-created', ({ roomId: createdRoomId, isHost }) => {
      console.log('Successfully created room:', createdRoomId, 'isHost:', isHost);
    });

    socket.on('selection-started', () => {
      console.log('Selection started, switching to selection view');
      setStep('selection');
    });

    // Handle reconnection events
    socket.on('disconnect', () => {
      console.log('Disconnected from server, attempting to reconnect...');
      setIsReconnecting(true);
      setReconnectionMessage('Connection lost. Attempting to reconnect...');
    });

    socket.on('reconnect', () => {
      console.log('Reconnected to server, attempting to rejoin room...');
      setReconnectionMessage('Reconnected! Rejoining room...');

      // Attempt to rejoin the room
      socket.emit('reconnect-to-room', { roomId, username });
    });

    socket.on('room-rejoined', ({ message }) => {
      console.log('Successfully rejoined room:', message);
      setIsReconnecting(false);
      setReconnectionMessage('');
    });

    socket.on('reconnect_failed', () => {
      setReconnectionMessage('Failed to reconnect. Please refresh the page.');
    });

    socket.on('error', ({ message }) => {
      console.error('Room error:', message);
      // Could redirect back to rooms page or show error
    });

    return () => {
      socket.off('room-joined');
      socket.off('room-created');
      socket.off('selection-started');
      socket.off('error');
      socket.off('disconnect');
      socket.off('reconnect');
      socket.off('room-rejoined');
      socket.off('reconnect_failed');
    };
}, [roomId, username]);

  const handleStart = () => {
    socket.emit('start-selection', roomId);
    setStep('selection');
  };

  if (isLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p>Loading room...</p>
        </div>
      </main>
    );
  }

  // Show reconnection overlay
  if (isReconnecting) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center bg-white p-8 rounded-lg shadow-lg max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Reconnecting...</h2>
          <p className="text-gray-600">{reconnectionMessage}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
          >
            Refresh Page
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-4">
      {step === 'lobby' && (
        <Lobby
          socket={socket}
          roomId={roomId}
          username={username}
          onStart={handleStart}
        />
      )}
      {step === 'selection' && (
        <SelectionBoard
          socket={socket}
          roomId={roomId}
        />
      )}
    </main>
  );
}