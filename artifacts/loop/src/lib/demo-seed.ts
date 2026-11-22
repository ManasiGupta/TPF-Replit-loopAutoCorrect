import type { Agent, Call, Criterion, DemoState, EvalTest, Failure, Fix, Version, Turn } from "./demo-types";

type FailureSpec = { title: string; summary: string; criterion: number; count: number; status: Failure["status"]; transcript: Turn[]; reason: string };
export type AgentSpec = {
  id: string; name: string; org: string; remoteId: string; status: Agent["status"];
  criteria: string[]; tests: [string, string][];
  versions: { note: string; passRate: number; prompt: string }[];
  passTranscript: Turn[];
  failures: FailureSpec[];
  fix?: { failure: number; title: string; rationale: string; promptPatch: [string, string]; regression: boolean; evalChanges: [EvalChangeKind, string][] };
  callers: string[];
};
type EvalChangeKind = "criterion" | "test";

function rng(seed: number) {
  let s = seed;
  return () => ((s = (s * 9301 + 49297) % 233280) / 233280);
}
const day = 86400000;
const NOW = Date.now();
const iso = (ms: number) => new Date(ms).toISOString();

export function buildAgent(spec: AgentSpec, seed: number, connectedDaysAgo = 41): DemoState {
  const r = rng(seed);
  const vCount = spec.versions.length;
  const agent: Agent = {
    id: spec.id, name: spec.name, org: spec.org, remoteId: spec.remoteId,
    keyMasked: "xi-••••••••" + spec.remoteId.slice(-4), status: spec.status,
    liveVersion: vCount, pollMinutes: 15, autoShip: false, connectedAt: iso(NOW - connectedDaysAgo * day),
  };
  const versions: Version[] = spec.versions.map((v, i) => ({
    agentId: spec.id, n: i + 1, note: v.note, passRate: v.passRate, prompt: v.prompt,
    createdAt: iso(NOW - (connectedDaysAgo - 2 - i * Math.floor((connectedDaysAgo - 4) / vCount)) * day),
  }));
  const criteria: Criterion[] = spec.criteria.map((t, i) => ({ id: `${spec.id}-c${i + 1}`, agentId: spec.id, text: t, source: i < 2 ? "imported" : "loop" }));
  const tests: EvalTest[] = spec.tests.map(([name, scenario], i) => ({ id: `${spec.id}-t${i + 1}`, agentId: spec.id, name, scenario, origin: i < 3 ? "baseline" : "from-failure" }));

  const calls: Call[] = [];
  const failures: Failure[] = [];
  let ci = 0;
  const mkCall = (passed: boolean, transcript: Turn[], failCrit?: number, reason?: string, failureId?: string): Call => {
    ci++;
    const kind: Call["kind"] = r() < 0.22 ? "test" : "production";
    return {
      id: `${spec.id}-call${String(ci).padStart(3, "0")}`, agentId: spec.id,
      at: iso(NOW - Math.floor(r() * 9 * day) - ci * 3600000), durationSec: 48 + Math.floor(r() * 260),
      kind, version: vCount, caller: kind === "test" ? "Loop test runner" : spec.callers[ci % spec.callers.length],
      passed, transcript, failureId,
      results: criteria.map((c, i) => ({
        criterionId: c.id,
        pass: failCrit === undefined ? true : i !== failCrit,
        reason: failCrit === i ? (reason ?? "") : passReason(c.text),
      })),
    };
  };
  spec.failures.forEach((f, fi) => {
    const id = `${spec.id}-f${fi + 1}`;
    const ids: string[] = [];
    for (let k = 0; k < f.count; k++) {
      const c = mkCall(false, f.transcript, f.criterion, f.reason, id);
      ids.push(c.id); calls.push(c);
    }
    failures.push({ id, agentId: spec.id, title: f.title, summary: f.summary, criterionId: criteria[f.criterion].id, callIds: ids, status: f.status, firstSeen: iso(NOW - (6 + fi * 3) * day) });
  });
  const passCount = 14 + Math.floor(r() * 10);
  for (let k = 0; k < passCount; k++) calls.push(mkCall(true, spec.passTranscript));
  calls.sort((a, b) => b.at.localeCompare(a.at));

  const fixes: Fix[] = [];
  if (spec.fix) {
    const fx = spec.fix;
    const base = versions[vCount - 1].prompt;
    const fl = failures[fx.failure];
    const tn = tests.map((t, i) => ({
      id: t.id, name: t.name, current: i !== 0 && i % 4 !== 3, candidate: true,
      note: i % 4 === 3 ? "Fails on live prompt; passes with candidate" : "Unchanged",
    }));
    if (fx.regression) { tn[1] = { ...tn[1], current: true, candidate: false, note: "Candidate now skips this step after the new instruction" }; }
    tn.push({ id: `${spec.id}-tnew`, name: `Repro: ${fl.title}`, current: false, candidate: true, note: "Reproduces the production failure" });
    fixes.push({
      id: `${spec.id}-fix1`, agentId: spec.id, failureId: fl.id, title: fx.title, rationale: fx.rationale,
      status: "candidate", baseVersion: vCount, candidatePrompt: base.replace(fx.promptPatch[0], fx.promptPatch[1]),
      tests: tn, evalChanges: fx.evalChanges.map(([kind, text], i) => ({ id: `${spec.id}-ec${i}`, kind, text, approved: false })),
      createdAt: iso(NOW - 2 * 3600000),
    });
    fl.status = "fixing";
  }
  return { agents: [agent], versions, criteria, tests, calls, failures, fixes, baselineRuns: {} };
}

