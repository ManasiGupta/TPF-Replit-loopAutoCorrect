# Evals & Tests: API confirmation before implementation

Confirmed from ElevenLabs' current documentation on November 22, 2026,
starting at `https://elevenlabs.io/docs/llms.txt` and the linked ElevenAgents
API index. This is an API audit, **not an implemented Evals & Tests workspace**.

Base URL: `https://api.elevenlabs.io`.

| Operation | Confirmed endpoint |
| --- | --- |
| Agent criteria references and attached test IDs | `GET /v1/convai/agents/{agent_id}` |
| Workspace criterion definition | `GET /v1/convai/analysis-items/{analysis_item_id}` |
| All published criterion versions, paginated | `GET /v1/convai/analysis-items/{analysis_item_id}/versions` |
| Workspace tests, not agent attachments | `GET /v1/convai/agent-testing` |
| Test definition | `GET /v1/convai/agent-testing/{test_id}` |
| Agent/test run history | `GET /v1/convai/test-invocations?agent_id=...&test_id=...` |
| Individual invocation with its test runs and reasons | `GET /v1/convai/test-invocations/{test_invocation_id}` |
| User-requested test execution | `POST /v1/convai/agents/{agent_id}/run-tests` |
| Create a criterion | `POST /v1/convai/analysis-items` |
| Publish changed criterion wording | `PATCH /v1/convai/analysis-items/{analysis_item_id}` |
| Attach/detach a criterion | `PATCH /v1/convai/analysis-items/{analysis_item_id}/attachments` |
| Create a test | `POST /v1/convai/agent-testing/create` |
| Update agent settings, including attached tests | `PATCH /v1/convai/agents/{agent_id}` |

The installed official Python SDK exposes the corresponding
`conversational_ai.agents.get`, `analysis_items.get/list_versions`,
`tests.get`, `tests.invocations.list/get`, `agents.run_tests`,
`analysis_items.create/update/update_attachments` and `tests.create` methods.
No provider mutations or test executions were performed during this audit.

## Important distinctions and unconfirmed details

- Attached IDs come from
  `platform_settings.testing.attached_tests`. The workspace tests listing is
  not an agent-attached-tests endpoint and must not be treated as one.
- Evaluation references come from
  `platform_settings.analysis_items.evaluation_criteria`; inline evaluation
  criteria are used only when references are absent. Built-in system criteria
  need not expose a scoring prompt.
- User criterion definitions are shared workspace resources. Published wording
  changes affect other agents using the updated item, subject to their version
  references. Preserve pinned versions and comparison-only versions.
- Published criterion versions expose ID, version number, creation time and
  definition. The reviewed version schema does **not** expose a full editor
  identity. Creator/access information is not proof of the last editor.
- Test definitions distinguish `simulation`, `llm`, and `tool`. The latter two
  are next-reply tests; they must not be confused with full conversations.
- Invocation test runs expose `pending`, `passed`, `failed`, and `cancelled`,
  with condition result/rationale and timestamps. A dedicated
  `unsupported_client_tool` status/code was **not confirmed** in the reviewed
  documentation. A future “Couldn't test” presentation must rely on explicit
  returned evidence, never relabel an arbitrary failed tool run.
- `from_conversation_metadata` identifies the source conversation, but does not
  by itself prove that Loop, rather than ElevenLabs, created the test. Record
  Loop-created provenance when Loop actually writes it.
- Complete who/what/before/after history for edits made outside Loop was
  **not confirmed**. Record Loop actions prospectively and mark unavailable
  external authorship honestly.

## Official references

- [Agent configuration](https://elevenlabs.io/docs/eleven-agents/api-reference/agents/get)
- [Criterion definition](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/analysis-items/get)
- [Criterion versions](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/analysis-items/list-versions)
- [Test definition](https://elevenlabs.io/docs/eleven-agents/api-reference/tests/get)
- [Invocation listing](https://elevenlabs.io/docs/eleven-agents/api-reference/tests/test-invocations/list)
- [Invocation results](https://elevenlabs.io/docs/eleven-agents/api-reference/tests/test-invocations/get)
- [Run tests](https://elevenlabs.io/docs/eleven-agents/api-reference/tests/run-tests)
