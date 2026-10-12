import { createFileRoute } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, ArrowRight, CheckCircle2, Sparkles, Target, Timer } from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { RingProgress } from "@/components/ui-kit/RingProgress";
import { Reveal } from "@/components/ui-kit/Motion";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  attemptResultQueryOptions,
  attemptScheduleRevision,
  attemptToMistakeBank,
  testHistoryQueryOptions,
} from "@/services/tests";

export const Route = createFileRoute("/app/results")({
  validateSearch: (search: Record<string, unknown>): { attempt?: string } => ({
    attempt: typeof search.attempt === "string" ? search.attempt : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Result Analysis · RankOS" },
      {
        name: "description",
        content:
          "Score, percentile, predicted AIR, question timeline, topic and time analysis with AI feedback.",
      },
      { property: "og:title", content: "Result Analysis · RankOS" },
      {
        property: "og:description",
        content: "Score, percentile, predicted AIR, topic and time analysis with AI feedback.",
      },
    ],
  }),
  component: ResultsPage,
});

const chartColors = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

const stateStyle: Record<string, string> = {
  correct: "bg-success/70",
  wrong: "bg-destructive/70",
  skipped: "bg-muted",
  review: "bg-warning/70",
};

const difficultyTone: Record<string, string> = {
  Easy: "bg-success",
  Medium: "bg-warning",
  Hard: "bg-destructive",
};

const weakFallback = [
  { topic: "3D Geometry", lost: 16, accuracy: 22 },
  { topic: "Definite Integration", lost: 14, accuracy: 38 },
  { topic: "Rotational Motion", lost: 12, accuracy: 44 },
  { topic: "Probability", lost: 9, accuracy: 41 },
];

const strongFallback = [
  { topic: "Organic Basics", gained: 24, accuracy: 94 },
  { topic: "Gravitation", gained: 20, accuracy: 91 },
  { topic: "Ionic Equilibrium", gained: 16, accuracy: 86 },
  { topic: "Current Electricity", gained: 16, accuracy: 84 },
];