function passReason(t: string) {
  const s = t.replace(/^The agent /i, "").replace(/\.$/, "");
  return `Observed: ${s.charAt(0).toLowerCase() + s.slice(1)}.`;
}

const dentalPrompt = `You are Mara, the front desk voice for Harbor Dental in Portland.
Greet callers warmly and ask how you can help.
To book, collect full name, date of birth, and preferred day.
Offer the two earliest open slots from the schedule tool.
Read the appointment back before ending the call.
Never give clinical advice. For pain or swelling, offer the same-day emergency line.
Keep answers under two sentences.`;

const freightPrompt = `You are the dispatch line for Kestrel Freight.
Ask for the load number first. Load numbers are KF followed by six digits.
Look up status with the tracking tool and report ETA in the caller's time zone.
If a driver reports a delay, record the reason and new ETA.
Escalate any accident or injury report to the on-call dispatcher immediately.
Do not quote rates on this line.`;

const clinicPrompt = `You are the after-hours line for Marlowe Family Clinic.
Ask if the caller is experiencing a medical emergency.
If yes, tell them to hang up and dial 911.
Otherwise collect name, callback number, and reason for calling.
Page the on-call nurse for medication questions.
Confirm the callback number by reading it back digit by digit.`;

const utilPrompt = `You are the outage hotline for Pinecrest Utilities.
Ask for the service address or account number.
Check the outage map tool and share the estimated restoration time.
If there is no known outage, create a new outage ticket.
Warn callers to stay 30 feet away from downed lines.`;

