import { useEffect, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { AlertTriangle } from "lucide-react";
import { getGetCallQueryKey, getGetMonitoringDashboardQueryKey, useGetCall, useGetMonitoringDashboard, usePollAgent } from "@workspace/api-client-react";
import type { AgentDetail } from "@workspace/api-client-react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Empty } from "@/components/loop/ui";
import { SnapshotCallDetail } from "@/components/loop/snapshot/snapshot-call";
import { MonitoringLine, PollButton, useInvalidateAgent } from "@/components/loop/workspace/connected";
import { MonitoringDashboardView, type Bucket } from "./dashboard-view";

const TICK = 60000;
const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

export function ConnectedDashboard({ agent }: { agent: AgentDetail }) {
  const id = agent.id;
  const [bucket, setBucket] = useState<Bucket>("hour");
  const [openCall, setOpenCall] = useState<string | null>(null);
  const [, navigate] = useLocation();
  const incidentId = new URLSearchParams(useSearch()).get("incident");
  const params = { bucket, timezone: tz };
  const q = useGetMonitoringDashboard(id, params, { query: { queryKey: getGetMonitoringDashboardQueryKey(id, params), refetchInterval: TICK } });
  const poll = usePollAgent();
  const pollRef = useRef(poll.mutateAsync);
  pollRef.current = poll.mutateAsync;
  const inval = useInvalidateAgent(id);
  const invalRef = useRef(inval);
  invalRef.current = inval;
  const inflight = useRef(false);
  const enabled = agent.monitoring.enabled;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const run = async () => {
      if (inflight.current) { timer = setTimeout(run, TICK); return; }
      inflight.current = true;
      try { await pollRef.current({ id }); if (!cancelled) invalRef.current(); } catch { /* surfaced via monitoring.lastError */ }
      finally { inflight.current = false; if (!cancelled) timer = setTimeout(run, TICK); }
    };
    void run();
    return () => { cancelled = true; if (timer) clearTimeout(timer); };
  }, [id, enabled]);

  if (q.isLoading) return <div className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-2xl" />)}</div><Skeleton className="h-72 rounded-2xl" /></div>;
  if (q.isError || !q.data) return <div className="rounded-2xl border border-border bg-card p-8"><Empty icon={AlertTriangle} title="Dashboard could not load" body="The monitoring data could not be read."><button type="button" onClick={() => q.refetch()} data-testid="button-retry-dashboard" className="text-sm font-medium text-primary hover:underline">Retry</button></Empty></div>;

  return <>
    <MonitoringDashboardView data={q.data} bucket={bucket} onBucket={setBucket} onOpenCall={setOpenCall} incidentId={incidentId}
      onIncident={(iid) => navigate(iid ? `/agents/${id}?incident=${encodeURIComponent(iid)}` : `/agents/${id}`)}
      header={<div className="flex flex-wrap items-center justify-between gap-3"><MonitoringLine m={q.data.monitoring} /><PollButton agentId={id} m={q.data.monitoring} /></div>} />
    <Sheet open={!!openCall} onOpenChange={(o) => !o && setOpenCall(null)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">{openCall && <LiveCall agentId={id} callId={openCall} />}</SheetContent>
    </Sheet>
  </>;
}

function LiveCall({ agentId, callId }: { agentId: string; callId: string }) {
  const q = useGetCall(agentId, callId, { query: { queryKey: getGetCallQueryKey(agentId, callId) } });
  if (q.isLoading) return <div className="space-y-3 pt-6"><Skeleton className="h-6 w-2/3" /><Skeleton className="h-40 w-full" /></div>;
  if (!q.data) return <div className="pt-10"><SheetHeader className="sr-only"><SheetTitle>Call</SheetTitle><SheetDescription>Error</SheetDescription></SheetHeader><Empty icon={AlertTriangle} title="Call could not load" body="Try again."><button type="button" onClick={() => q.refetch()} className="text-sm font-medium text-primary hover:underline">Retry</button></Empty></div>;
  return <SnapshotCallDetail call={q.data} readOnly={false} />;
}
