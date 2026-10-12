import { cn } from "@/lib/utils";

export function RingProgress({
  value,
  size = 96,
  stroke = 8,
  label,
  sublabel,
  className,
  tone = "primary",
}: {
  value: number;
  size?: number;
  stroke?: number;
  label?: string;
  sublabel?: string;
  className?: string;
  tone?: "primary" | "success" | "warning" | "accent";
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const toneClass = {
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    accent: "text-accent",
  }[tone];

  return (
    <div
      className={cn("relative grid place-items-center", className)}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          className="stroke-muted"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c - (c * value) / 100}
          className={cn(
            "stroke-current transition-[stroke-dashoffset] duration-1000 ease-out",
            toneClass,
          )}
        />
      </svg>
      <div className="absolute text-center">
        <p className="text-lg font-semibold tabular-nums leading-none">{label ?? `${value}%`}</p>
        {sublabel && (
          <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
            {sublabel}
          </p>
        )}
      </div>
    </div>
  );
}
