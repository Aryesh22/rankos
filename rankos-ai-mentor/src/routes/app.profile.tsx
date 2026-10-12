import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, GraduationCap, Target, Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { StudyHeatmap } from "@/components/ui-kit/StudyHeatmap";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { achievementsQueryOptions, profileQueryOptions } from "@/services/profile";
import { heatmapQueryOptions } from "@/services/analytics";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/profile")({
  head: () => ({
    meta: [
      { title: "Profile · RankOS" },
      { name: "description", content: "XP, badges, study stats, target rank and dream college." },
      { property: "og:title", content: "Profile · RankOS" },
      {
        property: "og:description",
        content: "XP, badges, study stats, target rank and dream college.",
      },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { data: student } = useQuery(profileQueryOptions());
  const achievementsQuery = useQuery(achievementsQueryOptions());
  const heatmap = useQuery(heatmapQueryOptions());

  const achievements = achievementsQuery.data?.data ?? [];
  const nextLevelXp = student?.nextLevelXp ?? 55000;
  const xpToNext = student?.xpToNextLevel ?? 0;

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Profile"
        title={student?.name ?? "Profile"}
        description={student ? `${student.exam} · ${student.institute}` : ""}
      />

      <div className="surface mb-4 flex flex-wrap items-center gap-6 p-6">
        <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient text-xl font-semibold text-primary-foreground">
          {student?.initials ?? "—"}
        </span>
        <div className="min-w-[220px] flex-1">
          <div className="flex items-baseline justify-between text-[13px]">
            <span className="font-medium">Level {student?.level ?? 0}</span>
            <span className="tabular-nums text-muted-foreground">
              {(student?.xp ?? 0).toLocaleString("en-IN")} / {nextLevelXp.toLocaleString("en-IN")} XP
            </span>
          </div>
          <Progress value={((student?.xp ?? 0) / nextLevelXp) * 100} className="mt-2 h-1.5" />
          <p className="mt-2 text-[12px] text-muted-foreground">
            {xpToNext.toLocaleString("en-IN")} XP to Level {(student?.level ?? 0) + 1} · unlocks the
            advanced paper analytics suite
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Target rank" value={student?.targetRank ?? 0} icon={Target} tone="primary" />
        <StatCard
          label="Predicted AIR"
          value={student?.currentPredictedRank ?? 0}
          icon={Trophy}
          delta={12}
        />
        <StatCard
          label="Syllabus covered"
          value={student?.syllabusCovered ?? 0}
          suffix="%"
          icon={GraduationCap}
          tone="success"
        />
        <StatCard
          label="Badges earned"
          value={achievementsQuery.data?.earnedCount ?? 0}
          suffix={`/${achievementsQuery.data?.total ?? achievements.length}`}
          icon={Award}
          tone="warning"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <div className="surface p-5 lg:col-span-2">
          <h2 className="text-[15px] font-semibold">Consistency</h2>
          <div className="mt-5">
            <StudyHeatmap data={heatmap.data?.data ?? []} />
          </div>
        </div>
        <div className="surface p-5">
          <h2 className="text-[15px] font-semibold">Dream college</h2>
          <p className="mt-3 text-[14px] font-medium">{student?.dreamCollege ?? "—"}</p>
          <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
            Closing rank last year: 62. You need roughly +96 marks from your current mock average.
            At your present trajectory that's 19 weeks away.
          </p>
          <div className="mt-5 space-y-2 text-[12.5px]">
            {[
              ["State", student?.state ?? "—"],
              ["Institute", student?.institute ?? "—"],
              ["Longest streak", `${student?.longestStreak ?? 0} days`],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <span className="text-muted-foreground">{k}</span>
                <span>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="surface mt-4 p-5">
        <h2 className="text-[15px] font-semibold">Achievements</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {achievements.map((a) => (
            <div
              key={a.name}
              className={cn("rounded-xl border border-border p-4", !a.earned && "opacity-50")}
            >
              <div className="flex items-center justify-between">
                <p className="text-[13.5px] font-medium">{a.name}</p>
                <Badge
                  variant={a.earned ? "default" : "secondary"}
                  className="rounded-full text-[10px]"
                >
                  {a.earned ? "Earned" : "Locked"}
                </Badge>
              </div>
              <p className="mt-1.5 text-[12px] text-muted-foreground">{a.detail}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
