import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, ChevronDown, CircleAlert, KeyRound, Loader2, LockKeyhole, Plus, RefreshCw, ShieldCheck, X } from "lucide-react";
import { discoverAgents, previewAgent, connectAgent, useGetSetup, getListAgentsQueryKey, getGetAgentQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import type { AgentPreview, RemoteAgent } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { errorMessage } from "@/lib/api-error";

const MAX_CRITERIA = 30;
const MAX_WARN = 25;

function messageFrom(error: unknown) {
  return errorMessage(error, "The connection request could not be completed. Check your connection and try again.");
}

function Stage({ number, title, active, complete, children }: { number: number; title: string; active: boolean; complete?: boolean; children: React.ReactNode }) {
  return <section className={`grid grid-cols-[2rem_1fr] gap-4 pb-9 last:pb-0 ${active ? "" : "opacity-55"}`}>
    <div className="flex flex-col items-center">
      <span className={`grid h-8 w-8 place-items-center rounded-full border font-mono text-xs ${complete ? "border-[#5B4BFF] bg-[#5B4BFF] text-white" : active ? "border-[#5B4BFF] text-[#5B4BFF]" : "border-[#DDD9EB] text-[#8A879A]"}`}>{complete ? <Check className="h-4 w-4" /> : number}</span>
      <span className="mt-2 w-px flex-1 bg-[#E7E4F0]" />
    </div>
    <div className="min-w-0">
      <h2 className="mb-4 pt-1 font-display text-lg font-semibold tracking-tight">{title}</h2>
      {children}
    </div>
  </section>;
}

export default function ConnectPage() {
  const [, navigate] = useLocation();
  const queryClient = useQueryClient();
  const setupQuery = useGetSetup({ query: { retry: false } });
  const [apiKey, setApiKey] = useState("");
  const [agents, setAgents] = useState<RemoteAgent[]>([]);
  const [preview, setPreview] = useState<AgentPreview | null>(null);
  const [remoteId, setRemoteId] = useState("");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [discovering, setDiscovering] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [keyVisible, setKeyVisible] = useState(false);
  const requestVersion = useRef(0);
  const busy = useRef(false);

  const setup = setupQuery.data;
  const canSave = !!setup?.databaseReady && !!setup?.encryptionReady;
  const validKey = apiKey.trim().length > 0 && apiKey.trim().length <= 1024;
  const selectedAgent = agents.find((agent) => agent.remoteId === remoteId);
  const ready = !!preview && !previewing;
  const totalCriteria = (preview?.criteria.length ?? 0) + criteria.length;
  const tooMany = totalCriteria >= MAX_WARN;

  useEffect(() => () => { requestVersion.current += 1; }, []);

  const onKeyChange = (value: string) => {
    requestVersion.current += 1;
    busy.current = false;
    setApiKey(value);
    setAgents([]);
    setDiscovering(false);
    setPreviewing(false);
    setPreview(null);
    setRemoteId("");
    setCriteria([]);
    setError("");
  };

  const discover = async () => {
    if (!validKey || discovering || busy.current) return;
    setPreview(null);
    setRemoteId("");
    setCriteria([]);
    setDraft("");
    const token = ++requestVersion.current;
    busy.current = true;
    setDiscovering(true);
    setPreviewing(false);
    setError("");
    setAgents([]);
    try {
      const result = await discoverAgents({ apiKey: apiKey.trim() });
      if (requestVersion.current !== token) return;
      setAgents(result);
      if (!result.length) setError("No conversational AI agents were found for this key.");
    } catch (e) {
      if (requestVersion.current === token) setError(messageFrom(e));
    } finally {
      if (requestVersion.current === token) {
        busy.current = false;
        setDiscovering(false);
      }
    }
  };

  const chooseAgent = async (id: string) => {
    requestVersion.current += 1;
    const token = requestVersion.current;
    setRemoteId(id);
    setPreview(null);
    setCriteria([]);
    setDraft("");
    setError("");
    setPreviewing(false);
    if (!id) return;
    setPreviewing(true);
    try {
      const result = await previewAgent({ apiKey: apiKey.trim(), remoteId: id });
      if (requestVersion.current !== token) return;
      setPreview(result);
    } catch (e) {
      if (requestVersion.current === token) setError(messageFrom(e));
    } finally {
      if (requestVersion.current === token) setPreviewing(false);
    }
  };

  const addCriterion = () => {
    const value = draft.trim();
    if (!value || totalCriteria >= MAX_CRITERIA) return;
    setCriteria((current) => [...current, value]);
    setDraft("");
  };

  const save = async () => {
    if (!preview || !canSave || saving || busy.current) return;
    const token = requestVersion.current;
    busy.current = true;
    setSaving(true);
    setError("");
    try {
      const saved = await connectAgent({ apiKey: apiKey.trim(), remoteId: preview.remoteId, userCriteria: criteria });
      if (requestVersion.current !== token) return;
      queryClient.setQueryData(getGetAgentQueryKey(saved.id), saved);
      void queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() });
      setApiKey("");
      setAgents([]);
      setPreview(null);
      setCriteria([]);
      navigate(`/agents/${saved.id}`);
    } catch (e) {
      if (requestVersion.current === token) setError(messageFrom(e));
    } finally {
      busy.current = false;
      if (requestVersion.current === token) setSaving(false);
    }
  };

  return <div className="mx-auto max-w-4xl text-[#1A1A2E]">
    <nav aria-label="Breadcrumb" className="mb-7 flex items-center gap-2 text-sm text-[#69677A]">
      <Link href="/" className="hover:text-[#5B4BFF]">Home</Link><span aria-hidden>/</span>
      <Link href="/agents" data-testid="link-back" className="inline-flex items-center gap-2 rounded-md transition-colors hover:text-[#5B4BFF]"><ArrowLeft className="h-4 w-4" /> All agents</Link>
    </nav>
    <div className="rise mb-9">
      <p className="mb-2 font-mono text-[10px] uppercase tracking-[.2em] text-[#5B4BFF]">ElevenLabs · secure connection</p>
      <h1 className="font-display text-4xl font-semibold tracking-[-.035em] sm:text-5xl">Connect your agent</h1>
      <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-[#706E81]">Bring an existing production agent into Loop. We read its current configuration and criteria; no prompt changes are made here.</p>
    </div>
    <div className="mb-8 grid gap-3 sm:grid-cols-3">
      {[
        ["01", "Add API key"],
        ["02", "Choose agent"],
        ["03", "Review criteria"],
      ].map(([n, text], index) => <div key={n} className="flex items-center gap-3 rounded-xl border border-[#E8E6F1] bg-white/80 px-4 py-3">
        <span className={`font-mono text-xs ${index === (preview ? 2 : agents.length ? 1 : 0) ? "text-[#5B4BFF]" : "text-[#AAA7B8]"}`}>{n}</span><span className="text-sm font-medium">{text}</span>
      </div>)}
    </div>

    <div className="rounded-2xl border border-[#E7E4F0] bg-white p-5 shadow-[0_25px_80px_-55px_rgba(40,33,97,.35)] sm:p-8">
      <Stage number={1} title="ElevenLabs credentials" active complete={agents.length > 0}>
        <div className="rounded-xl border border-[#E9E7F2] bg-[#FDFDFF] p-4 sm:p-5">
          <label htmlFor="api-key" className="mb-2 block text-sm font-semibold">API key</label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative min-w-0 flex-1">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8A879D]" />
              <input id="api-key" autoComplete="off" spellCheck={false} disabled={saving} type={keyVisible ? "text" : "password"} value={apiKey} onChange={(event) => onKeyChange(event.target.value)} placeholder="Paste your ElevenLabs API key" data-testid="input-api-key" className="h-11 w-full rounded-lg border border-[#E1DEEC] bg-white pl-10 pr-11 font-mono text-sm outline-none transition-shadow placeholder:font-sans placeholder:text-[#AAA7B8] focus:border-[#9388FF] focus:ring-4 focus:ring-[#5B4BFF]/10 disabled:opacity-60" />
              <button type="button" onClick={() => setKeyVisible((visible) => !visible)} aria-label={keyVisible ? "Hide API key" : "Show API key"} data-testid="button-toggle-key-visibility" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded text-[#8A879D] hover:bg-[#F1EFFF] hover:text-[#5B4BFF]">{keyVisible ? <X className="h-4 w-4" /> : <span className="font-mono text-[10px]">•••</span>}</button>
            </div>
            <button type="button" onClick={discover} disabled={!validKey || discovering} data-testid="button-discover" className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-full bg-[#5B4BFF] px-5 text-sm font-semibold text-white shadow-[0_10px_25px_-14px_rgba(91,75,255,.8)] transition-transform hover:-translate-y-0.5 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-45">
              {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}{agents.length ? "Refresh agents" : "Find my agents"}
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 text-xs leading-relaxed text-[#77758A]"><LockKeyhole className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#5B4BFF]" /><p>Your key is sent over the authenticated connection for discovery and encrypted storage. It stays in memory on this screen only and is never saved in browser storage.</p></div>
          {setupQuery.isLoading ? <div className="mt-4"><Skeleton className="h-10 w-full" /></div> : setupQuery.isError ? <div className="mt-4 flex items-center justify-between rounded-lg border border-[#F0D7D9] bg-[#FFF8F8] px-3 py-2 text-xs text-[#8C3C4A]"><span>Could not check whether secure storage is ready.</span><button type="button" onClick={() => setupQuery.refetch()} className="font-semibold underline">Retry</button></div> : setup && !canSave ? <div className="mt-4 flex gap-2 rounded-lg border border-[#EADFC3] bg-[#FFFCF5] p-3 text-xs leading-relaxed text-[#735C25]"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><p><strong>Saving is not available yet.</strong> {setup.message || "Secure storage and database setup must be complete before an agent can be saved."} You can still discover agents and review their current criteria.</p></div> : setup ? <div className="mt-4 flex items-center gap-2 text-xs text-[#287D61]"><ShieldCheck className="h-4 w-4" /> Database and encrypted credential storage are ready.</div> : null}
        </div>
      </Stage>

      <Stage number={2} title="Select an existing agent" active={agents.length > 0 || discovering} complete={!!preview}>
        {discovering ? <div className="space-y-2"><Skeleton className="h-12 w-full" /><Skeleton className="h-12 w-4/5" /></div> : agents.length ? <div className="relative">
          <select value={remoteId} disabled={previewing || saving} onChange={(event) => chooseAgent(event.target.value)} data-testid="select-agent" className="h-12 w-full appearance-none rounded-lg border border-[#E1DEEC] bg-[#FDFDFF] px-4 pr-10 text-sm outline-none focus:border-[#9388FF] focus:ring-4 focus:ring-[#5B4BFF]/10 disabled:opacity-60">
            <option value="">Choose an ElevenLabs agent</option>
            {agents.map((agent) => <option key={agent.remoteId} value={agent.remoteId}>{agent.name} · {agent.remoteId}</option>)}
          </select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78758B]" />
          {selectedAgent && <p className="mt-2 text-xs text-[#7A778A]">Agent ID <span className="font-mono text-[#4A485B]">{selectedAgent.remoteId}</span>{selectedAgent.tags.length > 0 && <span> · {selectedAgent.tags.join(", ")}</span>}</p>}
        </div> : <p className="rounded-xl border border-dashed border-[#DEDCE9] px-4 py-5 text-sm text-[#8A879A]">Your available agents will appear after you verify your API key.</p>}
      </Stage>

      <Stage number={3} title="Review success criteria" active={!!remoteId} complete={ready}>
        {previewing ? <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div> : preview ? <div className="space-y-4">
          {preview.warning && <div className="rounded-lg border border-[#EADFC3] bg-[#FFFCF5] px-4 py-3 text-sm leading-relaxed text-[#735C25]">{preview.warning}</div>}
          <div className="overflow-hidden rounded-xl border border-[#E7E4F0]">
            <div className="flex items-center justify-between border-b border-[#E7E4F0] bg-[#F8F7FC] px-4 py-3"><span className="text-sm font-semibold">Imported from ElevenLabs</span><span className="font-mono text-xs text-[#7E7B8E]">{preview.criteria.length} criteria</span></div>
            {preview.criteria.length ? <ul className="divide-y divide-[#EFEDF5]">{preview.criteria.map((criterion, index) => <li key={criterion.id} className="flex gap-3 px-4 py-3 text-sm leading-relaxed"><span className="pt-0.5 font-mono text-[10px] text-[#5B4BFF]">{String(index + 1).padStart(2, "0")}</span><span>{criterion.text || criterion.name}</span></li>)}</ul> : <p className="px-4 py-5 text-sm text-[#7A778A]">No success criteria were found in the current agent configuration.</p>}
          </div>
          <div className="rounded-xl border border-[#E7E4F0] bg-[#FDFDFF] p-4">
            <div className="mb-3 flex items-center justify-between"><label htmlFor="criterion" className="text-sm font-semibold">Add your criteria</label><span className={`font-mono text-xs ${tooMany ? "text-[#A66A28]" : "text-[#77758A]"}`} data-testid="text-criteria-count">{totalCriteria} / {MAX_CRITERIA}</span></div>
            {criteria.length > 0 && <ul className="mb-3 space-y-2">{criteria.map((item, index) => <li key={`${index}-${item}`} className="flex gap-3 rounded-lg bg-[#F2F0FF] px-3 py-2.5 text-sm" data-testid={`row-user-criterion-${index}`}><span className="flex-1">{item}</span><button type="button" disabled={saving} onClick={() => setCriteria((items) => items.filter((_, i) => i !== index))} aria-label={`Remove criterion ${index + 1}`} data-testid={`button-remove-criterion-${index}`} className="text-[#77758A] hover:text-[#AF3347] disabled:opacity-40"><X className="h-4 w-4" /></button></li>)}</ul>}
            <div className="flex flex-col gap-2 sm:flex-row"><textarea id="criterion" disabled={saving} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); addCriterion(); } }} rows={2} maxLength={4000} placeholder="Add an expectation Loop should use when reviewing calls" data-testid="input-criterion" className="min-h-11 flex-1 resize-y rounded-lg border border-[#E1DEEC] bg-white px-3 py-2.5 text-sm outline-none placeholder:text-[#AAA7B8] focus:border-[#9388FF] focus:ring-4 focus:ring-[#5B4BFF]/10 disabled:opacity-60" />
              <button type="button" onClick={addCriterion} disabled={!draft.trim() || totalCriteria >= MAX_CRITERIA || saving} data-testid="button-add-criterion" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-full border border-[#DCD8EF] px-4 text-sm font-semibold text-[#5B4BFF] hover:bg-[#F5F3FF] disabled:opacity-40"><Plus className="h-4 w-4" />Add</button></div>
            <p className="mt-2 text-xs text-[#817E91]">{tooMany ? "25+ criteria can be difficult to evaluate consistently. Review the list before continuing." : "Imported criteria are read-only here. Your additions are stored with the connection."}</p>
          </div>
        </div> : <p className="rounded-xl border border-dashed border-[#DEDCE9] px-4 py-5 text-sm text-[#8A879A]">Choose an agent to preview the criteria already in its configuration.</p>}
      </Stage>

      {error && <div role="alert" className="mb-4 flex items-start gap-2 rounded-xl border border-[#F0D7D9] bg-[#FFF8F8] px-4 py-3 text-sm text-[#8C3C4A]" data-testid="status-connect-error"><CircleAlert className="mt-0.5 h-4 w-4 shrink-0" /><span>{error}</span></div>}
      {agents.length === 0 && !discovering && apiKey.trim() && !error && <div className="mb-4 rounded-xl border border-[#E7E4F0] bg-[#F8F7FC] px-4 py-3 text-xs text-[#77758A]">Your key has not been verified yet. Use “Find my agents” to securely check the available agents.</div>}
      <div className="flex flex-col gap-3 border-t border-[#E8E6F1] pt-5 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm text-[#77758A]">{!ready ? "Select and preview an agent before connecting." : !canSave ? "Secure storage must be ready before this connection can be saved." : <>Ready to connect <span className="font-semibold text-[#26243A]">{preview.name}</span>. Nothing is changed in ElevenLabs.</>}</p>
        <button type="button" onClick={save} disabled={!ready || !canSave || saving || setupQuery.isLoading || setupQuery.isError} data-testid="button-save" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-[#5B4BFF] px-6 text-sm font-semibold text-white shadow-[0_10px_26px_-14px_rgba(91,75,255,.8)] transition-transform hover:-translate-y-0.5 active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-40">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Connect agent
        </button>
      </div>
    </div>
    <p className="mx-auto mt-5 max-w-2xl text-center text-xs leading-relaxed text-[#8A879A]">Connect reads the agent and securely saves its credentials. This does not start monitoring, edit prompts, or publish changes.</p>
  </div>;
}
