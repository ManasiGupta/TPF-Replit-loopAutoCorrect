import { Link, useLocation, useParams, useSearch } from "wouter";
import { ArrowLeft, SearchX } from "lucide-react";
import { useDemo, agentStats } from "@/lib/demo-store";
import { Empty, Eyebrow, Tag } from "@/components/loop/ui";
import { OverviewTab } from "@/components/loop/workspace/overview";
import { CallsTab } from "@/components/loop/workspace/calls";
import { FailuresTab } from "@/components/loop/workspace/failures";
import { EvalsTab } from "@/components/loop/workspace/evals";
import { FixesTab } from "@/components/loop/workspace/fixes";
import { VersionsTab } from "@/components/loop/workspace/versions";
import { SettingsTab } from "@/components/loop/workspace/settings";
import { cn } from "@/lib/utils";
import { getGetAgentQueryKey, useGetAgent } from "@workspace/api-client-react";
import type { AgentDetail } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

const TABS = ["overview", "calls", "failures", "evals", "fixes", "versions", "settings"] as const;
export type TabKey = (typeof TABS)[number];

export default function AgentDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const search = useSearch();
  const [location, navigate] = useLocation();
  const { state } = useDemo();
  const agent = state.agents.find((a) => a.id === id);
  const remoteQuery = useGetAgent(id, { query: { enabled: !agent, queryKey: getGetAgentQueryKey(id), retry: false } });
  const sampleRoute = location.startsWith("/sample/") || !!agent;
  const backHref = sampleRoute ? "/sample" : "/agents";
  const raw = new URLSearchParams(search).get("tab") as TabKey | null;
  const tab: TabKey = raw && TABS.includes(raw) ? raw : "overview";
  const go = (t: TabKey) => navigate(`${sampleRoute ? "/sample" : "/agents"}/${id}${t === "overview" ? "" : `?tab=${t}`}`);

  if (!agent) {
    if (remoteQuery.isLoading) return <div className="mx-auto max-w-4xl space-y-4"><Skeleton className="h-8 w-32" /><Skeleton className="h-32 w-full rounded-2xl" /><Skeleton className="h-48 w-full rounded-2xl" /></div>;
    if (remoteQuery.isError || !remoteQuery.data) return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card p-8 text-center" data-testid="status-detail-error">
        <Empty icon={SearchX} title="Agent not found" body="This connected agent may have been removed or may not belong to your account.">
          <button type="button" onClick={() => remoteQuery.refetch()} className="mr-4 text-sm font-medium text-primary hover:underline">Retry</button>
          <Link href={backHref} className="text-sm font-medium text-primary hover:underline">Back to agents</Link>
        </Empty>
      </div>
    );
    return <ConnectedAgentDetail agent={remoteQuery.data} backHref={backHref} />;
  }
  const s = agentStats(state, id);
  const counts: Partial<Record<TabKey, number>> = { failures: s.openClusters, fixes: s.pendingFixes };

  return (
    <div>
      <Link href={backHref} data-testid="link-back" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />{sampleRoute ? "Sample agents" : "All agents"}</Link>
      <div className="rise mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <Eyebrow className="mb-1">{agent.org}</Eyebrow>
          <h1 className="font-display text-3xl font-semibold sm:text-4xl" data-testid="text-agent-name">{agent.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Tag>{agent.remoteId}</Tag>
            <Tag className="border-primary/30 bg-accent text-accent-foreground">live v{agent.liveVersion}</Tag>
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-1.5 w-1.5"><span className={cn("absolute inset-0 rounded-full", agent.status === "monitoring" ? "pulse-dot bg-pass" : "")} /><span className={cn("relative h-1.5 w-1.5 rounded-full", agent.status === "monitoring" ? "bg-pass" : "bg-muted-foreground/50")} /></span>
              {agent.status === "monitoring" ? `Sample polling every ${agent.pollMinutes} min` : "Polling paused"}
            </span>
          </div>
        </div>
      </div>

      <nav className="sticky top-[6.5rem] z-30 -mx-4 mb-6 overflow-x-auto border-b border-border bg-background/90 px-4 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t} onClick={() => go(t)} data-testid={`tab-${t}`} className={cn("relative whitespace-nowrap px-3 py-3 text-sm capitalize transition-colors", tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t}
              {counts[t] ? <span className={cn("ml-1.5 rounded-full px-1.5 font-mono text-[10px] tabular", t === "fixes" ? "bg-primary text-primary-foreground" : "bg-destructive/12 text-destructive")}>{counts[t]}</span> : null}
              <span className={cn("absolute inset-x-2 -bottom-px h-0.5 origin-left rounded-full bg-primary transition-transform duration-300", tab === t ? "scale-x-100" : "scale-x-0")} />
            </button>
          ))}
        </div>
      </nav>

      <div key={tab} className="rise">
        {tab === "overview" && <OverviewTab agentId={id} onTab={go} />}
        {tab === "calls" && <CallsTab agentId={id} />}
        {tab === "failures" && <FailuresTab agentId={id} />}
        {tab === "evals" && <EvalsTab agentId={id} />}
        {tab === "fixes" && <FixesTab agentId={id} />}
        {tab === "versions" && <VersionsTab agentId={id} />}
        {tab === "settings" && <SettingsTab agentId={id} />}
      </div>
    </div>
  );
}

