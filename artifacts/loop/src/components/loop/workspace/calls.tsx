import { useMemo, useState } from "react";
import { PhoneOff } from "lucide-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useDemo } from "@/lib/demo-store";
import type { Call } from "@/lib/demo-types";
import { Empty, Panel, Segmented, Tag, Verdict, fmtDur, fmtTime } from "@/components/loop/ui";
import { cn } from "@/lib/utils";
import { CriteriaBreakdown } from "@/components/loop/criteria-breakdown";

type Filter = "all" | "failed" | "passed" | "production" | "test";

export function CallsTab({ agentId }: { agentId: string }) {
  const { state } = useDemo();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState<Call | null>(null);
  const calls = useMemo(() => state.calls.filter((c) => c.agentId === agentId), [state.calls, agentId]);
  const shown = calls.filter((c) => filter === "all" || (filter === "failed" ? !c.passed : filter === "passed" ? c.passed : c.kind === filter));
  const count = (f: Filter) => calls.filter((c) => f === "all" || (f === "failed" ? !c.passed : f === "passed" ? c.passed : c.kind === f)).length;
  const crit = (id: string) => state.criteria.find((c) => c.id === id)?.text ?? "Removed criterion";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Segmented value={filter} onChange={(value) => setFilter(value as Filter)} testId="filter-calls" options={(["all", "failed", "passed", "production", "test"] as Filter[]).map((f) => ({ value: f, label: f[0].toUpperCase() + f.slice(1), count: count(f) }))} />
        <span className="font-mono text-[11px] text-muted-foreground">Sample calls, last 9 days</span>
      </div>
      <Panel>
        {shown.length === 0 ? <Empty icon={PhoneOff} title="No calls here" body="Nothing matches this filter yet." /> : (
          <ul className="divide-y divide-border">
            {shown.map((c) => (
              <li key={c.id}>
                <button onClick={() => setOpen(c)} data-testid={`row-call-${c.id}`} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/50 sm:grid-cols-[8.5rem_1fr_6rem_4rem_3rem_auto]">
                  <span className="font-mono text-xs text-muted-foreground">{fmtTime(c.at)}</span>
                  <span className="hidden min-w-0 truncate sm:block">{c.passed ? c.transcript[c.transcript.length - 1].text : state.failures.find((f) => f.id === c.failureId)?.title}</span>
                  <span className="hidden sm:block"><Tag>{c.kind}</Tag></span>
                  <span className="hidden font-mono text-xs text-muted-foreground tabular sm:block">{fmtDur(c.durationSec)}</span>
                  <span className="hidden font-mono text-xs text-muted-foreground sm:block">v{c.version}</span>
                  <CriteriaBreakdown total={c.results.length} failed={c.results.filter((r) => !r.pass).length} unknown={0} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {open && (
            <>
              <SheetHeader className="text-left">
                <div className="flex flex-wrap items-center gap-2"><CriteriaBreakdown total={open.results.length} failed={open.results.filter((r) => !r.pass).length} unknown={0} /><Tag>{open.kind}</Tag><Tag>v{open.version}</Tag></div>
                <SheetTitle className="font-display text-xl">{open.caller}</SheetTitle>
                <SheetDescription className="font-mono text-xs">{fmtTime(open.at)} · {fmtDur(open.durationSec)} · {open.id}</SheetDescription>
              </SheetHeader>
              <h4 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Criteria</h4>
              <ul className="space-y-2" data-testid="list-call-criteria">
                {open.results.map((r) => (
                  <li key={r.criterionId} className={cn("rounded-lg border px-3 py-2.5", r.pass ? "border-border" : "border-destructive/30 bg-destructive/5")}>
                    <div className="flex items-start justify-between gap-3"><p className="text-sm">{crit(r.criterionId)}</p><Verdict pass={r.pass} size="xs" /></div>
                    <p className="mt-1 text-xs text-muted-foreground">{r.reason}</p>
                  </li>
                ))}
              </ul>
              <h4 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Transcript</h4>
              <ol className="space-y-2.5" data-testid="list-transcript">
                {open.transcript.map((t, i) => (
                  <li key={i} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", t.role === "agent" ? "rounded-tl-sm bg-secondary" : "ml-auto rounded-tr-sm bg-accent text-accent-foreground")}>
                    <span className="mb-0.5 block font-mono text-[10px] uppercase opacity-60">{t.role}</span>{t.text}
                  </li>
                ))}
              </ol>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
