import { useMemo, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, Lock, PhoneOff, Snowflake } from "lucide-react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Empty, Segmented, Tag, fmtDate, fmtDur, fmtTime } from "@/components/loop/ui";
import { LoopLogo } from "@/components/loop/mark";
import { CriteriaBreakdown } from "@/components/loop/criteria-breakdown";
import { SnapshotCallDetail } from "@/components/loop/snapshot/snapshot-call";
import { snapshot } from "@/lib/connected-sample";
import { cn } from "@/lib/utils";
import { CallCategories, CallFailureReasons, humanizeCriterion } from "@/components/loop/call-categories";
import { AgentPreviewLink } from "@/components/loop/agent-preview-link";
import type { CallCategory, CallDetail } from "@workspace/api-client-react";

function failedIds(c: CallDetail) {
  return Array.from(new Set(c.failureReasons.map((r) => r.criterionId)));
}
function inCategory(c: CallDetail, cat: string) {
  if (cat === "all") return true;
  if (cat === "passed" || cat === "unknown") return c.result === cat;
  if (c.result !== "failed") return false;
  if (cat === "other-failure") return failedIds(c).length === 0;
  return cat.startsWith("criterion:") && failedIds(c).includes(cat.slice(10));
}

type RF = "all" | "failed" | "passed" | "unknown";
type SF = "all" | "production" | "test" | "unknown";
type Tab = "calls" | "criteria";

function Metric({ label, value, hint, testId }: { label: string; value: string; hint: string; testId: string }) {
  return <div className="rounded-2xl border border-[#E7E4F0] bg-white p-5">
    <p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#7E7B8E]">{label}</p>
    <p className="mt-2 font-display text-3xl font-semibold tracking-tight tabular" data-testid={testId}>{value}</p>
    <p className="mt-1 text-xs text-[#8A879A]">{hint}</p>
  </div>;
}

