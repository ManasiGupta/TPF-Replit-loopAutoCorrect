import { useEffect, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, PhoneOff, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  getGetAgentQueryKey, getGetCallQueryKey, getListAgentsQueryKey, getListCallsQueryKey,
  useGetCall, useListCalls, usePollAgent, useUpdateMonitoring,
} from "@workspace/api-client-react";
import type { AgentDetail, CallEvaluation, ListCallsResult, ListCallsSource, Monitoring } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Empty, Segmented, Tag, ago, fmtDur, fmtTime } from "@/components/loop/ui";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const REFRESH = 15000;
const PAGE = 25;

function errMsg(e: unknown) {
  if (e && typeof e === "object") {
    const d = (e as { data?: { error?: string; message?: string } }).data;
    if (d?.error) return d.error;
    if (d?.message) return d.message;
    if ("message" in e && typeof (e as Error).message === "string") return (e as Error).message;
  }
  return "Request failed";
}

function useInvalidateAgent(id: string) {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: getGetAgentQueryKey(id) });
    qc.invalidateQueries({ queryKey: getListAgentsQueryKey() });
    qc.invalidateQueries({ queryKey: getListCallsQueryKey(id) });
    qc.invalidateQueries({ predicate: (q) => typeof q.queryKey[0] === "string" && q.queryKey[0].startsWith(`/api/agents/${id}/calls/`) });
  };
}

export function ResultPill({ result, size = "sm" }: { result: "passed" | "failed" | "unknown" | "success" | "failure"; size?: "sm" | "xs" }) {
  const r = result === "success" ? "passed" : result === "failure" ? "failed" : result;
  const label = r === "passed" ? "Passed" : r === "failed" ? "Failed" : "Unknown";
  return <span data-testid={`status-result-${r}`} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-full border font-mono uppercase tracking-wide",
    size === "xs" ? "px-1.5 py-0.5 text-[9.5px]" : "px-2 py-0.5 text-[10.5px]",
    r === "passed" && "border-pass/30 bg-pass/10 text-pass",
    r === "failed" && "border-destructive/30 bg-destructive/8 text-destructive",
    r === "unknown" && "border-dashed border-muted-foreground/40 bg-muted text-muted-foreground")}>
    <span className={cn("h-1.5 w-1.5 rounded-full", r === "passed" ? "bg-pass" : r === "failed" ? "bg-destructive" : "border border-muted-foreground/60")} />{label}
  </span>;
}

export function MonitoringLine({ m }: { m: Monitoring }) {
  return <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground" data-testid="text-monitoring-status">
    <span className="relative flex h-1.5 w-1.5">
      {m.enabled && !m.lastError && <span className="pulse-dot absolute inset-0 rounded-full bg-pass" />}
      <span className={cn("relative h-1.5 w-1.5 rounded-full", !m.enabled ? "bg-muted-foreground/50" : m.lastError ? "bg-warn" : "bg-pass")} />
    </span>
    {m.enabled ? `Checking every ${m.pollMinutes} min` : "Monitoring paused"}
    {m.lastSuccessAt ? ` · last synced ${ago(m.lastSuccessAt)}` : " · not synced yet"}
  </span>;
}

function PollButton({ agentId, m }: { agentId: string; m: Monitoring }) {
  const { toast } = useToast();
  const inval = useInvalidateAgent(agentId);
  const poll = usePollAgent();
  const due = m.enabled && (!m.nextPollAt || new Date(m.nextPollAt).getTime() <= Date.now());
  const label = !m.enabled ? "Monitoring paused" : poll.isPending ? "Checking…" : due ? "Check now (due)" : "Check if due";
  return <button type="button" data-testid="button-poll" disabled={!m.enabled || poll.isPending}
    title={m.enabled ? "Runs a check only when the next scheduled check is due. It does not force a refresh." : "Enable monitoring to allow checks."}
    onClick={() => poll.mutate({ id: agentId }, {
      onSuccess: (res) => { inval(); toast({ title: res.lastError ? "Check reported an error" : "Check request sent", description: res.lastError ?? (res.nextPollAt ? `Next scheduled check ${ago(res.nextPollAt)}.` : "Schedule updated.") }); },
      onError: (e) => toast({ title: "Could not request check", description: errMsg(e), variant: "destructive" }),
    })}
    className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium transition-all hover:border-primary/40 hover:text-primary active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50">
    <RefreshCw className={cn("h-3.5 w-3.5", poll.isPending && "animate-spin")} />{label}
  </button>;
}

