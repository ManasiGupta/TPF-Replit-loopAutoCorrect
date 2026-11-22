# loop

**Your voice agent, better every week.**

Loop watches an ElevenLabs voice agent's real calls, finds what went wrong, writes the fix, and proves it works before it goes live.

Built at The Product Folks hackathon, Nov 2026, for RFS 07: an agent that reads its own failures, fixes itself and proves it got better.

---

## The problem

Most agents ship once and never get better. Failures pile up in call logs, someone reads a few transcripts, tweaks the prompt by hand, and hopes nothing else breaks. There is no proof the new version is better.

Loop closes that loop automatically, with a human approval gate.

## How it works

```
Connect agent > Baseline test run > Monitor calls > Group failures
> Generate fix > Verify on tests > Approve and ship > Update evals > Repeat
```

1. **Watch:** Loop pulls every call the agent takes, with transcript and evaluation results.
2. **Spot:** failed calls are grouped into clear issues, e.g. "didn't ask for order ID (6 calls)".
3. **Fix:** Loop rewrites the agent's prompt for that issue and shows the diff.
4. **Prove:** the fix runs on a duplicate agent against tests built from real failures, side by side with the live version.
5. **Ship:** you approve, the live agent is updated. Every version can be rolled back.
6. **Update evals:** fixed failures become permanent regression tests, and Loop proposes new or sharper evaluation criteria.

## Rules Loop never breaks

1. Never ships a fix that makes a previously passing test fail, even with Auto-ship on.
2. Never edits the live agent during testing. Candidates run on a duplicate.
3. Eval changes need approval, same as prompt changes. Loop cannot grade itself easier.
4. When evals change, old and new versions are re-scored so pass rates stay comparable.

## Stack

| Part | Role |
| --- | --- |
| **ElevenLabs Agents** | The voice agent, its calls, evaluation criteria and Tests |
| **Nebius Token Factory** | Loop's reasoning engine: groups failures, writes fixes, proposes eval changes |
| **Replit** | Builds and hosts Loop |
| FastAPI, React, Postgres | Backend, frontend, database |

## Screens

1. **Home:** what Loop is and how to connect.
2. **Agents:** connected agents with pass rate and open failures.
3. **Connect:** paste an ElevenLabs API key, pick an agent.
4. **Agent workspace:** Overview, Calls, Failures, Evals, Fixes, Versions, Settings.
5. **Fix review:** prompt diff, current vs candidate test results, eval changes, Approve or Reject.

## Setup

### 1. Loop's own keys (environment variables)

Set these in Replit Secrets or your environment. Never commit them.

| Variable | What it is |
| --- | --- |
| `NEBIUS_API_KEY` | From Nebius Token Factory, API keys section |
| `NEBIUS_MODEL` | Model ID from the Token Factory playground |
| `ENCRYPTION_KEY` | Fernet key used to encrypt stored ElevenLabs keys |

### 2. Your agent's key (entered in the app)

The ElevenLabs API key is not an environment variable. Each user enters their own on the Connect screen.

1. In ElevenLabs, go to **Developers > API Keys** and create a key.
2. Restrict it to agents and conversations, and set a credit quota.
3. Paste it into Loop and pick your agent.

### 3. Before your first run

1. Add 3 to 5 evaluation criteria in your agent's **Analysis** tab. Without them, calls have no pass or fail.
2. Make a few test calls, including some that should fail.

## Data model

Agent, Conversation, FailureCluster, EvalCriterion, TestCase, PromptVersion, Run.

## Known limits

1. Single user. No signup, teams or billing yet.
2. ElevenLabs only. Other voice platforms later.
3. Prompt fixes only. Knowledge base and tool changes are not auto-fixed yet.
4. ElevenLabs allows up to 30 evaluation criteria per agent. Loop warns as you get close.

## Security

1. Stored ElevenLabs keys are encrypted and never sent back to the browser.
2. Keep this repository private while keys are in use. ElevenLabs auto-disables keys found in public GitHub repos.
