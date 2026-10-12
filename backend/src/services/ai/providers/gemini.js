/**
 * Google Gemini provider adapter. Activated when GEMINI_API_KEY is set.
 * generateContent REST API via global fetch. Model configurable via AI_MODEL.
 */
export const geminiProvider = {
  name: "gemini",
  isRemote: true,
  isConfigured: () => Boolean(process.env.GEMINI_API_KEY),

  async generate({ system, prompt, maxTokens = 700, temperature = 0.6 }) {
    const model = process.env.AI_MODEL || "gemini-1.5-flash";
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GEMINI_API_KEY}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: maxTokens, temperature },
      }),
      signal: AbortSignal.timeout(Number(process.env.AI_TIMEOUT_MS) || 20000),
    });
    if (!res.ok) throw new Error(`gemini ${res.status}: ${await res.text()}`);
    const data = await res.json();
    return (data.candidates?.[0]?.content?.parts || [])
      .map((p) => p.text || "")
      .join("")
      .trim();
  },
};

export default geminiProvider;
