import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useDemo, agentStats } from "@/lib/demo-store";
import { Panel, Stat, fmtTime } from "@/components/loop/ui";
import { CriteriaBreakdown } from "@/components/loop/criteria-breakdown";
import type { TabKey } from "@/pages/agent-detail";

export function OverviewTab({ agentId, onTab }: { agentId: string; onTab: (t: TabKey) => void }) {
  const { state } = useDemo();
  const agent = state.agents.find((a) => a.id === agentId)!;
  const s = agentStats(state, agentId);
  const versions = useMemo(() => state.versions.filter((v) => v.agentId === agentId).sort((a, b) => a.n - b.n), [state.versions, agentId]);
  const agentCalls = state.calls.filter((c) => c.agentId === agentId);
  const criteria = state.criteria.filter((c) => c.agentId === agentId).map((cr) => {
    const rs = agentCalls.flatMap((c) => c.results.filter((r) => r.criterionId === cr.id));
    return { ...cr, failed: rs.filter((r) => !r.pass).length, passed: rs.filter((r) => r.pass).length };
  });
  const live = versions.find((v) => v.n === agent.liveVersion);
  const failures = state.failures.filter((f) => f.agentId === agentId && f.status !== "fixed").sort((a, b) => b.callIds.length - a.callIds.length);
  const recent = state.calls.filter((c) => c.agentId === agentId).slice(0, 5);
  const pending = state.fixes.find((f) => f.agentId === agentId && f.status === "candidate");

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4 [&>*]:border-border [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+2)]:border-l lg:[&>*:nth-child(n+3)]:border-t-0">
        <Stat label="Evaluation criteria" value={s.criteria} hint="Sample criteria for this agent" tone="primary" testId="text-criteria" />
        <Stat label="Criteria with failures" value={s.failedCriteria} hint={`Across ${s.calls} sample calls`} tone="fail" testId="text-failed-criteria" />
        <Stat label="Fixed failures" value={s.fixed} hint="Resolved by shipped fixes" />
        <Stat label="Live version" value={`v${agent.liveVersion}`} hint={live ? live.note : ""} tone="primary" testId="text-live-version" />
      </dl>

      {pending && (
        <Link href={`/agents/${agentId}/fixes/${pending.id}`} data-testid="link-pending-fix" className="group flex items-center gap-4 rounded-xl border border-primary/30 bg-accent/60 px-4 py-3 transition-colors hover:bg-accent">
          <span className="h-2 w-2 shrink-0 rounded-full bg-primary pulse-dot" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Candidate fix ready for review</p>
            <p className="truncate text-xs text-muted-foreground">{pending.title}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-primary transition-transform group-hover:translate-x-1" />
        </Link>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.6fr_1fr]">
        <Panel title="Results by criterion" action={<span className="font-mono text-[10.5px] text-muted-foreground">sample calls</span>}>
          <ul className="divide-y divide-border" data-testid="list-criterion-results">
            {criteria.map((cr) => <li key={cr.id} className="flex items-start gap-3 px-4 py-3">
              <p className="min-w-0 flex-1 text-sm leading-relaxed">{cr.text}</p>
              <span className="shrink-0 font-mono text-[11px] tabular text-muted-foreground"><span className={cr.failed ? "text-destructive" : ""}>{cr.failed} failed</span> · {cr.passed} passed</span>
            </li>)}
          </ul>
        </Panel>

        <Panel title="Top open failures" action={<button onClick={() => onTab("failures")} className="text-xs text-primary hover:underline" data-testid="button-view-failures">View all</button>}>
          {failures.length === 0 ? <p className="px-4 py-10 text-center text-sm text-muted-foreground">No open failures. Nice.</p> : (
            <ul className="divide-y divide-border">
              {failures.slice(0, 4).map((f) => (
                <li key={f.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-8 font-display text-lg font-semibold text-destructive tabular">{f.callIds.length}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{f.title}</p>
                    <p className="font-mono text-[10.5px] text-muted-foreground">{f.status === "fixing" ? "fix in review" : "open"}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel title="Recent calls" action={<button onClick={() => onTab("calls")} className="text-xs text-primary hover:underline" data-testid="button-view-calls">All calls</button>}>
        <ul className="divide-y divide-border">
          {recent.map((c) => (
            <li key={c.id} className="grid grid-cols-[1fr_auto] items-center gap-3 px-4 py-2.5 text-sm sm:grid-cols-[9rem_1fr_5rem_auto]">
              <span className="font-mono text-xs text-muted-foreground">{fmtTime(c.at)}</span>
              <span className="hidden truncate sm:block">{c.caller}</span>
              <span className="hidden font-mono text-[11px] text-muted-foreground sm:block">{c.kind}</span>
              <CriteriaBreakdown total={c.results.length} failed={c.results.filter((r) => !r.pass).length} unknown={0} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
