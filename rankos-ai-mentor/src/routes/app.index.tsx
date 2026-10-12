import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpenCheck,
  Brain,
  CalendarClock,
  CheckCircle2,
  Circle,
  Clock,
  Flame,
  Percent,
  Sparkles,
  Target,
  Trophy,
  Zap,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StudyHeatmap } from "@/components/ui-kit/StudyHeatmap";
import { RingProgress } from "@/components/ui-kit/RingProgress";
import { Reveal } from "@/components/ui-kit/Motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { dashboardQueryOptions } from "@/services/dashboard";
import { heatmapQueryOptions, recommendationsQueryOptions } from "@/services/analytics";
import { updateTask } from "@/services/tasks";
import type { StudyTask } from "@/types";

export const Route = createFileRoute("/app/")({
  head: () => ({
    meta: [
      { title: "Dashboard · RankOS" },
      {
        name: "description",
        content: "Today's plan, streak, weekly goals and AI mentor insights in one workspace.",
      },
      { property: "og:title", content: "Dashboard · RankOS" },
      {
        property: "og:description",
        content: "Today's plan, streak, weekly goals and AI mentor insights in one workspace.",
      },
    ],
  }),
  component: Dashboard,
});

const quickActions = [
  { label: "Custom test", icon: Zap, to: "/app/tests" },
  { label: "Revise mistakes", icon: Target, to: "/app/mistakes" },
  { label: "Exam DNA", icon: Brain, to: "/app/exam-dna" },
  { label: "Plan my week", icon: CalendarClock, to: "/app/planner" },
] as const;

