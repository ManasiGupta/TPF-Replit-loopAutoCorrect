import { ArrowUpRight, Mic } from "lucide-react";

const PREVIEW_AGENT = "agent_5901m7yp1qdnet0bj3bnnxthk8pt";
const PREVIEW_URL = "https://elevenlabs.io/app/agents/agents/agent_5901m7yp1qdnet0bj3bnnxthk8pt/preview?branchId=agtbrch_0401m7yp1ra5f5fscn9cq6pe45v8";

export function AgentPreviewLink({ remoteId, frozen }: { remoteId: string; frozen: boolean }) {
  if (remoteId !== PREVIEW_AGENT) return null;
  return <div className="flex flex-col gap-3 rounded-2xl border border-[#E7E4F0] bg-white p-4 sm:flex-row sm:items-center sm:p-5" data-testid="panel-agent-preview">
    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#F2F0FF] text-[#5B4BFF]"><Mic className="h-4 w-4" /></span>
    <p className="flex-1 text-xs leading-relaxed text-[#6F6C82]">
      Opens ElevenLabs in a new tab, where you start the conversation yourself. Access depends on the provider's sharing settings.{" "}
      {frozen ? "This frozen sample will not update with your conversation." : "New calls appear here after ElevenLabs finishes analysis and the next scheduled sync runs."}
    </p>
    <a href={PREVIEW_URL} target="_blank" rel="noopener noreferrer" data-testid="link-agent-preview" className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-[#5B4BFF] px-5 text-sm font-semibold text-white transition-transform hover:-translate-y-0.5">Try a conversation in ElevenLabs <ArrowUpRight className="h-4 w-4" /></a>
  </div>;
}
