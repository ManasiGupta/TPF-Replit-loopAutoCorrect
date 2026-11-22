import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Search, X, Plug } from "lucide-react";
import { useDemo, agentStats } from "@/lib/demo-store";
import { Empty, Eyebrow, Stat, ago } from "@/components/loop/ui";
import { cn } from "@/lib/utils";

function Spark({ values }: { values: number[] }) {
  if (values.length < 2) return <span className="font-mono text-[10px] text-muted-foreground">1 version</span>;
  const min = Math.min(...values) - 2, max = Math.max(...values) + 2;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 72},${22 - ((v - min) / (max - min)) * 20}`).join(" ");
  const last = pts.split(" ").pop()!.split(",");
  return (
    <svg viewBox="-2 -2 78 28" className="h-6 w-20 text-primary" aria-hidden>
      <polyline points={pts} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.4" fill="currentColor" />
    </svg>
  );
}

export default function AgentsPage() {
  const { state } = useDemo();
  const [search, setSearch] = useState("");
  const rows = useMemo(() => state.agents.map((a) => ({
    a, s: agentStats(state, a.id),
    trend: state.versions.filter((v) => v.agentId === a.id).sort((x, y) => x.n - y.n).map((v) => v.passRate),
    last: state.calls.find((c) => c.agentId === a.id)?.at,
  })), [state]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? rows.filter(({ a }) => `${a.name} ${a.org} ${a.remoteId}`.toLowerCase().includes(q)) : rows;
  }, [rows, search]);

  const totals = useMemo(() => {
    const rates = rows.map((r) => r.s.passRate).filter((x): x is number => x !== null);
    return {
      avg: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
      open: rows.reduce((n, r) => n + r.s.open, 0),
      review: rows.reduce((n, r) => n + r.s.pendingFixes, 0),
      calls: rows.reduce((n, r) => n + r.s.calls, 0),
    };
  }, [rows]);

  return (
    <div>
      <div className="rise mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow className="mb-1">Workspace</Eyebrow>
          <h1 className="font-display text-4xl font-semibold">Agents</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Where each voice agent is failing, and what is waiting on you.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, org, or agent ID" data-testid="input-search" className="h-9 w-full rounded-md border border-input bg-card pl-9 pr-8 text-sm outline-none transition-shadow placeholder:text-muted-foreground focus:ring-2 focus:ring-ring/30" />
          {search && <button onClick={() => setSearch("")} aria-label="Clear search" data-testid="button-clear-search" className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>}
        </div>
      </div>

      <dl className="rise mb-6 grid grid-cols-2 divide-border overflow-hidden rounded-xl border border-border bg-card md:grid-cols-4 md:divide-x [&>*:nth-child(2n)]:border-l [&>*:nth-child(n+3)]:border-t md:[&>*]:border-0" style={{ animationDelay: "50ms" }}>
        <Stat label="Agents" value={rows.length} hint={`${rows.filter((r) => r.a.status === "monitoring").length} monitoring`} />
        <Stat label="Avg pass rate" value={`${totals.avg.toFixed(1)}%`} hint="Live versions" tone="pass" testId="text-avg-pass" />
        <Stat label="Open failures" value={totals.open} hint={`across ${totals.calls} sampled calls`} tone="fail" testId="text-open-failures" />
        <Stat label="Fixes to review" value={totals.review} hint="Candidates awaiting approval" tone="primary" />
      </dl>

      {rows.length === 0 ? (
        <div className="rounded-xl border border-border bg-card">
          <Empty icon={Plug} title="No agents in this demo" body="Connect a sample agent to explore the workspace.">
            <Link href="/connect" className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">Connect sample agent</Link>
          </Empty>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[minmax(0,1fr)_6rem_7rem_7.5rem_7rem_1.25rem] gap-4 border-b border-border px-5 py-2.5 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground md:grid">
            <span>Agent</span><span>Trend</span><span>Pass rate</span><span>Open failures</span><span>Review</span><span />
          </div>
          {filtered.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground" data-testid="text-no-results">No agents match "{search}".</div>
          ) : (
            <ul>
              {filtered.map(({ a, s, trend, last }, i) => (
                <li key={a.id} className="rise border-b border-border/70 last:border-0" style={{ animationDelay: `${80 + i * 40}ms` }}>
                  <Link href={`/agents/${a.id}`} data-testid={`link-agent-${a.id}`} className="group grid grid-cols-2 gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-secondary/50 md:grid-cols-[minmax(0,1fr)_6rem_7rem_7.5rem_7rem_1.25rem] md:items-center">
                    <div className="col-span-2 min-w-0 md:col-span-1">
                      <div className="flex items-center gap-2">
                        <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", a.status === "monitoring" ? "bg-pass" : "bg-muted-foreground/50")} />
                        <span className="truncate font-medium" data-testid={`text-agent-name-${a.id}`}>{a.org} <span className="text-muted-foreground">/</span> {a.name}</span>
                        <span className="rounded-full bg-secondary px-2 py-px font-mono text-[10px] text-muted-foreground">v{a.liveVersion}</span>
                      </div>
                      <p className="mt-0.5 truncate pl-3.5 font-mono text-[11px] text-muted-foreground">{a.remoteId} · {a.status === "paused" ? "paused" : last ? `last call ${ago(last)}` : "no calls yet"}</p>
                    </div>
                    <Spark values={trend} />
                    <span className="text-sm font-medium tabular" data-testid={`text-passrate-${a.id}`}><span className="text-muted-foreground md:hidden">Pass </span>{s.passRate?.toFixed(1)}%</span>
                    <span className={cn("text-sm tabular", s.open > 0 ? "text-destructive" : "text-muted-foreground")} data-testid={`text-failures-${a.id}`}>{s.open} <span className="text-xs text-muted-foreground">in {s.openClusters} cluster{s.openClusters === 1 ? "" : "s"}</span></span>
                    <span>{s.pendingFixes > 0 ? <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-medium text-accent-foreground">{s.pendingFixes} fix ready</span> : <span className="text-xs text-muted-foreground">Clear</span>}</span>
                    <ArrowRight className="hidden h-4 w-4 -translate-x-1 text-muted-foreground opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100 md:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
