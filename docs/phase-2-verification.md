# Phase 2: private call monitoring

## Delivered behavior

- A backend worker checks due, owned ElevenLabs connections every ten seconds. Each connection defaults to five-minute polling and can be paused or set to a whole-number interval from 1 to 1440 minutes. The application must be running for scheduled checks to execute.
- The first successful poll imports conversations started within the preceding seven days. Subsequent polls start 24 hours before the last successful attempt, covering downtime and delayed analyses. Stored pending/unknown conversations are revisited even when older than that interval.
- All pages are followed using the documented cursor. A malformed cursor, wrong-agent response, unavailable credential, provider error, or invalid response fails explicitly. A failed poll rolls back all of that attempt's conversation changes, records a sanitized error, and retries at the saved interval. Previously saved evidence remains available.
- Credentials are decrypted only in Python immediately before provider access. No raw credential, ciphertext, provider error body, or Nebius credential is returned to the browser or logged.
- PostgreSQL row locks serialize manual and scheduled polling across workers. The locked row refreshes any previously loaded state so a concurrent request cannot act on an obsolete schedule. The unique connection/conversation index prevents duplicate records, while allowing separate owners to connect the same provider agent.
- Owner-scoped APIs expose saved call summaries and details. Calls have independent result/source filters, server pagination, transcripts, individual evaluation rationales, nullable numeric scores, actual provider version IDs, and loading/empty/error states.
- The frontend refreshes agent metrics, calls, open call details, and monitoring state every 15 seconds. Saving settings and requesting a due check also invalidate affected queries. Browser account-change cache clearing is preserved.
- Sample routes remain browser-only demonstration data. A missing sample agent cannot fall through into the private connected-agent view.

## Evidence and classification rules

The provider's actual `analysis.evaluation_criteria_results_list` is retained when present (including repeated criterion IDs); otherwise the result map is used. There is no model-generated evaluation or inferred rationale.

- A completed call with any failed criterion or a provider-reported overall failure is failed.
- A completed call passes only when there is at least one criterion result, every returned criterion succeeded, and the provider's overall result is not unknown.
- Missing analysis, no criteria results, an unknown criterion, and in-progress/processing calls remain unknown, not zero-percent/100-percent samples. A provider technical failure without evaluated failure evidence is likewise unknown.
- Criteria added in Loop are not sent to ElevenLabs for scoring in this phase. Call details explicitly mark absent saved-criterion results unknown. They do not invent pass/fail results for these criteria.
- Production pass rate is `passed / (passed + failed)`, excluding unknown outcomes, test calls, and unknown-source calls. It remains null when no measured production results exist.
- The API's existing `openFailures` field now carries the observed failed-production-call count, not a count of failure clusters. The UI labels it **Failed calls**. Clustering and fixed/open lifecycles are not part of this phase.
- **Classification convention, not a confirmed Tests provenance field:** source uses the provider's explicit `environment` string: exactly `production` or `test`; missing/custom values become `unknown`. Official docs document `environment`, but do not establish it as proof of an agent-testing run. The UI explains this distinction. No test executions or test-suite results are fabricated.

## Exact provider-call audit

Official documentation was fetched during this implementation, starting with <https://elevenlabs.io/docs/llms.txt>. Endpoint names, pagination/filter fields, transcript fields, analysis fields, and installed official Python SDK signatures were checked before implementation.

