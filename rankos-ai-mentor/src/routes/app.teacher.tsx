import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ClipboardList, TrendingUp, Users } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  teacherAssignmentsQueryOptions,
  teacherBatchesQueryOptions,
  teacherLeaderboardQueryOptions,
  teacherOverviewQueryOptions,
} from "@/services/teacher";
import { cn } from "@/lib/utils";
import { requireRole } from "@/lib/auth";

export const Route = createFileRoute("/app/teacher")({
  beforeLoad: (args) => requireRole(["teacher", "admin"], args),
  head: () => ({
    meta: [
      { title: "Teacher Dashboard · RankOS" },
      {
        name: "description",
        content: "Batch analytics, assignments, weak topics and class leaderboards.",
      },
      { property: "og:title", content: "Teacher Dashboard · RankOS" },
      {
        property: "og:description",
        content: "Batch analytics, assignments, weak topics and leaderboards.",
      },
    ],
  }),
  component: TeacherPage,
});

function TeacherPage() {
  const overview = useQuery(teacherOverviewQueryOptions()).data;
  const classPerformance = useQuery(teacherBatchesQueryOptions()).data?.data ?? [];
  const assignments = useQuery(teacherAssignmentsQueryOptions()).data?.data ?? [];
  const leaderboard = useQuery(teacherLeaderboardQueryOptions(6)).data?.data ?? [];

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Teacher view"
        title="Class performance"
        description="166 students across 3 batches. Weak topics are computed from every attempt, nightly."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Students" value={overview?.totalStudents ?? 0} icon={Users} tone="primary" />
        <StatCard
          label="Avg. class accuracy"
          value={overview?.avgClassAccuracy ?? 0}
          decimals={1}
          suffix="%"
          icon={TrendingUp}
          delta={3}
          tone="success"
        />
        <StatCard
          label="Open assignments"
          value={overview?.openAssignments ?? 0}
          icon={ClipboardList}
          tone="warning"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold">Batches</h2>
          <div className="mt-4 space-y-3">
            {classPerformance.map((b) => (
              <div key={b.name} className="rounded-xl border border-border p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[13.5px] font-medium">{b.name}</p>
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[11px] font-medium",
                      b.trend >= 0
                        ? "bg-success/12 text-success"
                        : "bg-destructive/12 text-destructive",
                    )}
                  >
                    {b.trend >= 0 ? "+" : ""}
                    {b.trend}% this month
                  </span>
                </div>
                <p className="mt-1 text-[12px] text-muted-foreground">
                  {b.students} students · weakest topic: {b.weakTopic}
                </p>
                <Progress value={b.avgScore} className="mt-3 h-1.5" />
              </div>
            ))}
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="text-[15px] font-semibold">Assignments</h2>
          <div className="mt-4 space-y-3">
            {assignments.map((a) => (
              <div key={a.title} className="rounded-xl border border-border p-3.5">
                <p className="text-[13px] font-medium leading-snug">{a.title}</p>
                <div className="mt-2 flex items-center justify-between text-[11.5px] text-muted-foreground">
                  <span>
                    {a.batch} · due {a.due}
                  </span>
                  <Badge variant="secondary" className="rounded-full text-[10px]">
                    {a.submitted}/{a.total}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
          <Button className="mt-4 w-full rounded-xl" size="sm">
            Create assignment
          </Button>
        </div>
      </div>

      <div className="surface mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Top students this week</h2>
        <div className="mt-3 divide-y divide-border">
          {leaderboard.slice(0, 6).map((s) => (
            <div key={s.rank} className="flex items-center gap-4 py-3 text-[13px]">
              <span className="w-5 tabular-nums text-muted-foreground">{s.rank}</span>
              <span className="flex-1 font-medium">{s.name}</span>
              <span className="text-[12px] text-muted-foreground">{s.institute}</span>
              <span className="w-14 text-right tabular-nums">{s.accuracy}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
