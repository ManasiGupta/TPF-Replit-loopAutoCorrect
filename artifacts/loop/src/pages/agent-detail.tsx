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

const TABS = ["overview", "calls", "failures", "evals", "fixes", "versions", "settings"] as const;
export type TabKey = (typeof TABS)[number];

export default function AgentDetailPage() {
  const { id = "" } = useParams<{ id: string }>();
  const search = useSearch();
  const [, navigate] = useLocation();
  const { state } = useDemo();
  const agent = state.agents.find((a) => a.id === id);
  const raw = new URLSearchParams(search).get("tab") as TabKey | null;
  const tab: TabKey = raw && TABS.includes(raw) ? raw : "overview";
  const go = (t: TabKey) => navigate(`/agents/${id}${t === "overview" ? "" : `?tab=${t}`}`);

  if (!agent) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-border bg-card" data-testid="status-detail-error">
        <Empty icon={SearchX} title="Agent not found" body="It may have been removed when the demo data was reset.">
          <Link href="/agents" className="text-sm font-medium text-primary hover:underline">Back to agents</Link>
        </Empty>
      </div>
    );
  }
  const s = agentStats(state, id);
  const counts: Partial<Record<TabKey, number>> = { failures: s.openClusters, fixes: s.pendingFixes };

  return (
    <div>
      <Link href="/agents" data-testid="link-back" className="mb-5 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All agents</Link>
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
