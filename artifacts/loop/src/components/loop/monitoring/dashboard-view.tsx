import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, Clock, Languages, MessageSquare, Siren, X } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CallSummary, DashboardIncident, DashboardMetric, HeatmapCell, MonitoringDashboard } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Segmented, fmtDur } from "@/components/loop/ui";
import { humanizeCriterion } from "@/components/loop/call-categories";
import { cn } from "@/lib/utils";

export type Bucket = "hour" | "day";
const IMPACTS = ["Margin", "Trust", "Returns", "Conversion", "Experience"];

function fmtIn(tz: string, iso: string | number, mode: "tick-hour" | "tick-day" | "full") {
  const d = new Date(iso);
  const o: Intl.DateTimeFormatOptions = mode === "tick-hour" ? { hour: "2-digit", minute: "2-digit", day: "numeric", month: "short" } : mode === "tick-day" ? { day: "numeric", month: "short" } : { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" };
  try { return new Intl.DateTimeFormat(undefined, { ...o, timeZone: tz }).format(d); } catch { return new Intl.DateTimeFormat(undefined, o).format(d); }
}

function metricValue(m: DashboardMetric) {
  if (m.value == null) return "—";
  if (m.unit === "percent") return `${m.value.toFixed(1)}%`;
  if (m.unit === "score") return m.value.toFixed(1);
  return m.value.toLocaleString();
}

function Metric({ m }: { m: DashboardMetric }) {
  return <div className="flex min-h-40 flex-col justify-between rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-6" data-testid={`metric-${m.key}`}>
    <p className="font-mono text-[11px] uppercase tracking-[.16em] text-[#77758A]">{m.label}</p>
    <p className="mt-3 font-display text-5xl font-semibold leading-none tracking-[-.04em] tabular sm:text-6xl" data-testid={`text-metric-${m.key}`}>{metricValue(m)}</p>
    <div className="mt-3 text-xs leading-relaxed text-[#77758A]">
      {m.delta != null && <span className="mr-2 font-mono text-[#1A1A2E]">{m.delta > 0 ? "+" : ""}{m.unit === "percent" ? `${m.delta.toFixed(1)} pts` : m.delta.toFixed(1)}{m.baseline != null ? " vs baseline" : ""}</span>}
      {m.note}
    </div>
  </div>;
}

type Focus = { label: string; ids: string[] };

export function MonitoringDashboardView({ data, readOnly, bucket, onBucket, onOpenCall, incidentId, onIncident, header }: {
  data: MonitoringDashboard; readOnly?: boolean; bucket: Bucket; onBucket?: (b: Bucket) => void;
  onOpenCall: (id: string) => void; incidentId: string | null; onIncident: (id: string | null) => void; header?: React.ReactNode;
}) {
  const tz = data.timezone;
  const [focus, setFocus] = useState<Focus | null>(null);
  const tickMode = bucket === "hour" ? "tick-hour" : "tick-day";
  const series = useMemo(() => data.timeline.map((p) => ({ ...p, t: new Date(p.at).getTime() })), [data.timeline]);
  const versions = useMemo(() => data.versions.map((v) => ({ ...v, t: new Date(v.at).getTime() })), [data.versions]);
  const hasScore = series.some((p) => p.score != null);
  const impacts = useMemo(() => IMPACTS.map((name) => data.impacts.find((i) => i.impact === name) ?? { impact: name, failedCalls: 0, callIds: [] as string[] }), [data.impacts]);
  const feed = useMemo(() => [...data.calls].sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [data.calls]);
  const shown = focus ? feed.filter((c) => focus.ids.includes(c.id)) : feed;
  const missing = focus ? focus.ids.length - shown.length : 0;
  const incident = data.incidents.find((i) => i.id === incidentId) ?? null;
  const columns = data.heatmap[0]?.cells ?? [];

  const cellClick = (criterionId: string, name: string, cell: HeatmapCell) => {
    const failing = data.calls.filter((c) => cell.callIds.includes(c.id) && c.failureReasons.some((r) => r.criterionId === criterionId)).map((c) => c.id);
    setFocus({ label: `${humanizeCriterion(name)} · ${fmtIn(tz, cell.at, "full")}`, ids: failing.length ? failing : cell.callIds });
  };

  return <div className="space-y-6">
    {data.monitoring.lastError && <div role="alert" className="flex items-start gap-3 rounded-xl border border-warn/30 bg-warn/8 px-4 py-3 text-sm text-warn" data-testid="status-stale">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <p><strong>Data may be stale.</strong> The last sync failed: {data.monitoring.lastError}. Last successful sync: <span className="font-mono">{data.monitoring.lastSuccessAt ? fmtIn(tz, data.monitoring.lastSuccessAt, "full") : "never"}</span>.</p>
    </div>}

    {data.alerts.length > 0 && <div className="space-y-2" data-testid="list-alerts">
      {data.alerts.map((a) => <button key={a.id} type="button" onClick={() => onIncident(a.incidentId)} data-testid={`alert-${a.id}`} className="flex w-full items-center gap-3 rounded-xl bg-destructive px-4 py-3 text-left text-white transition-transform hover:-translate-y-0.5">
        <Siren className="h-5 w-5 shrink-0" />
        <span className="min-w-0 flex-1"><span className="block font-semibold">{a.title}</span><span className="block text-sm text-white/80">{a.detail}</span></span>
        <span className="hidden shrink-0 items-center gap-1 text-sm font-medium sm:inline-flex">Open incident <ArrowRight className="h-4 w-4" /></span>
      </button>)}
    </div>}

    {header}

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" data-testid="grid-metrics">
      {data.metrics.map((m) => <Metric key={m.key} m={m} />)}
    </section>
    <p className="-mt-3 font-mono text-[11px] text-[#858295]">{data.totalCalls} imported conversations · {fmtIn(tz, data.periodStart, "full")} to {fmtIn(tz, data.periodEnd, "full")} · {tz}{readOnly ? " · frozen, no auto-refresh" : ` · updated ${fmtIn(tz, data.generatedAt, "full")}`}</p>

    <section className="rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-6">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8B889A]">Trend</p><h2 className="mt-1 font-display text-2xl font-semibold">Average score</h2></div>
        {onBucket && !readOnly ? <Segmented value={bucket} onChange={(v) => onBucket(v as Bucket)} testId="toggle-bucket" options={[{ value: "hour", label: "Hourly" }, { value: "day", label: "Daily" }]} /> : <span className="font-mono text-xs text-[#77758A]">{bucket === "hour" ? "Hourly" : "Daily"}</span>}
      </div>
      {!hasScore ? <p className="rounded-xl border border-dashed border-[#DEDCE9] px-4 py-12 text-center text-sm text-[#858295]">No scored calls in this period yet.</p> : <div className="h-72" data-testid="chart-score">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{ top: 22, right: 16, bottom: 4, left: -8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="t" type="number" scale="time" domain={["dataMin", "dataMax"]} tickFormatter={(v: number) => fmtIn(tz, v, tickMode)} tickLine={false} axisLine={{ stroke: "hsl(var(--border))" }} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} minTickGap={28} />
            <YAxis domain={[0, 100]} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} width={44} />
            <Tooltip content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as (typeof series)[number];
              return <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
                <p className="font-mono text-muted-foreground">{fmtIn(tz, p.at, "full")}</p>
                <p className="mt-0.5 font-display text-lg font-semibold">{p.score == null ? "No score" : p.score.toFixed(1)}</p>
                <p className="text-muted-foreground">{p.calls} calls · {p.errorCalls} with errors</p>
              </div>;
            }} />
            {versions.map((v) => <ReferenceLine key={v.id} x={v.t} stroke="hsl(var(--foreground))" strokeOpacity={0.35} strokeDasharray="4 3" label={{ value: v.version ?? "Unknown version", position: "top", fontSize: 11, fill: "hsl(var(--foreground))" }} />)}
            <Line type="linear" dataKey="score" stroke="hsl(var(--primary))" strokeWidth={2.5} connectNulls={false} dot={{ r: 3, fill: "hsl(var(--card))", strokeWidth: 2 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>}
      <p className="mt-3 text-xs leading-relaxed text-[#77758A]">{data.scoreNote} Gaps mean no scored calls in that {bucket}.</p>
      {versions.length > 0 && <ul className="mt-4 divide-y divide-[#EFEDF5] rounded-xl border border-[#EAE8F1] text-sm" data-testid="list-versions">
        {versions.map((v) => <li key={v.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
          <span className="font-mono text-xs text-[#77758A]">{fmtIn(tz, v.at, "full")}</span>
          <span className="font-medium">First observed {v.version ?? "Unknown version"}</span>
          <span className="text-xs text-[#77758A]">Publisher: {v.publisher}</span>
          <span className="min-w-0 flex-1 text-xs text-[#858295]">{v.evidence}</span>
        </li>)}
      </ul>}
      {data.versionNote && <p className="mt-2 text-[11px] leading-relaxed text-[#858295]">{data.versionNote}</p>}
    </section>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="min-w-0 rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8B889A]">Criteria over time</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Where calls fail</h2>
        {data.heatmap.length === 0 || columns.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-[#DEDCE9] px-4 py-10 text-center text-sm text-[#858295]">No criterion results in this period.</p> : <>
          <div className="mt-4 overflow-x-auto" data-testid="heatmap">
            <div className="grid gap-[3px]" style={{ gridTemplateColumns: `minmax(9rem,12rem) repeat(${columns.length}, minmax(16px, 1fr))` }}>
              {data.heatmap.map((row) => <div key={row.criterionId} className="contents">
                <span className="truncate pr-2 text-xs leading-6" title={humanizeCriterion(row.name)}>{humanizeCriterion(row.name)}</span>
                {row.cells.map((cell, ci) => {
                  const measured = cell.passed + cell.failed;
                  const share = measured ? cell.failed / measured : 0;
                  const label = `${humanizeCriterion(row.name)}, ${fmtIn(tz, cell.at, "full")}: ${cell.failed} failed, ${cell.passed} passed, ${cell.unknown} unknown`;
                  const empty = measured + cell.unknown === 0;
                  return <button key={ci} type="button" disabled={cell.failed === 0} title={label} aria-label={label} onClick={() => cellClick(row.criterionId, row.name, cell)} data-testid={`cell-${row.criterionId}-${ci}`}
                    className={cn("h-6 rounded-[3px] transition-transform enabled:hover:scale-110 enabled:cursor-pointer disabled:cursor-default",
                      empty ? "bg-[#F4F3F8]" : cell.failed > 0 ? "bg-destructive" : measured ? "bg-[#DCD7FF]" : "border border-dashed border-[#B9B6C8] bg-white")}
                    style={cell.failed > 0 ? { opacity: 0.35 + share * 0.65 } : undefined} />;
                })}
              </div>)}
              <span />
              {columns.map((c, i) => <span key={i} className="truncate pt-1 text-center font-mono text-[9.5px] text-[#858295]">{i % Math.max(1, Math.ceil(columns.length / 8)) === 0 ? fmtIn(tz, c.at, tickMode) : ""}</span>)}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-4 text-[11px] text-[#77758A]">
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-destructive" />Failures (darker = larger share)</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-[#DCD7FF]" />All measured passed</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] border border-dashed border-[#B9B6C8]" />Unknown only</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-[3px] bg-[#F4F3F8]" />No calls</span>
            <span>Click a red cell to list its failing calls.</span>
          </div>
        </>}
      </section>

      <section className="min-w-0 rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-6">
        <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8B889A]">Business impact</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">Failed calls by impact</h2>
        <div className="mt-4 h-64" data-testid="chart-impact">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={impacts} layout="vertical" margin={{ top: 0, right: 16, bottom: 0, left: 8 }}>
              <CartesianGrid strokeDasharray="2 4" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" domain={[0, "dataMax"]} allowDecimals={false} tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis type="category" dataKey="impact" tickLine={false} axisLine={false} width={84} tick={{ fontSize: 13, fill: "hsl(var(--foreground))" }} />
              <Tooltip cursor={{ fill: "hsl(var(--secondary))" }} formatter={(v: number) => [`${v} failed calls`, ""]} />
              <Bar dataKey="failedCalls" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} isAnimationActive={false} cursor="pointer"
                onClick={(d: { impact?: string; callIds?: string[] }) => d.callIds?.length && setFocus({ label: `${d.impact} impact`, ids: d.callIds })} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-[#77758A]">A call counts once per impact when any of its failed criteria maps there. Mappings are set in Settings.</p>
      </section>
    </div>

    <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
      <section className="min-w-0 rounded-2xl border border-[#E7E4F0] bg-white" data-testid="feed-calls">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFEDF5] px-5 py-4">
          <div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8B889A]">{readOnly ? "Snapshot" : "Live feed"}</p><h2 className="mt-1 font-display text-2xl font-semibold">Newest calls</h2></div>
          {focus && <button type="button" onClick={() => setFocus(null)} data-testid="button-clear-focus" className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-[#1A1A2E] px-3 py-1.5 text-xs text-white"><span className="truncate">{focus.label}</span><X className="h-3.5 w-3.5 shrink-0" /></button>}
        </div>
        {shown.length === 0 ? <p className="px-5 py-12 text-center text-sm text-[#858295]">{focus ? "None of these calls are in the recent feed." : "No calls imported yet."}</p>
          : <ul className="max-h-[38rem] divide-y divide-[#EFEDF5] overflow-y-auto">{shown.map((c) => <FeedRow key={c.id} c={c} tz={tz} onOpen={() => onOpenCall(c.id)} />)}</ul>}
        {missing > 0 && <p className="border-t border-[#EFEDF5] px-5 py-2.5 text-xs text-[#858295]">{missing} more matching call{missing === 1 ? " is" : "s are"} outside the recent feed. Use the Calls tab to see all.</p>}
      </section>

      <section className="min-w-0 rounded-2xl border border-[#E7E4F0] bg-white p-5" data-testid="list-incidents">
        <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8B889A]">Incidents</p>
        <h2 className="mt-1 font-display text-2xl font-semibold">{data.incidents.filter((i) => i.state === "open").length} open</h2>
        {data.incidents.length === 0 ? <p className="mt-4 text-sm text-[#858295]">No incidents recorded. Incidents open when the score drops 20+ points in an hour against the 7-day average, more than 10% of calls in an hour error, or one criterion fails 3+ times in an hour.</p>
          : <ul className="mt-4 space-y-2">{data.incidents.map((i) => <li key={i.id}><button type="button" onClick={() => onIncident(i.id)} data-testid={`row-incident-${i.id}`} className="flex w-full items-start gap-3 rounded-xl border border-[#EAE8F1] px-3 py-2.5 text-left transition-colors hover:border-[#C9C2FF]">
            <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", i.state === "open" ? "bg-destructive" : "bg-[#B9B6C8]")} />
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{i.title}</span><span className="font-mono text-[11px] text-[#858295]">{i.state} · last seen {fmtIn(tz, i.lastSeenAt, "full")} · {i.callIds.length} calls</span></span>
          </button></li>)}</ul>}
      </section>
    </div>

    <Sheet open={!!incident} onOpenChange={(o) => !o && onIncident(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">{incident && <IncidentDetail i={incident} tz={tz} calls={data.calls} onOpenCall={(id) => { onIncident(null); onOpenCall(id); }} />}</SheetContent>
    </Sheet>
  </div>;
}

function FeedRow({ c, tz, onOpen }: { c: CallSummary; tz: string; onOpen: () => void }) {
  return <li><button type="button" onClick={onOpen} data-testid={`row-feed-${c.id}`} className="grid w-full grid-cols-[1fr_auto] gap-3 px-5 py-3.5 text-left transition-colors hover:bg-[#F8F7FC]">
    <div className="min-w-0">
      <p className="truncate font-medium">{c.title || c.summary || "Conversation"}</p>
      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[11px] text-[#77758A]">
        <span>{fmtIn(tz, c.startedAt, "full")}</span>
        <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{fmtDur(c.durationSecs)}</span>
        {c.messageCount != null && <span className="inline-flex items-center gap-1"><MessageSquare className="h-3 w-3" />{c.messageCount}</span>}
        {c.language && <span className="inline-flex items-center gap-1"><Languages className="h-3 w-3" />{c.language}</span>}
        {c.outcome === "error" && <span className="text-warn">error</span>}
        {c.outcome === "analyzing" && <span>analyzing</span>}
      </p>
      {c.failureReasons.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{c.failureReasons.map((r, i) => <span key={`${r.criterionId}-${i}`} className="rounded-full border border-destructive/30 bg-destructive/5 px-2 py-0.5 text-[11px] text-destructive">{humanizeCriterion(r.name)}</span>)}</div>}
    </div>
    <div className="text-right">
      <p className="font-display text-2xl font-semibold tabular">{c.score == null ? "—" : c.score.toFixed(0)}</p>
      <p className="font-mono text-[10px] text-[#858295]">{c.score == null ? "no score" : "score"}</p>
    </div>
  </button></li>;
}

function IncidentDetail({ i, tz, calls, onOpenCall }: { i: DashboardIncident; tz: string; calls: CallSummary[]; onOpenCall: (id: string) => void }) {
  const known = calls.filter((c) => i.callIds.includes(c.id));
  return <>
    <SheetHeader className="text-left">
      <p className={cn("font-mono text-[10px] uppercase tracking-[.16em]", i.state === "open" ? "text-destructive" : "text-muted-foreground")}>{i.state} incident · {i.kind}</p>
      <SheetTitle className="font-display text-2xl" data-testid="text-incident-title">{i.title}</SheetTitle>
      <SheetDescription className="font-mono text-xs">First seen {fmtIn(tz, i.firstSeenAt, "full")} · last seen {fmtIn(tz, i.lastSeenAt, "full")}</SheetDescription>
    </SheetHeader>
    <p className="mt-5 text-sm leading-relaxed">{i.detail}</p>
    <h4 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Calls · {i.callIds.length}</h4>
    {known.length === 0 ? <p className="text-xs text-muted-foreground">These calls are outside the recent feed. Open the Calls tab to browse them.</p>
      : <ul className="space-y-1.5">{known.map((c) => <li key={c.id}><button type="button" onClick={() => onOpenCall(c.id)} data-testid={`link-incident-call-${c.id}`} className="w-full rounded-lg border border-border px-3 py-2 text-left text-sm hover:border-primary/40">
        <span className="block truncate">{c.title || c.summary || "Conversation"}</span><span className="font-mono text-[11px] text-muted-foreground">{fmtIn(tz, c.startedAt, "full")}</span>
      </button></li>)}</ul>}
    {known.length > 0 && known.length < i.callIds.length && <p className="mt-2 text-xs text-muted-foreground">{i.callIds.length - known.length} more outside the recent feed.</p>}
  </>;
}
