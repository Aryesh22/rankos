import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  flattenLeaderboard,
  leaderboardQueryOptions,
  type LeaderboardRange,
  type LeaderboardScope,
} from "@/services/leaderboard";

export const Route = createFileRoute("/app/leaderboard")({
  head: () => ({
    meta: [
      { title: "Leaderboard · RankOS" },
      {
        name: "description",
        content: "Compare with friends, your institute, your state and all of India.",
      },
      { property: "og:title", content: "Leaderboard · RankOS" },
      {
        property: "og:description",
        content: "Friends, institute, state and India rankings, weekly to all-time.",
      },
    ],
  }),
  component: LeaderboardPage,
});

const scopes = ["Friends", "Institute", "State", "India"];
const ranges = ["Weekly", "Monthly", "Overall"];

function LeaderboardPage() {
  const [scope, setScope] = useState("India");
  const [range, setRange] = useState("Weekly");

  const { data, isLoading } = useQuery(
    leaderboardQueryOptions({
      scope: scope.toLowerCase() as LeaderboardScope,
      range: range.toLowerCase() as LeaderboardRange,
    }),
  );
  const leaderboard = flattenLeaderboard(data);

  return (
    <div className="mx-auto max-w-[1000px]">
      <PageHeader
        eyebrow="Leaderboard"
        title="Where you stand"
        description="Ranked by XP earned from accuracy, consistency and cleared mistakes — not raw hours."
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5">
          {scopes.map((s) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={cn(
                "rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                scope === s
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <Tabs value={range} onValueChange={setRange}>
          <TabsList className="rounded-full">
            {ranges.map((r) => (
              <TabsTrigger key={r} value={r} className="rounded-full text-[12px]">
                {r}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {isLoading && leaderboard.length === 0
          ? Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[150px] rounded-xl" />
            ))
          : leaderboard.slice(0, 3).map((e, i) => (
              <div
                key={e.rank}
                className={cn("surface p-5 text-center", i === 0 && "border-primary/40 shadow-glow")}
              >
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                  Rank {e.rank}
                </p>
                <p className="mt-2 text-[15px] font-semibold">{e.name}</p>
                <p className="text-[12px] text-muted-foreground">{e.institute}</p>
                <p className="mt-3 text-2xl font-semibold tabular-nums">
                  {e.xp.toLocaleString("en-IN")}
                </p>
                <p className="text-[11px] text-muted-foreground">XP · {e.accuracy}% accuracy</p>
              </div>
            ))}
      </div>

      <div className="surface divide-y divide-border">
        {leaderboard.map((e) => (
          <div
            key={e.rank}
            className={cn(
              "flex items-center gap-4 px-5 py-3.5 text-[13px]",
              e.isYou && "bg-primary/8",
            )}
          >
            <span className="w-6 tabular-nums text-muted-foreground">{e.rank}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {e.name} {e.isYou && <span className="text-primary">· you</span>}
              </p>
              <p className="truncate text-[12px] text-muted-foreground">
                {e.institute} · {e.state}
              </p>
            </div>
            <span className="hidden w-16 text-right tabular-nums text-muted-foreground sm:block">
              {e.streak}d
            </span>
            <span className="w-14 text-right tabular-nums text-muted-foreground">
              {e.accuracy}%
            </span>
            <span className="w-24 text-right font-medium tabular-nums">
              {e.xp.toLocaleString("en-IN")}
            </span>
          </div>
        ))}
        {!isLoading && leaderboard.length === 0 && (
          <div className="px-5 py-10 text-center text-[13px] text-muted-foreground">
            No ranking data for this scope yet.
          </div>
        )}
      </div>
    </div>
  );
}
