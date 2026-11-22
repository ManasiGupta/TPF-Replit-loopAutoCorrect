import { KeyRound, ShieldCheck } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useDemo } from "@/lib/demo-store";
import { Panel, Tag, fmtDate } from "@/components/loop/ui";
import { useToast } from "@/hooks/use-toast";

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="max-w-md"><p className="text-sm font-medium">{label}</p>{hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}</div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

export function SettingsTab({ agentId }: { agentId: string }) {
  const { state, updateAgent } = useDemo();
  const { toast } = useToast();
  const a = state.agents.find((x) => x.id === agentId)!;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Panel title="Connection" action={<Tag>sample</Tag>}>
        <div className="divide-y divide-border">
          <Row label="Platform" hint={`Added to demo ${fmtDate(a.connectedAt)}`}><span className="text-sm">ElevenLabs Conversational AI</span></Row>
          <Row label="API key" hint="Placeholder mask. No key exists in this prototype."><span className="inline-flex items-center gap-1.5 font-mono text-sm" data-testid="text-key-masked"><KeyRound className="h-3.5 w-3.5 text-muted-foreground" />{a.keyMasked}</span></Row>
          <Row label="Remote agent ID"><span className="font-mono text-sm">{a.remoteId}</span></Row>
        </div>
      </Panel>
      <Panel title="Monitoring">
        <div className="divide-y divide-border">
          <Row label="Polling" hint="How often Loop would check for new calls.">
            <div className="flex items-center gap-3">
              <Switch checked={a.status === "monitoring"} onCheckedChange={(v) => updateAgent(agentId, { status: v ? "monitoring" : "paused" })} data-testid="switch-polling" />
              <Select value={String(a.pollMinutes)} onValueChange={(v) => { updateAgent(agentId, { pollMinutes: Number(v) }); toast({ title: `Polling set to every ${v} min (demo)` }); }}>
                <SelectTrigger className="h-9 w-36" data-testid="select-poll"><SelectValue /></SelectTrigger>
                <SelectContent>{[5, 15, 30, 60].map((m) => <SelectItem key={m} value={String(m)}>Every {m} min</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </Row>
        </div>
      </Panel>
      <Panel title="Shipping">
        <div className="divide-y divide-border">
          <Row label="Auto-ship fixes" hint="Off by default. When on, a candidate would ship without review only if it passes every test and causes zero regressions.">
            <Switch checked={a.autoShip} onCheckedChange={(v) => { updateAgent(agentId, { autoShip: v }); toast({ title: v ? "Auto-ship on (demo)" : "Auto-ship off" }); }} data-testid="switch-autoship" />
          </Row>
          <div className="flex gap-3 bg-secondary/40 px-4 py-3 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 shrink-0 text-pass" />
            <p><span className="font-medium text-foreground">No-regression rule.</span> Any test that passes on the live version must still pass on the candidate. Eval changes always need human approval, even with auto-ship on.</p>
          </div>
        </div>
      </Panel>
    </div>
  );
}
