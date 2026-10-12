import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CalendarCheck, Clock, HeartPulse, TrendingUp } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { Progress } from "@/components/ui/progress";
import { parentChildrenQueryOptions, parentReportQueryOptions } from "@/services/parent";
import { requireRole } from "@/lib/auth";

export const Route = createFileRoute("/app/parent")({
  // Parents and admins; a student may self-preview (API_SPEC.md → Parent View).
  beforeLoad: (args) => requireRole(["parent", "admin", "student"], args),
  head: () => ({
    meta: [
      { title: "Parent Dashboard · RankOS" },
      {
        name: "description",
        content: "Study time, attendance, weak subjects and performance trends for parents.",
      },
      { property: "og:title", content: "Parent Dashboard · RankOS" },
      {
        property: "og:description",
        content: "Study time, attendance, weak subjects and performance trends.",
      },
    ],
  }),
  component: ParentPage,
});

function ParentPage() {
  const children = useQuery(parentChildrenQueryOptions());
  const studentId = children.data?.data?.[0]?.studentId;
  const report = useQuery(parentReportQueryOptions({ studentId })).data;

  const studyTimeWeek = report?.studyTimeWeek ?? [];
  const subjectBreakdown = report?.subjectBreakdown ?? [];
  const firstName = report?.student?.name?.split(" ")[0] ?? "Your child";

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Parent view"
        title={`${firstName}'s week`}
        description="Trends and consistency only. Individual questions and mentor chats stay private."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Study time"
          value={report?.hoursThisWeek ?? 38.5}
          decimals={1}
          suffix="h"
          icon={Clock}
          delta={-6}
          hint="Target 45h"
        />
        <StatCard
          label="Attendance"
          value={report?.attendance ?? 0}
          suffix="%"
          icon={CalendarCheck}
          tone="success"
        />
        <StatCard
          label="Focus score"
          value={report?.focusScore ?? 0}
          icon={TrendingUp}
          tone="primary"
          delta={4}
        />
        <StatCard
          label="Burnout risk"
          value={38}
          suffix="%"
          icon={HeartPulse}
          tone="warning"
          hint={report?.burnoutRisk ?? ""}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold">Daily study hours vs target</h2>
          <div className="mt-5 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={studyTimeWeek} margin={{ left: -20, top: 6 }}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="var(--color-border)"
                  vertical={false}
                />
                <XAxis
                  dataKey="day"
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
                <Bar dataKey="hours" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="target" fill="var(--color-muted)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="surface p-5">
          <h2 className="text-[15px] font-semibold">Subject standing</h2>
          <div className="mt-5 space-y-5">
            {subjectBreakdown.map((s) => (
              <div key={s.subject}>
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span>{s.subject}</span>
                  <span className="tabular-nums text-muted-foreground">{s.accuracy}%</span>
                </div>
                <Progress value={s.accuracy} className="h-1.5" />
              </div>
            ))}
          </div>
          <p className="mt-6 rounded-xl bg-muted/60 p-3 text-[12px] leading-relaxed text-muted-foreground">
            {report?.recommendation ??
              "Recommendation: protect Sunday as a genuine rest day. Three late-night sessions this week correlate with a 14% accuracy drop the following morning."}
          </p>
        </div>
      </div>
    </div>
  );
}
