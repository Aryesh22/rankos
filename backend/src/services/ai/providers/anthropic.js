/**
 * Anthropic (Claude) provider adapter. Activated when ANTHROPIC_API_KEY is set.
 * Uses the Messages REST API via global fetch (no SDK dependency). Model is
 * configurable via AI_MODEL; defaults to a fast, low-cost Claude model.
 */
const API_URL = "https://api.anthropic.com/v1/messages";

export const anthropicProvider = {
  name: "anthropic",
  isRemote: true,
  isConfigured: () => Boolean(process.env.ANTHROPIC_API_KEY),

  async generate({ system, prompt, maxTokens = 700, temperature = 0.6 }) {
    const model = process.env.AI_MODEL || "claude-haiku-4-5-20251001";
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 20000),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.content || []).map((c) => c.text || "").join("").trim();
  },
};

export default anthropicProvider;
