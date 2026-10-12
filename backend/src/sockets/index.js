import { Server as SocketIOServer } from "socket.io";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Socket.IO bootstrap (INFRASTRUCTURE only). Attaches a Socket.IO server to the
 * existing HTTP server and logs connections. No application events/namespaces
 * are implemented in the foundation — features add handlers here later.
 */

let io = null;

export function initSockets(httpServer) {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.cors.origin,
      credentials: env.cors.credentials,
    },
    path: "/socket.io",
  });

  io.on("connection", (socket) => {
    logger.debug(`[socket] connected: ${socket.id}`);
    socket.on("disconnect", (reason) => {
      logger.debug(`[socket] disconnected: ${socket.id} (${reason})`);
    });
  });

  logger.info("[socket] Socket.IO initialised");
  return io;
}

export function getIO() {
  return io;
}

export async function closeSockets() {
  if (io) {
    await io.close();
    io = null;
    logger.info("[socket] Socket.IO closed");
  }
}

export default initSockets;
