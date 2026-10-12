import { env } from "../config/env.js";
import { logger } from "../config/logger.js";

/**
 * SMS transport. Production-ready shape with a DEV-STUB fallback: when no SMS
 * provider is configured (the default in this build), messages are logged
 * instead of sent, and OTP delivery still "works" for local development — the
 * code is printed to the server log. Wire a real provider (Twilio, MSG91, …)
 * by implementing `sendViaProvider` and setting the provider env vars.
 */
function isProviderConfigured() {
  // e.g. Twilio: TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN + TWILIO_FROM
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN);
}

async function sendViaProvider(to, body) {
  // Placeholder for a real integration. Kept out of the default path so the
  // app runs without credentials. Implement when TWILIO_* / MSG91_* is set.
  throw new Error("SMS provider configured but sendViaProvider() is not implemented");
}

/**
 * Send an SMS. Returns { delivered, channel }.
 * @param {{ to: string, body: string }} message
 */
export async function sendSms({ to, body }) {
  if (!isProviderConfigured()) {
    // DEV STUB — never do this in production; codes must go over SMS only.
    logger.warn(`[sms:stub] → ${to}: ${body}`);
    return { delivered: false, channel: "stub" };
  }
  await sendViaProvider(to, body);
  logger.info(`[sms] sent → ${to}`);
  return { delivered: true, channel: "sms" };
}

export default { sendSms };
