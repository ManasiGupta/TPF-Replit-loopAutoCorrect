import { useState } from "react";
import { useLocation } from "wouter";
import { CheckCircle2, ChevronDown, Wand2 } from "lucide-react";
import { useDemo } from "@/lib/demo-store";
import { Btn, Empty, Segmented, Tag, ago } from "@/components/loop/ui";
import { cn } from "@/lib/utils";

type F = "open" | "fixed";

export function FailuresTab({ agentId }: { agentId: string }) {
  const { state, ensureFix } = useDemo();
  const [, navigate] = useLocation();
  const [filter, setFilter] = useState<F>("open");
  const [expanded, setExpanded] = useState<string | null>(null);
  const all = state.failures.filter((f) => f.agentId === agentId);
  const list = all.filter((f) => (filter === "open" ? f.status !== "fixed" : f.status === "fixed")).sort((a, b) => b.callIds.length - a.callIds.length);
  const max = Math.max(1, ...all.map((f) => f.callIds.length));

  const fix = (id: string) => {
    const fixId = ensureFix(id);
    if (fixId) navigate(`/agents/${agentId}/fixes/${fixId}`);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <Segmented value={filter} onChange={(value) => setFilter(value as F)} testId="filter-failures" options={[{ value: "open", label: "Open", count: all.filter((f) => f.status !== "fixed").length }, { value: "fixed", label: "Fixed", count: all.filter((f) => f.status === "fixed").length }]} />
        <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">Clustered by failing criterion and transcript pattern</span>
      </div>
      {list.length === 0 ? (
        <div className="rounded-xl border border-border bg-card"><Empty icon={CheckCircle2} title={filter === "open" ? "No open failures" : "Nothing fixed yet"} body={filter === "open" ? "Every sampled call passes its criteria." : "Shipped fixes will move clusters here."} /></div>
      ) : (
        <ul className="space-y-3">
          {list.map((f, i) => {
            const crit = state.criteria.find((c) => c.id === f.criterionId);
            const sample = state.calls.find((c) => c.id === f.callIds[0]);
            const isOpen = expanded === f.id;
            return (
              <li key={f.id} className="rise overflow-hidden rounded-xl border border-border bg-card" style={{ animationDelay: `${i * 50}ms` }} data-testid={`card-failure-${f.id}`}>
                <div className="flex flex-col gap-4 p-4 sm:flex-row sm:items-start">
                  <div className="flex shrink-0 items-baseline gap-1 sm:w-16 sm:flex-col sm:items-start sm:gap-0">
                    <span className={cn("font-display text-3xl font-semibold tabular", f.status === "fixed" ? "text-pass" : "text-destructive")}>{f.callIds.length}</span>
                    <span className="font-mono text-[10px] uppercase text-muted-foreground">calls</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{f.title}</h3>
                      {f.status === "fixing" && <Tag className="border-primary/30 bg-accent text-accent-foreground">fix in review</Tag>}
                      {f.status === "fixed" && <Tag className="border-pass/30 text-pass">fixed</Tag>}
                    </div>
                    <p className="mt-1 text-sm text-muted-foreground">{f.summary}</p>
                    <div className="mt-3 h-1 w-full max-w-xs overflow-hidden rounded-full bg-secondary"><div className="h-full origin-left rounded-full bg-destructive/70 transition-transform duration-700" style={{ transform: `scaleX(${f.callIds.length / max})` }} /></div>
                    <p className="mt-2 font-mono text-[11px] text-muted-foreground">Criterion: {crit?.text ?? "removed"} · first seen {ago(f.firstSeen)}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Btn variant="ghost" onClick={() => setExpanded(isOpen ? null : f.id)} data-testid={`button-expand-${f.id}`}>Example<ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} /></Btn>
                    {f.status !== "fixed" && <Btn variant="primary" onClick={() => fix(f.id)} data-testid={`button-fix-${f.id}`}><Wand2 className="h-4 w-4" />{f.status === "fixing" ? "Review fix" : "Fix this"}</Btn>}
                  </div>
                </div>
                {isOpen && sample && (
                  <div className="slidein border-t border-border bg-secondary/30 px-4 py-3">
                    <p className="mb-2 text-xs text-destructive">{sample.results.find((r) => !r.pass)?.reason}</p>
                    <ol className="space-y-1 font-mono text-xs">
                      {sample.transcript.map((t, k) => <li key={k}><span className={t.role === "agent" ? "text-primary" : "text-muted-foreground"}>{t.role}:</span> {t.text}</li>)}
                    </ol>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
