import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, FlaskConical, Plus, X } from "lucide-react";
import { EXAMPLE_REMOTE } from "@/lib/demo-seed";
import { useDemo } from "@/lib/demo-store";

export default function SampleConnectPage() {
  const [, navigate] = useLocation();
  const { connectExample } = useDemo();
  const [selectedId, setSelectedId] = useState("");
  const [criteria, setCriteria] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const selected = EXAMPLE_REMOTE.find((item) => item.id === selectedId);
  const add = () => {
    const value = draft.trim();
    if (value && criteria.length < 30) {
      setCriteria((current) => [...current, value]);
      setDraft("");
    }
  };
  const createSample = () => {
    if (!selected) return;
    const id = connectExample(selected.id, criteria);
    navigate(`/sample/${id}`);
  };
  return <div className="mx-auto max-w-3xl">
    <Link href="/sample" className="mb-6 inline-flex items-center gap-2 text-sm text-[#69677A] hover:text-[#5B4BFF]"><ArrowLeft className="h-4 w-4" /> Sample workspace</Link>
    <div className="mb-7"><p className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[.18em] text-[#5B4BFF]"><FlaskConical className="h-3.5 w-3.5" /> Sample-only flow</p><h1 className="mt-2 font-display text-4xl font-semibold tracking-[-.035em]">Add a sample agent</h1><p className="mt-2 text-sm leading-relaxed text-[#77758A]">Use synthetic records to explore the interface. This does not contact ElevenLabs, accept a key, or create a real connection.</p></div>
    <div className="space-y-5 rounded-2xl border border-[#E7E4F0] bg-white p-5 sm:p-7">
      <div className="rounded-xl border border-[#DED9FF] bg-[#F5F3FF] p-4 text-sm leading-relaxed text-[#575273]">The sample workspace is separate from <Link href="/connect" className="font-semibold text-[#5B4BFF] underline underline-offset-2">your real connections</Link>. Only this page uses simulated examples.</div>
      <label className="block text-sm font-semibold" htmlFor="sample-agent">Choose a fictional agent</label>
      <select id="sample-agent" value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setCriteria([]); }} data-testid="select-sample-agent" className="h-11 w-full rounded-lg border border-[#E1DEEC] bg-[#FDFDFF] px-3 text-sm outline-none focus:border-[#9388FF] focus:ring-4 focus:ring-[#5B4BFF]/10">
        <option value="">Select an example</option>
        {EXAMPLE_REMOTE.map((item) => <option key={item.id} value={item.id}>{item.org} / {item.name}</option>)}
      </select>
      {selected && <div className="rounded-xl border border-[#EAE8F1] p-4">
        <h2 className="text-sm font-semibold">Example criteria</h2>
        <ul className="mt-2 space-y-2 text-sm text-[#666478]">{selected.criteria.map((text) => <li key={text} className="rounded-lg bg-[#F8F7FC] px-3 py-2">{text}</li>)}</ul>
        <div className="mt-5 flex items-center justify-between"><h3 className="text-sm font-semibold">Extra sample criteria</h3><span className="font-mono text-xs text-[#858295]">{criteria.length} / 30</span></div>
        {criteria.length > 0 && <ul className="mt-2 space-y-2">{criteria.map((text, index) => <li key={`${index}-${text}`} className="flex items-center gap-2 rounded-lg bg-[#F2F0FF] px-3 py-2 text-sm"><span className="flex-1">{text}</span><button type="button" onClick={() => setCriteria((items) => items.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Remove sample criterion ${index + 1}`}><X className="h-4 w-4 text-[#77758A]" /></button></li>)}</ul>}
        <div className="mt-3 flex gap-2"><input value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); add(); } }} maxLength={4000} placeholder="Add a simulated criterion" data-testid="input-sample-criterion" className="h-10 min-w-0 flex-1 rounded-lg border border-[#E1DEEC] px-3 text-sm outline-none focus:border-[#9388FF] focus:ring-4 focus:ring-[#5B4BFF]/10" /><button type="button" onClick={add} disabled={!draft.trim() || criteria.length >= 30} className="inline-flex h-10 items-center gap-1.5 rounded-full border border-[#DCD8EF] px-4 text-sm font-semibold text-[#5B4BFF] disabled:opacity-40"><Plus className="h-4 w-4" />Add</button></div>
      </div>}
      <button type="button" onClick={createSample} disabled={!selected} data-testid="button-add-sample-agent" className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-[#5B4BFF] px-5 text-sm font-semibold text-white disabled:opacity-40"><FlaskConical className="h-4 w-4" />Add to sample workspace</button>
    </div>
  </div>;
}
