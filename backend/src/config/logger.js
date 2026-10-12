import path from "node:path";
import fs from "node:fs";
import winston from "winston";
import DailyRotateFile from "winston-daily-rotate-file";
import { env } from "./env.js";

const { combine, timestamp, printf, colorize, errors, json, splat } = winston.format;

// Ensure the log directory exists (file transports are only used in production).
// This must NEVER crash boot: many production targets run on a read-only or
// non-writable filesystem (containers as non-root, serverless). If the directory
// can't be created/written, we fall back to console-only logging.
const logDir = path.resolve(process.cwd(), env.log.dir);
let fileLoggingEnabled = env.isProduction;
if (env.isProduction) {
  try {
    if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });
    fs.accessSync(logDir, fs.constants.W_OK);
  } catch (err) {
    fileLoggingEnabled = false;
    // eslint-disable-next-line no-console
    console.warn(`[logger] file logging disabled (${logDir} not writable: ${err.code}) — console only`);
  }
}

const devFormat = combine(
  colorize({ all: true }),
  timestamp({ format: "HH:mm:ss" }),
  errors({ stack: true }),
  splat(),
  printf(({ level, message, timestamp: ts, stack }) => {
    return `${ts} ${level}: ${stack || message}`;
  }),
);

const prodFormat = combine(timestamp(), errors({ stack: true }), splat(), json());

const transports = [
  new winston.transports.Console({
    format: env.isProduction ? prodFormat : devFormat,
  }),
];

if (fileLoggingEnabled) {
  transports.push(
    new DailyRotateFile({
      dirname: logDir,
      filename: "error-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      level: "error",
      maxFiles: "14d",
      format: prodFormat,
    }),
    new DailyRotateFile({
      dirname: logDir,
      filename: "combined-%DATE%.log",
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      format: prodFormat,
    }),
  );
}

export const logger = winston.createLogger({
  level: env.log.level,
  levels: winston.config.npm.levels,
  defaultMeta: { service: env.app.name },
  transports,
  exitOnError: false,
  silent: env.isTest,
});

// Stream adapter so Morgan writes HTTP access logs through Winston.
export const morganStream = {
  write: (message) => logger.http(message.trim()),
};

export default logger;
