import { Link } from "wouter";
import { ArrowRight, CircleAlert, Plug, RefreshCw, Radio, Search, X } from "lucide-react";
import { useMemo, useState } from "react";
import { getListAgentsQueryKey, useListAgents } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const query = useListAgents({ query: { queryKey: getListAgentsQueryKey(), retry: false, refetchInterval: 15000 } });
  const agents = query.data ?? [];
  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return needle ? agents.filter((agent) => `${agent.name} ${agent.remoteId} ${agent.platform}`.toLowerCase().includes(needle)) : agents;
  }, [agents, search]);

  return <div className="mx-auto max-w-6xl text-[#1A1A2E]">
    <div className="rise mb-8 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-[#5B4BFF]">Your workspace</p>
        <h1 className="font-display text-4xl font-semibold tracking-[-.035em]">All agents</h1>
        <p className="mt-2 text-sm text-[#77758A]">Real ElevenLabs connections saved to your account.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href="/connect" data-testid="link-connect-agent" className="inline-flex h-10 items-center gap-2 rounded-full bg-[#5B4BFF] px-5 text-sm font-semibold text-white shadow-[0_10px_25px_-14px_rgba(91,75,255,.8)] transition-transform hover:-translate-y-0.5">Connect agent <ArrowRight className="h-4 w-4" /></Link>
      </div>
    </div>

    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm text-[#68667A]"><Radio className="h-4 w-4 text-[#5B4BFF]" />{agents.length} connected {agents.length === 1 ? "agent" : "agents"}</div>
      <label className="relative w-full sm:w-72">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9290A1]" />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name or agent ID" data-testid="input-search" className="h-10 w-full rounded-full border border-[#E2DFED] bg-white pl-9 pr-9 text-sm outline-none transition-shadow placeholder:text-[#AAA7B8] focus:border-[#9388FF] focus:ring-4 focus:ring-[#5B4BFF]/10" />
        {search && <button type="button" onClick={() => setSearch("")} aria-label="Clear search" data-testid="button-clear-search" className="absolute right-3 top-1/2 -translate-y-1/2 rounded text-[#77758A] hover:text-[#5B4BFF]"><X className="h-3.5 w-3.5" /></button>}
      </label>
    </div>

    {query.isLoading ? <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-24 w-full rounded-2xl" />)}</div>
      : query.isError ? <div className="rounded-2xl border border-[#F0D7D9] bg-white p-8 text-center">
        <CircleAlert className="mx-auto h-7 w-7 text-[#B34D5C]" /><h2 className="mt-3 font-display text-xl font-semibold">Could not load your agents</h2><p className="mt-2 text-sm text-[#77758A]">Your saved connections are still secure. Check your session and retry.</p>
        <button onClick={() => query.refetch()} data-testid="button-retry-agents" className="mt-5 inline-flex h-9 items-center gap-2 rounded-full border border-[#DDD9EA] px-4 text-sm font-medium hover:bg-[#F8F7FC]"><RefreshCw className="h-4 w-4" />Try again</button>
      </div>
      : agents.length === 0 ? <div className="rounded-2xl border border-dashed border-[#DCD9E9] bg-white/70 px-6 py-16 text-center">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-[#F1EFFF] text-[#5B4BFF]"><Plug className="h-5 w-5" /></span>
        <h2 className="mt-5 font-display text-2xl font-semibold">Nothing connected yet</h2><p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-[#77758A]">Connect an existing ElevenLabs agent to review its current setup and add your own success criteria.</p>
        <Link href="/connect" data-testid="link-empty-connect" className="mt-6 inline-flex h-10 items-center gap-2 rounded-full bg-[#5B4BFF] px-5 text-sm font-semibold text-white">Connect your first agent <ArrowRight className="h-4 w-4" /></Link>
      </div>
      : filtered.length === 0 ? <div className="rounded-2xl border border-[#E7E4F0] bg-white px-5 py-12 text-center text-sm text-[#77758A]">No connected agents match “{search}”.</div>
      : <ul className="grid gap-3">
        {filtered.map((agent, index) => <li key={agent.id} className="rise" style={{ animationDelay: `${index * 45}ms` }}>
          <Link href={`/agents/${agent.id}`} data-testid={`link-agent-${agent.id}`} className="group grid gap-4 rounded-2xl border border-[#E7E4F0] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#C9C2FF] hover:shadow-[0_18px_44px_-34px_rgba(57,43,156,.42)] sm:grid-cols-[1fr_auto] sm:items-center sm:px-5 sm:py-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display text-lg font-semibold tracking-tight">{agent.name}</span>
                <span className="rounded-full bg-[#F2F0FF] px-2.5 py-1 font-mono text-[10px] text-[#5B4BFF]">{agent.platform}</span>
                <span className="rounded-full bg-[#F6F5FA] px-2.5 py-1 text-[10px] text-[#69677A]">{agent.status}</span>
              </div>
              <p className="mt-1.5 truncate font-mono text-xs text-[#858295]">ID {agent.remoteId} <span className="px-1.5 text-[#C0BDCC]">/</span>{agent.criteriaCount} saved criteria</p>
            </div>
            <div className="flex items-center justify-between gap-6 border-t border-[#F0EEF5] pt-3 sm:border-0 sm:pt-0">
              <div className="flex gap-6">
                <div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#9693A4]">Pass rate</p><p className="mt-1 text-sm font-semibold tabular">{agent.passRate == null ? <span className="font-normal text-[#858295]">Not measured</span> : `${agent.passRate.toFixed(1)}%`}</p></div>
                <div><p className="font-mono text-[9px] uppercase tracking-[.14em] text-[#9693A4]">Failed calls</p><p className="mt-1 text-sm font-semibold tabular">{agent.openFailures == null ? <span className="font-normal text-[#858295]">Not measured</span> : agent.openFailures}</p></div>
              </div>
              <ArrowRight className="h-4 w-4 text-[#858295] transition-transform group-hover:translate-x-1 group-hover:text-[#5B4BFF]" />
            </div>
          </Link>
        </li>)}
      </ul>}
  </div>;
}
