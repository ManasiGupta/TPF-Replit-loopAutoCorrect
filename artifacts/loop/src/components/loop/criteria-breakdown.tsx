import { cn } from "@/lib/utils";

export function CriteriaBreakdown({ total, failed, unknown, className, testId }: { total: number; failed: number; unknown: number; className?: string; testId?: string }) {
  if (total <= 0) return <span data-testid={testId} className={cn("inline-flex shrink-0 rounded-full border border-dashed border-muted-foreground/40 px-2 py-0.5 font-mono text-[10.5px] text-muted-foreground", className)}>Not evaluated</span>;
  return <span data-testid={testId} className={cn("inline-flex max-w-full flex-wrap items-center gap-1.5 font-mono text-[11px] tabular", className)}>
    <span className={cn("rounded-full border px-2 py-0.5", failed > 0 ? "border-destructive/30 bg-destructive/8 text-destructive" : "border-border bg-card text-foreground")}>{failed} of {total} criteria failed</span>
    <span className={cn("text-muted-foreground", unknown > 0 && "text-foreground/70")}>{unknown} unknown</span>
  </span>;
}