function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading } = useQuery(dashboardQueryOptions());
  const heatmap = useQuery(heatmapQueryOptions());
  const recommendations = useQuery(recommendationsQueryOptions());
  const recs = recommendations.data;

  const [tasks, setTasks] = useState<StudyTask[]>([]);
  useEffect(() => {
    if (data?.todayPlan) setTasks(data.todayPlan);
  }, [data]);

  const toggleTask = useMutation({
    mutationFn: (task: StudyTask) => updateTask(task.id, { done: !task.done }),
  });

  const student = data?.student;
  const weeklyGoals = data?.weeklyGoals ?? [];
  const scoreTrend = data?.scoreTrend ?? [];
  const upcomingTests = data?.upcomingTests ?? [];
  const revisionQueue = data?.revisionQueue ?? [];

  const doneCount = tasks.filter((t) => t.done).length;
  const planPct = tasks.length ? Math.round((doneCount / tasks.length) * 100) : 0;
  const firstName = (user?.name ?? "there").split(" ")[0];

  const onToggle = (task: StudyTask) => {
    setTasks((prev) => prev.map((p) => (p.id === task.id ? { ...p, done: !p.done } : p)));
    toggleTask.mutate(task);
  };

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Tuesday, 28 July"
        title={`Good evening, ${firstName}`}
        description="You're 3 tasks away from a perfect day. Maths is still the gap between you and AIR 480."
        actions={
          <Button asChild variant="outline" size="sm" className="rounded-full">
            <Link to="/app/results">
              View Mock 14 analysis <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Current streak"
          value={student?.streak ?? 0}
          suffix=" days"
          icon={Flame}
          tone="warning"
          hint={`Longest ${student?.longestStreak ?? student?.streak ?? 0} days`}
        />
        <StatCard
          label="Predicted AIR"
          value={student?.currentPredictedRank ?? 0}
          icon={Trophy}
          tone="primary"
          delta={12}
          hint={`Target ${student?.targetRank ?? 0}`}
        />
        <StatCard
          label="Accuracy"
          value={student?.accuracy ?? 0}
          decimals={1}
          suffix="%"
          icon={Percent}
          tone="success"
          delta={4}
          hint="Across last 6 mocks"
        />
        <StatCard
          label="Hours this week"
          value={student?.hoursThisWeek ?? 0}
          decimals={1}
          suffix="h"
          icon={Clock}
          delta={-6}
          hint="Target 45h"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* Today's plan */}
        <Reveal className="lg:col-span-2">
          <div className="surface h-full p-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-[15px] font-semibold">Today's study plan</h2>
                <p className="mt-0.5 text-[13px] text-muted-foreground">
                  {doneCount} of {tasks.length} complete · rebuilt at 05:40 by your mentor
                </p>
              </div>
              <RingProgress value={planPct} size={58} stroke={6} sublabel="" />
            </div>

            <ul className="mt-5 space-y-2">
              {isLoading &&
                tasks.length === 0 &&
                Array.from({ length: 4 }).map((_, i) => (
                  <li key={i}>
                    <Skeleton className="h-[58px] w-full rounded-xl" />
                  </li>
                ))}
              {!isLoading && tasks.length === 0 && (
                <li className="rounded-xl border border-border px-3.5 py-3 text-[13px] text-muted-foreground">
                  No tasks planned yet — your mentor will build tomorrow's plan overnight.
                </li>
              )}
              {tasks.map((t) => (
                <li key={t.id}>
                  <button
                    onClick={() => onToggle(t)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-xl border border-border px-3.5 py-3 text-left transition-colors hover:border-primary/40",
                      t.done && "opacity-55",
                    )}
                  >
                    {t.done ? (
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                    ) : (
                      <Circle className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "truncate text-[13.5px] font-medium",
                          t.done && "line-through",
                        )}
                      >
                        {t.title}
                      </p>
                      <p className="mt-0.5 text-[12px] text-muted-foreground">
                        {t.time} · {t.subject} · {t.minutes} min
                      </p>
                    </div>
                    <Badge variant="secondary" className="shrink-0 rounded-full text-[10px]">
                      {t.type}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        {/* AI mentor card */}
        <Reveal delay={0.06}>
          <div className="surface relative h-full overflow-hidden p-5">
            <div
              className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-25 blur-3xl"
              style={{ backgroundImage: "var(--gradient-brand)" }}
            />
            <div className="relative">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" /> AI mentor
              </span>
              <h2 className="mt-4 text-[15px] font-semibold">Tonight's highest-value move</h2>
              <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
                Your Maths accuracy drops from 68% to 41% after minute 120. That's stamina, not
                knowledge. Attempt Part Test 07 in a single unbroken sitting and I'll measure the
                decay curve again.
              </p>
              <div className="mt-4 space-y-2.5">
                {[
                  { l: "Definite Integration", v: 55 },
                  { l: "3D Geometry", v: 34 },
                  { l: "Probability", v: 42 },
                ].map((r) => (
                  <div key={r.l}>
                    <div className="mb-1 flex justify-between text-[12px]">
                      <span className="text-muted-foreground">{r.l}</span>
                      <span className="tabular-nums">{r.v}%</span>
                    </div>
                    <Progress value={r.v} className="h-1.5" />
                  </div>
                ))}
              </div>
              <div className="mt-5 border-t border-border pt-4">
                <h3 className="text-[13px] font-medium">Recommended focus</h3>
                {recommendations.isLoading ? (
                  <div className="mt-3 space-y-2">
                    <Skeleton className="h-3 w-3/4 rounded" />
                    <Skeleton className="h-3 w-full rounded" />
                    <Skeleton className="h-3 w-5/6 rounded" />
                  </div>
                ) : recommendations.isError || !recs || recs.items.length === 0 ? (
                  <p className="mt-2 text-[12.5px] text-muted-foreground">
                    No focus recommendations yet — keep attempting tests and your mentor will
                    surface priorities here.
                  </p>
                ) : (
                  <>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-muted-foreground">
                      {recs.headline}
                    </p>
                    <ul className="mt-3 space-y-1.5 text-[12.5px] text-muted-foreground">
                      {recs.items.map((item, i) => (
                        <li key={i} className="flex gap-2">
                          <span className="mt-0.5 text-primary">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>

              <Button asChild size="sm" className="mt-5 w-full rounded-xl">
                <Link to="/app/planner">Apply mentor's plan</Link>
              </Button>
            </div>
          </div>
        </Reveal>
      </div>

      {/* Learning graph + goals */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <div className="surface h-full p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Learning graph</h2>
              <span className="text-[12px] text-muted-foreground">
                Score vs topper · last 6 mocks
              </span>
            </div>
            <div className="mt-5 h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={scoreTrend} margin={{ left: -18, right: 6, top: 6 }}>
                  <defs>
                    <linearGradient id="gScore" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.45} />
                      <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="test"
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
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 12,
                      fontSize: 12,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="topper"
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 4"
                    fill="none"
                    strokeWidth={1.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="var(--color-primary)"
                    strokeWidth={2.5}
                    fill="url(#gScore)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">Weekly goals</h2>
            <div className="mt-5 space-y-5">
              {weeklyGoals.map((g) => {
                const pct = Math.min(100, Math.round((g.current / g.target) * 100));
                return (
                  <div key={g.label}>
                    <div className="mb-1.5 flex items-baseline justify-between text-[13px]">
                      <span>{g.label}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {g.current}
                        {g.unit} / {g.target}
                        {g.unit}
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                );
              })}
            </div>
          </div>
        </Reveal>
      </div>

      {/* Heatmap + revision queue + tests */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <div className="surface h-full p-5">
            <div className="flex items-baseline justify-between">
              <h2 className="text-[15px] font-semibold">Study heatmap</h2>
              <span className="text-[12px] text-muted-foreground">
                {student?.streak ?? 0}-day streak · 1,284 hours logged
              </span>
            </div>
            <div className="mt-5">
              <StudyHeatmap data={heatmap.data?.data ?? []} />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="surface h-full p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold">Revision queue</h2>
              <Badge variant="secondary" className="rounded-full text-[10px]">
                {revisionQueue.length} due
              </Badge>
            </div>
            <ul className="mt-4 space-y-2.5">
              {revisionQueue.slice(0, 4).map((m) => (
                <li key={m.id} className="rounded-xl border border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[12.5px] font-medium">{m.chapter ?? m.subject}</p>
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                        m.priority === "High"
                          ? "bg-destructive/12 text-destructive"
                          : "bg-warning/12 text-warning",
                      )}
                    >
                      {m.priority}
                    </span>
                  </div>
                  <p className="mt-1 text-[11.5px] text-muted-foreground">
                    {m.category ?? m.subject} · repeated {m.timesRepeated ?? 0}×
                  </p>
                </li>
              ))}
              {revisionQueue.length === 0 && (
                <li className="rounded-xl border border-border p-3 text-[11.5px] text-muted-foreground">
                  Nothing due — your revision queue is clear.
                </li>
              )}
            </ul>
            <Button asChild variant="ghost" size="sm" className="mt-3 w-full rounded-xl">
              <Link to="/app/mistakes">Open Mistake Bank</Link>
            </Button>
          </div>
        </Reveal>
      </div>

      {/* Upcoming tests + quick actions */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">Upcoming tests</h2>
            <ul className="mt-4 space-y-2.5">
              {upcomingTests.map((t) => (
                <li
                  key={t.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-border p-3.5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-muted">
                    <BookOpenCheck className="h-4 w-4 text-primary" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium">{t.title}</p>
                    <p className="mt-0.5 text-[12px] text-muted-foreground">
                      {t.scheduledFor} · {t.questions} Q · {t.durationMin} min · {t.difficulty}
                    </p>
                  </div>
                  <Button asChild size="sm" variant="outline" className="rounded-full">
                    <Link to="/test/$testId" params={{ testId: t.id }}>
                      Start
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="surface h-full p-5">
            <h2 className="text-[15px] font-semibold">Quick actions</h2>
            <div className="mt-4 grid grid-cols-2 gap-2.5">
              {quickActions.map((a) => (
                <Link
                  key={a.label}
                  to={a.to}
                  className="hover-lift flex flex-col gap-2 rounded-xl border border-border p-4 text-[12.5px] font-medium"
                >
                  <a.icon className="h-4 w-4 text-primary" strokeWidth={1.75} />
                  {a.label}
                </Link>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
