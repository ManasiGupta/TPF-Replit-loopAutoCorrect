"""Backend-only Nebius calls. No database writes or live-agent mutations.

Only validated proposals are returned. Callers must still obtain approval and
run regression tests; schema validation cannot prove a criterion is not weaker.
"""
import json
import os

import httpx

from . import nebius_prompts as prompts
from .nebius_validation import (
    CallEvidence, CurrentCriterion, FailureGroup, GroupFailuresResult,
    NebiusOutputError, StrictModel, UpdateEvalsResult, WriteFixResult,
    parse_output, validate_evals, validate_groups,
)

CHAT_COMPLETIONS_URL = "https://api.tokenfactory.nebius.com/v1/chat/completions"


class NebiusConfigurationError(RuntimeError):
    pass


class NebiusRequestError(RuntimeError):
    pass


class NebiusService:
    def __init__(self, *, transport: httpx.BaseTransport | None = None):
        # Transport injection is for offline tests; secrets are never passed
        # from frontend input, returned, logged, or written to local storage.
        self._transport = transport

    def _request(self, system: str, evidence: dict, output_type: type[StrictModel]):
        key = os.environ.get("NEBIUS_API_KEY", "").strip()
        model = os.environ.get("NEBIUS_MODEL", "").strip()
        if not key or not model:
            raise NebiusConfigurationError("Loop's backend requires NEBIUS_API_KEY and NEBIUS_MODEL. No request was sent.")
        payload = {
            "model": model,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(evidence, ensure_ascii=False, allow_nan=False)},
            ],
            "response_format": {
                "type": "json_schema",
                "json_schema": {
                    "name": output_type.__name__,
                    "strict": True,
                    "schema": output_type.model_json_schema(),
                },
            },
            "stream": False,
            "store": False,
        }
        try:
            with httpx.Client(timeout=90, transport=self._transport, follow_redirects=False) as client:
                response = client.post(
                    CHAT_COMPLETIONS_URL,
                    headers={"Authorization": f"Bearer {key}"},
                    json=payload,
                )
        except httpx.TimeoutException:
            raise NebiusRequestError("Nebius timed out. No result was saved.") from None
        except httpx.HTTPError:
            raise NebiusRequestError("Nebius could not be reached. No result was saved.") from None
        if response.status_code in (401, 403):
            raise NebiusRequestError("Nebius rejected Loop's backend credentials. No result was saved.")
        if response.status_code == 429:
            raise NebiusRequestError("Nebius rate limit reached. Retry later; no result was saved.")
        if not response.is_success:
            # No raw upstream bodies: they can echo keys or private transcripts.
            raise NebiusRequestError("Nebius rejected the request. Verify NEBIUS_MODEL supports JSON-schema output. No result was saved.")
        try:
            body = response.json()
            choice = body["choices"][0]
            message = choice["message"]
            if choice["finish_reason"] != "stop" or message.get("refusal") or message.get("tool_calls"):
                raise ValueError("Incomplete, refused, or non-text completion")
            content = message["content"]
            if not isinstance(content, str):
                raise ValueError("Missing JSON content")
        except (ValueError, TypeError, KeyError, IndexError):
            raise NebiusOutputError("Nebius returned an incomplete or unusable response. Nothing was saved.") from None
        return parse_output(content, output_type)

    @staticmethod
    def _calls(calls: list[CallEvidence]) -> list[dict]:
        if not calls or any(not isinstance(call, CallEvidence) for call in calls):
            raise ValueError("Supply validated call evidence before requesting analysis.")
        ids = [call.conversation_id for call in calls]
        if len(set(ids)) != len(ids):
            raise ValueError("Input conversation IDs must be unique.")
        return [call.model_dump() for call in calls]

    def group_failures(self, calls: list[CallEvidence]) -> GroupFailuresResult:
        evidence = self._calls(calls)
        result = self._request(prompts.GROUP_FAILURES, {"calls": evidence}, GroupFailuresResult)
        return validate_groups(result, calls)

    def write_fix(self, current_prompt: str, group: FailureGroup, calls: list[CallEvidence]) -> WriteFixResult:
        evidence = self._calls(calls)
        if not current_prompt.strip():
            raise ValueError("The current prompt is required.")
        if not isinstance(group, FailureGroup):
            raise ValueError("Supply a validated failure group.")
        validate_groups(GroupFailuresResult(groups=[group]), calls)
        result = self._request(
            prompts.WRITE_THE_FIX,
            {"current_prompt": current_prompt, "group": group.model_dump(), "calls": evidence},
            WriteFixResult,
        )
        if result.new_prompt == current_prompt:
            raise NebiusOutputError("Nebius proposed no prompt change. Nothing was saved.")
        return result

    def update_evals(self, criteria: list[CurrentCriterion], calls: list[CallEvidence]) -> UpdateEvalsResult:
        evidence = self._calls(calls)
        if any(not isinstance(item, CurrentCriterion) for item in criteria):
            raise ValueError("Supply validated criteria with pass, fail, and unknown counts.")
        if len({item.id for item in criteria}) != len(criteria) or len(criteria) > 30:
            raise ValueError("Supply at most 30 criteria with unique IDs.")
        result = self._request(
            prompts.UPDATE_EVALS,
            {"current_criteria": [item.model_dump() for item in criteria], "failed_calls": evidence},
            UpdateEvalsResult,
        )
        return validate_evals(result, criteria)
