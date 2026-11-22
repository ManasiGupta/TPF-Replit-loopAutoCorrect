import type { CallCategory, CallEvaluation } from "@workspace/api-client-react";
import { cn } from "@/lib/utils";

export function humanizeCriterion(name: string) {
  const t = name.replace(/^__system_eval_criteria_/, "").replace(/_/g, " ").trim();
  return t ? t[0].toUpperCase() + t.slice(1) : name;
}

const FIXED = new Set(["all", "passed", "unknown"]);

export function CallCategories({ categories, value, onChange }: { categories: CallCategory[]; value: string; onChange: (id: string) => void }) {
  const failures = categories.filter((c) => !FIXED.has(c.id));
  const fixed = categories.filter((c) => FIXED.has(c.id));
  const chip = (c: CallCategory) => <button key={c.id} type="button" onClick={() => onChange(c.id)} aria-pressed={value === c.id} data-testid={`button-category-${c.id}`}
    className={cn("inline-flex max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition-colors",
      value === c.id ? "border-[#5B4BFF] bg-[#5B4BFF] text-white" : c.id === "unknown" ? "border-dashed border-border bg-card text-muted-foreground hover:border-[#9388FF]" : "border-border bg-card hover:border-[#9388FF] hover:text-[#5B4BFF]")}>
    <span className="min-w-0 break-words">{humanizeCriterion(c.name)}</span>
    <span className={cn("font-mono text-[10.5px] tabular", value === c.id ? "text-white/75" : "text-muted-foreground")}>{c.count}</span>
  </button>;
  return <div className="mb-4 rounded-xl border border-border bg-card/60 p-3" data-testid="panel-call-categories">
    <div className="flex flex-wrap gap-1.5">{fixed.map(chip)}</div>
    <p className="mb-2 mt-3 font-mono text-[10px] uppercase tracking-[.14em] text-muted-foreground">Failed criteria</p>
    {failures.length ? <div className="flex flex-wrap gap-1.5">{failures.map(chip)}</div>
      : <p className="text-xs text-muted-foreground" data-testid="text-no-failure-categories">No failed criteria recorded for these calls. Calls with unknown results are kept separate and never counted as failures.</p>}
    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Groups come from recorded failed criterion results, not inferred root causes. A call that failed several criteria appears in each group.</p>
  </div>;
}

export function CallFailureReasons({ reasons }: { reasons: CallEvaluation[] }) {
  if (!reasons.length) return null;
  return <ul className="mt-2 space-y-1.5" data-testid="list-failure-reasons">
    {reasons.map((r, i) => <li key={`${r.criterionId}-${i}`} className="rounded-lg border border-destructive/20 bg-destructive/5 px-2.5 py-1.5 text-xs leading-relaxed">
      <span className="font-medium text-destructive">{humanizeCriterion(r.name)}</span>
      <span className="whitespace-normal break-words text-muted-foreground"> · {r.rationale || "No reason given."}</span>
    </li>)}
  </ul>;
}
