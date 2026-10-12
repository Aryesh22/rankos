import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Fragment, useState } from "react";
import { Sparkles } from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { PageHeader } from "@/components/app/PageHeader";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  generateTopicNotes,
  practiceTopic,
  topicGraphQueryOptions,
  topicNotesQueryOptions,
  topicRevisionsQueryOptions,
} from "@/services/topics";
import { cn } from "@/lib/utils";

/** Minimal, dependency-free markdown: `## heading`, `**bold**`, line breaks. */
function renderInline(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i} className="font-semibold text-foreground">
        {part.slice(2, -2)}
      </strong>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function NoteMarkdown({ content }: { content: string }) {
  return (
    <div className="space-y-2 text-[12.5px] leading-relaxed text-muted-foreground">
      {content.split("\n").map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;
        if (trimmed.startsWith("## ")) {
          return (
            <h4 key={i} className="mt-2 text-[13px] font-semibold text-foreground">
              {renderInline(trimmed.slice(3))}
            </h4>
          );
        }
        if (trimmed.startsWith("# ")) {
          return (
            <h3 key={i} className="mt-2 text-[13.5px] font-semibold text-foreground">
              {renderInline(trimmed.slice(2))}
            </h3>
          );
        }
        if (/^[-*]\s/.test(trimmed)) {
          return (
            <p key={i} className="pl-3">
              • {renderInline(trimmed.replace(/^[-*]\s/, ""))}
            </p>
          );
        }
        return <p key={i}>{renderInline(trimmed)}</p>;
      })}
    </div>
  );
}

export const Route = createFileRoute("/app/revision-graph")({
  head: () => ({
    meta: [
      { title: "Revision Graph · RankOS" },
      {
        name: "description",
        content:
          "Your syllabus as a living knowledge graph — nodes shift colour as mastery decays.",
      },
      { property: "og:title", content: "Revision Graph · RankOS" },
      {
        property: "og:description",
        content: "A knowledge graph of every chapter, coloured by current mastery.",
      },
    ],
  }),
  component: GraphPage,
});

const toneFor = (m: number) =>
  m >= 80 ? "bg-success" : m >= 60 ? "bg-primary" : m >= 45 ? "bg-warning" : "bg-destructive";

