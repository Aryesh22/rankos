import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, Calculator, Flag, Maximize2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  saveAttemptResponse,
  startAttempt,
  submitAttempt,
  testMetaQueryOptions,
  type AttemptQuestion,
  type SaveResponseInput,
} from "@/services/tests";
import { requireAuth } from "@/lib/auth";

export const Route = createFileRoute("/test/$testId")({
  beforeLoad: requireAuth,
  head: () => ({
    meta: [
      { title: "Test in progress · RankOS" },
      {
        name: "description",
        content: "Fullscreen exam simulator with palette, timer and calculator.",
      },
      { property: "og:title", content: "Test in progress · RankOS" },
      {
        property: "og:description",
        content: "Fullscreen exam simulator with palette, timer and calculator.",
      },
    ],
  }),
  component: TestInterface,
});

type Status = "unseen" | "answered" | "review" | "skipped";

function TestInterface() {
  const { testId } = Route.useParams();
  const meta = useQuery(testMetaQueryOptions(testId));

  const [questions, setQuestions] = useState<AttemptQuestion[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [status, setStatus] = useState<Record<number, Status>>({});
  const [marked, setMarked] = useState<Record<number, boolean>>({});
  const [durationSec, setDurationSec] = useState(120 * 60);
  const [seconds, setSeconds] = useState(120 * 60);
  const [calc, setCalc] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const startedRef = useRef(false);

  // Begin the attempt once; loads questions (without answers) + duration.
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startAttempt(testId)
      .then((res) => {
        setAttemptId(res.attemptId);
        setQuestions(res.questions);
        setDurationSec(res.durationSec);
        setSeconds(res.durationSec);
      })
      .catch(() => {
        startedRef.current = false;
      });
  }, [testId]);

  const q = questions[idx];

  const autosave = (input: SaveResponseInput) => {
    if (!attemptId) return;
    void saveAttemptResponse(attemptId, input).catch(() => {});
  };

  const pick = (opt: number) => {
    if (!q) return;
    setAnswers((a) => ({ ...a, [q.id]: opt }));
    setStatus((s) => ({ ...s, [q.id]: "answered" }));
    autosave({ questionId: q.id, selectedIndex: opt, status: "answered", marked: marked[q.id] ?? false });
  };

  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => (s > 0 ? s - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") setIdx((i) => Math.min(questions.length - 1, i + 1));
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (["1", "2", "3", "4"].includes(e.key)) pick(Number(e.key) - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const submit = () => {
    if (!attemptId || submitting) return;
    setSubmitting(true);
    submitAttempt(attemptId, Math.max(0, durationSec - seconds))
      .then((res) => navigate({ to: "/app/results", search: { attempt: res.attemptId } }))
      .catch(() => navigate({ to: "/app/results", search: { attempt: attemptId } }));
  };

  const hh = String(Math.floor(seconds / 3600)).padStart(2, "0");
  const mm = String(Math.floor((seconds % 3600) / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");
  const answered = Object.keys(answers).length;

  const paletteTone = (id: number) => {
    if (marked[id]) return "bg-warning/80 text-warning-foreground";
    if (status[id] === "answered") return "bg-success/80 text-success-foreground";
    if (status[id] === "skipped") return "bg-destructive/70 text-destructive-foreground";
    return "bg-muted text-muted-foreground";
  };

  if (!q) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6">
        <Skeleton className="h-8 w-64 rounded-lg" />
        <Skeleton className="h-[320px] w-full max-w-3xl rounded-xl" />
        <p className="text-[13px] text-muted-foreground">Preparing your test…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="glass sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <div>
          <p className="text-[13.5px] font-semibold">{meta.data?.title ?? "Test in progress"}</p>
          <p className="text-[11.5px] text-muted-foreground">
            {answered}/{questions.length} answered · {q.subject} · {q.difficulty}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="rounded-full border border-border px-3 py-1.5 text-[13px] font-medium tabular-nums">
            {hh}:{mm}:{ss}
          </span>
          <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => setCalc((c) => !c)}
            aria-label="Calculator"
          >
            <Calculator className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="hidden rounded-full sm:inline-flex"
            aria-label="Fullscreen"
            onClick={() => document.documentElement.requestFullscreen?.()}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
          <Button size="sm" className="rounded-full" onClick={submit} disabled={submitting}>
            Submit
          </Button>
          <Button
            asChild
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Exit test"
          >
            <Link to="/app">
              <X className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </header>

      <Progress value={(answered / questions.length) * 100} className="h-1 rounded-none" />

      <div className="grid flex-1 gap-6 p-4 sm:p-6 lg:grid-cols-[1fr_268px]">
        <div className="mx-auto w-full max-w-3xl">
          <p className="text-[12px] uppercase tracking-wide text-muted-foreground">
            Question {idx + 1} of {questions.length}
          </p>
          <h1 className="mt-3 text-[19px] font-medium leading-relaxed sm:text-[21px]">{q.text}</h1>

          <div className="mt-7 space-y-2.5">
            {q.options.map((o, i) => (
              <button
                key={o}
                onClick={() => pick(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left text-[14px] transition-colors",
                  answers[q.id] === i
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40",
                )}
              >
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md border border-border text-[11px]">
                  {String.fromCharCode(65 + i)}
                </span>
                {o}
              </button>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full"
              onClick={() => {
                const next = !marked[q.id];
                setMarked((m) => ({ ...m, [q.id]: next }));
                autosave({ questionId: q.id, marked: next, status: status[q.id] ?? "review" });
              }}
            >
              <Flag className="mr-1.5 h-3.5 w-3.5" /> Mark for review
            </Button>
            <Button variant="outline" size="sm" className="rounded-full">
              <Bookmark className="mr-1.5 h-3.5 w-3.5" /> Bookmark
            </Button>
            <div className="ml-auto flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
              >
                Previous
              </Button>
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  const nextStatus = status[q.id] ?? "skipped";
                  setStatus((s) => ({ ...s, [q.id]: nextStatus }));
                  autosave({ questionId: q.id, status: nextStatus });
                  setIdx((i) => Math.min(questions.length - 1, i + 1));
                }}
              >
                Save & next
              </Button>
            </div>
          </div>

          <p className="mt-5 text-[11.5px] text-muted-foreground">
            Keyboard: ← → to move, 1–4 to answer.
          </p>
        </div>

        <aside className="surface h-fit p-4 lg:sticky lg:top-24">
          <p className="text-[13px] font-semibold">Question palette</p>
          <div className="mt-4 grid grid-cols-6 gap-1.5 lg:grid-cols-5">
            {questions.map((item, i) => (
              <button
                key={item.id}
                onClick={() => setIdx(i)}
                className={cn(
                  "grid h-8 w-full place-items-center rounded-lg text-[11.5px] font-medium transition-transform hover:scale-105",
                  paletteTone(item.id),
                  idx === i && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                )}
              >
                {item.id}
              </button>
            ))}
          </div>
          <div className="mt-4 space-y-1.5 text-[11.5px] text-muted-foreground">
            {[
              ["bg-success/80", "Answered"],
              ["bg-warning/80", "Marked for review"],
              ["bg-destructive/70", "Skipped"],
              ["bg-muted", "Not visited"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-2">
                <span className={cn("h-2.5 w-2.5 rounded-sm", c)} />
                {l}
              </span>
            ))}
          </div>
        </aside>
      </div>

      {calc && (
        <div className="glass fixed bottom-6 right-6 z-40 w-[240px] rounded-2xl p-3 shadow-glow">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[12px] font-medium">Calculator</p>
            <button onClick={() => setCalc(false)} aria-label="Close calculator">
              <X className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </div>
          <div className="rounded-lg border border-border px-3 py-2 text-right text-lg tabular-nums">
            0
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            {["7", "8", "9", "÷", "4", "5", "6", "×", "1", "2", "3", "−", "0", ".", "=", "+"].map(
              (k) => (
                <button
                  key={k}
                  className="rounded-lg border border-border py-2 text-[13px] transition-colors hover:bg-muted"
                >
                  {k}
                </button>
              ),
            )}
          </div>
        </div>
      )}
    </div>
  );
}
