import { useMemo, useState } from "react";
import { Link, useLocation, useParams } from "wouter";
import { AlertTriangle, ArrowLeft, Check, FlaskConical, Loader2, Pencil, RefreshCw, Rocket, SearchX, X } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDemo } from "@/lib/demo-store";
import { lineDiff } from "@/lib/diff";
import { Btn, Empty, Eyebrow, Panel, Tag, Verdict } from "@/components/loop/ui";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function FixReviewPage() {
  const { id = "", fixId = "" } = useParams<{ id: string; fixId: string }>();
  const { state, updateFix, rerunFix, approveFix, rejectFix } = useDemo();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const fix = state.fixes.find((f) => f.id === fixId && f.agentId === id);
  const agent = state.agents.find((a) => a.id === id);
  const base = state.versions.find((v) => v.agentId === id && v.n === fix?.baseVersion);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [rerunning, setRerunning] = useState(false);
  const [confirm, setConfirm] = useState<"ship" | "reject" | null>(null);

  const diff = useMemo(() => (fix && base ? lineDiff(base.prompt, fix.candidatePrompt) : []), [fix, base]);
  const sorted = useMemo(() => {
    if (!fix) return [];
    const rank = (t: { current: boolean; candidate: boolean }) => (t.current && !t.candidate ? 0 : !t.current && t.candidate ? 1 : !t.candidate ? 2 : 3);
    return [...fix.tests].sort((a, b) => rank(a) - rank(b));
  }, [fix]);

  if (!fix || !agent || !base) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card">
        <Empty icon={SearchX} title="Fix not found" body="This candidate may have been cleared by a demo reset."><Link href={`/agents/${id}?tab=fixes`} className="text-sm font-medium text-primary hover:underline">Back to fixes</Link></Empty>
      </div>
    );
  }

  const failure = state.failures.find((f) => f.id === fix.failureId);
  const regressions = fix.tests.filter((t) => t.current && !t.candidate).length;
  const gains = fix.tests.filter((t) => !t.current && t.candidate).length;
  const curPass = fix.tests.filter((t) => t.current).length;
  const candPass = fix.tests.filter((t) => t.candidate).length;
  const pendingEval = fix.evalChanges.filter((e) => !e.approved).length;
  const decided = fix.status !== "candidate";
  const canShip = !decided && regressions === 0 && pendingEval === 0 && !editing;
  const blocker = regressions > 0 ? `${regressions} regression${regressions > 1 ? "s" : ""} must be resolved. Edit the prompt and re-run.` : pendingEval > 0 ? `Approve or remove ${pendingEval} proposed eval change${pendingEval > 1 ? "s" : ""}.` : editing ? "Save your prompt edit first." : null;

  const rerun = () => { setRerunning(true); setTimeout(() => { rerunFix(fix.id); setRerunning(false); toast({ title: "Tests re-run (simulated)", description: "Results updated for the edited candidate." }); }, 1100); };

  return (
    <div>
      <Link href={`/agents/${id}?tab=fixes`} data-testid="link-back" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> {agent.org} / {agent.name}</Link>
      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow className="mb-1">Fix review · v{fix.baseVersion} to candidate</Eyebrow>
          <h1 className="font-display text-3xl font-semibold" data-testid="text-fix-title">{fix.title}</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{fix.rationale}</p>
          {failure && <p className="mt-2 font-mono text-[11px] text-muted-foreground">Addresses: {failure.title} · {failure.callIds.length} calls</p>}
        </div>
        <div className="flex items-center gap-6 rounded-xl border border-border bg-card px-5 py-3">
          <div><p className="font-mono text-[10px] uppercase text-muted-foreground">Live</p><p className="font-display text-xl font-semibold tabular">{curPass}/{fix.tests.length}</p></div>
          <span className="text-muted-foreground">to</span>
          <div><p className="font-mono text-[10px] uppercase text-muted-foreground">Candidate</p><p className={cn("font-display text-xl font-semibold tabular", regressions ? "text-destructive" : "text-pass")}>{candPass}/{fix.tests.length}</p></div>
        </div>
      </div>

      {decided && (
        <div className={cn("mb-5 flex gap-3 rounded-lg border px-4 py-3 text-sm", fix.status === "shipped" ? "border-pass/30 bg-pass/10" : "border-border bg-secondary/50")} data-testid="status-fix">
          {fix.status === "shipped" ? <Rocket className="h-4 w-4 text-pass" /> : <X className="h-4 w-4 text-muted-foreground" />}
          {fix.status === "shipped" ? `Shipped as v${agent.liveVersion} in this demo. No live ElevenLabs agent was modified.` : "Rejected. The failure cluster is open again."}
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <Panel title="Prompt diff" action={!decided && (editing ? (
          <div className="flex gap-1.5">
            <Btn variant="ghost" className="h-8" onClick={() => setEditing(false)} data-testid="button-cancel-edit">Cancel</Btn>
            <Btn variant="ink" className="h-8" onClick={() => { updateFix(fix.id, { candidatePrompt: draft, edited: true }); setEditing(false); }} data-testid="button-save-prompt"><Check className="h-3.5 w-3.5" />Save</Btn>
          </div>
        ) : <Btn variant="ghost" className="h-8" onClick={() => { setDraft(fix.candidatePrompt); setEditing(true); }} data-testid="button-edit-prompt"><Pencil className="h-3.5 w-3.5" />Edit prompt</Btn>)}>
          {editing ? (
            <textarea value={draft} onChange={(e) => setDraft(e.target.value)} rows={14} data-testid="input-prompt" className="block w-full resize-y bg-background p-4 font-mono text-xs leading-relaxed outline-none" />
          ) : (
            <div className="overflow-x-auto py-2 font-mono text-[12.5px] leading-relaxed" data-testid="view-diff">
              {diff.map((l, i) => (
                <div key={i} className={cn("flex gap-3 px-4", l.kind === "add" && "bg-pass/10", l.kind === "del" && "bg-destructive/8")}>
                  <span className={cn("w-3 shrink-0 select-none", l.kind === "add" ? "text-pass" : l.kind === "del" ? "text-destructive" : "text-muted-foreground/40")}>{l.kind === "add" ? "+" : l.kind === "del" ? "-" : " "}</span>
                  <span className={cn("whitespace-pre-wrap", l.kind === "del" && "text-destructive line-through decoration-destructive/40", l.kind === "same" && "text-muted-foreground")}>{l.text || " "}</span>
                </div>
              ))}
            </div>
          )}
          {fix.edited && regressions > 0 && !editing && !decided && (
            <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3 text-sm">
              <span className="text-muted-foreground">Prompt edited. Re-run tests to check regressions.</span>
              <Btn onClick={rerun} disabled={rerunning} data-testid="button-rerun">{rerunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}Re-run tests</Btn>
            </div>
          )}
        </Panel>

        <div className="space-y-5">
          <Panel title="Tests: live vs candidate" action={<span className="font-mono text-[11px]"><span className="text-destructive">{regressions} regress</span> · <span className="text-pass">+{gains} fixed</span></span>}>
            <div className="grid grid-cols-[1fr_3.5rem_3.5rem] gap-2 border-b border-border px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground"><span>Test</span><span>Live</span><span>Cand.</span></div>
            <ul className="divide-y divide-border">
              {sorted.map((t) => {
                const reg = t.current && !t.candidate;
                return (
                  <li key={t.id} className={cn("grid grid-cols-[1fr_3.5rem_3.5rem] items-center gap-2 px-4 py-2.5", reg && "bg-destructive/5")} data-testid={`row-test-${t.id}`}>
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm">{reg && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}{t.name}</p>
                      <p className="truncate text-[11px] text-muted-foreground">{reg ? "New regression. " : ""}{t.note}</p>
                    </div>
                    <Verdict pass={t.current} size="xs" />
                    <Verdict pass={t.candidate} size="xs" />
                  </li>
                );
              })}
            </ul>
          </Panel>

          <Panel title="Proposed eval changes">
            {fix.evalChanges.length === 0 ? <p className="px-4 py-6 text-sm text-muted-foreground">No eval changes proposed.</p> : (
              <ul className="divide-y divide-border">
                {fix.evalChanges.map((e) => (
                  <li key={e.id} className="flex items-start gap-3 px-4 py-3">
                    <Tag>{e.kind === "test" ? "+ test" : "+ criterion"}</Tag>
                    <p className="flex-1 text-sm">{e.text}</p>
                    {!decided && (
                      <div className="flex gap-1">
                        <button onClick={() => updateFix(fix.id, { evalChanges: fix.evalChanges.map((x) => (x.id === e.id ? { ...x, approved: !x.approved } : x)) })} data-testid={`button-approve-eval-${e.id}`} className={cn("inline-flex h-7 items-center gap-1 rounded-md border px-2 text-xs transition-colors", e.approved ? "border-pass/40 bg-pass/12 text-pass" : "border-border hover:border-foreground/30")}><Check className="h-3 w-3" />{e.approved ? "Approved" : "Approve"}</button>
                        <button onClick={() => updateFix(fix.id, { evalChanges: fix.evalChanges.filter((x) => x.id !== e.id) })} aria-label="Remove change" data-testid={`button-drop-eval-${e.id}`} className="grid h-7 w-7 place-items-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          {!decided && (
            <div className="sticky bottom-4 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur">
              <p className={cn("mb-3 flex items-start gap-2 text-sm", blocker ? "text-destructive" : "text-pass")} data-testid="text-ship-status">
                {blocker ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <Check className="mt-0.5 h-4 w-4 shrink-0" />}
                {blocker ?? "No regressions and all eval changes approved."}
              </p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <Btn variant="danger" onClick={() => setConfirm("reject")} data-testid="button-reject">Reject</Btn>
                <Btn variant="primary" className="flex-1" disabled={!canShip} onClick={() => setConfirm("ship")} data-testid="button-approve-ship"><Rocket className="h-4 w-4" />Approve and ship</Btn>
              </div>
              <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><FlaskConical className="h-3 w-3" />Demo: shipping updates local sample data only.</p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={confirm !== null} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">{confirm === "ship" ? "Ship this candidate?" : "Reject this candidate?"}</AlertDialogTitle>
            <AlertDialogDescription>{confirm === "ship" ? `Creates v${Math.max(...state.versions.filter((v) => v.agentId === id).map((v) => v.n)) + 1} as the live version in this demo and adds ${fix.evalChanges.length} approved eval change(s). No live agent is modified.` : "The failure cluster returns to open. You can generate a new fix later."}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-confirm">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm" className={confirm === "reject" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""} onClick={() => {
              if (confirm === "ship") { const n = approveFix(fix.id); toast({ title: `v${n} shipped (demo)`, description: "Sample data updated. No live agent modified." }); navigate(`/agents/${id}?tab=versions`); }
              else { rejectFix(fix.id); toast({ title: "Candidate rejected" }); }
              setConfirm(null);
            }}>{confirm === "ship" ? "Approve and ship" : "Reject"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
