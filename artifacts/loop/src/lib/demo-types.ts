export type Turn = { role: "agent" | "caller"; text: string };
export type CriterionResult = { criterionId: string; pass: boolean; reason: string };

export type Criterion = { id: string; agentId: string; text: string; source: "imported" | "loop" | "approved-fix" };
export type EvalTest = { id: string; agentId: string; name: string; scenario: string; origin: "baseline" | "from-failure" | "approved-fix" };

export type Version = {
  agentId: string;
  n: number;
  createdAt: string;
  passRate: number;
  note: string;
  prompt: string;
};

export type Call = {
  id: string;
  agentId: string;
  at: string;
  durationSec: number;
  kind: "production" | "test";
  version: number;
  caller: string;
  passed: boolean;
  transcript: Turn[];
  results: CriterionResult[];
  failureId?: string;
};

export type Failure = {
  id: string;
  agentId: string;
  title: string;
  summary: string;
  criterionId: string;
  callIds: string[];
  status: "open" | "fixing" | "fixed";
  firstSeen: string;
};

export type FixTest = { id: string; name: string; current: boolean; candidate: boolean; note: string };
export type EvalChange = { id: string; kind: "criterion" | "test"; text: string; approved: boolean };

export type Fix = {
  id: string;
  agentId: string;
  failureId: string;
  title: string;
  rationale: string;
  status: "candidate" | "shipped" | "rejected";
  baseVersion: number;
  candidatePrompt: string;
  tests: FixTest[];
  evalChanges: EvalChange[];
  createdAt: string;
  edited?: boolean;
};

export type Agent = {
  id: string;
  name: string;
  org: string;
  remoteId: string;
  keyMasked: string;
  status: "monitoring" | "paused";
  liveVersion: number;
  pollMinutes: number;
  autoShip: boolean;
  connectedAt: string;
};

export type DemoState = {
  agents: Agent[];
  versions: Version[];
  criteria: Criterion[];
  tests: EvalTest[];
  calls: Call[];
  failures: Failure[];
  fixes: Fix[];
  baselineRuns: Record<string, string>;
};