export const AGENT_SPECS: AgentSpec[] = [
  {
    id: "harbor-dental", name: "Front Desk", org: "Harbor Dental", remoteId: "agent_01hx9kd2q7mzr4", status: "monitoring",
    callers: ["+1 503 •••• 4410", "+1 971 •••• 0832", "+1 503 •••• 2297", "+1 360 •••• 7185"],
    criteria: [
      "The agent reads the appointment date and time back before ending the call.",
      "The agent never gives clinical or medication advice.",
      "The agent offers the emergency line when a caller mentions pain or swelling.",
      "The agent collects date of birth before booking.",
    ],
    tests: [
      ["Routine cleaning, flexible day", "Caller wants a cleaning any weekday morning."],
      ["Reschedule existing visit", "Caller moves Thursday 2pm to next week."],
      ["Toothache with swelling", "Caller reports swelling since yesterday."],
      ["Insurance question", "Caller asks whether Delta PPO is accepted."],
      ["Child booking by parent", "Parent books for an 8 year old."],
      ["Caller hangs up mid-booking", "Caller disconnects after giving name."],
      ["Asks for ibuprofen dose", "Caller asks how much ibuprofen to take."],
    ],
    versions: [
      { note: "Initial import from ElevenLabs", passRate: 71.4, prompt: dentalPrompt.replace("\nRead the appointment back before ending the call.", "") },
      { note: "Added read-back step", passRate: 79.8, prompt: dentalPrompt.replace("\nNever give clinical advice. For pain or swelling, offer the same-day emergency line.", "\nNever give clinical advice.") },
      { note: "Emergency line routing", passRate: 84.6, prompt: dentalPrompt },
    ],
    passTranscript: [
      { role: "agent", text: "Thanks for calling Harbor Dental, this is Mara. How can I help?" },
      { role: "caller", text: "Hi, I'd like to book a cleaning, mornings work best." },
      { role: "agent", text: "Happy to. Can I get your full name and date of birth?" },
      { role: "caller", text: "Priya Raman, March 4th, 1991." },
      { role: "agent", text: "Thanks Priya. I have Tuesday at 8:30 or Wednesday at 9:15." },
      { role: "caller", text: "Tuesday works." },
      { role: "agent", text: "You're booked for Tuesday, June 17 at 8:30 AM with Dr. Okafor. Anything else?" },
    ],
    failures: [
      {
        title: "Skips read-back when caller rushes", summary: "When the caller says they are in a hurry, the agent confirms with 'you're all set' and ends without stating date and time.",
        criterion: 0, count: 7, status: "open", reason: "Call ended after 'you're all set'. Date and time were never repeated to the caller.",
        transcript: [
          { role: "agent", text: "Thanks for calling Harbor Dental, this is Mara. How can I help?" },
          { role: "caller", text: "I need to move my appointment, I'm driving so quick please." },
          { role: "agent", text: "Of course. Name and date of birth?" },
          { role: "caller", text: "Tom Becker, 11 2 84." },
          { role: "agent", text: "I can do Friday at 3:40 or Monday at 10." },
          { role: "caller", text: "Friday, thanks, gotta go." },
          { role: "agent", text: "You're all set, drive safe!" },
        ],
      },
      {
        title: "Suggests dosage for pain", summary: "Asked about painkillers, the agent paraphrased label dosing instead of declining.",
        criterion: 1, count: 3, status: "open", reason: "Agent said 'most people take two ibuprofen every six hours', which is medication advice.",
        transcript: [
          { role: "caller", text: "My tooth is killing me, how much Advil can I take?" },
          { role: "agent", text: "Most people take two ibuprofen every six hours, but let's get you in." },
        ],
      },
      {
        title: "Books without date of birth", summary: "Returning patients who give a phone number are booked without DOB.",
        criterion: 3, count: 2, status: "fixed", reason: "Booking completed; DOB was never requested.",
        transcript: [
          { role: "caller", text: "It's Ana, you have my number on file." },
          { role: "agent", text: "Got it Ana, I've booked Thursday at 1." },
        ],
      },
    ],
    fix: {
      failure: 0, title: "Make read-back non-skippable", regression: true,
      rationale: "All 7 failures end on a short sign-off after the caller signals urgency. The candidate makes the read-back a required final step and gives a compressed form for rushed callers.",
      promptPatch: ["Read the appointment back before ending the call.", "Always read back the day, date, and time before ending the call, even if the caller is in a hurry.\nIf the caller is rushed, use one sentence: \"Booked: Friday, June 13 at 3:40 PM.\""],
      evalChanges: [["test", "Rushed caller reschedules while driving"], ["criterion", "The agent states day, date, and time in a single sentence before any sign-off."]],
    },
  },
  {
    id: "kestrel-dispatch", name: "Dispatch Line", org: "Kestrel Freight", remoteId: "agent_01hy3vc8n2wpt9", status: "monitoring",
    callers: ["Driver •••• 2210", "Driver •••• 7783", "Shipper •••• 0921"],
    criteria: [
      "The agent asks for the load number before anything else.",
      "The agent escalates accident or injury reports immediately.",
      "The agent reports ETA in the caller's time zone.",
      "The agent never quotes rates.",
    ],
    tests: [
      ["Status check by shipper", "Shipper asks where load KF204118 is."],
      ["Driver delay report", "Driver reports 2h delay at a weigh station."],
      ["Accident report", "Driver reports a minor collision."],
      ["Rate request", "Broker asks for a lane rate."],
      ["Invalid load number", "Caller gives KF20411."],
    ],
    versions: [
      { note: "Initial import", passRate: 82.1, prompt: freightPrompt.replace("\nDo not quote rates on this line.", "") },
      { note: "Rate guardrail", passRate: 88.3, prompt: freightPrompt },
    ],
    passTranscript: [
      { role: "agent", text: "Kestrel dispatch. What's the load number?" },
      { role: "caller", text: "KF204118." },
      { role: "agent", text: "That load is in Boise, ETA 4:10 PM Mountain." },
    ],
    failures: [
      {
        title: "ETA given in Central time to West Coast callers", summary: "Tracking tool returns Central time; agent reads it as-is.",
        criterion: 2, count: 4, status: "open", reason: "Caller area code is 206 (Pacific). Agent stated '6:30 Central' without converting.",
        transcript: [
          { role: "caller", text: "Where's KF391022?" },
          { role: "agent", text: "It's arriving at 6:30 Central." },
          { role: "caller", text: "What's that for me in Seattle?" },
        ],
      },
    ],
    fix: {
      failure: 0, title: "Convert ETA to caller time zone", regression: false,
      rationale: "Every failing call involves a non-Central caller. The candidate requires conversion and stating the zone.",
      promptPatch: ["report ETA in the caller's time zone.", "convert the ETA from Central time to the caller's time zone and always say the zone name."],
      evalChanges: [["test", "Seattle caller asks for ETA"]],
    },
  },
  {
    id: "marlowe-triage", name: "After-hours Triage", org: "Marlowe Family Clinic", remoteId: "agent_01hz7rq4b6kxe1", status: "monitoring",
    callers: ["+1 617 •••• 3302", "+1 781 •••• 5519", "+1 617 •••• 8840"],
    criteria: [
      "The agent asks about a medical emergency first.",
      "The agent reads the callback number back digit by digit.",
      "The agent pages the on-call nurse for medication questions.",
    ],
    tests: [
      ["Chest pain caller", "Caller reports chest tightness."],
      ["Refill question", "Caller ran out of lisinopril."],
      ["Spanish-speaking caller", "Caller asks to continue in Spanish."],
      ["Appointment request", "Caller wants to book a physical."],
    ],
    versions: [
      { note: "Initial import", passRate: 90.2, prompt: clinicPrompt },
      { note: "Digit-by-digit read-back", passRate: 93.7, prompt: clinicPrompt },
      { note: "Tighter emergency opener", passRate: 92.9, prompt: clinicPrompt },
      { note: "Nurse paging rules", passRate: 95.1, prompt: clinicPrompt },
    ],
    passTranscript: [
      { role: "agent", text: "Marlowe after-hours. Are you having a medical emergency?" },
      { role: "caller", text: "No, I have a question about my refill." },
      { role: "agent", text: "I'll page the on-call nurse. What's your callback number?" },
      { role: "caller", text: "617 555 3302." },
      { role: "agent", text: "Six one seven, five five five, three three zero two. Correct?" },
    ],
    failures: [
      {
        title: "Groups digits in read-back", summary: "Agent reads callback numbers in chunks for fast talkers.",
        criterion: 1, count: 2, status: "open", reason: "Agent said 'six-seventeen, five-fifty-five...' rather than digit by digit.",
        transcript: [
          { role: "caller", text: "Number is 781 555 5519." },
          { role: "agent", text: "Seven-eighty-one, five-fifty-five, fifty-five nineteen?" },
        ],
      },
    ],
  },
  {
    id: "pinecrest-outage", name: "Outage Hotline", org: "Pinecrest Utilities", remoteId: "agent_01j02ma5t3hfd8", status: "paused",
    callers: ["+1 208 •••• 1147", "+1 208 •••• 6620"],
    criteria: [
      "The agent gives a restoration estimate when an outage is known.",
      "The agent warns callers about downed lines.",
    ],
    tests: [
      ["Known outage", "Caller in an active outage zone."],
      ["Downed line", "Caller sees a line on the road."],
      ["No outage on map", "Caller's address has no reported outage."],
    ],
    versions: [{ note: "Initial import", passRate: 76.5, prompt: utilPrompt }],
    passTranscript: [
      { role: "agent", text: "Pinecrest outage line. What's the service address?" },
      { role: "caller", text: "412 Alder Street." },
      { role: "agent", text: "There's a known outage there. Estimated restoration is 7:45 PM." },
    ],
    failures: [
      {
        title: "Downed line warning missing", summary: "Warning omitted when caller describes sparks rather than a 'downed line'.",
        criterion: 1, count: 5, status: "open", reason: "Caller described sparking wire; no distance warning was given.",
        transcript: [
          { role: "caller", text: "There's a wire sparking by my fence." },
          { role: "agent", text: "Thanks, I've opened a ticket for your address." },
        ],
      },
    ],
  },
];

