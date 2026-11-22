# Loop Phase 1 verification

## Scope

Implemented the Postgres database, Connect flow, Agents list, and read-only saved-agent detail. No Phase 2–5 ingestion, testing, clustering, prompt editing, or shipping behavior was built.

## Provider call audit

All provider operations implemented for this phase are read-only, through the official ElevenLabs Python SDK (installed version 2.79.0).

| SDK method | HTTP endpoint | Confirmation | Live execution in this verification |
| --- | --- | --- | --- |
| `client.conversational_ai.agents.list(page_size=100, cursor=..., archived=False)` | `GET https://api.elevenlabs.io/v1/convai/agents` | Official endpoint reference and installed official SDK signature/source | One call with a deliberately invalid, synthetic key; friendly rejection displayed |
| `client.conversational_ai.agents.get(agent_id=...)` | `GET https://api.elevenlabs.io/v1/convai/agents/{agent_id}` | Official endpoint reference and installed official SDK signature/source | Not exercised with a live account; covered with SDK HTTP fixtures |
| `client.conversational_ai.analysis_items.get(analysis_item_id=...)` | `GET https://api.elevenlabs.io/v1/convai/analysis-items/{analysis_item_id}` | Official endpoint reference and installed official SDK signature/source | Not exercised with a live account; covered with SDK HTTP fixtures |

No assumed endpoint or method names. No ElevenLabs writes, calls, test runs, simulations, or Nebius inference requests were made.

Agent discovery follows pagination until `has_more` is false. Preview fetches the selected agent; saving re-fetches it so browser-supplied names or imported criteria cannot be trusted accidentally. When `analysis_items` is present, those attachments are authoritative. Attached user evaluation items are resolved through the third endpoint above.

### Official sources consulted

- https://elevenlabs.io/docs/llms.txt
- https://elevenlabs.io/docs/eleven-agents/api-reference/llms.txt
- https://elevenlabs.io/docs/eleven-agents/api-reference/agents/list.md
- https://elevenlabs.io/docs/eleven-agents/api-reference/agents/get.md
- https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/analysis-items/get.md
- https://docs.tokenfactory.nebius.com/api-reference/introduction.md

Nebius's official documentation confirms `https://api.tokenfactory.nebius.com/v1/` as its OpenAI-compatible base URL. This was not checked inside the user's authenticated console. An older `https://docs.nebius.com/quickstart` search result returned a 404; verification used the current Token Factory documentation instead. Phase 1 does not need Nebius credentials.

## Verification performed

- `python -m pytest artifacts/api-server/tests -q`: **14 passed**.
- Tests used real Postgres transactions, rolled back afterward, with synthetic credentials and controlled provider fixtures.
- Confirmed encrypted-at-rest storage and decryptability, no raw key or ciphertext in API responses, imported and user criteria persistence, detail/list reload responses, duplicate rejection, missing-encryption blocking, atomic failure, 30-criterion enforcement, sanitized validation/provider errors, SDK pagination, and inline/reference criterion parsing.
- Warning: the installed Starlette TestClient warns that its HTTPX transport is deprecated in favor of HTTPX2. It did not cause failures.
- Frontend TypeScript check passed.
- API and frontend workflows started successfully.
- Browser verification covered the real empty Agents screen, setup warning, Connect navigation, masked password input, disabled saving without encryption, and a single invalid-key discovery attempt.
- Browser success-flow verification used explicitly mocked local API responses: discovery, criteria preview, adding a criterion, save navigation, detail/list rendering and reload, masked-key display, and no key in browser storage.
- Light/dark mode and 390-pixel layouts checked; no horizontal overflow or browser runtime exceptions found.
- Browser mocks were removed afterward. No test agent records remain in Postgres.

## Observed errors and blockers

1. `ENCRYPTION_KEY` is not configured. `/api/setup` correctly reports `databaseReady: true`, `encryptionReady: false`. Saving is blocked in both frontend and backend.
2. The deliberately invalid ElevenLabs key produced HTTP 400 from Loop with a sanitized rejection message. This maps an upstream 401/403; the browser run did not capture the exact upstream status. Its expected HTTP 400 caused a browser “Failed to load resource” console entry, not a runtime crash.
3. No valid ElevenLabs key was available. A complete live-account success journey has **not** been verified. Provider-fixture tests and mocked browser success coverage do not substitute for that check.
4. The browser tester accidentally probed `/api/health` and got 404; the configured endpoint is `/api/healthz`, which responds successfully.

## Assumptions and explicit limitations

- Private, single-user use; no signup or billing, as requested. No authentication was added. Do not treat this as a public multi-user service.
- ElevenLabs's default global API region is used. Region-specific residency hosts are documented but are not selectable in this phase.
- User-added success criteria are stored in Loop only. Phase 1 never changes the original agent or its criteria.
- Pass rates and failure counts remain unmeasured until later phases; they are not fabricated as zero or 100%.
- Evaluation-version import now supports `latest`, explicit historical versions, and non-scoring comparison versions; see `evaluation-version-import.md` for the confirmed endpoint and regression checks. System criteria without a materialized plain-English definition still stop import rather than saving an incorrect definition.
- Keep the encryption key stable. Replacing it without re-encrypting stored records would make existing encrypted credentials unreadable.

## Remaining live acceptance check

Configure a valid `ENCRYPTION_KEY`, enter an ElevenLabs API key through Connect, load its agents, choose one, inspect imported criteria, save, then reload the Agents list and detail. No secrets should be pasted into chat.
