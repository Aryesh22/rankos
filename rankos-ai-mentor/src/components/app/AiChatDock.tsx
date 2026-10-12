import { AnimatePresence, motion } from "motion/react";
import { ArrowUp, Sparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { mentorMessagesQueryOptions, sendMentorChat, type MentorMessage } from "@/services/mentor";

type Msg = MentorMessage;

const prompts = [
  "Why did my percentile drop?",
  "Plan my next 7 days",
  "Explain Cannizzaro reaction",
  "What should I revise tonight?",
];

export function AiChatDock() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [input, setInput] = useState("");

  // Load history the first time the dock is opened.
  const { data } = useQuery(mentorMessagesQueryOptions(open));
  useEffect(() => {
    if (data) {
      setMessages(data.data);
      setConversationId(data.conversationId);
    }
  }, [data]);

  const chat = useMutation({
    mutationFn: (text: string) => sendMentorChat({ conversationId, text }),
    onSuccess: (res) => {
      setConversationId(res.conversationId);
      setMessages((m) => [...m, res.reply]);
    },
  });

  const send = (text: string) => {
    if (!text.trim() || chat.isPending) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    chat.mutate(text);
  };

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="glass fixed bottom-24 right-4 z-50 flex h-[520px] w-[calc(100vw-2rem)] max-w-[400px] flex-col overflow-hidden rounded-2xl shadow-glow sm:right-6"
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand-gradient">
                  <Sparkles className="h-3.5 w-3.5 text-primary-foreground" />
                </span>
                <div>
                  <p className="text-[13px] font-semibold leading-tight">RankOS Mentor</p>
                  <p className="text-[11px] text-muted-foreground">Knows all 14 of your mocks</p>
                </div>
              </div>
              <button onClick={() => setOpen(false)} aria-label="Close AI mentor">
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                    m.role === "ai"
                      ? "bg-muted text-foreground"
                      : "ml-auto bg-primary text-primary-foreground",
                  )}
                >
                  {m.text}
                </div>
              ))}
            </div>

            <div className="border-t border-border p-3">
              <div className="mb-2 flex gap-1.5 overflow-x-auto pb-1">
                {prompts.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="shrink-0 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  >
                    {p}
                  </button>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  send(input);
                }}
                className="flex items-center gap-2 rounded-xl border border-border bg-background px-3 py-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask your mentor anything…"
                  className="flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground"
                />
                <Button type="submit" size="icon" className="h-7 w-7 rounded-lg">
                  <ArrowUp className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Open AI mentor"
        className="fixed bottom-6 right-4 z-50 grid h-13 w-13 place-items-center rounded-full bg-brand-gradient p-4 shadow-glow transition-transform hover:scale-105 active:scale-95 sm:right-6"
      >
        <Sparkles className="h-5 w-5 text-primary-foreground" />
      </button>
    </>
  );
}
