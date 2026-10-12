import { cn } from "@/lib/utils";

export function Logo({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-[10px] bg-brand-gradient">
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path
            d="M5 18V9m7 9V5m7 13v-6"
            stroke="currentColor"
            className="text-primary-foreground"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>
      {showWordmark && <span className="text-[17px] font-semibold tracking-tight">RankOS</span>}
    </span>
  );
}
