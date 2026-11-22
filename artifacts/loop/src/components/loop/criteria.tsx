import type { Criterion } from "@workspace/api-client-react";

const sourceLabel: Record<string, string> = { imported: "Imported", user: "Yours", loop: "Loop" };

export function CriterionRow({ c, index }: { c: Criterion; index: number }) {
  return (
    <li className="rise group grid grid-cols-[2.25rem_1fr] gap-3 border-b border-border/70 py-4 last:border-0" style={{ animationDelay: `${Math.min(index, 12) * 35}ms` }} data-testid={`row-criterion-${c.id}`}>
      <span className="pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">{String(index + 1).padStart(2, "0")}</span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{c.name}</span>
          <span className={`rounded-full px-2 py-px font-mono text-[10px] uppercase tracking-wider ${c.source === "user" ? "bg-accent text-accent-foreground" : "bg-secondary text-muted-foreground"}`}>{sourceLabel[c.source] ?? c.source}</span>
        </div>
        {c.text && c.text !== c.name && <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{c.text}</p>}
      </div>
    </li>
  );
}

export function NotMeasured({ testId }: { testId?: string }) {
  return <span className="font-mono text-xs text-muted-foreground" data-testid={testId}>not yet measured</span>;
}
