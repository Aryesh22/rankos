import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Filter, Sparkles, Timer, Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Reveal } from "@/components/ui-kit/Motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  createCustomTest,
  testHistoryQueryOptions,
  testStatsQueryOptions,
  upcomingTestsQueryOptions,
} from "@/services/tests";
import { flattenLeaderboard, leaderboardQueryOptions } from "@/services/leaderboard";

export const Route = createFileRoute("/app/tests")({
  head: () => ({
    meta: [
      { title: "Tests · RankOS" },
      {
        name: "description",
        content: "Upcoming mocks, attempt history, accuracy trends and a custom test generator.",
      },
      { property: "og:title", content: "Tests · RankOS" },
      {
        property: "og:description",
        content: "Upcoming mocks, attempt history, accuracy trends and a custom test generator.",
      },
    ],
  }),
  component: TestsPage,
});

const subjects = ["Physics", "Chemistry", "Mathematics"];
const difficulties = ["Easy", "Medium", "Hard", "Exam-level"];

function TestsPage() {
  const [picked, setPicked] = useState<string[]>(["Physics", "Mathematics"]);
  const [difficulty, setDifficulty] = useState("Exam-level");
  const [count, setCount] = useState([45]);
  const navigate = useNavigate();

  const generate = useMutation({
    mutationFn: () =>
      createCustomTest({ subjects: picked, difficulty, count: count[0] }),
    onSuccess: (res) => {
      navigate({ to: "/test/$testId", params: { testId: res.testId } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't generate the test.");
    },
  });

  const upcoming = useQuery(upcomingTestsQueryOptions());
  const history = useQuery(testHistoryQueryOptions());
  const stats = useQuery(testStatsQueryOptions());
  const leaderboardQuery = useQuery(leaderboardQueryOptions({ scope: "india", range: "weekly", limit: 8 }));

  const upcomingTests = upcoming.data?.data ?? [];
  const previousTests = history.data?.data ?? [];
  const leaderboard = flattenLeaderboard(leaderboardQuery.data);

  const toggle = (s: string) =>
    setPicked((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Test centre"
        title="Tests"
        description="Every attempt feeds your Exam DNA. Nothing here is a standalone score."
        actions={
          <Button variant="outline" size="sm" className="rounded-full">
            <Filter className="mr-1.5 h-3.5 w-3.5" /> Filters
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Tests attempted" value={stats.data?.attempted ?? 0} icon={Trophy} tone="primary" />
        <StatCard
          label="Average accuracy"
          value={stats.data?.avgAccuracy ?? 0}
          decimals={1}
          suffix="%"
          delta={4}
          tone="success"
        />
        <StatCard
          label="Avg. time / question"
          value={stats.data?.avgTimePerQuestionSec ?? 0}
          suffix="s"
          icon={Timer}
          delta={-7}
        />
        <StatCard
          label="Best percentile"
          value={stats.data?.bestPercentile ?? 0}
          decimals={1}
          icon={Sparkles}
          tone="warning"
        />
      </div>

      <Tabs defaultValue="upcoming" className="mt-6">
        <TabsList className="rounded-full">
          <TabsTrigger value="upcoming" className="rounded-full">
            Upcoming
          </TabsTrigger>
          <TabsTrigger value="history" className="rounded-full">
            Attempt history
          </TabsTrigger>
          <TabsTrigger value="generator" className="rounded-full">
            Custom test
          </TabsTrigger>
          <TabsTrigger value="leaderboard" className="rounded-full">
            Leaderboard
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upcoming" className="mt-4 grid gap-4 md:grid-cols-3">
          {upcoming.isLoading &&
            Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[220px] rounded-xl" />
            ))}
          {!upcoming.isLoading && upcomingTests.length === 0 && (
            <p className="surface p-8 text-center text-[13px] text-muted-foreground md:col-span-3">
              No upcoming tests scheduled.
            </p>
          )}
          {upcomingTests.map((t, i) => (
            <Reveal key={t.id} delay={i * 0.05}>
              <div className="surface hover-lift flex h-full flex-col p-5">
                <div className="flex items-center justify-between">
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {t.exam}
                  </Badge>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      t.difficulty === "Hard"
                        ? "bg-destructive/12 text-destructive"
                        : "bg-warning/12 text-warning",
                    )}
                  >
                    {t.difficulty}
                  </span>
                </div>
                <h3 className="mt-4 text-[15px] font-semibold leading-snug">{t.title}</h3>
                <p className="mt-1.5 text-[12.5px] text-muted-foreground">
                  {t.questions} questions · {t.durationMin} min · {t.maxScore} marks
                </p>
                <p className="mt-4 text-[12px] text-primary">{t.scheduledFor}</p>
                <Button asChild className="mt-auto w-full rounded-xl pt-0" size="sm">
                  <Link to="/test/$testId" params={{ testId: t.id }}>
                    Start test
                  </Link>
                </Button>
              </div>
            </Reveal>
          ))}
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <div className="surface overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="border-b border-border text-left text-[12px] text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Test</th>
                  <th className="px-5 py-3 font-medium">Date</th>
                  <th className="px-5 py-3 font-medium">Score</th>
                  <th className="px-5 py-3 font-medium">Accuracy</th>
                  <th className="px-5 py-3 font-medium">Percentile</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {previousTests.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0 hover:bg-muted/40">
                    <td className="px-5 py-3.5 font-medium">{t.title}</td>
                    <td className="px-5 py-3.5 text-muted-foreground">{t.attemptedOn}</td>
                    <td className="px-5 py-3.5 tabular-nums">
                      {t.score}
                      <span className="text-muted-foreground">/{t.maxScore}</span>
                    </td>
                    <td className="px-5 py-3.5 tabular-nums">{t.accuracy}%</td>
                    <td className="px-5 py-3.5 tabular-nums text-success">{t.percentile}</td>
                    <td className="px-5 py-3.5 text-right">
                      <Button asChild size="sm" variant="ghost" className="rounded-full">
                        <Link to="/app/results" search={{ attempt: t.id }}>
                          Analysis
                        </Link>
                      </Button>
                    </td>
                  </tr>
                ))}
                {!history.isLoading && previousTests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                      No attempts yet — your history will appear here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="generator" className="mt-4">
          <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
            <div className="surface p-6">
              <h3 className="text-[15px] font-semibold">Custom test generator</h3>
              <p className="mt-1 text-[13px] text-muted-foreground">
                Your mentor pre-selected the chapters where you're leaking the most marks.
              </p>

              <div className="mt-6 space-y-6">
                <div>
                  <p className="mb-2.5 text-[13px] font-medium">Subjects</p>
                  <div className="flex flex-wrap gap-2">
                    {subjects.map((s) => (
                      <button
                        key={s}
                        onClick={() => toggle(s)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                          picked.includes(s)
                            ? "border-primary bg-primary/12 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-2.5 text-[13px] font-medium">Difficulty</p>
                  <div className="flex flex-wrap gap-2">
                    {difficulties.map((d) => (
                      <button
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={cn(
                          "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                          difficulty === d
                            ? "border-primary bg-primary/12 text-primary"
                            : "border-border text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="mb-3 flex justify-between text-[13px]">
                    <span className="font-medium">Questions</span>
                    <span className="tabular-nums text-muted-foreground">{count[0]}</span>
                  </div>
                  <Slider value={count} onValueChange={setCount} min={10} max={90} step={5} />
                </div>
              </div>

              <Button
                className="mt-7 w-full rounded-xl"
                onClick={() => generate.mutate()}
                disabled={generate.isPending}
              >
                Generate and start
              </Button>
            </div>

            <div className="surface p-6">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-2.5 py-1 text-[11px] text-muted-foreground">
                <Sparkles className="h-3 w-3 text-primary" /> Mentor suggestion
              </span>
              <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">
                Build a 45-question paper: 18 from Definite Integration, 15 from 3D Geometry and 12
                from Rotational Motion, all at exam level. Based on your last 6 mocks, clearing
                these three is worth roughly <span className="text-foreground">+34 marks</span> and
                pushes your projected AIR from 1,240 to about 840.
              </p>
              <div className="mt-5 space-y-2">
                {[
                  "Definite Integration · 18 Q",
                  "3D Geometry · 15 Q",
                  "Rotational Motion · 12 Q",
                ].map((x) => (
                  <div key={x} className="rounded-lg border border-border px-3 py-2 text-[12.5px]">
                    {x}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="leaderboard" className="mt-4">
          <div className="surface divide-y divide-border">
            {leaderboardQuery.isLoading && leaderboard.length === 0 && (
              <div className="px-5 py-8">
                <Skeleton className="h-24 w-full rounded-lg" />
              </div>
            )}
            {leaderboard.slice(0, 8).map((e) => (
              <div
                key={e.rank}
                className={cn(
                  "flex items-center gap-4 px-5 py-3.5 text-[13px]",
                  e.isYou && "bg-primary/8",
                )}
              >
                <span className="w-6 tabular-nums text-muted-foreground">{e.rank}</span>
                <div className="flex-1">
                  <p className="font-medium">
                    {e.name} {e.isYou && <span className="text-primary">· you</span>}
                  </p>
                  <p className="text-[12px] text-muted-foreground">{e.institute}</p>
                </div>
                <span className="tabular-nums text-muted-foreground">{e.accuracy}%</span>
                <span className="w-20 text-right tabular-nums font-medium">
                  {e.xp.toLocaleString("en-IN")} XP
                </span>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
