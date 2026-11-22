import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Agent, Criterion, DemoState, Fix } from "./demo-types";
import { buildAgent, EXAMPLE_REMOTE, seedState } from "./demo-seed";

const KEY = "loop-demo-state-v2";

function load(): DemoState {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw) as DemoState;
      if (Array.isArray(s.agents)) return s;
    }
  } catch { /* ignore */ }
  return seedState();
}

type Actions = {
  state: DemoState;
  connectExample: (specId: string, extraCriteria: string[]) => string;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  addCriterion: (agentId: string, text: string) => void;
  editCriterion: (id: string, text: string) => void;
  removeCriterion: (id: string) => void;
  runBaseline: (agentId: string) => void;
  ensureFix: (failureId: string) => string;
  updateFix: (fixId: string, patch: Partial<Fix>) => void;
  rerunFix: (fixId: string) => void;
  approveFix: (fixId: string) => number;
  rejectFix: (fixId: string) => void;
  rollback: (agentId: string, n: number) => number;
  reset: () => void;
};

const Ctx = createContext<Actions | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<DemoState>(load);
  const ref = useRef(state);
  const commit = useCallback((fn: (s: DemoState) => DemoState) => {
    const next = fn(ref.current);
    ref.current = next;
    setState(next);
  }, []);
  useEffect(() => {
    try { window.localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore quota */ }
  }, [state]);

  const connectExample = useCallback((specId: string, extra: string[]) => {
    const spec = EXAMPLE_REMOTE.find((s) => s.id === specId);
    if (!spec) return "";
    let newId = spec.id;
    commit((s) => {
      newId = s.agents.some((a) => a.id === spec.id) ? `${spec.id}-${s.agents.length}` : spec.id;
      const part = buildAgent({ ...spec, id: newId, criteria: [...spec.criteria, ...extra] }, newId.length * 13, 0);
      part.calls = part.calls.slice(0, 6);
      return {
        agents: [part.agents[0], ...s.agents], versions: [...s.versions, ...part.versions], criteria: [...s.criteria, ...part.criteria],
        tests: [...s.tests, ...part.tests], calls: [...s.calls, ...part.calls], failures: [...s.failures, ...part.failures],
        fixes: s.fixes, baselineRuns: s.baselineRuns,
      };
    });
    return newId;
  }, []);

  const updateAgent = useCallback((id: string, patch: Partial<Agent>) =>
    commit((s) => ({ ...s, agents: s.agents.map((a) => (a.id === id ? { ...a, ...patch } : a)) })), []);

  const addCriterion = useCallback((agentId: string, text: string) =>
    commit((s) => ({ ...s, criteria: [...s.criteria, { id: `${agentId}-c${Date.now()}`, agentId, text, source: "loop" } as Criterion] })), []);
  const editCriterion = useCallback((id: string, text: string) =>
    commit((s) => ({ ...s, criteria: s.criteria.map((c) => (c.id === id ? { ...c, text } : c)) })), []);
  const removeCriterion = useCallback((id: string) =>
    commit((s) => ({ ...s, criteria: s.criteria.filter((c) => c.id !== id) })), []);
  const runBaseline = useCallback((agentId: string) =>
    commit((s) => ({ ...s, baselineRuns: { ...s.baselineRuns, [agentId]: new Date().toISOString() } })), []);

  const ensureFix = useCallback((failureId: string) => {
    let id = "";
    commit((s) => {
      const existing = s.fixes.find((f) => f.failureId === failureId && f.status === "candidate");
      if (existing) { id = existing.id; return s; }
      const fl = s.failures.find((f) => f.id === failureId);
      if (!fl) return s;
      const agent = s.agents.find((a) => a.id === fl.agentId)!;
      const live = s.versions.find((v) => v.agentId === agent.id && v.n === agent.liveVersion)!;
      const crit = s.criteria.find((c) => c.id === fl.criterionId);
      id = `${fl.id}-fix${Date.now()}`;
      const tests = s.tests.filter((t) => t.agentId === agent.id).map((t, i) => ({
        id: t.id, name: t.name, current: i % 3 !== 2, candidate: true, note: i % 3 === 2 ? "Fails on live prompt; passes with candidate" : "Unchanged",
      }));
      tests.push({ id: `${id}-repro`, name: `Repro: ${fl.title}`, current: false, candidate: true, note: "Reproduces the production failure" });
      const fix: Fix = {
        id, agentId: agent.id, failureId, status: "candidate", baseVersion: live.n, createdAt: new Date().toISOString(),
        title: `Address: ${fl.title.toLowerCase()}`,
        rationale: `${fl.callIds.length} calls failed "${crit?.text ?? "a criterion"}". The candidate adds an explicit instruction targeting the pattern seen in those transcripts.`,
        candidatePrompt: `${live.prompt}\n${crit ? `Required: ${crit.text.replace(/^The agent /, "")}` : "Follow every success criterion."}`,
        tests, evalChanges: [{ id: `${id}-ec0`, kind: "test", text: `Repro: ${fl.title}`, approved: false }],
      };
      return { ...s, fixes: [fix, ...s.fixes], failures: s.failures.map((f) => (f.id === failureId ? { ...f, status: "fixing" } : f)) };
    });
    return id;
  }, []);

  const updateFix = useCallback((fixId: string, patch: Partial<Fix>) =>
    commit((s) => ({ ...s, fixes: s.fixes.map((f) => (f.id === fixId ? { ...f, ...patch } : f)) })), []);

  const rerunFix = useCallback((fixId: string) =>
    commit((s) => ({
      ...s,
      fixes: s.fixes.map((f) => (f.id === fixId ? { ...f, tests: f.tests.map((t) => (t.current && !t.candidate ? { ...t, candidate: true, note: "Passes after prompt edit (simulated re-run)" } : t)) } : f)),
    })), []);

  const approveFix = useCallback((fixId: string) => {
    let n = 0;
    commit((s) => {
      const fix = s.fixes.find((f) => f.id === fixId);
      if (!fix) return s;
      const agentVersions = s.versions.filter((v) => v.agentId === fix.agentId);
      n = Math.max(...agentVersions.map((v) => v.n)) + 1;
      const passed = fix.tests.filter((t) => t.candidate).length;
      const rate = Math.round((passed / Math.max(fix.tests.length, 1)) * 1000) / 10;
      const prev = agentVersions.find((v) => v.n === fix.baseVersion)?.passRate ?? 80;
      const approved = fix.evalChanges.filter((e) => e.approved);
      return {
        ...s,
        agents: s.agents.map((a) => (a.id === fix.agentId ? { ...a, liveVersion: n } : a)),
        versions: [...s.versions, { agentId: fix.agentId, n, createdAt: new Date().toISOString(), note: fix.title, prompt: fix.candidatePrompt, passRate: Math.min(99.2, Math.max(rate, prev + 2.3)) }],
        fixes: s.fixes.map((f) => (f.id === fixId ? { ...f, status: "shipped" } : f)),
        failures: s.failures.map((f) => (f.id === fix.failureId ? { ...f, status: "fixed" } : f)),
        criteria: [...s.criteria, ...approved.filter((e) => e.kind === "criterion").map((e) => ({ id: `${e.id}-c`, agentId: fix.agentId, text: e.text, source: "approved-fix" as const }))],
        tests: [...s.tests, ...approved.filter((e) => e.kind === "test").map((e) => ({ id: `${e.id}-t`, agentId: fix.agentId, name: e.text, scenario: "Added from approved fix", origin: "approved-fix" as const }))],
      };
    });
    return n;
  }, []);

  const rejectFix = useCallback((fixId: string) =>
    commit((s) => {
      const fix = s.fixes.find((f) => f.id === fixId);
      return {
        ...s,
        fixes: s.fixes.map((f) => (f.id === fixId ? { ...f, status: "rejected" } : f)),
        failures: s.failures.map((f) => (fix && f.id === fix.failureId ? { ...f, status: "open" } : f)),
      };
    }), []);

  const rollback = useCallback((agentId: string, target: number) => {
    let n = 0;
    commit((s) => {
      const vs = s.versions.filter((v) => v.agentId === agentId);
      const t = vs.find((v) => v.n === target);
      if (!t) return s;
      n = Math.max(...vs.map((v) => v.n)) + 1;
      return {
        ...s,
        agents: s.agents.map((a) => (a.id === agentId ? { ...a, liveVersion: n } : a)),
        versions: [...s.versions, { ...t, n, createdAt: new Date().toISOString(), note: `Rollback to v${target}` }],
      };
    });
    return n;
  }, []);

  const reset = useCallback(() => commit(() => seedState()), []);

  const value = useMemo<Actions>(() => ({
    state, connectExample, updateAgent, addCriterion, editCriterion, removeCriterion, runBaseline,
    ensureFix, updateFix, rerunFix, approveFix, rejectFix, rollback, reset,
  }), [state, connectExample, updateAgent, addCriterion, editCriterion, removeCriterion, runBaseline, ensureFix, updateFix, rerunFix, approveFix, rejectFix, rollback, reset]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useDemo() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useDemo outside DemoProvider");
  return c;
}

export function agentStats(s: DemoState, agentId: string) {
  const agent = s.agents.find((a) => a.id === agentId);
  const live = s.versions.find((v) => v.agentId === agentId && v.n === agent?.liveVersion);
  const fl = s.failures.filter((f) => f.agentId === agentId);
  return {
    passRate: live?.passRate ?? null,
    open: fl.filter((f) => f.status !== "fixed").reduce((n, f) => n + f.callIds.length, 0),
    openClusters: fl.filter((f) => f.status !== "fixed").length,
    fixed: fl.filter((f) => f.status === "fixed").reduce((n, f) => n + f.callIds.length, 0),
    pendingFixes: s.fixes.filter((f) => f.agentId === agentId && f.status === "candidate").length,
    calls: s.calls.filter((c) => c.agentId === agentId).length,
  };
}
