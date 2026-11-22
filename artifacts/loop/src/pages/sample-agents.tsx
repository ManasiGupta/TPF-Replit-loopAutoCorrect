import { Link } from "wouter";
import { ArrowRight, FlaskConical } from "lucide-react";
import { useDemo, agentStats } from "@/lib/demo-store";

export default function SampleAgentsPage() {
  const { state } = useDemo();
  return <div className="mx-auto max-w-6xl text-[#1A1A2E]">
    <div className="mb-7 rounded-2xl border border-[#DED9FF] bg-[#F5F3FF] p-5 sm:p-7">
      <p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#5B4BFF]"><FlaskConical className="h-3.5 w-3.5" /> Sample workspace · simulated data</p>
      <h1 className="mt-3 font-display text-3xl font-semibold tracking-[-.03em]">Explore the Loop workflow</h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#6F6C82]">These examples demonstrate the existing workspace screens. Calls, pass rates, failures, and fixes here are synthetic and separate from your connected ElevenLabs agents.</p>
    </div>
    <div className="mb-4 flex items-end justify-between gap-4">
      <div><h2 className="font-display text-2xl font-semibold">Sample agents</h2><p className="mt-1 text-sm text-[#77758A]">Open one to explore its tabs and simulated review actions.</p></div>
      <div className="flex gap-4"><Link href="/sample/connect" className="text-sm font-medium text-[#5B4BFF] hover:underline">Add sample</Link><Link href="/agents" className="text-sm font-medium text-[#5B4BFF] hover:underline">Back to your agents</Link></div>
    </div>
    <ul className="grid gap-3 md:grid-cols-2">
      {state.agents.map((agent) => {
        const stats = agentStats(state, agent.id);
        return <li key={agent.id}>
          <Link href={`/sample/${agent.id}`} data-testid={`link-sample-agent-${agent.id}`} className="group flex min-h-32 items-center justify-between gap-4 rounded-2xl border border-[#E7E4F0] bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#C9C2FF] hover:shadow-[0_18px_44px_-34px_rgba(57,43,156,.42)]">
            <div className="min-w-0"><p className="truncate font-display text-lg font-semibold">{agent.org} <span className="text-[#AAA7B8]">/</span> {agent.name}</p><p className="mt-1 truncate font-mono text-xs text-[#858295]">{agent.remoteId} · simulated</p>
              <div className="mt-4 flex flex-wrap gap-3 text-xs text-[#77758A]"><span>{stats.calls} sample calls</span><span>{stats.open} sample failures</span>{stats.passRate != null && <span>{stats.passRate.toFixed(1)}% sample pass rate</span>}</div>
            </div><ArrowRight className="h-4 w-4 shrink-0 text-[#8A879A] transition-transform group-hover:translate-x-1 group-hover:text-[#5B4BFF]" />
          </Link>
        </li>;
      })}
    </ul>
  </div>;
}