function ResultsPage() {
  const { attempt } = Route.useSearch();
  const history = useQuery(testHistoryQueryOptions());
  const attemptId = attempt ?? history.data?.data?.[0]?.id;
  const { data: result } = useQuery(attemptResultQueryOptions(attemptId));

  const timeline = result?.timeline ?? [];
  const timePerQuestion = result?.timePerQuestion ?? [];
  const errorMix = result?.errorMix ?? [];
  const subjectBreakdown = result?.subjectBreakdown ?? [];
  const examDnaRadar = result?.radar ?? [];
  const difficultyStats = result?.difficultyStats ?? [];

  const weak = result?.weakAreas?.length
    ? result.weakAreas.map((topic, i) => ({
        topic,
        lost: weakFallback[i]?.lost ?? 0,
        accuracy: weakFallback[i]?.accuracy ?? 0,
      }))
    : weakFallback;
  const strong = result?.strongAreas?.length
    ? result.strongAreas.map((topic, i) => ({
        topic,
        gained: strongFallback[i]?.gained ?? 0,
        accuracy: strongFallback[i]?.accuracy ?? 0,
      }))
    : strongFallback;

  const sendToMistakeBank = useMutation({
    mutationFn: () => attemptToMistakeBank(attemptId as string),
    onSuccess: ({ created }) => {
      toast.success(`${created} mistakes added`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't send errors to Mistake Bank.");
    },
  });

  const scheduleRevision = useMutation({
    mutationFn: () => attemptScheduleRevision(attemptId as string, result?.weakAreas ?? []),
    onSuccess: ({ tasksCreated }) => {
      toast.success(`${tasksCreated} revision tasks scheduled`);
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't schedule revision.");
    },
  });

  if (!attemptId && !history.isLoading) {
    return (
      <div className="mx-auto max-w-[1200px]">
        <PageHeader
          eyebrow="Result analysis"
          title="No attempt selected"
          description="Finish a test or open one from your attempt history to see its full analysis."
        />
        <div className="surface p-10 text-center text-[13px] text-muted-foreground">
          Nothing to analyse yet — your most recent attempt will appear here once you complete a
          test.
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Full Syllabus Mock 14 · 12 July"
        title="Result analysis"
        description="90 questions · 180 minutes · attempted 78 · 1,42,904 students ranked."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => sendToMistakeBank.mutate()}
            disabled={!attemptId || sendToMistakeBank.isPending}
          >
            Send 12 errors to Mistake Bank <ArrowRight className="ml-1 h-3.5 w-3.5" />
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Score"
          value={result?.score ?? 0}
          suffix={`/${result?.maxScore ?? 360}`}
          tone="primary"
          delta={8}
        />
        <StatCard
          label="Percentile"
          value={result?.percentile ?? 0}
          decimals={1}
          tone="success"
          delta={1}
        />
        <StatCard
          label="Predicted AIR"
          value={result?.predictedAIR ?? 0}
          icon={Target}
          hint="Target 480"
          delta={12}
        />
        <StatCard
          label="Accuracy"
          value={result?.accuracy ?? 0}
          suffix="%"
          icon={CheckCircle2}
          tone="warning"
          delta={3}
        />
      </div>

      {/* AI feedback */}
      <Reveal className="mt-4">
        <div className="surface relative overflow-hidden p-6">
          <div
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-20 blur-3xl"
            style={{ backgroundImage: "var(--gradient-brand)" }}
          />
          <div className="relative flex flex-wrap items-start gap-6">
            <div className="flex-1 min-w-[280px]">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" /> AI feedback
              </span>
              <p className="mt-4 text-[14px] leading-relaxed">
                {result?.aiFeedback ?? (
                  <>
                    You gained 16 marks over Mock 13, entirely from Chemistry. Maths is unchanged for
                    the third attempt in a row and now accounts for{" "}
                    <span className="text-destructive">62% of your total loss</span>.
                  </>
                )}
              </p>
              <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
                Two behaviours are costing you more than any chapter: you spent 4+ minutes on 12
                questions and got 9 of them wrong, and you attempted 3D Geometry in the final 15
                minutes for the fourth mock running. Move it into the first pass and cap any single
                question at 3 minutes — that alone is worth an estimated +21 marks.
              </p>
            </div>
            <div className="flex gap-4">
              <RingProgress
                value={result?.accuracy ?? 0}
                label={`${result?.accuracy ?? 0}%`}
                sublabel="Accuracy"
                tone="primary"
              />
              <RingProgress
                value={87}
                label={result?.attempted ? `${result.attempted}/90` : "78/90"}
                sublabel="Attempted"
                tone="accent"
              />
            </div>
          </div>
        </div>
      </Reveal>

      {/* Question timeline */}
      <Reveal className="mt-4">
        <div className="surface p-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-[15px] font-semibold">Question timeline</h2>
            <div className="flex flex-wrap gap-3 text-[11.5px] text-muted-foreground">
              {[
                ["correct", "Correct"],
                ["wrong", "Wrong"],
                ["review", "Marked for review"],
                ["skipped", "Skipped"],
              ].map(([k, l]) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className={cn("h-2.5 w-2.5 rounded-sm", stateStyle[k])} />
                  {l}
                </span>
              ))}
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-[3px]">
            {timeline.map((t) => (
              <span
                key={t.index}
                title={`Q${t.index} · ${t.state} · ${t.seconds}s`}
                className={cn(
                  "h-6 flex-1 min-w-[8px] rounded-[3px] transition-transform hover:scale-y-125",
                  stateStyle[t.state],
                )}
                style={{ opacity: 0.45 + Math.min(0.55, t.seconds / 260) }}
              />
            ))}
          </div>
          <p className="mt-3 text-[11.5px] text-muted-foreground">
            Bar opacity encodes time spent. Your longest stretch was Q61–Q68 (18 minutes, 2
            correct).
          </p>
        </div>
      </Reveal>

      {/* Charts row */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">Time vs correctness</h2>
            <p className="mt-1 text-[12.5px] text-muted-foreground">
              Beyond two minutes, your odds invert — a hard stop is worth more than persistence.
            </p>
            <div className="mt-5 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={timePerQuestion} margin={{ left: -20, top: 6 }}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="bucket"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)", opacity: 0.4 }}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="correct" fill="var(--color-success)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="wrong" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">Error composition</h2>
            <div className="mt-2 h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={errorMix}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={52}
                    outerRadius={78}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {errorMix.map((_, i) => (
                      <Cell key={i} fill={chartColors[i % chartColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="space-y-1.5">
              {errorMix.map((e, i) => (
                <li key={e.key} className="flex items-center gap-2 text-[12.5px]">
                  <span
                    className="h-2.5 w-2.5 rounded-sm"
                    style={{ background: chartColors[i % chartColors.length] }}
                  />
                  <span className="flex-1 text-muted-foreground">{e.name}</span>
                  <span className="tabular-nums">{e.value}%</span>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>

      {/* Subject + difficulty + radar */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal>
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">Subject analysis</h2>
            <div className="mt-5 space-y-5">
              {subjectBreakdown.map((s) => (
                <div key={s.subject}>
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span>{s.subject}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {s.score}/{s.max} · {s.accuracy}%
                    </span>
                  </div>
                  <Progress value={(s.score / s.max) * 100} className="h-1.5" />
                  <p className="mt-1.5 text-[11.5px] text-muted-foreground">
                    {s.time} min spent · {Math.round(s.time / (s.max / 40))} min per 10 marks
                  </p>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">Difficulty analysis</h2>
            <div className="mt-5 space-y-4">
              {(difficultyStats.length
                ? difficultyStats.map((s) => ({
                    d: s.level,
                    attempted: s.total,
                    correct: s.correct,
                    tone: difficultyTone[s.level] ?? "bg-primary",
                  }))
                : [
                    { d: "Easy", attempted: 30, correct: 27, tone: "bg-success" },
                    { d: "Medium", attempted: 32, correct: 21, tone: "bg-warning" },
                    { d: "Hard", attempted: 16, correct: 7, tone: "bg-destructive" },
                  ]
              ).map((x) => (
                <div key={x.d} className="rounded-xl border border-border p-4">
                  <div className="flex items-baseline justify-between">
                    <p className="text-[13px] font-medium">{x.d}</p>
                    <p className="text-[12px] tabular-nums text-muted-foreground">
                      {x.correct}/{x.attempted} correct
                    </p>
                  </div>
                  <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full transition-all duration-1000", x.tone)}
                      style={{ width: `${x.attempted ? (x.correct / x.attempted) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-[12px] text-muted-foreground">
              <Timer className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warning" />
              You solved easy questions 22% slower than the top 100 — that's where the missing 9
              minutes for Hard questions went.
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">You vs top 100</h2>
            <div className="mt-2 h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={examDnaRadar} outerRadius="72%">
                  <PolarGrid stroke="var(--color-border)" />
                  <PolarAngleAxis
                    dataKey="trait"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                  />
                  <Radar
                    dataKey="value"
                    stroke="var(--color-primary)"
                    fill="var(--color-primary)"
                    fillOpacity={0.28}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Weak / strong */}
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Reveal>
          <div className="surface h-full p-5">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <h2 className="text-[15px] font-semibold">Weak areas</h2>
            </div>
            <ul className="mt-4 space-y-2">
              {weak.map((w) => (
                <li
                  key={w.topic}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-[13px]"
                >
                  <span>{w.topic}</span>
                  <span className="text-[12px] text-destructive tabular-nums">
                    −{w.lost} marks · {w.accuracy}%
                  </span>
                </li>
              ))}
            </ul>
            <Button
              size="sm"
              className="mt-4 w-full rounded-xl"
              onClick={() => scheduleRevision.mutate()}
              disabled={!attemptId || scheduleRevision.isPending}
            >
              Schedule suggested revision
            </Button>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="surface h-full p-5">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-success" />
              <h2 className="text-[15px] font-semibold">Strong areas</h2>
            </div>
            <ul className="mt-4 space-y-2">
              {strong.map((s) => (
                <li
                  key={s.topic}
                  className="flex items-center justify-between rounded-xl border border-border px-4 py-3 text-[13px]"
                >
                  <span>{s.topic}</span>
                  <span className="text-[12px] text-success tabular-nums">
                    +{s.gained} marks · {s.accuracy}%
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 rounded-xl bg-muted/60 p-3 text-[12px] text-muted-foreground">
              Maintenance only: 20 minutes of spaced revision a week keeps these above 85%.
            </p>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
