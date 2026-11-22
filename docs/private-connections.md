# Private sign-in and agent connections

## Boundaries

- The landing page is public. Connect, the agent list, all agent workspaces,
  and fix reviews require a managed Clerk sign-in.
- The Python API independently verifies Clerk's `__session` cookie. Hiding
  frontend controls is not an authorization boundary.
- Verification accepts RS256 signatures from this Clerk instance's authenticated
  JWKS endpoint, checks issuer, expiry, not-before, session/user identifiers,
  authorized party and cross-site write requests. A verification outage fails
  closed. No browser token getter or bearer header is needed.
- Each agent belongs to a verified Clerk subject. Criteria inherit ownership
  through their agent. Foreign and nonexistent IDs both return 404.
- Two owners can independently connect the same provider agent. An owner cannot
  submit another owner's ID to claim their existing connection.

## Existing records

The additive ownership migration leaves old `owner_id` values null. Those rows,
their encrypted keys and criteria are preserved but never returned by an
authenticated owner's queries. Do not give them to the first person who signs in.
Any future recovery process must verify ownership explicitly.

The development migration is idempotent:

```sh
cd artifacts/api-server
python -m loop_api.apply_dev_schema
```

The post-merge setup runs it for development. This command deliberately refuses
production. Production schema changes need an explicitly authorized migration,
not DDL hidden in application startup. The additive routine is
`loop_api.migrations.apply_schema`; it only adds the owner column/index and
replaces global remote-agent uniqueness with owner-scoped uniqueness.

## Encryption

An explicit `ENCRYPTION_KEY` is supported and must be a valid Fernet key.
If it is absent, the application derives a dedicated 32-byte Fernet subkey
from its existing stable `SESSION_SECRET` using HKDF-SHA256 and the
`loop:elevenlabs-key-storage:v1` context. The root must be at least 32 bytes.
This is intentionally separate from the root's session purpose, and never
uses a user password or ElevenLabs key as encryption material.

**Do not rotate the root or switch key sources without migrating ciphertext.**
An invalid explicit encryption key fails closed, rather than falling back.
End users enter only their ElevenLabs key on Connect; Nebius configuration is
backend-only and is not needed for connection discovery/import.

## Managed auth proxy

The existing service is Python, so `clerk_proxy.py` implements the canonical
managed Clerk proxy's behavior without swapping the API to Express. The
production-only `/api/__clerk` path forwards to the constant
`https://frontend-api.clerk.dev` upstream with server-managed proxy and secret
headers. It preserves repeated cookies and raw content encoding, strips
hop-by-hop headers, and supplies Content-Length. Development uses Clerk's
development frontend API directly.

## Provider operations

No Nebius inference calls are part of sign-in or connecting an agent.
Existing ElevenLabs operations remain read-only:

| SDK operation | HTTP endpoint | Confirmation |
| --- | --- | --- |
| `client.conversational_ai.agents.list` | `GET /v1/convai/agents` | Previously checked against official docs and installed SDK; pagination exercised by tests |
| `client.conversational_ai.agents.get` | `GET /v1/convai/agents/{agent_id}` | Previously checked against official docs and installed SDK |
| `client.conversational_ai.analysis_items.get` | `GET /v1/convai/analysis-items/{analysis_item_id}` | Previously checked against official docs and installed SDK; analysis-item fixtures exercised by tests |

Clerk verification reference:
https://clerk.com/docs/guides/sessions/manual-jwt-verification

Authenticated signing-key endpoint:
`GET https://api.clerk.com/v1/jwks`.

Provider success verification still requires an actual ElevenLabs key entered by
the user in the app. Test credentials are synthetic and never contact a real
ElevenLabs account.

## Verification performed

- All 37 Python checks passed, including signed-out routes, RS256 claims,
  cross-account list/detail access, encrypted writes, legacy-data migration,
  production proxy behavior, and signing-key refresh/outage throttling.
- Workspace TypeScript checks and the production frontend build passed.
- One browser journey used two real, programmatically created Clerk test users.
  Setup, list, detail, signed-out 401s and cross-owner 404s hit the real Python
  API using cookies, without browser Authorization headers.
- Discovery, preview and save used explicit synthetic browser fixtures. The
  saved detail used a temporary, encrypted, owner-scoped database fixture;
  it was removed after the test. No real ElevenLabs or Nebius requests were made.
- Logout removed authenticated access and the entered key did not survive browser
  back/forward or appear in local/session storage. The second account did not
  see the first account's connected agent or edited sample criterion.
- Desktop and mobile Connect rendered correctly. The browser pass found a fixed
  width overflow on mobile sign-in; constraining both the grid track and Clerk
  card resolved it, confirmed by a new 390×844 screenshot.

The build emitted existing source-map/chunk-size advisories; Python emitted a
Starlette/httpx test-client deprecation warning. Neither prevented the checks.
Clerk's development-mode notice is expected in the development preview.
