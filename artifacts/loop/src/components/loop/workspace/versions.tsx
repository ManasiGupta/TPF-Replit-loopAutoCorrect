import { useState } from "react";
import { History } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { useDemo } from "@/lib/demo-store";
import { Btn, Panel, Tag, fmtDate } from "@/components/loop/ui";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export function VersionsTab({ agentId }: { agentId: string }) {
  const { state, rollback } = useDemo();
  const { toast } = useToast();
  const agent = state.agents.find((a) => a.id === agentId)!;
  const versions = state.versions.filter((v) => v.agentId === agentId).sort((a, b) => b.n - a.n);
  const [target, setTarget] = useState<number | null>(null);
  const [view, setView] = useState<number | null>(null);

  return (
    <Panel>
      <ol className="relative">
        {versions.map((v, i) => {
          const live = v.n === agent.liveVersion;
          const prev = versions[i + 1];
          const delta = prev ? v.passRate - prev.passRate : null;
          return (
            <li key={v.n} className="border-b border-border last:border-0" data-testid={`row-version-${v.n}`}>
              <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center">
                <div className="flex items-center gap-3 sm:w-24">
                  <span className={cn("grid h-8 w-8 place-items-center rounded-full border font-mono text-xs", live ? "border-primary bg-primary text-primary-foreground" : "border-border text-muted-foreground")}>v{v.n}</span>
                  {live && <Tag className="border-primary/30 bg-accent text-accent-foreground">live</Tag>}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{v.note}</p>
                  <p className="font-mono text-[11px] text-muted-foreground">{fmtDate(v.createdAt)}</p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="font-display text-lg font-semibold tabular">{v.passRate.toFixed(1)}%</span>
                  {delta !== null && <span className={cn("w-12 font-mono text-xs tabular", delta >= 0 ? "text-pass" : "text-destructive")}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}</span>}
                  <Btn variant="ghost" className="h-8" onClick={() => setView(view === v.n ? null : v.n)} data-testid={`button-view-${v.n}`}>Prompt</Btn>
                  <Btn className="h-8" disabled={live} onClick={() => setTarget(v.n)} data-testid={`button-rollback-${v.n}`}><History className="h-3.5 w-3.5" />Roll back</Btn>
                </div>
              </div>
              {view === v.n && <pre className="slidein mx-4 mb-4 whitespace-pre-wrap rounded-lg bg-secondary/60 p-3 font-mono text-xs leading-relaxed">{v.prompt}</pre>}
            </li>
          );
        })}
      </ol>
      <AlertDialog open={target !== null} onOpenChange={(o) => !o && setTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-display">Roll back to v{target}?</AlertDialogTitle>
            <AlertDialogDescription>This creates a new version in this demo with v{target}'s prompt and marks it live. Demo only: no ElevenLabs agent is modified.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-rollback">Cancel</AlertDialogCancel>
            <AlertDialogAction data-testid="button-confirm-rollback" onClick={() => { if (target !== null) { const n = rollback(agentId, target); toast({ title: `v${n} is live (demo)`, description: `Restored prompt from v${target}. No live agent changed.` }); } setTarget(null); }}>Roll back</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Panel>
  );
}
