import { useEffect, useState } from "react";
import { getGetMonitoringDashboardQueryKey, useGetMonitoringDashboard, useUpdateImpactMappings, ImpactMappingImpact } from "@workspace/api-client-react";
import type { ImpactMapping } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { humanizeCriterion } from "@/components/loop/call-categories";
import { useInvalidateAgent } from "@/components/loop/workspace/connected";
import { useToast } from "@/hooks/use-toast";

const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
const OPTIONS = Object.values(ImpactMappingImpact);

export function ImpactMappingsEditor({ agentId }: { agentId: string }) {
  const params = { bucket: "hour" as const, timezone: tz };
  const q = useGetMonitoringDashboard(agentId, params, { query: { queryKey: getGetMonitoringDashboardQueryKey(agentId, params) } });
  const upd = useUpdateImpactMappings();
  const inval = useInvalidateAgent(agentId);
  const { toast } = useToast();
  const [rows, setRows] = useState<ImpactMapping[]>([]);
  const server = JSON.stringify(q.data?.mappings ?? []);
  useEffect(() => { setRows(JSON.parse(server) as ImpactMapping[]); }, [server]);
  const dirty = JSON.stringify(rows) !== server;
  const valid = rows.every((r) => OPTIONS.includes(r.impact));

  return <section className="mt-5 rounded-xl border border-border bg-card p-5" data-testid="panel-impact-mappings">
    <p className="font-mono text-[10px] uppercase tracking-[.16em] text-muted-foreground">Business impact</p>
    <h2 className="mt-1 font-display text-xl font-semibold">Criterion impact mapping</h2>
    <p className="mt-1 text-sm text-muted-foreground">Choose which business area a failure of each criterion affects. Defaults are applied until you save.</p>
    {q.isLoading ? <Skeleton className="mt-4 h-32 w-full" /> : q.isError ? <button type="button" onClick={() => q.refetch()} className="mt-4 text-sm font-medium text-primary hover:underline">Could not load mappings. Retry</button>
      : rows.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No criteria to map yet.</p>
      : <ul className="mt-4 divide-y divide-border rounded-lg border border-border">{rows.map((r, i) => <li key={r.criterionId} className="flex items-center gap-3 px-3 py-2.5">
        <span className="min-w-0 flex-1 text-sm">{humanizeCriterion(r.name)}</span>
        <select value={r.impact} disabled={upd.isPending} data-testid={`select-impact-${r.criterionId}`} onChange={(e) => setRows((cur) => cur.map((x, k) => k === i ? { ...x, impact: e.target.value as ImpactMapping["impact"] } : x))} className="h-9 rounded-md border border-input bg-background px-2 text-sm">
          {OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      </li>)}</ul>}
    <div className="mt-4 flex justify-end gap-2">
      {dirty && <button type="button" onClick={() => setRows(JSON.parse(server) as ImpactMapping[])} data-testid="button-reset-impacts" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Reset</button>}
      <button type="button" disabled={!dirty || !valid || upd.isPending} data-testid="button-save-impacts" onClick={() => upd.mutate({ id: agentId, data: { mappings: rows } }, {
        onSuccess: () => { inval(); toast({ title: "Impact mapping saved" }); },
        onError: () => toast({ title: "Could not save mapping", variant: "destructive" }),
      })} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-40">{upd.isPending ? "Saving…" : "Save"}</button>
    </div>
  </section>;
}
