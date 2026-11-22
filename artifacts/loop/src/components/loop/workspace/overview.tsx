import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useDemo, agentStats } from "@/lib/demo-store";
import { Panel, Stat, Verdict, fmtDate, fmtTime } from "@/components/loop/ui";
import type { TabKey } from "@/pages/agent-detail";

export function OverviewTab({ agentId, onTab }: { agentId: string; onTab: (t: TabKey) => void }) {
  const { state } = useDemo();
  const agent = state.agents.find((a) => a.id === agentId)!;
  const s = agentStats(state, agentId);
  const versions = useMemo(() => state.versions.filter((v) => v.agentId === agentId).sort((a, b) => a.n - b.n), [state.versions, agentId]);
  const data = versions.map((v) => ({ name: `v${v.n}`, rate: v.passRate, note: v.note, date: fmtDate(v.createdAt), live: v.n === agent.liveVersion }));
  const live = versions.find((v) => v.n === agent.liveVersion);
  const failures = state.failures.filter((f) => f.agentId === agentId && f.status !== "fixed").sort((a, b) => b.callIds.length - a.callIds.length);
  const recent = state.calls.filter((c) => c.agentId === agentId).slice(0, 5);
  const pending = state.fixes.find((f) => f.agentId === agentId && f.status === "candidate");

  return (
    <div className="space-y-5">
      <dl className="grid grid-cols-2 overflow-hidden rounded-xl border border-border bg-card lg:grid-cols-4 [&>*]:border-border [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+2)]:border-l lg:[&>*:nth-child(n+3)]:border-t-0">
        <Stat label="Pass rate, live" value={`${s.passRate?.toFixed(1)}%`} hint={`v${agent.liveVersion} across ${s.calls} calls`} tone="pass" testId="text-passrate" />
        <Stat label="Open failures" value={s.open} hint={`${s.openClusters} clusters`} tone="fail" testId="text-failures" />
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
        <Panel title="Pass rate by version" action={<span className="font-mono text-[10.5px] text-muted-foreground">% of criteria checks passed</span>}>
          <div className="h-64 px-2 pb-3 pt-4" data-testid="chart-passrate">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 8, right: 16, bottom: 4, left: -8 }}>
                <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono" }} />
                <YAxis domain={[60, 100]} tickFormatter={(v: number) => `${v}%`} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))", fontFamily: "JetBrains Mono" }} width={48} />
                <Tooltip
                  cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.3 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as (typeof data)[number];
                    return (
                      <div className="rounded-lg border border-popover-border bg-popover px-3 py-2 text-xs shadow-md">
                        <p className="font-mono text-muted-foreground">{p.name} · {p.date}{p.live ? " · live" : ""}</p>
                        <p className="mt-0.5 font-display text-base font-semibold">{p.rate.toFixed(1)}%</p>
                        <p className="text-muted-foreground">{p.note}</p>
                      </div>
                    );
                  }}
                />
                <Line type="monotone" dataKey="rate" stroke="hsl(var(--primary))" strokeWidth={2.2} dot={{ r: 3.5, fill: "hsl(var(--card))", strokeWidth: 2 }} activeDot={{ r: 5 }} animationDuration={700} />
              </LineChart>
            </ResponsiveContainer>
          </div>
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
              <Verdict pass={c.passed} />
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
