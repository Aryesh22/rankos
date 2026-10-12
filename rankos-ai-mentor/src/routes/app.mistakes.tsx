import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Search, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/app/PageHeader";
import { Reveal } from "@/components/ui-kit/Motion";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { mistakesQueryOptions, practiceSimilar, updateMistake } from "@/services/mistakes";
import type { Mistake } from "@/types";

const nextStatus: Record<Mistake["status"], Mistake["status"]> = {
  Pending: "Revised",
  Revised: "Mastered",
  Mastered: "Pending",
};

export const Route = createFileRoute("/app/mistakes")({
  head: () => ({
    meta: [
      { title: "Mistake Bank · RankOS" },
      {
        name: "description",
        content:
          "Every error auto-classified into concept, formula, calculation, guess, memory, time-pressure and careless mistakes.",
      },
      { property: "og:title", content: "Mistake Bank · RankOS" },
      {
        property: "og:description",
        content: "Auto-classified errors with priority, revision status and mentor notes.",
      },
    ],
  }),
  component: MistakesPage,
});

const categories = [
  "All",
  "Concept Error",
  "Formula Error",
  "Calculation Error",
  "Guess",
  "Memory Error",
  "Time Pressure",
  "Careless Mistake",
];

const statuses = ["All", "Pending", "Revised", "Mastered"];

function MistakesPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const [status, setStatus] = useState("All");
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const filters = { q, category: cat, status };
  const { data, isLoading } = useQuery(mistakesQueryOptions(filters));
  const filtered = data?.data ?? [];

  const changeStatus = useMutation({
    mutationFn: (m: Mistake) => updateMistake(m.id, { status: nextStatus[m.status] }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["mistakes"] }),
  });

  const practise = useMutation({
    mutationFn: (m: Mistake) => practiceSimilar(m.id, 5),
    onSuccess: (res) => {
      navigate({ to: "/test/$testId", params: { testId: res.testId } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't start practice.");
    },
  });

  return (
    <div className="mx-auto max-w-[1100px]">
      <PageHeader
        eyebrow="Mistake bank"
        title="Every error, classified"
        description="1,284 mistakes logged. 41 cleared this week. A mistake is only closed when you solve its type twice, cold."
      />

      <div className="surface mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex min-w-[220px] flex-1 items-center gap-2 rounded-lg border border-border px-3">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions, chapters…"
            className="border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {statuses.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
                status === s
                  ? "border-primary bg-primary/12 text-primary"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        {categories.map((c) => (
          <button
            key={c}
            onClick={() => setCat(c)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors",
              cat === c
                ? "border-primary bg-primary/12 text-primary"
                : "border-border text-muted-foreground hover:text-foreground",
            )}
          >
            {c}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[168px] w-full rounded-xl" />
          ))}
        {filtered.map((m, i) => (
          <Reveal key={m.id} delay={Math.min(i * 0.04, 0.2)}>
            <article className="surface hover-lift p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {m.subject}
                </Badge>
                <span className="text-[12px] text-muted-foreground">{m.chapter}</span>
                <span className="text-[12px] text-muted-foreground">· {m.occurredOn}</span>
                <span className="ml-auto flex items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      m.priority === "High"
                        ? "bg-destructive/12 text-destructive"
                        : m.priority === "Medium"
                          ? "bg-warning/12 text-warning"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m.priority}
                  </span>
                  <span
                    onClick={() => changeStatus.mutate(m)}
                    title="Advance revision status"
                    className={cn(
                      "rounded-full px-2 py-0.5 text-[10px] font-medium",
                      m.status === "Mastered"
                        ? "bg-success/12 text-success"
                        : m.status === "Revised"
                          ? "bg-primary/12 text-primary"
                          : "bg-muted text-muted-foreground",
                    )}
                  >
                    {m.status}
                  </span>
                </span>
              </div>

              <p className="mt-3 text-[14px] leading-relaxed">{m.question}</p>

              <div className="mt-3 flex items-start gap-2 rounded-xl bg-muted/60 p-3">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                <p className="text-[12.5px] leading-relaxed text-muted-foreground">{m.aiNote}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Badge variant="outline" className="rounded-full text-[10px]">
                  {m.category}
                </Badge>
                <span className="text-[11.5px] text-muted-foreground">
                  repeated {m.timesRepeated}×
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto rounded-full"
                  onClick={() => practise.mutate(m)}
                  disabled={practise.isPending}
                >
                  Practice 5 similar
                </Button>
              </div>
            </article>
          </Reveal>
        ))}
        {!isLoading && filtered.length === 0 && (
          <p className="surface p-10 text-center text-[13px] text-muted-foreground">
            Nothing matches those filters — which, for once, is good news.
          </p>
        )}
      </div>
    </div>
  );
}
