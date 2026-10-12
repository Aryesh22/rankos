import { createFileRoute } from "@tanstack/react-router";
import { Brain, Gauge, HeartPulse, ShieldCheck, Timer, Zap } from "lucide-react";
import {
  PolarAngleAxis,
  PolarGrid,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/ui-kit/StatCard";
import { RingProgress } from "@/components/ui-kit/RingProgress";
import { Reveal } from "@/components/ui-kit/Motion";
import { Progress } from "@/components/ui/progress";
import { examDnaQueryOptions } from "@/services/analytics";
import { topicGraphQueryOptions } from "@/services/topics";
import { cn } from "@/lib/utils";

/** Loose label match so API values slot into the labelled UI rows. */
function valueByLabel(
  rows: { label: string; value: number }[] | undefined,
  label: string,
): number | undefined {
  const b = label.toLowerCase();
  return rows?.find((x) => {
    const a = x.label.toLowerCase();
    return a === b || a.includes(b) || b.includes(a);
  })?.value;
}

export const Route = createFileRoute("/app/exam-dna")({
  head: () => ({
    meta: [
      { title: "Exam DNA · RankOS" },
      {
        name: "description",
        content:
          "Your behavioural fingerprint: speed, guess rate, error types, burnout risk, retention and discipline.",
      },
      { property: "og:title", content: "Exam DNA · RankOS" },
      {
        property: "og:description",
        content:
          "Speed, guess rate, error types, burnout risk, retention and discipline — measured.",
      },
    ],
  }),
  component: ExamDnaPage,
});

const behaviours = [
  {
    label: "Speed index",
    value: 74,
    hint: "98s per question vs 84s topper median",
    tone: "primary" as const,
  },
  {
    label: "Accuracy",
    value: 72,
    hint: "Stable across the last 3 mocks",
    tone: "success" as const,
  },
  {
    label: "Confidence",
    value: 61,
    hint: "You change 1 in 6 correct answers",
    tone: "warning" as const,
  },
  { label: "Retention", value: 83, hint: "Decay starts around day 9", tone: "accent" as const },
];

const errorProfile = [
  { label: "Guess rate", value: 10, tone: "bg-chart-3" },
  { label: "Calculation errors", value: 26, tone: "bg-chart-5" },
  { label: "Concept errors", value: 34, tone: "bg-destructive" },
  { label: "Careless mistakes", value: 17, tone: "bg-warning" },
];

function ExamDnaPage() {
  const dna = useQuery(examDnaQueryOptions()).data;
  const nodes = useQuery(topicGraphQueryOptions()).data?.nodes ?? [];

  const weak = [...nodes].sort((a, b) => a.mastery - b.mastery).slice(0, 5);
  const strong = [...nodes].sort((a, b) => b.mastery - a.mastery).slice(0, 5);
  const examDnaRadar = dna?.radar ?? [];

  return (
    <div className="mx-auto max-w-[1200px]">
      <PageHeader
        eyebrow="Signature feature"
        title="Your Exam DNA"
        description="Built from 4,812 attempted questions. This is how you behave under a clock — not what you know."
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Discipline score"
          value={valueByLabel(dna?.behaviours, "Discipline") ?? 91}
          icon={ShieldCheck}
          tone="success"
          hint="46-day streak"
          delta={5}
        />
        <StatCard
          label="Burnout risk"
          value={38}
          suffix="%"
          icon={HeartPulse}
          tone="warning"
          hint={dna?.burnoutRisk ?? "3 sessions past 1 AM"}
          delta={9}
        />
        <StatCard
          label="Endurance drop"
          value={dna?.enduranceDropPct ?? 27}
          suffix="%"
          icon={Timer}
          tone="danger"
          hint="Accuracy fall after 120 min"
        />
        <StatCard
          label="Learning velocity"
          value={dna?.learningVelocity ?? 1.8}
          decimals={1}
          suffix="x"
          icon={Zap}
          tone="primary"
          hint="vs your March baseline"
          delta={18}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Reveal className="lg:col-span-2">
          <div className="surface h-full p-5">
            <div className="flex items-center gap-2">
              <Brain className="h-4 w-4 text-primary" />
              <h2 className="text-[15px] font-semibold">Learning behaviour</h2>
            </div>
            <div className="mt-6 grid gap-6 sm:grid-cols-2">
              {behaviours.map((b) => (
                <div key={b.label} className="flex items-center gap-4">
                  <RingProgress
                    value={valueByLabel(dna?.behaviours, b.label) ?? b.value}
                    size={76}
                    stroke={7}
                    tone={b.tone}
                  />
                  <div>
                    <p className="text-[13.5px] font-medium">{b.label}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {b.hint}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-7 space-y-4 border-t border-border pt-6">
              {errorProfile.map((e) => (
                <div key={e.label}>
                  <div className="mb-1.5 flex justify-between text-[12.5px]">
                    <span>{e.label}</span>
                    <span className="tabular-nums text-muted-foreground">
                      {valueByLabel(dna?.errorProfile, e.label) ?? e.value}%
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className={cn("h-full rounded-full", e.tone)}
                      style={{ width: `${valueByLabel(dna?.errorProfile, e.label) ?? e.value}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.06}>
          <div className="surface h-full p-5">
            <div className="flex items-center gap-2">
              <Gauge className="h-4 w-4 text-primary" />
              <h2 className="text-[15px] font-semibold">DNA profile</h2>
            </div>
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
            <p className="text-[12px] leading-relaxed text-muted-foreground">
              Pattern: <span className="text-foreground">disciplined sprinter</span>. You start fast
              and accurate, then lose 27% accuracy in the final third. Endurance, not syllabus, is
              your ceiling.
            </p>
          </div>
        </Reveal>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {[
          { title: "Weak chapters", list: weak, tone: "text-destructive" },
          { title: "Strong chapters", list: strong, tone: "text-success" },
        ].map((col, ci) => (
          <Reveal key={col.title} delay={ci * 0.06}>
            <div className="surface h-full p-5">
              <h2 className="text-[15px] font-semibold">{col.title}</h2>
              <ul className="mt-4 space-y-3.5">
                {col.list.map((t) => (
                  <li key={t.id}>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span>{t.name}</span>
                      <span className={cn("tabular-nums text-[12px]", col.tone)}>{t.mastery}%</span>
                    </div>
                    <Progress value={t.mastery} className="h-1.5" />
                    <p className="mt-1 text-[11.5px] text-muted-foreground">
                      {t.subject} · last revised {t.lastRevised} · {t.weakQuestions} weak questions
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>
        ))}
      </div>
    </div>
  );
}