type RF = "all" | "failed" | "passed" | "unknown";
type SF = "all" | "production" | "test";

export function ConnectedCallsTab({ agent }: { agent: AgentDetail }) {
  const [result, setResult] = useState<RF>("all");
  const [source, setSource] = useState<SF>("all");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const params = { result: result as ListCallsResult, source: source as ListCallsSource, offset, limit: PAGE };
  const q = useListCalls(agent.id, params, { query: { queryKey: getListCallsQueryKey(agent.id, params), refetchInterval: REFRESH } });
  const page = q.data;
  const m = page?.monitoring ?? agent.monitoring;

  return <>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented value={result} onChange={(v) => { setResult(v as RF); setOffset(0); }} testId="filter-result" options={(["all", "failed", "passed", "unknown"] as RF[]).map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) }))} />
        <Segmented value={source} onChange={(v) => { setSource(v as SF); setOffset(0); }} testId="filter-source" options={(["all", "production", "test"] as SF[]).map((v) => ({ value: v, label: v === "all" ? "Any source" : v[0].toUpperCase() + v.slice(1) }))} />
      </div>
      <PollButton agentId={agent.id} m={m} />
    </div>
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2"><MonitoringLine m={m} />{m.lastError && <span className="inline-flex items-center gap-1 text-xs text-warn" data-testid="text-poll-error"><AlertTriangle className="h-3.5 w-3.5" />{m.lastError}</span>}</div>

    <div className="overflow-hidden rounded-xl border border-border bg-card">
      {q.isLoading ? <div className="space-y-px">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="flex items-center gap-4 px-4 py-3.5"><Skeleton className="h-3 w-24" /><Skeleton className="h-3 flex-1" /><Skeleton className="h-4 w-16 rounded-full" /></div>)}</div>
        : q.isError ? <Empty icon={AlertTriangle} title="Calls could not load" body={errMsg(q.error)}><button type="button" data-testid="button-retry-calls" onClick={() => q.refetch()} className="text-sm font-medium text-primary hover:underline">Retry</button></Empty>
        : !page || page.items.length === 0 ? <Empty icon={PhoneOff} title={result === "all" && source === "all" ? "No calls recorded yet" : "No calls match"} body={result === "all" && source === "all" ? (m.enabled ? "Real conversations appear here after the next scheduled check finds them." : "Monitoring is paused. Turn it on in settings to start collecting calls.") : "Try a different result or source filter."} />
        : <ul className={cn("divide-y divide-border transition-opacity", q.isFetching && q.isPlaceholderData && "opacity-60")} data-testid="list-calls">
          {page.items.map((c) => <li key={c.id}>
            <button type="button" onClick={() => setOpen(c.id)} data-testid={`row-call-${c.id}`} className="group grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/50 sm:grid-cols-[8.5rem_1fr_6.5rem_3.5rem_4.5rem_auto]">
              <span className="font-mono text-xs text-muted-foreground">{fmtTime(c.startedAt)}</span>
              <span className={cn("hidden min-w-0 truncate sm:block", !c.summary && "italic text-muted-foreground")}>{c.summary ?? "No summary provided"}</span>
              <span className="hidden sm:block"><Tag className={cn(c.source === "unknown" && "border-dashed text-muted-foreground")}>{c.source === "unknown" ? "source ?" : c.source}</Tag></span>
              <span className="hidden font-mono text-xs text-muted-foreground tabular sm:block">{fmtDur(c.durationSecs)}</span>
              <span className="hidden font-mono text-[11px] text-muted-foreground tabular sm:block">{c.evaluationCount} eval{c.evaluationCount === 1 ? "" : "s"}</span>
              <ResultPill result={c.result} />
            </button>
          </li>)}
        </ul>}
    </div>
    {page && page.total > 0 && <div className="mt-3 flex items-center justify-between font-mono text-[11px] text-muted-foreground">
      <span data-testid="text-calls-range">{page.offset + 1}–{page.offset + page.items.length} of {page.total}</span>
      <div className="flex gap-1">
        <button type="button" aria-label="Previous calls page" data-testid="button-prev-page" disabled={offset === 0 || q.isFetching} onClick={() => setOffset(Math.max(0, offset - PAGE))} className="rounded-md border border-border p-1.5 hover:bg-secondary disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <button type="button" aria-label="Next calls page" data-testid="button-next-page" disabled={page.offset + page.items.length >= page.total || q.isFetching} onClick={() => setOffset(offset + PAGE)} className="rounded-md border border-border p-1.5 hover:bg-secondary disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>}
    <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Source reflects an explicit production or test environment reported by the provider, not a verified test-suite run. Missing or custom environments are unknown. Pass rates use measured production calls only; unknown evaluations are excluded.</p>

    <Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">{open && <CallSheet agentId={agent.id} callId={open} />}</SheetContent>
    </Sheet>
  </>;
}

