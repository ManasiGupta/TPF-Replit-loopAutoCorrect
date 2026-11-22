import type { CallDetail, CallEvaluation } from "@workspace/api-client-react";
import { humanizeCriterion } from "@/components/loop/call-categories";
import { SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tag, fmtDur, fmtTime } from "@/components/loop/ui";
import { ResultPill } from "@/components/loop/workspace/connected";
import { cn } from "@/lib/utils";
import { CriteriaBreakdown } from "@/components/loop/criteria-breakdown";

function EvalRow({ e }: { e: CallEvaluation }) {
  return <li className={cn("rounded-lg border px-3 py-2.5", e.result === "failure" ? "border-destructive/30 bg-destructive/5" : e.result === "unknown" ? "border-dashed border-border" : "border-border")} data-testid={`row-demo-eval-${e.criterionId}`}>
    <div className="flex items-start justify-between gap-3"><p className="text-sm font-medium">{humanizeCriterion(e.name)}</p><ResultPill result={e.result} size="xs" /></div>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{e.rationale || "No reason given."}</p>
    {e.score != null && <p className="mt-1.5 font-mono text-[10.5px] text-muted-foreground tabular">score {e.score}{e.maxScore != null ? ` / ${e.maxScore}` : ""}</p>}
  </li>;
}

export function SnapshotCallDetail({ call: c, readOnly = true }: { call: CallDetail; readOnly?: boolean }) {
  const failedTurns = new Set(c.failedTurnIndexes ?? []);
  const guards = c.guardrails ?? [];
  return <>
    <SheetHeader className="text-left">
      <div className="flex flex-wrap items-center gap-2"><CriteriaBreakdown total={c.criteriaCount} failed={c.failedCriteriaCount} unknown={c.unknownCriteriaCount} /><Tag>{c.source === "unknown" ? "source unknown" : c.source}</Tag>{c.versionId && <Tag>{c.versionId}</Tag>}<Tag>{c.status}</Tag>{readOnly && <Tag className="border-[#DDD9FF] text-[#5B4BFF]">read-only</Tag>}{c.language && <Tag>{c.language}</Tag>}</div>
      <SheetTitle className="font-display text-xl" data-testid="text-demo-call-title">{c.summary ?? "Conversation"}</SheetTitle>
      <SheetDescription className="break-all font-mono text-xs">{fmtTime(c.startedAt)} · {fmtDur(c.durationSecs)} · {c.conversationId}{c.environment ? ` · env ${c.environment}` : ""}</SheetDescription>
    </SheetHeader>
    <h4 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Criteria results · {c.evaluations.length}</h4>
    {c.evaluations.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No criteria results were recorded for this call when the snapshot was taken.</p>
      : <ul className="space-y-2">{c.evaluations.map((e, i) => <EvalRow key={`${e.criterionId}-${i}`} e={e} />)}</ul>}
    {(c.errorReasons?.length ?? 0) > 0 && <div className="mt-5 rounded-lg border border-warn/30 bg-warn/8 px-3 py-2.5 text-xs leading-relaxed text-warn" data-testid="list-call-errors"><p className="font-semibold">Call errors</p><ul className="mt-1 list-disc pl-4">{c.errorReasons!.map((r, i) => <li key={i}>{r}</li>)}</ul></div>}
    {guards.length > 0 && <div className="mt-5" data-testid="list-guardrails"><h4 className="mb-2 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Guardrails triggered · {guards.length}</h4><ul className="flex flex-wrap gap-1.5">{guards.map((g, i) => <li key={i} className="rounded-full border border-border px-2.5 py-1 text-xs">{g.name} <span className="font-mono text-[10px] text-muted-foreground">{g.type} · turn {g.turnIndex + 1}</span></li>)}</ul></div>}
    <h4 className="mb-2 mt-6 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground">Transcript</h4>
    {c.transcript.length > 0 && <p className="mb-2 text-[11px] text-muted-foreground">{c.failedTurnIndexes && c.failedTurnIndexes.length ? `${c.failedTurnIndexes.length} turn${c.failedTurnIndexes.length === 1 ? "" : "s"} marked by the provider as failing are highlighted.` : "The provider did not identify specific failing turns for this call."}</p>}
    {c.transcript.length === 0 ? <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">No transcript was recorded for this call (status: {c.status}).</p>
      : <ol className="space-y-2.5" data-testid="list-demo-transcript">{c.transcript.map((t, i) => {
        const agentSide = t.role === "agent";
        const bad = failedTurns.has(i);
        const g = guards.filter((x) => x.turnIndex === i);
        return <li key={i} data-testid={bad ? `turn-failed-${i}` : undefined} className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", agentSide ? "rounded-tl-sm bg-secondary" : "ml-auto rounded-tr-sm bg-accent text-accent-foreground", bad && "ring-2 ring-destructive/60")}>
          {(bad || g.length > 0) && <span className="mb-1 flex flex-wrap gap-1 font-mono text-[9.5px] uppercase">{bad && <span className="rounded bg-destructive px-1.5 py-0.5 text-white">failing turn</span>}{g.map((x, k) => <span key={k} className="rounded border border-warn/40 px-1.5 py-0.5 text-warn">{x.name}</span>)}</span>}
          <span className="mb-0.5 flex justify-between gap-3 font-mono text-[10px] uppercase opacity-60"><span>{t.role}</span><span className="tabular">{fmtDur(Math.round(t.timeInCallSecs))}</span></span>
          {t.text ?? <span className="italic opacity-60">No text (tool call or silence)</span>}
        </li>;
      })}</ol>}
  </>;
}
