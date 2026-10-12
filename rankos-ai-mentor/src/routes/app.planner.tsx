import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Pause, Play, RotateCcw, Sparkles, Wand2 } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Reveal } from "@/components/ui-kit/Motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { tasksQueryOptions } from "@/services/tasks";
import { dashboardQueryOptions } from "@/services/dashboard";
import {
  generatePlan,
  logPomodoro,
  monthPlanQueryOptions,
  weekPlanQueryOptions,
  type PlanScope,
} from "@/services/plans";

export const Route = createFileRoute("/app/planner")({
  head: () => ({
    meta: [
      { title: "AI Study Planner · RankOS" },
      {
        name: "description",
        content:
          "A daily, weekly and monthly plan rewritten every night from your own attempt data.",
      },
      { property: "og:title", content: "AI Study Planner · RankOS" },
      {
        property: "og:description",
        content: "Daily, weekly and monthly plans with spaced revision and a pomodoro timer.",
      },
    ],
  }),
  component: PlannerPage,
});

const week = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const FOCUS_MINUTES = 25;

function Pomodoro() {
  const [seconds, setSeconds] = useState(FOCUS_MINUTES * 60);
  const [running, setRunning] = useState(false);
  const logged = useRef(false);

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => {
      setSeconds((s) => {
        if (s <= 1) {
          if (!logged.current) {
            logged.current = true;
            // Fire-and-forget: a completed focus session is recorded server-side.
            logPomodoro({ focusMinutes: FOCUS_MINUTES, taskId: null, completed: true }).catch(
              () => {},
            );
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [running]);

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="surface p-5 text-center">
      <p className="text-[13px] font-medium">Focus session</p>
      <p className="mt-4 text-5xl font-semibold tabular-nums tracking-tight">
        {mm}:{ss}
      </p>
      <Progress value={100 - (seconds / (FOCUS_MINUTES * 60)) * 100} className="mt-4 h-1.5" />
      <div className="mt-5 flex justify-center gap-2">
        <Button size="sm" className="rounded-full" onClick={() => setRunning((r) => !r)}>
          {running ? (
            <Pause className="mr-1.5 h-3.5 w-3.5" />
          ) : (
            <Play className="mr-1.5 h-3.5 w-3.5" />
          )}
          {running ? "Pause" : "Start"}
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="rounded-full"
          onClick={() => {
            setRunning(false);
            logged.current = false;
            setSeconds(FOCUS_MINUTES * 60);
          }}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
        </Button>
      </div>
      <p className="mt-4 text-[11.5px] text-muted-foreground">
        4 sessions today · your best focus window is 06:00–08:30
      </p>
    </div>
  );
}

function PlannerPage() {
  const [tab, setTab] = useState("today");
  const queryClient = useQueryClient();

  const tasksQuery = useQuery(tasksQueryOptions("today"));
  const todayPlan = tasksQuery.data?.data ?? [];
  const weeklyGoals = useQuery(dashboardQueryOptions()).data?.weeklyGoals ?? [];

  const weekQuery = useQuery(weekPlanQueryOptions("week"));
  const monthQuery = useQuery(monthPlanQueryOptions());
  const weekDays = weekQuery.data?.days ?? [];
  const monthDays = monthQuery.data?.days ?? [];

  // The generate button targets whichever scope is currently in view.
  const scope: PlanScope = tab === "month" ? "month" : "week";
  const rebuild = useMutation({
    mutationFn: () => generatePlan({ scope }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["plans", scope] });
      toast.success("Your plan has been rebuilt.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't rebuild the plan.");
    },
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="AI planner"
        title="Your plan, rewritten nightly"
        description="Every task below exists because of something measurable in your last attempt."
        actions={
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            onClick={() => rebuild.mutate()}
            disabled={rebuild.isPending}
          >
            <Wand2 className="mr-1.5 h-3.5 w-3.5" /> Rebuild my plan
          </Button>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="rounded-full">
          <TabsTrigger value="today" className="rounded-full">
            Today
          </TabsTrigger>
          <TabsTrigger value="week" className="rounded-full">
            This week
          </TabsTrigger>
          <TabsTrigger value="month" className="rounded-full">
            Month
          </TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4 grid gap-4 lg:grid-cols-3">
          <Reveal className="lg:col-span-2">
            <div className="surface h-full p-5">
              <h2 className="text-[15px] font-semibold">Timeline</h2>
              <ol className="mt-5 space-y-0">
                {tasksQuery.isLoading && (
                  <li className="space-y-3">
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                    <Skeleton className="h-16 w-full rounded-xl" />
                  </li>
                )}
                {!tasksQuery.isLoading && todayPlan.length === 0 && (
                  <li className="text-[13px] text-muted-foreground">
                    No tasks scheduled for today.
                  </li>
                )}
                {todayPlan.map((t, i) => (
                  <li key={t.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "mt-1.5 h-2.5 w-2.5 rounded-full",
                          t.done ? "bg-success" : "bg-primary",
                        )}
                      />
                      {i !== todayPlan.length - 1 && <span className="w-px flex-1 bg-border" />}
                    </div>
                    <div className="pb-6">
                      <p className="text-[12px] tabular-nums text-muted-foreground">{t.time}</p>
                      <p className="mt-0.5 text-[13.5px] font-medium">{t.title}</p>
                      <p className="mt-1 text-[12px] text-muted-foreground">
                        {t.subject} · {t.minutes} min · {t.type}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </Reveal>

          <div className="space-y-4">
            <Pomodoro />
            <Reveal delay={0.06}>
              <div className="surface p-5">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                  <Sparkles className="h-3 w-3 text-primary" /> Recommendations
                </span>
                <ul className="mt-4 space-y-2.5 text-[12.5px] text-muted-foreground">
                  <li>Shift 3D Geometry to 06:30 — your morning accuracy is 23 points higher.</li>
                  <li>Cap Part Test 07 at one unbroken sitting to measure stamina decay.</li>
                  <li>Skip new Organic theory this week; retention there is already 91%.</li>
                </ul>
              </div>
            </Reveal>
            <Reveal delay={0.1}>
              <div className="surface p-5">
                <h3 className="text-[13px] font-medium">Weekly goals</h3>
                <div className="mt-4 space-y-4">
                  {weeklyGoals.map((g) => (
                    <div key={g.label}>
                      <div className="mb-1.5 flex justify-between text-[12.5px]">
                        <span>{g.label}</span>
                        <span className="tabular-nums text-muted-foreground">
                          {g.current}/{g.target}
                        </span>
                      </div>
                      <Progress value={(g.current / g.target) * 100} className="h-1.5" />
                    </div>
                  ))}
                </div>
              </div>
            </Reveal>
          </div>
        </TabsContent>

        <TabsContent value="week" className="mt-4">
          {weekQuery.data?.narrative && (
            <div className="surface mb-4 flex gap-3 border-l-2 border-l-primary p-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {weekQuery.data.narrative}
              </p>
            </div>
          )}
          <div className="surface grid gap-px overflow-hidden bg-border sm:grid-cols-4 lg:grid-cols-7">
            {week.map((d, i) => (
              <div key={d} className="min-h-[180px] bg-card p-4">
                <p className="text-[12px] font-semibold">{d}</p>
                <div className="mt-3 space-y-2">
                  {weekQuery.isLoading && weekDays.length === 0 ? (
                    <Skeleton className="h-9 w-full rounded-lg" />
                  ) : (
                    (weekDays[i]?.items ?? []).map((item, j) => (
                      <p
                        key={`${item.title}-${j}`}
                        className="rounded-lg border border-border px-2.5 py-2 text-[11.5px] leading-snug"
                      >
                        {item.title}
                      </p>
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="month" className="mt-4">
          {monthQuery.data?.narrative && (
            <div className="surface mb-4 flex gap-3 border-l-2 border-l-primary p-4">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-[12.5px] leading-relaxed text-muted-foreground">
                {monthQuery.data.narrative}
              </p>
            </div>
          )}
          <div className="surface p-5">
            <div className="grid grid-cols-7 gap-2 text-center text-[11px] text-muted-foreground">
              {week.map((d) => (
                <span key={d}>{d}</span>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-7 gap-2">
              {Array.from({ length: 35 }, (_, i) => {
                const load = monthDays[i]?.load ?? 0;
                return (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-lg border border-border p-2 text-[11px] tabular-nums transition-colors hover:border-primary/40",
                      load === 3 && "bg-primary/20",
                      load === 2 && "bg-primary/12",
                      load === 1 && "bg-primary/6",
                    )}
                  >
                    {i + 1 <= 31 ? i + 1 : ""}
                    {load === 3 && i + 1 <= 31 && (
                      <Badge
                        variant="secondary"
                        className="mt-1 hidden rounded-full text-[9px] sm:inline-flex"
                      >
                        Mock
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