export default function DemoPage() {
  const { agent, calls, capturedAt } = snapshot;
  const [tab, setTab] = useState<Tab>("calls");
  const [result, setResult] = useState<RF>("all");
  const [source, setSource] = useState<SF>("all");
  const [category, setCategory] = useState("all");
  const completed = calls.filter((c) => c.status === "done" || c.status === "failed");
  const successRate = completed.length ? (completed.filter((c) => c.criteriaCount > 0 && c.passedCriteriaCount === c.criteriaCount && c.outcome === "scored" && c.result !== "failed" && !(c.errorReasons?.length)).length / completed.length) * 100 : null;
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => [...calls].sort((a, b) => b.startedAt.localeCompare(a.startedAt)), [calls]);
  const bySource = sorted.filter((c) => source === "all" || c.source === source);
  const filtered = bySource.filter((c) => (result === "all" || c.result === result) && inCategory(c, category));
  const categories = useMemo<CallCategory[]>(() => {
    const names = new Map(agent.criteria.map((cr) => [cr.id, cr.name]));
    const counts = new Map<string, { name: string; count: number }>();
    let other = 0;
    for (const c of bySource) {
      if (c.result !== "failed") continue;
      const ids = failedIds(c);
      if (!ids.length) other += 1;
      for (const id of ids) {
        const name = names.get(id) ?? c.failureReasons.find((r) => r.criterionId === id)?.name ?? id;
        const cur = counts.get(id) ?? { name, count: 0 };
        cur.count += 1; counts.set(id, cur);
      }
    }
    const list: CallCategory[] = [
      { id: "all", name: "All calls", count: bySource.length },
      { id: "passed", name: "Passed", count: bySource.filter((c) => c.result === "passed").length },
      { id: "unknown", name: "Unknown result", count: bySource.filter((c) => c.result === "unknown").length },
      ...[...counts.entries()].sort((a, b) => b[1].count - a[1].count).map(([id, v]) => ({ id: `criterion:${id}`, name: humanizeCriterion(v.name), count: v.count })),
    ];
    if (other) list.push({ id: "other-failure", name: "Failed, no failed criterion recorded", count: other });
    return list;
  }, [bySource, agent.criteria]);
  const count = (r: RF) => r === "all" ? calls.length : calls.filter((c) => c.result === r).length;
  const openCall = calls.find((c) => c.id === open);

  return <div className="min-h-[100dvh] bg-[#FDFDFF] text-[#1A1A2E]" style={{ colorScheme: "light" }}>
    <header className="sticky top-0 z-30 border-b border-[#1A1A2E]/[.06] bg-[#FDFDFF]/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-8">
        <Link href="/" aria-label="loop home" data-testid="link-demo-home" className="rounded-md"><LoopLogo textClassName="text-xl" /></Link>
        <span className="hidden rounded-full border border-[#DDD9FF] bg-[#F5F3FF] px-2.5 py-1 font-mono text-[10px] uppercase tracking-[.15em] text-[#5B4BFF] sm:inline-flex">Read-only sample</span>
        <Link href="/connect" data-testid="link-demo-connect-header" className="ml-auto inline-flex h-9 items-center gap-2 rounded-full bg-[#5B4BFF] px-4 text-sm font-medium text-white transition-transform active:scale-[.97]">Connect your own agent <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </header>

    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-8">
      <div className="rise mb-8 flex flex-col gap-4 rounded-2xl border border-[#DED9FF] bg-[#F5F3FF] p-5 sm:flex-row sm:items-center sm:p-6">
        <Snowflake className="h-5 w-5 shrink-0 text-[#5B4BFF]" />
        <p className="flex-1 text-sm leading-relaxed text-[#4F4C66]" data-testid="text-demo-frozen">
          <strong className="text-[#1A1A2E]">Frozen snapshot of a real connected agent</strong>, captured <span className="font-mono">{fmtTime(capturedAt)}</span> ({fmtDate(capturedAt)}). Transcripts and evaluations are original. Nothing here updates, polls, or reaches the provider.
        </p>
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[.15em] text-[#77758A]"><Lock className="h-3.5 w-3.5" /> No sign-in needed</span>
      </div>

      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#5B4BFF]">{agent.platform} · sample agent</p>
      <h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.035em] sm:text-5xl" data-testid="text-demo-agent-name">{agent.name}</h1>
      <p className="mt-2 break-all font-mono text-xs text-[#858295]">{agent.remoteId} · connected {fmtDate(agent.createdAt)}</p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Calls success rate" value={successRate == null ? "—" : `${successRate.toFixed(1)}%`} hint="Completed calls with every criterion passed and no errors" testId="text-demo-success-rate" />
        <Metric label="Total criteria" value={String(agent.criteriaCount)} hint="Saved success criteria" testId="text-demo-criteria" />
        <Metric label="Total calls" value={String(calls.length)} hint="All imported conversations in this snapshot" testId="text-demo-calls" />
        <Metric label="Criteria with failures" value={agent.failedCriteriaCount == null ? "—" : String(agent.failedCriteriaCount)} hint="Distinct criteria failed at least once" testId="text-demo-failed-criteria" />
      </div>

      <div className="mt-6"><AgentPreviewLink remoteId={agent.remoteId} frozen /></div>

      <div className="mb-4 mt-10 flex flex-wrap items-center gap-2 border-b border-[#E8E6F1]">
        {(["calls", "criteria"] as Tab[]).map((t) => <button key={t} type="button" onClick={() => setTab(t)} data-testid={`tab-demo-${t}`} className={cn("-mb-px border-b-2 px-3 py-2.5 text-sm font-medium capitalize transition-colors", tab === t ? "border-[#5B4BFF] text-[#1A1A2E]" : "border-transparent text-[#8A879A] hover:text-[#1A1A2E]")}>{t}</button>)}
      </div>

      {tab === "calls" ? <>
        <div className="mb-3 flex flex-wrap gap-2">
          <Segmented value={result} onChange={(v) => { setResult(v as RF); setCategory("all"); }} testId="filter-demo-result" options={(["all", "failed", "passed", "unknown"] as RF[]).map((v) => ({ value: v, label: v === "all" ? "Any provider result" : `Provider: ${v}`, count: count(v) }))} />
          <Segmented value={source} onChange={(v) => { setSource(v as SF); setCategory("all"); }} testId="filter-demo-source" options={(["all", "production", "test", "unknown"] as SF[]).map((v) => ({ value: v, label: v === "all" ? "Any source" : v[0].toUpperCase() + v.slice(1) }))} />
        </div>
        <CallCategories categories={categories} value={category} onChange={(id) => { setCategory(id); setResult("all"); }} />
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {filtered.length === 0 ? <Empty icon={PhoneOff} title={calls.length ? "No calls match" : "No calls in this snapshot"} body={calls.length ? "Try a different result or source filter." : "The snapshot was captured before any calls were recorded."} />
            : <ul className="divide-y divide-border" data-testid="list-demo-calls">{filtered.map((c) => <li key={c.id}>
              <button type="button" onClick={() => setOpen(c.id)} data-testid={`row-demo-call-${c.id}`} className="grid w-full grid-cols-1 items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-secondary/50 xl:grid-cols-[8.5rem_minmax(0,1fr)_6.5rem_3.5rem_4.5rem_auto]">
                <span className="font-mono text-xs text-muted-foreground">{fmtTime(c.startedAt)}</span>
                <span className={cn("hidden min-w-0 truncate sm:block", !c.summary && "italic text-muted-foreground")}>{c.summary ?? "No summary provided"}</span>
                <span className="hidden xl:block"><Tag className={cn(c.source === "unknown" && "border-dashed text-muted-foreground")}>{c.source === "unknown" ? "source ?" : c.source}</Tag></span>
                <span className="hidden font-mono text-xs text-muted-foreground tabular xl:block">{fmtDur(c.durationSecs)}</span>
                <span className="hidden font-mono text-[11px] text-muted-foreground tabular xl:block">{c.evaluationCount} eval{c.evaluationCount === 1 ? "" : "s"}</span>
                <CriteriaBreakdown total={c.criteriaCount} failed={c.failedCriteriaCount} unknown={c.unknownCriteriaCount} testId={`text-demo-call-criteria-${c.id}`} />
              </button>
              {c.failureReasons.length > 0 && <div className="px-4 pb-3"><CallFailureReasons reasons={c.failureReasons} /></div>}
            </li>)}</ul>}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Source is the environment label reported by the provider at capture time; it does not prove a test run took place. Unknown means no result or environment was recorded; it is not counted as a pass or failure.</p>
      </> : <ul className="space-y-2" data-testid="list-demo-criteria">
        {agent.criteria.length === 0 ? <li className="rounded-xl border border-dashed border-[#DEDCE9] px-4 py-5 text-sm text-[#8A879A]">No criteria were recorded in this snapshot.</li>
          : agent.criteria.map((cr, i) => {
            const total = cr.passed + cr.failed + cr.unknown;
            return <li key={cr.id} className="rounded-xl border border-[#E7E4F0] bg-white p-4" data-testid={`row-demo-criterion-${cr.id}`}>
              <div className="flex flex-wrap items-start gap-3"><span className="pt-0.5 font-mono text-[10px] text-[#5B4BFF]">{String(i + 1).padStart(2, "0")}</span>
                <div className="min-w-0 flex-1"><p className="font-medium">{humanizeCriterion(cr.name)}</p>{cr.text && cr.text !== cr.name && <p className="mt-1 text-sm leading-relaxed text-[#706E81]">{cr.text}</p>}</div><Tag>{cr.source}</Tag></div>
              <div className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-[#F0EEF6]">{total > 0 && <><span className="bg-pass" style={{ width: `${(cr.passed / total) * 100}%` }} /><span className="bg-destructive" style={{ width: `${(cr.failed / total) * 100}%` }} /></>}</div>
              <p className="mt-2 font-mono text-[11px] text-[#77758A] tabular">{cr.passed} passed · {cr.failed} failed · {cr.unknown} unknown</p>
            </li>;
          })}
      </ul>}

      <section className="mt-14 flex flex-col items-start gap-4 rounded-[1.5rem] bg-[#5B4BFF] p-7 text-white sm:flex-row sm:items-center sm:p-10">
        <div className="flex-1"><h2 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">See this for your own agent.</h2><p className="mt-2 text-sm text-white/70">Sign in, paste your ElevenLabs key, and pick your agent. Your data stays private.</p></div>
        <Link href="/connect" data-testid="link-demo-connect-cta" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 text-sm font-semibold text-[#5B4BFF] transition-transform hover:-translate-y-0.5">Connect your own agent <ArrowRight className="h-4 w-4" /></Link>
      </section>
    </main>

    <Sheet open={!!openCall} onOpenChange={(o) => !o && setOpen(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">{openCall && <SnapshotCallDetail call={openCall} />}</SheetContent>
    </Sheet>
  </div>;
}