function CallSheet({ agentId, callId }: { agentId: string; callId: string }) {
  const q = useGetCall(agentId, callId, { query: { enabled: !!callId, queryKey: getGetCallQueryKey(agentId, callId), refetchInterval: REFRESH } });
  if (q.isLoading) return <div className="space-y-3 pt-6"><Skeleton className="h-5 w-32" /><Skeleton className="h-7 w-2/3" /><Skeleton className="h-20 w-full" /><Skeleton className="h-40 w-full" /></div>;
  if (q.isError || !q.data) return <div className="pt-10"><SheetHeader className="sr-only"><SheetTitle>Call</SheetTitle><SheetDescription>Error</SheetDescription></SheetHeader><Empty icon={AlertTriangle} title="Call could not load" body={q.isError ? errMsg(q.error) : "No data returned."}><button type="button" data-testid="button-retry-call" onClick={() => q.refetch()} className="text-sm font-medium text-primary hover:underline">Retry</button></Empty></div>;
  const c = q.data;
  return <>
    <SheetHeader className="text-left">
      <div className="flex flex-wrap items-center gap-2"><ResultPill result={c.result} /><Tag>{c.source}</Tag>{c.versionId && <Tag>{c.versionId}</Tag>}<Tag>{c.status}</Tag></div>
      <SheetTitle className="font-display text-xl" data-testid="text-call-title">{c.summary ?? "Conversation"}</SheetTitle>
      <SheetDescription className="break-all font-mono text-xs">{fmtTime(c.startedAt)} · {fmtDur(c.durationSecs)} · {c.conversationId}{c.environment ? ` · env ${c.environment}` : ""}</SheetDescription>
    </SheetHeader>
    <h4 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Criteria results · {c.evaluations.length}</h4>
    {c.evaluations.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No criteria results were reported for this call. Evaluation may still be pending.</p>
      : <ul className="space-y-2" data-testid="list-call-criteria">{c.evaluations.map((e, i) => <EvalRow key={`${e.criterionId}-${i}`} e={e} />)}</ul>}
    <h4 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Transcript</h4>
    {c.transcript.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground" data-testid="text-transcript-empty">{c.status === "done" ? "The provider returned no transcript for this call." : `Transcript not available yet (status: ${c.status}).`}</p>
      : <ol className="space-y-2.5" data-testid="list-transcript">{c.transcript.map((t, i) => {
        const agentSide = t.role === "agent";
        return <li key={i} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", agentSide ? "rounded-tl-sm bg-secondary" : "ml-auto rounded-tr-sm bg-accent text-accent-foreground")}>
          <span className="mb-0.5 flex justify-between gap-3 font-mono text-[10px] uppercase opacity-60"><span>{t.role}</span><span className="tabular">{fmtDur(Math.round(t.timeInCallSecs))}</span></span>
          {t.text ?? <span className="italic opacity-60">No text (tool call or silence)</span>}
        </li>;
      })}</ol>}
  </>;
}

function EvalRow({ e }: { e: CallEvaluation }) {
  return <li className={cn("rounded-lg border px-3 py-2.5", e.result === "failure" ? "border-destructive/30 bg-destructive/5" : e.result === "unknown" ? "border-dashed border-border" : "border-border")} data-testid={`row-eval-${e.criterionId}`}>
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{e.name}</p><ResultPill result={e.result} size="xs" /></div>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.rationale || "No reason given."}</p>
    {e.score != null && <p className="mt-1.5 font-mono text-[10.5px] text-muted-foreground tabular">score {e.score}{e.maxScore != null ? ` / ${e.maxScore}` : ""}</p>}
  </li>;
}

