import json

import httpx
import pytest
from pydantic import ValidationError

from loop_api import nebius_prompts as prompts
from loop_api.nebius import (
    CHAT_COMPLETIONS_URL, NebiusConfigurationError, NebiusRequestError, NebiusService,
)
from loop_api.nebius_validation import (
    CallEvidence, CurrentCriterion, FailureGroup, GroupFailuresResult,
    NebiusOutputError, UpdateEvalsResult, WriteFixResult, parse_output,
)


@pytest.fixture
def calls():
    return [CallEvidence(
        conversation_id="conversation-1",
        transcript="Caller: Check my order. Agent: I will look it up now.",
        evaluation_results=[{
            "criterion_id": "criterion-1", "result": "fail",
            "rationale": "The agent did not confirm the order ID.",
        }],
    )]


@pytest.fixture
def criteria():
    return [CurrentCriterion(
        id="criterion-1", name="Confirm order ID",
        description="Mark as success if the agent confirms the order ID.",
        passed=4, failed=2, unknown=1,
    )]


@pytest.fixture
def group():
    return {"label": "Didn't confirm order ID", "root_cause": "Lookup starts without confirmation.", "conversation_ids": ["conversation-1"]}


def service(monkeypatch, output, *, status=200, finish="stop", refusal=None, raw=False, capture=None):
    monkeypatch.setenv("NEBIUS_API_KEY", "synthetic-test-value-not-a-credential")
    monkeypatch.setenv("NEBIUS_MODEL", "synthetic-model-for-offline-tests")

    def handle(request):
        assert str(request.url) == CHAT_COMPLETIONS_URL
        assert request.method == "POST"
        payload = json.loads(request.content)
        assert payload["model"] == "synthetic-model-for-offline-tests"
        assert payload["response_format"]["type"] == "json_schema"
        spec = payload["response_format"]["json_schema"]
        assert spec["strict"] is True
        assert spec["schema"]["additionalProperties"] is False
        assert payload["store"] is False and payload["stream"] is False
        if capture is not None:
            capture.append(payload)
        content = output if raw else json.dumps(output)
        return httpx.Response(status, json={"choices": [{
            "finish_reason": finish, "message": {"content": content, "refusal": refusal},
        }]})

    return NebiusService(transport=httpx.MockTransport(handle))


def test_prompts_remain_exactly_as_supplied():
    assert prompts.GROUP_FAILURES == (
        'You review failed voice agent calls. Each call includes a transcript and evaluation results with rationales. Group calls that failed for the same root cause. Name each group in plain words, under 8 words, describing what the agent did wrong (e.g. "Didn\'t confirm order ID before lookup"). Do not group by topic; group by the agent\'s mistake. A call can belong to only one group.\n'
        'Return JSON: {"groups": [{"label": "", "root_cause": "", "conversation_ids": []}]}'
    )
    assert prompts.WRITE_THE_FIX == (
        "You improve a voice agent's system prompt. You get the current prompt and one group of failed calls with their transcripts and evaluation rationales. Make the smallest change that fixes this root cause. Do not rewrite, reorder or restyle parts unrelated to the failure. Do not remove existing rules. Keep instructions short and spoken-friendly, since this is a voice agent.\n"
        'Return JSON: {"new_prompt": "", "changes": [{"what": "", "why": ""}]}'
    )
    assert prompts.UPDATE_EVALS == (
        'You maintain evaluation criteria for a voice agent. You get the current criteria with their pass, fail and unknown counts, plus the failed calls from this fix. (a) If a failure was not caught by any criterion, propose a new one. (b) If a criterion returns unknown often, propose clearer wording. Each criterion must be checkable from the transcript alone and start with "Mark as success if". Propose at most 2 changes. Never loosen a criterion so more calls pass.\n'
        'Return JSON: {"new_criteria": [{"name": "", "description": ""}], "edited_criteria": [{"id": "", "old": "", "new": "", "why": ""}]}'
    )


def test_grouping_uses_exact_prompt_and_returns_validated_result(monkeypatch, calls, group):
    captured = []
    result = service(monkeypatch, {"groups": [group]}, capture=captured).group_failures(calls)
    assert isinstance(result, GroupFailuresResult)
    assert captured[0]["messages"][0] == {"role": "system", "content": prompts.GROUP_FAILURES}
    assert json.loads(captured[0]["messages"][1]["content"])["calls"][0]["conversation_id"] == calls[0].conversation_id


def test_fix_uses_exact_prompt_and_supplied_evidence(monkeypatch, calls, group):
    captured = []
    result = service(monkeypatch, {
        "new_prompt": "Be helpful. Confirm the order ID before lookup.",
        "changes": [{"what": "Added an order confirmation step.", "why": "Prevents lookup without an ID."}],
    }, capture=captured).write_fix("Be helpful.", FailureGroup(**group), calls)
    assert isinstance(result, WriteFixResult)
    assert captured[0]["messages"][0]["content"] == prompts.WRITE_THE_FIX
    evidence = json.loads(captured[0]["messages"][1]["content"])
    assert evidence["current_prompt"] == "Be helpful."
    assert evidence["calls"][0]["evaluation_results"][0]["result"] == "fail"


