# ElevenLabs evaluation version import

## Connection blocker

Loop previously rejected any attached evaluation whose `version_id` differed
from the item's `current_version_id`, including the valid `"latest"` sentinel.
It also rejected all `additional_version_ids`. These were Loop restrictions,
not a request to change the user's ElevenLabs agent.

Import now resolves `null`, `"latest"`, and an explicit current ID to the current
definition. Explicit historical IDs are located through paginated published
version history. Missing versions still fail rather than silently substituting
another definition.

Only the primary version becomes a scoring criterion in Loop. Additional
versions are preserved as non-scoring comparison snapshots with the original
attachment metadata. They do not inflate the criterion count or turn a
comparison result into a scoring failure.

## Provider-call audit

All of these are read-only. The version-import fix adds only the last call.

| SDK method | Endpoint | Confirmation |
| --- | --- | --- |
| `client.conversational_ai.agents.list(...)` | `GET /v1/convai/agents` | Official list-agents docs and installed SDK |
| `client.conversational_ai.agents.get(agent_id=...)` | `GET /v1/convai/agents/{agent_id}` | Official get-agent docs and installed SDK |
| `client.conversational_ai.analysis_items.get(analysis_item_id=...)` | `GET /v1/convai/analysis-items/{analysis_item_id}` | Official get-analysis-item docs and installed SDK |
| `client.conversational_ai.analysis_items.list_versions(analysis_item_id=..., page_size=100, cursor=...)` | `GET /v1/convai/analysis-items/{analysis_item_id}/versions` | Official list-versions docs and installed SDK |

Sources:

- https://elevenlabs.io/docs/api-reference/agents/list
- https://elevenlabs.io/docs/api-reference/agents/get
- https://elevenlabs.io/docs/api-reference/conversations/analysis-items/get
- https://elevenlabs.io/docs/api-reference/conversations/analysis-items/list-versions

The installed official SDK's `AttachedUserEvaluationRef` documents `"latest"`
and states that additional versions are executed for comparison but excluded
from scoring. No SDK methods were guessed.

Verification uses the real SDK with `httpx.MockTransport`, including latest
selection, historical pagination, comparison versions, missing history, cursor
loops, and a preview/save round trip with transaction-rolled-back test records.
No live ElevenLabs or Nebius request, prompt update, or agent modification was
made as part of this fix. A live import using the user's key remains unverified.
