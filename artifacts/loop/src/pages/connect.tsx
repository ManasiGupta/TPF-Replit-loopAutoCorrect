import { useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowLeft, Check, FlaskConical, Loader2, Lock, Plus, X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDemo } from "@/lib/demo-store";
import { EXAMPLE_REMOTE } from "@/lib/demo-seed";
import { useToast } from "@/hooks/use-toast";

const MAX = 30;

function Step({ n, title, done, active, children }: { n: number; title: string; done?: boolean; active?: boolean; children: React.ReactNode }) {
  return (
    <section className={`rise relative grid grid-cols-[2rem_1fr] gap-4 pb-10 transition-opacity ${active ? "" : "opacity-50"}`} style={{ animationDelay: `${n * 60}ms` }}>
      <div className="flex flex-col items-center">
        <span className={`grid h-7 w-7 place-items-center rounded-full border font-mono text-xs transition-colors ${done ? "border-primary bg-primary text-primary-foreground" : active ? "border-primary text-primary" : "border-border text-muted-foreground"}`}>
          {done ? <Check className="h-3.5 w-3.5" /> : n}
        </span>
        <span className="mt-2 w-px flex-1 bg-border" />
      </div>
      <div className="min-w-0">
        <h2 className="mb-4 pt-0.5 font-display text-lg font-semibold">{title}</h2>
        {children}
      </div>
    </section>
  );
}