| SDK operation | Exact endpoint | Status |
| --- | --- | --- |
| `client.conversational_ai.conversations.list(agent_id=..., call_start_after_unix=..., page_size=100, cursor=...)` | `GET https://api.elevenlabs.io/v1/convai/conversations` | Confirmed in current official docs and installed SDK; exercised with SDK HTTP fixtures |
| `client.conversational_ai.conversations.get(conversation_id)` | `GET https://api.elevenlabs.io/v1/convai/conversations/{conversation_id}` | Confirmed in current official docs and installed SDK; exercised with SDK HTTP fixtures |
| Existing `client.conversational_ai.agents.list(...)` | `GET https://api.elevenlabs.io/v1/convai/agents` | Reconfirmed against current official docs; existing connection flow retained |
| Existing `client.conversational_ai.agents.get(agent_id=...)` | `GET https://api.elevenlabs.io/v1/convai/agents/{agent_id}` | Reconfirmed against current official docs; existing connection flow retained |
| Existing `client.conversational_ai.analysis_items.get(analysis_item_id=...)` | `GET https://api.elevenlabs.io/v1/convai/analysis-items/{analysis_item_id}` | Reconfirmed against current official docs; existing connection flow retained |
| Nebius | **No calls for Phase 2** | Existing backend-only service remains unchanged and is not invoked by monitoring |

No assumed endpoint names. No simulations, provider mutations, generated calls, test runs, prompt fixes, evaluation changes, or deployment occurred.

### Official references

- <https://elevenlabs.io/docs/api-reference/conversations/list.md>
- <https://elevenlabs.io/docs/api-reference/conversations/get.md>
- <https://elevenlabs.io/docs/api-reference/agents/list.md>
- <https://elevenlabs.io/docs/api-reference/agents/get.md>
- <https://elevenlabs.io/docs/api-reference/conversations/analysis-items/get.md>

## Verification

- `python -m pytest artifacts/api-server/tests -q`: **97 passed**.
- Tests use PostgreSQL and the real ElevenLabs SDK with controlled HTTP responses, never actual credentials. Coverage includes pagination, delayed analysis updates, deduplication, per-agent frequency, pause/resume, encrypted credential use, failed-poll atomicity, provider mismatches, malformed cursors, filters/pagination, unknowns, Loop-only criteria, and account isolation.
- An independent two-connection PostgreSQL check verifies row-lock exclusion and refresh of stale schedule state. Its temporary synthetic row is removed afterward.
- `pnpm --filter @workspace/loop run typecheck`: passed. OpenAPI code generation and shared-library typechecks passed.
- `git diff --check`: passed.
- API and frontend managed workflows restarted and reported healthy startup.
- Shared-proxy health request succeeded; unauthenticated call-list request returned 401. The new frontend module was served by Vite.
- The unauthenticated screenshot correctly shows sign-in, not private call data.
- One signed-in browser pass exercised the actual API/database with four explicitly synthetic calls in a new isolated test account: list/result/source filters, criterion rationales and transcript detail, settings validation, saved 17-minute paused configuration after reload, and 390px layouts all passed.
- The browser pass also verified signed-out list/detail requests return 401, a second account receives 404 for both, and the owner receives 200. No app runtime errors or horizontal overflow were found.
- All seeded browser-test agent, criterion, and conversation records were removed after verification. The two isolated authentication test accounts remain. No provider requests were made by that pass because its fixture connection stayed paused.
- Backend test execution emitted only the existing Starlette warning about its HTTPX TestClient transport.

## Live-account limitation

There were **zero owned connected agents** in the development database before verification. No successful live ElevenLabs conversation import has been verified. SDK fixtures and any isolated browser-test fixture records are explicitly synthetic verification evidence, not live call measurements, and are never used as product fallbacks. A live acceptance check requires connecting a real account through the private Connect form, not sending credentials in chat.

## Schema and operational notes

The additive development migration adds monitoring fields and the conversation table without assigning legacy unowned records to anyone. It was applied explicitly in development; the existing post-merge script already invokes that idempotent development setup. Nothing migrates automatically at application startup or in the production build. A future production rollout must apply the reviewed migration explicitly.

Polling is serialized per connection and the scan processes connections sequentially. The configured interval is the minimum delay after a completed attempt, not a hard real-time guarantee; provider latency and large backlogs can delay checks. A future high-volume worker can add bounded batches/fair scheduling without changing the evidence or ownership contract.
