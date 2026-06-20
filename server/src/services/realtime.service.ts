import { Server } from "socket.io";
import type { Server as HttpServer } from "http";
import prisma from "../utils/prisma";
import { env } from "../config/env";
import { verifyAccessToken } from "../utils/jwt";

interface SocketUser {
  userId: string;
  role: string;
}

let io: Server | null = null;

const projectRoom = (projectId: string) => `project:${projectId}`;
const userRoom = (userId: string) => `user:${userId}`;

export function initializeRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: env.frontendUrl,
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token || typeof token !== "string") {
        return next(new Error("Unauthorized"));
      }

      const decoded = verifyAccessToken(token) as SocketUser;
      socket.data.user = decoded;
      socket.join(userRoom(decoded.userId));
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("project:join", async (projectId: string, callback?: (result: { ok: boolean }) => void) => {
      const user = socket.data.user as SocketUser | undefined;
      if (!user || !projectId) {
        callback?.({ ok: false });
        return;
      }

      const membership = await prisma.projectMember.findUnique({
        where: { userId_projectId: { userId: user.userId, projectId } },
      });

      if (!membership) {
        callback?.({ ok: false });
        return;
      }

      await socket.join(projectRoom(projectId));
      callback?.({ ok: true });
    });

    socket.on("project:leave", async (projectId: string) => {
      if (projectId) await socket.leave(projectRoom(projectId));
    });
  });

  return io;
}

export function emitProjectEvent(projectId: string, event: string, payload: unknown) {
  io?.to(projectRoom(projectId)).emit(event, payload);
}

export function emitUserEvent(userId: string, event: string, payload: unknown) {
  io?.to(userRoom(userId)).emit(event, payload);
}
