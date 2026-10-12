import nodemailer from "nodemailer";
import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * Foundation email transport (Nodemailer). This is INFRASTRUCTURE only — it
 * exposes a generic `sendMail` wrapper. Feature-specific emails (OTP, welcome,
 * digests) are NOT implemented here; they belong with their features.
 *
 * If SMTP isn't configured, `sendMail` becomes a logged no-op so the app runs.
 */

let transporter = null;

export function getTransporter() {
  if (!env.smtp.isConfigured) return null;
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: env.smtp.host,
    port: env.smtp.port,
    secure: env.smtp.secure, // true for 465, false for other ports
    auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.password } : undefined,
  });

  logger.info(`[email] transport ready → ${env.smtp.host}:${env.smtp.port}`);
  return transporter;
}

export async function verifyEmailTransport() {
  const t = getTransporter();
  if (!t) {
    logger.warn("[email] SMTP not configured — emails will be skipped");
    return false;
  }
  try {
    await t.verify();
    logger.info("[email] SMTP verified");
    return true;
  } catch (err) {
    logger.warn(`[email] SMTP verify failed: ${err.message}`);
    return false;
  }
}

/**
 * Generic send. Returns null (and logs) when SMTP is not configured.
 * @param {{to:string, subject:string, html?:string, text?:string, from?:string}} message
 */
export async function sendMail(message) {
  const t = getTransporter();
  if (!t) {
    logger.warn(`[email] skipped (no SMTP) → ${message.subject} to ${message.to}`);
    return null;
  }
  const info = await t.sendMail({ from: env.smtp.from, ...message });
  logger.info(`[email] sent ${info.messageId} → ${message.to}`);
  return info;
}

export default { getTransporter, verifyEmailTransport, sendMail };
