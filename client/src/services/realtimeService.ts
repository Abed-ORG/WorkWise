import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';
import { getStoredAuth } from './authStorage';

let socket: Socket | null = null;

function getSocketUrl() {
  return import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';
}

export function getRealtimeSocket(): Socket | null {
  const token = getStoredAuth()?.accessToken;
  if (!token) return null;
  const currentToken = typeof socket?.auth === 'object' ? socket.auth.token : undefined;

  if (!socket || currentToken !== token) {
    socket?.disconnect();
    socket = io(getSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
  }

  return socket;
}

export function joinProjectRoom(projectId: string) {
  const activeSocket = getRealtimeSocket();
  activeSocket?.emit('project:join', projectId);
  return activeSocket;
}

export function leaveProjectRoom(projectId: string) {
  socket?.emit('project:leave', projectId);
}

export function disconnectRealtime() {
  socket?.disconnect();
  socket = null;
}