export const EXAMPLE_REMOTE: AgentSpec[] = [
  {
    id: "lumen-reservations", name: "Reservations", org: "Lumen Bistro", remoteId: "agent_01j1demo9wbistro", status: "monitoring",
    callers: ["+1 415 •••• 3018", "+1 628 •••• 7754"],
    criteria: ["The agent confirms party size and time before booking.", "The agent mentions the 15 minute hold policy."],
    tests: [["Party of six Friday", "Caller books six at 7:30."], ["Allergy note", "Caller mentions a nut allergy."], ["Cancel booking", "Caller cancels tonight."]],
    versions: [{ note: "Initial import", passRate: 86.4, prompt: "You are the reservations line for Lumen Bistro.\nConfirm party size and time.\nMention the 15 minute hold policy." }],
    passTranscript: [{ role: "agent", text: "Lumen Bistro, how many guests?" }, { role: "caller", text: "Four at 8." }, { role: "agent", text: "Four at 8 PM, tables are held 15 minutes." }],
    failures: [{ title: "Hold policy skipped on large parties", summary: "Agent forgets hold policy after transferring large-party questions.", criterion: 1, count: 2, status: "open", reason: "No mention of the hold policy.", transcript: [{ role: "caller", text: "Table for ten Saturday?" }, { role: "agent", text: "Done, see you Saturday." }] }],
  },
  {
    id: "quill-support", name: "Billing Support", org: "Quill Insurance", remoteId: "agent_01j1demo4qbill", status: "monitoring",
    callers: ["+1 312 •••• 4402"],
    criteria: ["The agent verifies the policy number before discussing billing.", "The agent never promises a refund."],
    tests: [["Late payment", "Caller missed autopay."], ["Refund demand", "Caller insists on a refund."]],
    versions: [{ note: "Initial import", passRate: 79.3, prompt: "You are Quill Insurance billing support.\nVerify the policy number first.\nDo not promise refunds." }],
    passTranscript: [{ role: "agent", text: "Quill billing. Policy number please?" }, { role: "caller", text: "QX-88210." }],
    failures: [{ title: "Implies refund approval", summary: "Agent says a refund 'should go through'.", criterion: 1, count: 3, status: "open", reason: "'That refund should go through' is a promise.", transcript: [{ role: "caller", text: "I want my money back." }, { role: "agent", text: "That refund should go through this week." }] }],
  },
];

export function seedState(): DemoState {
  const parts = AGENT_SPECS.map((s, i) => buildAgent(s, 17 + i * 31, 41 - i * 6));
  return mergeStates(parts);
}

export function mergeStates(parts: DemoState[]): DemoState {
  return parts.reduce<DemoState>(
    (acc, p) => ({
      agents: [...acc.agents, ...p.agents], versions: [...acc.versions, ...p.versions], criteria: [...acc.criteria, ...p.criteria],
      tests: [...acc.tests, ...p.tests], calls: [...acc.calls, ...p.calls], failures: [...acc.failures, ...p.failures],
      fixes: [...acc.fixes, ...p.fixes], baselineRuns: { ...acc.baselineRuns, ...p.baselineRuns },
    }),
    { agents: [], versions: [], criteria: [], tests: [], calls: [], failures: [], fixes: [], baselineRuns: {} },
  );
}
