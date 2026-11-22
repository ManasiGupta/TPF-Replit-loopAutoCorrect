# Loop's Nebius contract

Loop's three backend operations are `group_failures`, `write_fix`, and
`update_evals`. Their system messages preserve the user's supplied prompts
verbatim. Transcripts and other evidence are sent separately as JSON in the user
message, not concatenated into the system prompt.

## Request and validation

All three operations use:

- `POST https://api.tokenfactory.nebius.com/v1/chat/completions`
- Backend-only `NEBIUS_API_KEY` and the configured `NEBIUS_MODEL`; no default or
  guessed model.
- `response_format.type = "json_schema"` with the operation's strict JSON schema.
- `store = false` and `stream = false`.
- Strict local JSON parsing and Pydantic validation, even when the provider
  reports success. Markdown-wrapped JSON, duplicate fields, non-finite numbers,
  unexpected fields, wrong types, refusals, and truncated completions are rejected.
- No unstructured-output fallback, fabricated success, or raw provider-body
  logging.

Grouping requires every supplied conversation ID to appear exactly once and
rejects invented IDs. Group labels contain fewer than eight words.

Evaluation proposals permit at most two changes in total. Proposed descriptions
start with `Mark as success if`. Edits must reference an existing criterion ID
and reproduce its current wording exactly. Duplicate proposals and changes
exceeding the 30-criterion limit are rejected.

## Safety boundary and current status

These operations return validated proposals only; they do not write database
records, edit an ElevenLabs agent, approve changes, or register public routes.
The monitoring and persistence pipeline must consume these operations rather
than save raw model responses. That pipeline is not wired up by this change.

JSON validation cannot prove that groups represent the same root cause, that a
prompt preserves every rule, or that an evaluation has not been weakened.
Human approval, prompt/evaluation review, and regression tests remain required.
Do not treat schema-valid output as permission to ship.

## Verification

39 offline tests cover the three exact prompts, outgoing request format, evidence,
valid responses, malformed JSON, invalid IDs, grouping uniqueness, criterion
limits, backend configuration failures, and sanitized upstream errors.

No live Nebius or ElevenLabs API calls were made. The HTTP transport is mocked
in tests. Provider/model compatibility in the user's Nebius console has not
been tested.

Official documentation confirmed for the endpoint and request format:

- https://docs.tokenfactory.nebius.com/api-reference/inference/create-chat-completion
- https://docs.tokenfactory.nebius.com/ai-models-inference/json
