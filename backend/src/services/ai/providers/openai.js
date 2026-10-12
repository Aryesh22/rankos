/**
 * OpenAI provider adapter. Activated when OPENAI_API_KEY is set. Chat Completions
 * REST API via global fetch. Model configurable via AI_MODEL.
 */
const API_URL = "https://api.openai.com/v1/chat/completions";

export const openaiProvider = {
  name: "openai",
  isRemote: true,
  isConfigured: () => Boolean(process.env.OPENAI_API_KEY),

  async generate({ system, prompt, maxTokens = 700, temperature = 0.6 }) {
    const model = process.env.AI_MODEL || "gpt-4o-mini";
    const res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model,
        max_tokens: maxTokens,
        temperature,
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 20000),
    });
    if (!res.ok) throw new Error(`openai ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.choices?.[0]?.message?.content || "").trim();
  },
};

export default openaiProvider;
