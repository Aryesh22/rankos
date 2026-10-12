/**
 * Local fallback "provider". Not a real LLM: it signals the AI facade to use the
 * per-feature deterministic, DATA-GROUNDED composer instead. This is what makes
 * the app run with zero API keys while never returning a dummy/lorem response —
 * every fallback is built from the student's actual RankOS data.
 */
export const localProvider = {
  name: "local",
  isRemote: false,
  isConfigured: () => true,
};

export default localProvider;
