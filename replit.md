# Loop

A private, account-scoped tool for improving ElevenLabs voice agents from production failures.

## Product identity

Loop is a self-correcting agent that monitors an existing voice agent in production, identifies issues, generates prompt fixes, and verifies them before approved updates go live. It is **not a voice-agent builder**.

**Why:** The user explicitly corrected this distinction. Existing voice agents are the input to Loop, not something Loop creates.

Keep this positioning in descriptions and design briefs. Preserve the user's supplied homepage copy exactly; do not replace it with builder-oriented language.

## Integration boundaries

- Voice agents are created and deployed in ElevenLabs, outside Loop. The frontend connects an existing voice agent; it does not build or host one.
- The frontend's connection screen is for the agent provider, currently ElevenLabs. It must not ask visitors to connect Nebius.
- Nebius Token Factory is Loop's backend analysis engine. Loop's backend sends call transcripts, evaluation results, and prompt context for diagnosis and proposed fixes.
- The backend orchestrates ElevenLabs and Nebius independently. Nebius is not an intermediary through which the frontend connects to the voice agent.
- Loop-owned Nebius credentials remain backend-only. A connected agent's ElevenLabs key is submitted to the backend, stored encrypted, and never returned to the browser.

**Why:** The user clarified that Nebius is the backend connection, whereas the person on the frontend connects to their respective voice agent.

## Current requested scope

- The user first requested a UI prototype, then explicitly requested user-facing ElevenLabs connection and private SSO sign-in before Connect.
- The homepage stays public. Connect and all workspaces require managed Clerk authentication. The Python API also verifies authentication and scopes every saved agent/criterion to its owner.
- Existing unowned records must be preserved but never automatically assigned to a new user.
- Live connection/import is distinct from the explicitly labeled, account-isolated sample workspace. Do not claim call ingestion or Nebius analysis is implemented.
- Sample actions must remain simulated and must never modify a live voice agent or store real credentials.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the Python FastAPI server using managed PORT
- `pnpm --filter @workspace/loop run dev` — React frontend, managed workflow supplies PORT and BASE_PATH
- `cd artifacts/api-server && python -m loop_api.apply_dev_schema` — explicit development schema setup only
- `python -m pytest artifacts/api-server/tests -q` — Phase 1 tests (provider fixtures, real Postgres transaction rolled back)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- Backend-only env: `DATABASE_URL` — Postgres connection string; not needed to browse the UI prototype.
- Backend-only encryption: a valid explicit `ENCRYPTION_KEY`, or a domain-separated HKDF subkey derived from the existing stable `SESSION_SECRET` (at least 32 bytes). Never rotate/switch the source without migrating ciphertext. Invalid explicit keys fail closed.
- Clerk keys are provisioned and managed by Replit; do not ask visitors for them. Browser API calls use Clerk's same-origin session cookie, not explicit bearer tokens.
- Future phases use `NEBIUS_API_KEY` and `NEBIUS_MODEL`; neither is used in Phase 1.

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Python 3.12 + FastAPI + official ElevenLabs Python SDK
- DB: PostgreSQL + SQLAlchemy; the original Express/Drizzle starter is unused
- Validation: Pydantic (backend), generated React Query hooks (frontend)
- API codegen: Orval (from OpenAPI spec)
- Python dependencies: pyproject.toml + uv.lock; frontend build: Vite

## Where things live

- `artifacts/api-server/loop_api/` — Python API, SQLAlchemy models, provider and encryption logic
- `artifacts/loop/` — React app
- `lib/api-spec/openapi.yaml` — frontend API contract; regenerate after changes

## Architecture decisions

- Use Python FastAPI and SQLAlchemy, not the starter Express/Drizzle backend, because the user explicitly requires Python and the official ElevenLabs Python SDK.
- Do not run Drizzle push against Loop tables. Schema is owned by Python models; apply dev changes explicitly, never at application startup or production build.
- The user superseded the original no-signup single-user scope by requesting SSO and per-user privacy. Use managed Clerk accounts and enforce ownership in Python, not just frontend routes.
- Store only encrypted API keys; never return the ciphertext or original key. Never log request bodies/provider error bodies.

## Product

- The public homepage uses the exact supplied copy, logo and purple branding. Agents live at `/agents`; user connection is at `/connect`.
- Live agents use the Python discovery/import API. Future monitoring tabs must not substitute sample measurements for connected agents.
- The separate sample workspace persists only in account-namespaced browser state. Clear sensitive state on logout and never adopt legacy global demo data for the first account.

## User preferences

- "Build in phases. I will send one phase at a time. Do not build ahead."
- After every phase, list every ElevenLabs/Nebius call with exact endpoint or SDK method and confirmed-versus-assumed status; run phase end to end and report errors.
- Never use simulate-conversation. Later test phases must use Tests endpoints, duplicate the agent during verification, and never ship regressions.
- Eval changes require approval; re-score compared versions whenever evals change. No billing.

## Gotchas

- Vite's visual instrumentation can corrupt JSX with explicit generic type arguments (for example `<Component<Type> ...>`), even when TypeScript passes. Use inference/typed callbacks instead and verify the served module, not just tsc.
- ElevenLabs docs: https://elevenlabs.io/docs/llms.txt . Confirm SDK names against official docs and installed SDK; do not guess.
- Nebius base URL confirmed from official https://docs.tokenfactory.nebius.com/api-reference/introduction.md as https://api.tokenfactory.nebius.com/v1/; not authenticated in the user's console.
- ElevenLabs analysis-item attachments are authoritative when present. Import stops explicitly for pinned historical/multiple versions or non-materialized system definitions rather than silently importing incorrect criteria.
- User-added criteria in Phase 1 are saved in Loop only; Phase 1 makes no provider writes.
- Keep ENCRYPTION_KEY stable; replacing it without re-encrypting records makes saved credentials unreadable.
- See `docs/private-connections.md` for ownership migration, encryption-source stability, managed Python auth proxy, and provider-call audit.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
