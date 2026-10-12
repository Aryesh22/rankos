import mongoose from "mongoose";
import { logger } from "../config/logger.js";

/**
 * Run a unit of work inside a MongoDB transaction when the deployment supports
 * it (replica set / mongos), otherwise fall back to running WITHOUT a session.
 *
 * Why the fallback: multi-document transactions require a replica set. Local
 * single-node `mongod` (and the default docker-compose here) is standalone, so
 * a hard transaction dependency would break local development. We detect
 * support ONCE (cached) — never by letting a real write half-execute — so the
 * fallback is safe and idempotent.
 *
 * @template T
 * @param {(session: import("mongoose").ClientSession | null) => Promise<T>} work
 * @returns {Promise<T>}
 */
export async function withTransaction(work) {
  if (await supportsTransactions()) {
    const session = await mongoose.connection.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await work(session);
      });
      return result;
    } finally {
      await session.endSession();
    }
  }
  // Standalone dev fallback: no atomicity, writes run in order. Repositories are
  // written so the most-critical write (user creation) happens first.
  return work(null);
}

let transactionsSupported = null;

/** Probe (and cache) whether the connected topology supports transactions. */
async function supportsTransactions() {
  if (transactionsSupported !== null) return transactionsSupported;
  try {
    const info = await mongoose.connection.db.admin().command({ hello: 1 });
    // Replica set members expose `setName`; mongos exposes msg === "isdbgrid".
    transactionsSupported = Boolean(info.setName || info.msg === "isdbgrid");
    if (!transactionsSupported) {
      logger.warn("[db] standalone MongoDB — transactions disabled (dev fallback in use)");
    }
  } catch {
    transactionsSupported = false;
  }
  return transactionsSupported;
}

export default withTransaction;
