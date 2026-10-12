import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { AnimatedNumber } from "./Motion";

export function StatCard({
  label,
  value,
  suffix,
  decimals = 0,
  delta,
  icon: Icon,
  hint,
  tone = "default",
  className,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
  delta?: number;
  icon?: LucideIcon;
  hint?: string;
  tone?: "default" | "primary" | "success" | "warning" | "danger";
  className?: string;
}) {
  const toneRing = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-success",
    warning: "text-warning",
    danger: "text-destructive",
  }[tone];

  return (
    <div className={cn("surface hover-lift p-5", className)}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-[13px] font-medium text-muted-foreground">{label}</p>
        {Icon && <Icon className={cn("h-4 w-4", toneRing)} strokeWidth={1.75} />}
      </div>
      <div className="mt-3 flex items-end gap-2">
        <AnimatedNumber
          value={value}
          decimals={decimals}
          suffix={suffix}
          className="text-[28px] font-semibold leading-none tracking-tight"
        />
        {typeof delta === "number" && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] font-medium",
              delta >= 0 ? "bg-success/12 text-success" : "bg-destructive/12 text-destructive",
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
