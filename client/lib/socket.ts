import { io, Socket } from 'socket.io-client';

const URL = process.env.NEXT_PUBLIC_SOCKET_URL!;

console.log('Socket.IO connecting to:', URL);

export const socket: Socket = io(URL, {
  transports: ['polling', 'websocket'],
  autoConnect: true,
  reconnection: true,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  reconnectionAttempts: 10,
  timeout: 20000,
  forceNew: false
});

// Add connection event listeners for debugging
socket.on('connect', () => {
  console.log('Socket.IO connected successfully!', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('Socket.IO connection error:', error);
});

socket.on('disconnect', (reason) => {
  console.log('Socket.IO disconnected:', reason);
});

socket.on('reconnect', (attemptNumber) => {
  console.log('Socket.IO reconnected after', attemptNumber, 'attempts');
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log('Socket.IO reconnection attempt', attemptNumber);
});

socket.on('reconnect_error', (error) => {
  console.error('Socket.IO reconnection error:', error);
});

socket.on('reconnect_failed', () => {
  console.error('Socket.IO reconnection failed - all attempts exhausted');
});