function ConnectedAgentDetail({ agent, backHref }: { agent: AgentDetail; backHref: string }) {
  const imported = agent.criteria.filter((criterion) => criterion.source === "imported");
  const user = agent.criteria.filter((criterion) => criterion.source === "user");
  return <div className="mx-auto max-w-5xl text-[#1A1A2E]">
    <Link href={backHref} data-testid="link-back" className="mb-6 inline-flex items-center gap-2 text-sm text-[#69677A] hover:text-[#5B4BFF]"><ArrowLeft className="h-4 w-4" /> Agents</Link>
    <div className="mb-8 rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-8">
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-[#5B4BFF]">Connected ElevenLabs agent</p>
      <div className="mt-3 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div className="min-w-0"><h1 className="font-display text-3xl font-semibold tracking-[-.035em] sm:text-4xl" data-testid="text-agent-name">{agent.name}</h1><p className="mt-2 truncate font-mono text-xs text-[#77758A]">Agent ID · {agent.remoteId}</p></div>
        <span className="w-fit rounded-full bg-[#F2F0FF] px-3 py-1.5 font-mono text-xs text-[#5B4BFF]">{agent.platform}</span>
      </div>
      {agent.warning && <p className="mt-5 rounded-xl border border-[#EADFC3] bg-[#FFFCF5] px-4 py-3 text-sm leading-relaxed text-[#735C25]">{agent.warning}</p>}
    </div>
    <div className="mb-6 grid gap-3 sm:grid-cols-3">
      <div className="rounded-xl border border-[#E7E4F0] bg-white p-4"><p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#8B889A]">Pass rate</p><p className="mt-2 font-display text-xl font-semibold">{agent.passRate == null ? "Not measured" : `${agent.passRate.toFixed(1)}%`}</p></div>
      <div className="rounded-xl border border-[#E7E4F0] bg-white p-4"><p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#8B889A]">Open failures</p><p className="mt-2 font-display text-xl font-semibold">{agent.openFailures == null ? "Not measured" : agent.openFailures}</p></div>
      <div className="rounded-xl border border-[#E7E4F0] bg-white p-4"><p className="font-mono text-[10px] uppercase tracking-[.13em] text-[#8B889A]">Saved criteria</p><p className="mt-2 font-display text-xl font-semibold">{agent.criteriaCount}</p></div>
    </div>
    <div className="mb-6 rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-6">
      <div className="flex items-center justify-between gap-4"><div><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8B889A]">Credential</p><h2 className="mt-1 font-display text-xl font-semibold">Stored securely</h2></div><span className="rounded-lg bg-[#F5F4FA] px-3 py-2 font-mono text-sm text-[#575467]" data-testid="text-key-masked">{agent.keyMasked}</span></div>
      <p className="mt-2 text-xs text-[#858295]">Only the masked representation is returned to this screen.</p>
    </div>
    <div className="rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-6">
      <div className="mb-5"><p className="font-mono text-[10px] uppercase tracking-[.16em] text-[#8B889A]">Current setup</p><h2 className="mt-1 font-display text-xl font-semibold">Success criteria</h2></div>
      {agent.criteria.length === 0 ? <p className="rounded-xl border border-dashed border-[#DEDCE9] px-4 py-8 text-center text-sm text-[#858295]">No criteria were returned for this agent.</p> : <div className="space-y-6">
        {[
          { title: "Imported from ElevenLabs", items: imported, source: "imported" },
          { title: "Added in Loop", items: user, source: "user" },
        ].filter((group) => group.items.length > 0).map((group) => <section key={group.source}>
          <div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-semibold">{group.title}</h3><span className="font-mono text-xs text-[#858295]">{group.items.length}</span></div>
          <ul className="divide-y divide-[#EFEDF5] rounded-xl border border-[#EAE8F1]">
            {group.items.map((criterion, index) => <li key={criterion.id} className="flex items-start gap-3 px-4 py-3 text-sm leading-relaxed"><span className="pt-0.5 font-mono text-[10px] text-[#5B4BFF]">{String(index + 1).padStart(2, "0")}</span><span>{criterion.text || criterion.name}</span></li>)}
          </ul>
        </section>)}
      </div>}
    </div>
    <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#F5F3FF] p-4 text-xs leading-relaxed text-[#656279]"><span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[#5B4BFF]" /><p>Call activity, monitoring status, and performance metrics are not yet measured for this connected record. No sample statistics are shown here.</p></div>
  </div>;
}
