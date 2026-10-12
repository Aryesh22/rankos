import { cn } from "@/lib/utils";
import type { HeatmapCell } from "@/services/analytics";

const levels = [
  "bg-muted",
  "bg-primary/20",
  "bg-primary/40",
  "bg-primary/60",
  "bg-primary/80",
  "bg-primary",
];

export function StudyHeatmap({
  data = [],
  className,
}: {
  data?: HeatmapCell[];
  className?: string;
}) {
  const weeks: HeatmapCell[][] = [];
  for (let i = 0; i < data.length; i += 7) weeks.push(data.slice(i, i + 7));

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {weeks.map((week, wi) => (
          <div key={wi} className="flex flex-col gap-[3px]">
            {week.map((d) => (
              <span
                key={d.date}
                title={`${d.date} · ${d.value}h focused`}
                className={cn(
                  "h-[11px] w-[11px] shrink-0 rounded-[3px] transition-transform hover:scale-125",
                  levels[d.value] ?? levels[0],
                )}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Last 26 weeks</span>
        <span className="flex items-center gap-1">
          Less
          {levels.map((l, i) => (
            <span key={i} className={cn("h-[10px] w-[10px] rounded-[3px]", l)} />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
