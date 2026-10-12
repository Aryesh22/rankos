import { anthropicProvider } from "./anthropic.js";
import { geminiProvider } from "./gemini.js";
import { openaiProvider } from "./openai.js";
import { localProvider } from "./local.js";

/**
 * Provider registry + selection. Resolution order:
 *   1. `AI_PROVIDER` env, if it names a configured provider.
 *   2. The first configured remote provider (Anthropic → Gemini → OpenAI).
 *   3. The local grounded fallback (always available).
 * Switching providers is therefore a pure env change — no code edits.
 */
const REMOTE = [anthropicProvider, geminiProvider, openaiProvider];
const REGISTRY = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
  local: localProvider,
};

export function getProvider() {
  const explicit = process.env.AI_PROVIDER;
  if (explicit && REGISTRY[explicit] && REGISTRY[explicit].isConfigured()) {
    return REGISTRY[explicit];
  }
  return REMOTE.find((p) => p.isConfigured()) || localProvider;
}

/** Describe the active provider (for the /ai/status probe + logs). */
export function providerInfo() {
  const p = getProvider();
  return {
    provider: p.name,
    remote: p.isRemote,
    model: p.isRemote ? process.env.AI_MODEL || "(provider default)" : null,
  };
}

export default { getProvider, providerInfo };
