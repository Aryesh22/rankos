import mongoose from "mongoose";
import { env } from "./env.js";
import { logger } from "./logger.js";

// Fail fast on bad queries rather than buffering them indefinitely.
mongoose.set("strictQuery", true);

let isConnected = false;

/**
 * Connect to MongoDB. Retries with linear backoff so a cold Atlas cluster or a
 * container still starting up doesn't kill the process on boot.
 */
export async function connectDatabase({ retries = 5, delayMs = 3000 } = {}) {
  if (isConnected) return mongoose.connection;

  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      await mongoose.connect(env.mongo.uri, {
        serverSelectionTimeoutMS: 10000,
        maxPoolSize: 20,
        minPoolSize: 2,
      });
      isConnected = true;
      logger.info(`[db] MongoDB connected → ${maskUri(env.mongo.uri)}`);
      break;
    } catch (err) {
      logger.error(`[db] Connection attempt ${attempt}/${retries} failed: ${err.message}`);
      if (attempt === retries) throw err;
      await sleep(delayMs);
    }
  }

  mongoose.connection.on("disconnected", () => {
    isConnected = false;
    logger.warn("[db] MongoDB disconnected");
  });
  mongoose.connection.on("reconnected", () => {
    isConnected = true;
    logger.info("[db] MongoDB reconnected");
  });
  mongoose.connection.on("error", (err) => {
    logger.error(`[db] MongoDB error: ${err.message}`);
  });

  return mongoose.connection;
}

export async function disconnectDatabase() {
  if (!isConnected) return;
  await mongoose.connection.close();
  isConnected = false;
  logger.info("[db] MongoDB connection closed");
}

export function getDatabaseState() {
  // 0 = disconnected, 1 = connected, 2 = connecting, 3 = disconnecting
  const states = ["disconnected", "connected", "connecting", "disconnecting"];
  return states[mongoose.connection.readyState] ?? "unknown";
}

function maskUri(uri) {
  return uri.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default connectDatabase;