export function ConnectedSettingsTab({ agent }: { agent: AgentDetail }) {
  const m = agent.monitoring;
  const { toast } = useToast();
  const inval = useInvalidateAgent(agent.id);
  const upd = useUpdateMonitoring();
  const [enabled, setEnabled] = useState(m.enabled);
  const [mins, setMins] = useState(String(m.pollMinutes));
  useEffect(() => { setEnabled(m.enabled); setMins(String(m.pollMinutes)); }, [m.enabled, m.pollMinutes]);
  const n = Number(mins);
  const valid = Number.isInteger(n) && n >= 1 && n <= 1440;
  const dirty = enabled !== m.enabled || n !== m.pollMinutes;
  const save = () => upd.mutate({ id: agent.id, data: { enabled, pollMinutes: n } }, {
    onSuccess: () => { inval(); toast({ title: "Monitoring updated", description: enabled ? `Checking every ${n} min.` : "Monitoring paused." }); },
    onError: (e) => toast({ title: "Could not save", description: errMsg(e), variant: "destructive" }),
  });
  const rows: [string, string | null][] = [["Last attempt", m.lastAttemptAt], ["Last success", m.lastSuccessAt], ["Next check", m.nextPollAt]];
  return <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
    <section className="rounded-xl border border-border bg-card p-5">
      <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Monitoring</p>
      <h2 className="mt-1 font-display text-xl font-semibold">Automatic call checks</h2>
      <p className="mt-1 text-sm text-muted-foreground">Loop checks the provider on a schedule for new conversations. Checks run in the background.</p>
      <label className="mt-5 flex items-center justify-between gap-4 rounded-lg border border-border px-4 py-3">
        <span><span className="block text-sm font-medium">Monitoring enabled</span><span className="text-xs text-muted-foreground">When off, no scheduled or requested checks run.</span></span>
        <Switch checked={enabled} onCheckedChange={setEnabled} data-testid="switch-monitoring" />
      </label>
      <label className="mt-3 block rounded-lg border border-border px-4 py-3">
        <span className="block text-sm font-medium">Check interval</span>
        <span className="mt-2 flex items-center gap-2">
          <input type="number" min={1} max={1440} step={1} value={mins} onChange={(e) => setMins(e.target.value)} data-testid="input-poll-minutes" className={cn("w-24 rounded-md border bg-background px-2.5 py-1.5 font-mono text-sm tabular outline-none focus:ring-2 focus:ring-ring/40", valid ? "border-input" : "border-destructive")} />
          <span className="text-sm text-muted-foreground">minutes</span>
          <span className="ml-auto flex gap-1">{[5, 15, 60].map((p) => <button key={p} type="button" onClick={() => setMins(String(p))} data-testid={`button-preset-${p}`} className={cn("rounded-md border px-2 py-1 font-mono text-[11px] transition-colors", n === p ? "border-primary/40 bg-accent text-accent-foreground" : "border-border hover:bg-secondary")}>{p}m</button>)}</span>
        </span>
        {!valid && <span className="mt-1.5 block text-xs text-destructive">Whole number between 1 and 1440.</span>}
      </label>
      <div className="mt-4 flex justify-end gap-2">
        {dirty && <button type="button" onClick={() => { setEnabled(m.enabled); setMins(String(m.pollMinutes)); }} data-testid="button-reset-monitoring" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Reset</button>}
        <button type="button" disabled={!dirty || !valid || upd.isPending} onClick={save} data-testid="button-save-monitoring" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-40">{upd.isPending ? "Saving…" : "Save"}</button>
      </div>
    </section>
    <section className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Status</p><PollButton agentId={agent.id} m={m} /></div>
      <dl className="mt-4 divide-y divide-border text-sm">
        {rows.map(([k, v]) => <div key={k} className="flex justify-between gap-3 py-2.5"><dt className="text-muted-foreground">{k}</dt><dd className="font-mono text-xs tabular" data-testid={`text-${k.toLowerCase().replace(" ", "-")}`}>{v ? `${fmtTime(v)} · ${ago(v)}` : "—"}</dd></div>)}
      </dl>
      {m.lastError ? <p className="mt-3 flex gap-2 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5 text-xs leading-relaxed text-warn" data-testid="text-last-error"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{m.lastError}</p>
        : <p className="mt-3 text-xs text-muted-foreground">No errors on the last check.</p>}
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">"Check" only runs when monitoring is on and the next check is due. It never forces an early refresh.</p>
    </section>
  </div>;
}