function GraphPage() {
  const { data, isLoading } = useQuery(topicGraphQueryOptions());
  const topicGraph = data?.nodes ?? [];
  const [selectedId, setSelectedId] = useState<string | undefined>(undefined);
  const selected =
    topicGraph.find((n) => n.id === selectedId) ?? topicGraph[11] ?? topicGraph[0];
  const revisions = useQuery(topicRevisionsQueryOptions(selected?.id));
  const notes = useQuery(topicNotesQueryOptions(selected?.id));
  const latestNote = notes.data?.data?.[0];
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const generateNotes = useMutation({
    mutationFn: (id: string) => generateTopicNotes(id),
    onSuccess: (_note, id) => {
      queryClient.invalidateQueries({ queryKey: ["topics", "notes", id] });
      toast.success("AI notes generated.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't generate notes.");
    },
  });

  const practise = useMutation({
    mutationFn: (node: { id: string; weakQuestions: number }) =>
      practiceTopic(node.id, node.weakQuestions),
    onSuccess: (res) => {
      navigate({ to: "/test/$testId", params: { testId: res.testId } });
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Couldn't start practice.");
    },
  });

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Revision graph"
        title="Your syllabus, alive"
        description="Each node is a chapter. Colour is current mastery, size is how much it matters in your exam."
      />

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="surface relative h-[520px] overflow-hidden p-4">
          <div className="grid-bg absolute inset-0 opacity-40" />
          <svg className="absolute inset-0 h-full w-full" aria-hidden>
            {topicGraph.flatMap((n) =>
              n.links.map((l) => {
                const t = topicGraph.find((x) => x.id === l);
                if (!t) return null;
                return (
                  <line
                    key={`${n.id}-${l}`}
                    x1={`${n.x}%`}
                    y1={`${n.y}%`}
                    x2={`${t.x}%`}
                    y2={`${t.y}%`}
                    stroke="var(--color-border)"
                    strokeWidth={1}
                  />
                );
              }),
            )}
          </svg>
          {topicGraph.map((n) => (
            <button
              key={n.id}
              onClick={() => setSelectedId(n.id)}
              style={{ left: `${n.x}%`, top: `${n.y}%` }}
              className={cn(
                "absolute -translate-x-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[11.5px] font-medium text-background transition-transform hover:scale-110",
                toneFor(n.mastery),
                selected?.id === n.id && "ring-2 ring-primary ring-offset-2 ring-offset-card",
              )}
            >
              {n.name}
            </button>
          ))}
          <div className="absolute bottom-4 left-4 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            {[
              ["bg-destructive", "< 45%"],
              ["bg-warning", "45–60%"],
              ["bg-primary", "60–80%"],
              ["bg-success", "80%+"],
            ].map(([c, l]) => (
              <span key={l} className="flex items-center gap-1.5">
                <span className={cn("h-2.5 w-2.5 rounded-full", c)} />
                {l}
              </span>
            ))}
          </div>
        </div>

        <div className="surface h-full p-5">
          {!selected ? (
            isLoading ? (
              <div className="space-y-4">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-7 w-40 rounded" />
                <Skeleton className="h-2 w-full rounded" />
                <Skeleton className="h-40 w-full rounded" />
              </div>
            ) : (
              <p className="text-[13px] text-muted-foreground">No topics to show yet.</p>
            )
          ) : (
            <>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
                {selected.subject}
              </p>
              <h2 className="mt-1 text-xl font-semibold">{selected.name}</h2>

              <div className="mt-5">
                <div className="mb-1.5 flex justify-between text-[13px]">
                  <span>Mastery</span>
                  <span className="tabular-nums text-muted-foreground">{selected.mastery}%</span>
                </div>
                <Progress value={selected.mastery} className="h-1.5" />
              </div>

              <dl className="mt-6 space-y-3 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Last revised</dt>
                  <dd>{selected.lastRevised}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Weak questions</dt>
                  <dd className="tabular-nums">{selected.weakQuestions}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Linked chapters</dt>
                  <dd>{selected.links.length}</dd>
                </div>
              </dl>

              <h3 className="mt-7 text-[13px] font-medium">Revision history</h3>
              <ul className="mt-3 space-y-2 text-[12.5px] text-muted-foreground">
                {(revisions.data?.data ?? []).map((r, i) => (
                  <li key={i} className="rounded-lg border border-border px-3 py-2">
                    {r.revisedAt} · mastery {r.masteryBefore}% → {r.masteryAfter}% ·{" "}
                    {r.questionsPractised} questions
                  </li>
                ))}
                {!revisions.isLoading && (revisions.data?.data ?? []).length === 0 && (
                  <li className="rounded-lg border border-border px-3 py-2">
                    No revision history recorded yet.
                  </li>
                )}
              </ul>

              <Button
                className="mt-6 w-full rounded-xl"
                onClick={() =>
                  practise.mutate({ id: selected.id, weakQuestions: selected.weakQuestions })
                }
                disabled={practise.isPending}
              >
                Practise {selected.weakQuestions} weak questions
              </Button>

              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center justify-between">
                  <h3 className="text-[13px] font-medium">AI notes</h3>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => generateNotes.mutate(selected.id)}
                    disabled={generateNotes.isPending}
                  >
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    {generateNotes.isPending ? "Generating…" : "Generate AI Notes"}
                  </Button>
                </div>

                <div className="mt-3">
                  {notes.isLoading ? (
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-3/4 rounded" />
                      <Skeleton className="h-3 w-full rounded" />
                      <Skeleton className="h-3 w-5/6 rounded" />
                    </div>
                  ) : notes.isError ? (
                    <p className="text-[12.5px] text-destructive">
                      Couldn't load notes. Try generating again.
                    </p>
                  ) : latestNote ? (
                    <div className="rounded-xl border border-border p-4">
                      <p className="text-[13px] font-medium text-foreground">{latestNote.title}</p>
                      <div className="mt-2">
                        <NoteMarkdown content={latestNote.content} />
                      </div>
                    </div>
                  ) : generateNotes.isPending ? (
                    <p className="text-[12.5px] text-muted-foreground">Generating notes…</p>
                  ) : (
                    <p className="text-[12.5px] text-muted-foreground">
                      No notes yet — generate one.
                    </p>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