def test_eval_updates_use_exact_prompt_and_counts(monkeypatch, calls, criteria):
    captured = []
    result = service(monkeypatch, {
        "new_criteria": [],
        "edited_criteria": [{
            "id": criteria[0].id, "old": criteria[0].description,
            "new": "Mark as success if the agent reads the order ID back before lookup.",
            "why": "Makes confirmation observable from the transcript.",
        }],
    }, capture=captured).update_evals(criteria, calls)
    assert isinstance(result, UpdateEvalsResult)
    assert captured[0]["messages"][0]["content"] == prompts.UPDATE_EVALS
    evidence = json.loads(captured[0]["messages"][1]["content"])
    assert evidence["current_criteria"][0]["unknown"] == 1


@pytest.mark.parametrize("ids", [
    [], ["unknown-call"], ["conversation-1", "conversation-1"], ["conversation-1", "invented-call"],
])
def test_unknown_missing_or_duplicate_calls_are_rejected(monkeypatch, calls, group, ids):
    with pytest.raises(NebiusOutputError):
        service(monkeypatch, {"groups": [{**group, "conversation_ids": ids}]}).group_failures(calls)


def test_call_cannot_belong_to_two_groups(monkeypatch, calls, group):
    with pytest.raises(NebiusOutputError):
        service(monkeypatch, {"groups": [group, {**group, "label": "Another mistake"}]}).group_failures(calls)


@pytest.mark.parametrize("content", [
    '```json\n{"groups":[]}\n```',
    '{"groups":[],"groups":[]}',
    '{"groups":[],"extra":"field"}',
    '{"groups":"not-an-array"}',
    '{"groups":[{"label":"one two three four five six seven eight","root_cause":"A mistake","conversation_ids":["conversation-1"]}]}',
    '{"groups":[{"label":"  ","root_cause":"A mistake","conversation_ids":["conversation-1"]}]}',
    '{"groups": NaN}',
    "null",
    "[]",
    '{"groups":[',
])
def test_malformed_or_wrong_schema_json_is_rejected(content):
    with pytest.raises(NebiusOutputError):
        parse_output(content, GroupFailuresResult)


@pytest.mark.parametrize("finish,refusal", [
    ("length", None), ("stop", "Cannot comply"), ("content_filter", None), ("tool_calls", None),
])
def test_truncated_refused_or_nontext_responses_are_rejected(monkeypatch, calls, group, finish, refusal):
    with pytest.raises(NebiusOutputError):
        service(monkeypatch, {"groups": [group]}, finish=finish, refusal=refusal).group_failures(calls)


@pytest.mark.parametrize("status", [400, 401, 403, 429, 500, 302])
def test_upstream_errors_never_expose_response_bodies(monkeypatch, calls, status):
    with pytest.raises(NebiusRequestError) as caught:
        service(monkeypatch, "synthetic-sensitive-marker", status=status).group_failures(calls)
    assert "synthetic-sensitive-marker" not in str(caught.value)


@pytest.mark.parametrize("description", ["Be helpful.", "mark as success if it worked.", "Mark as success if", "Mark as success if "])
def test_proposed_criteria_require_exact_success_prefix(description):
    with pytest.raises(NebiusOutputError):
        parse_output(json.dumps({
            "new_criteria": [{"name": "Check", "description": description}], "edited_criteria": [],
        }), UpdateEvalsResult)


def test_no_more_than_two_eval_changes_total():
    with pytest.raises(NebiusOutputError):
        parse_output(json.dumps({
            "new_criteria": [{"name": "Check", "description": "Mark as success if the agent confirms."}] * 2,
            "edited_criteria": [{"id": "criterion-1", "old": "Original", "new": "Mark as success if confirmed.", "why": "Clarity."}],
        }), UpdateEvalsResult)


@pytest.mark.parametrize("field,value", [("id", "unknown-id"), ("old", "Not the current criterion")])
def test_eval_edits_must_match_existing_criteria(monkeypatch, calls, criteria, field, value):
    edit = {
        "id": criteria[0].id, "old": criteria[0].description,
        "new": "Mark as success if the agent reads the order ID before lookup.", "why": "Clarifies the step.",
    }
    edit[field] = value
    with pytest.raises(NebiusOutputError):
        service(monkeypatch, {"new_criteria": [], "edited_criteria": [edit]}).update_evals(criteria, calls)


def test_empty_eval_proposals_are_valid(monkeypatch, calls, criteria):
    assert service(monkeypatch, {"new_criteria": [], "edited_criteria": []}).update_evals(criteria, calls).new_criteria == []


def test_missing_backend_configuration_fails_without_network(monkeypatch, calls):
    monkeypatch.delenv("NEBIUS_API_KEY", raising=False)
    monkeypatch.delenv("NEBIUS_MODEL", raising=False)
    def fail(_):
        pytest.fail("Network attempted without backend configuration")
    with pytest.raises(NebiusConfigurationError):
        NebiusService(transport=httpx.MockTransport(fail)).group_failures(calls)


def test_input_counts_are_strict_and_nonnegative():
    with pytest.raises(ValidationError):
        CurrentCriterion(id="c", name="Check", description="Check the transcript.", passed="1", failed=0, unknown=0)
    with pytest.raises(ValidationError):
        CurrentCriterion(id="c", name="Check", description="Check the transcript.", passed=1, failed=-1, unknown=0)