export default function ConnectPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { connectExample } = useDemo();
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [remoteId, setRemoteId] = useState("");
  const [previewing, setPreviewing] = useState(false);
  const [extra, setExtra] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  const spec = EXAMPLE_REMOTE.find((s) => s.id === remoteId);
  const total = (spec?.criteria.length ?? 0) + extra.length;
  const ready = !!spec && !previewing;

  const load = () => { setLoading(true); setTimeout(() => { setLoading(false); setLoaded(true); }, 650); };
  const pick = (id: string) => { setRemoteId(id); setExtra([]); setPreviewing(true); setTimeout(() => setPreviewing(false), 500); };
  const add = () => { const t = draft.trim(); if (!t || total >= MAX) return; setExtra((e) => [...e, t]); setDraft(""); };
  const save = () => {
    if (!spec) return;
    setSaving(true);
    setTimeout(() => {
      const id = connectExample(spec.id, extra);
      toast({ title: `${spec.org} / ${spec.name} added`, description: "Sample agent added to this demo workspace." });
      navigate(`/agents/${id}`);
    }, 500);
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/agents" data-testid="link-back" className="mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> All agents</Link>
      <div className="rise mb-6">
        <p className="mb-1 font-mono text-xs uppercase tracking-[.18em] text-primary">New connection</p>
        <h1 className="font-display text-4xl font-semibold">Connect an agent</h1>
        <p className="mt-2 max-w-lg text-muted-foreground">Walk through how Loop reads an agent and its success criteria.</p>
      </div>
      <div className="rise mb-8 flex gap-3 rounded-lg border border-dashed border-primary/40 bg-accent/40 px-4 py-3 text-sm" data-testid="text-demo-notice">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p><span className="font-medium">Demo flow.</span> <span className="text-muted-foreground">No API key is needed or accepted. The agents below are fictional examples, and nothing is contacted.</span></p>
      </div>

      <Step n={1} title="Platform and credentials" active done={loaded}>
        <div className="space-y-4 rounded-xl border border-border bg-card p-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Platform</label>
            <Select value="elevenlabs">
              <SelectTrigger className="h-10 bg-background" data-testid="select-platform"><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="elevenlabs">ElevenLabs Conversational AI</SelectItem></SelectContent>
            </Select>
          </div>
          <div>
            <label htmlFor="api-key" className="mb-1.5 block text-sm font-medium">API key</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative flex-1">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input id="api-key" readOnly value="demo-key-not-required" tabIndex={-1} data-testid="input-api-key" className="h-10 w-full cursor-not-allowed rounded-md border border-dashed border-input bg-muted/60 pl-9 pr-3 font-mono text-sm text-muted-foreground outline-none" />
              </div>
              <button onClick={load} disabled={loading || loaded} data-testid="button-discover" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-foreground px-4 text-sm font-medium text-background transition-transform active:scale-[.97] disabled:opacity-40">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}{loaded ? "Examples loaded" : "Load example agents"}
              </button>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">Read-only placeholder. In this prototype the field cannot be edited and nothing is stored.</p>
          </div>
        </div>
      </Step>

      <Step n={2} title="Choose the agent" active={loaded} done={!!spec}>
        <div className="rounded-xl border border-border bg-card p-5">
          <Select value={remoteId} onValueChange={pick} disabled={!loaded}>
            <SelectTrigger className="h-10 bg-background" data-testid="select-agent"><SelectValue placeholder={loaded ? `Select one of ${EXAMPLE_REMOTE.length} example agents` : "Load examples first"} /></SelectTrigger>
            <SelectContent>
              {EXAMPLE_REMOTE.map((a) => (
                <SelectItem key={a.id} value={a.id} data-testid={`option-agent-${a.id}`}>
                  {a.org} / {a.name} <span className="ml-2 font-mono text-[11px] text-muted-foreground">{a.remoteId}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Step>

      <Step n={3} title="Success criteria" active={!!spec} done={ready && total > 0}>
        {previewing ? (
          <div className="space-y-2"><Skeleton className="h-14 w-full" /><Skeleton className="h-14 w-full" /></div>
        ) : spec ? (
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card px-5">
              <div className="flex items-center justify-between border-b border-border py-3 text-sm">
                <span className="font-medium">Imported from {spec.org}</span>
                <span className="font-mono text-xs text-muted-foreground">{spec.criteria.length}</span>
              </div>
              <ul>{spec.criteria.map((c, i) => (
                <li key={c} className="flex gap-3 border-b border-border/60 py-3 text-sm last:border-0"><span className="font-mono text-xs text-primary">{String(i + 1).padStart(2, "0")}</span>{c}</li>
              ))}</ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">Your criteria</span>
                <span className="font-mono text-xs text-muted-foreground tabular" data-testid="text-criteria-count">{total} / {MAX}</span>
              </div>
              {extra.length > 0 && (
                <ul className="mb-3 space-y-1.5">
                  {extra.map((t, i) => (
                    <li key={i} className="rise group flex items-start gap-3 rounded-md bg-accent/60 px-3 py-2 text-sm" data-testid={`row-user-criterion-${i}`}>
                      <span className="flex-1">{t}</span>
                      <button onClick={() => setExtra((c) => c.filter((_, j) => j !== i))} aria-label="Remove criterion" data-testid={`button-remove-criterion-${i}`} className="rounded p-0.5 text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
                    </li>
                  ))}
                </ul>
              )}
              <div className="flex flex-col gap-2 sm:flex-row">
                <textarea value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); add(); } }} rows={2} placeholder="e.g. The agent repeats the reservation time before hanging up" data-testid="input-criterion" className="min-h-[44px] flex-1 resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring/30" />
                <button onClick={add} disabled={!draft.trim()} data-testid="button-add-criterion" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium hover:border-foreground/30 disabled:opacity-40"><Plus className="h-4 w-4" />Add</button>
              </div>
            </div>
          </div>
        ) : <p className="text-sm text-muted-foreground">Criteria appear here once you choose an agent.</p>}
      </Step>

      <div className="sticky bottom-4 z-10 flex flex-col items-stretch gap-3 rounded-xl border border-border bg-card/95 p-4 shadow-lg backdrop-blur sm:flex-row sm:items-center">
        <div className="flex-1 text-sm text-muted-foreground">
          {ready ? <>Add <span className="text-foreground">{spec!.org} / {spec!.name}</span> to the demo with {total} criteria.</> : "Choose an example agent to continue."}
        </div>
        <button onClick={save} disabled={!ready || saving} data-testid="button-save" className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground transition-transform active:scale-[.97] disabled:opacity-40">
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}Add sample agent
        </button>
      </div>
    </div>
  );
}
