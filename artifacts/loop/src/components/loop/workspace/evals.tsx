import { useState } from "react";
import { Check, Loader2, Pencil, Play, Plus, Trash2, X } from "lucide-react";
import { useDemo } from "@/lib/demo-store";
import { Btn, Panel, Tag, ago } from "@/components/loop/ui";
import { useToast } from "@/hooks/use-toast";

export function EvalsTab({ agentId }: { agentId: string }) {
  const { state, addCriterion, editCriterion, removeCriterion, runBaseline } = useDemo();
  const { toast } = useToast();
  const criteria = state.criteria.filter((c) => c.agentId === agentId);
  const tests = state.tests.filter((t) => t.agentId === agentId);
  const [draft, setDraft] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [running, setRunning] = useState(false);
  const lastRun = state.baselineRuns[agentId];

  const baseline = () => {
    setRunning(true);
    setTimeout(() => {
      runBaseline(agentId); setRunning(false);
      toast({ title: "Baseline run complete (simulated)", description: `${tests.length} tests against the live version. No calls were placed.` });
    }, 1200);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Panel title={<>Success criteria <span className="ml-1 font-mono text-xs text-muted-foreground">{criteria.length}/30</span></>}>
        <ul className="divide-y divide-border">
          {criteria.map((c, i) => (
            <li key={c.id} className="group flex items-start gap-3 px-4 py-3" data-testid={`row-criterion-${c.id}`}>
              <span className="mt-0.5 font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>
              {editing === c.id ? (
                <div className="flex flex-1 flex-col gap-2">
                  <textarea autoFocus value={editText} onChange={(e) => setEditText(e.target.value)} rows={2} data-testid="input-edit-criterion" className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
                  <div className="flex gap-2">
                    <Btn variant="ink" className="h-8" disabled={!editText.trim()} onClick={() => { editCriterion(c.id, editText.trim()); setEditing(null); }} data-testid="button-save-criterion"><Check className="h-3.5 w-3.5" />Save</Btn>
                    <Btn variant="ghost" className="h-8" onClick={() => setEditing(null)}><X className="h-3.5 w-3.5" />Cancel</Btn>
                  </div>
                </div>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{c.text}</p>
                    <Tag className="mt-1.5">{c.source === "imported" ? "imported from ElevenLabs" : c.source === "approved-fix" ? "from approved fix" : "added in Loop"}</Tag>
                  </div>
                  <div className="flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <button onClick={() => { setEditing(c.id); setEditText(c.text); }} aria-label="Edit criterion" data-testid={`button-edit-${c.id}`} className="rounded p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => removeCriterion(c.id)} aria-label="Remove criterion" data-testid={`button-remove-${c.id}`} className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ul>
        <form onSubmit={(e) => { e.preventDefault(); if (draft.trim() && criteria.length < 30) { addCriterion(agentId, draft.trim()); setDraft(""); } }} className="flex flex-col gap-2 border-t border-border p-4 sm:flex-row">
          <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="The agent ..." data-testid="input-new-criterion" className="h-9 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
          <Btn type="submit" disabled={!draft.trim() || criteria.length >= 30} data-testid="button-add-criterion"><Plus className="h-4 w-4" />Add criterion</Btn>
        </form>
      </Panel>

      <Panel title={<>Test cases <span className="ml-1 font-mono text-xs text-muted-foreground">{tests.length}</span></>} action={<Btn variant="primary" className="h-8" onClick={baseline} disabled={running} data-testid="button-run-baseline">{running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}Run baseline (demo)</Btn>}>
        <p className="border-b border-border px-4 py-2 font-mono text-[11px] text-muted-foreground" data-testid="text-baseline">{lastRun ? `Last simulated baseline ${ago(lastRun)}` : "No baseline run in this session"}</p>
        <ul className="divide-y divide-border">
          {tests.map((t) => (
            <li key={t.id} className="px-4 py-3">
              <div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{t.name}</p><Tag>{t.origin.replace("-", " ")}</Tag></div>
              <p className="mt-0.5 text-xs text-muted-foreground">{t.scenario}</p>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
