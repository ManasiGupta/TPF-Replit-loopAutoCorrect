"""Strict structural and context checks for untrusted model output.

These checks do not prove semantic correctness. Proposed prompt/eval changes
still require human approval and regression tests before application.
"""
import json
from collections import Counter
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

Text = Annotated[str, Field(min_length=1)]


class NebiusOutputError(ValueError):
    """Safe error: never include raw model output or transcript content."""


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True, hide_input_in_errors=True)

    @field_validator("*")
    @classmethod
    def nonblank_strings(cls, value):
        if isinstance(value, str) and not value.strip():
            raise ValueError("Text cannot be blank")
        return value


class EvaluationEvidence(StrictModel):
    criterion_id: Text
    result: Literal["pass", "fail", "unknown"]
    rationale: Text


class CallEvidence(StrictModel):
    conversation_id: Text
    transcript: Text
    evaluation_results: list[EvaluationEvidence]


class CurrentCriterion(StrictModel):
    id: Text
    name: Text
    description: Text
    passed: int = Field(ge=0)
    failed: int = Field(ge=0)
    unknown: int = Field(ge=0)


class FailureGroup(StrictModel):
    label: Text
    root_cause: Text
    conversation_ids: list[Text] = Field(min_length=1)

    @field_validator("label")
    @classmethod
    def short_label(cls, value):
        if len(value.split()) >= 8:
            raise ValueError("Group labels must contain fewer than eight words")
        return value


class GroupFailuresResult(StrictModel):
    groups: list[FailureGroup] = Field(min_length=1)


class PromptChange(StrictModel):
    what: Text
    why: Text


class WriteFixResult(StrictModel):
    new_prompt: Text
    changes: list[PromptChange] = Field(min_length=1)


def success_wording(value: str) -> str:
    prefix = "Mark as success if"
    if not value.startswith(prefix + " ") or not value[len(prefix):].strip():
        raise ValueError('Criterion must start with "Mark as success if" and a condition')
    return value


class NewCriterion(StrictModel):
    name: Text
    description: Text
    _wording = field_validator("description")(success_wording)


class EditedCriterion(StrictModel):
    id: Text
    old: Text
    new: Text
    why: Text
    _wording = field_validator("new")(success_wording)


class UpdateEvalsResult(StrictModel):
    new_criteria: list[NewCriterion] = Field(max_length=2)
    edited_criteria: list[EditedCriterion] = Field(max_length=2)

    @model_validator(mode="after")
    def two_changes_total(self):
        if len(self.new_criteria) + len(self.edited_criteria) > 2:
            raise ValueError("At most two evaluation changes are allowed in total")
        return self


def reject_duplicate_keys(pairs):
    result = {}
    for key, value in pairs:
        if key in result:
            raise ValueError("Duplicate JSON field")
        result[key] = value
    return result


def reject_nonfinite(_value):
    raise ValueError("Non-finite JSON number")


def parse_output(content: str, output_type: type[StrictModel]):
    """No markdown stripping, type coercion, partial JSON, or repair fallback."""
    try:
        data = json.loads(content, object_pairs_hook=reject_duplicate_keys, parse_constant=reject_nonfinite)
        return output_type.model_validate(data, strict=True)
    except (ValueError, TypeError, RecursionError, ValidationError):
        raise NebiusOutputError("Nebius returned invalid JSON or a response that does not match the required schema. Nothing was saved.") from None


def validate_groups(result: GroupFailuresResult, calls: list[CallEvidence]) -> GroupFailuresResult:
    expected = [call.conversation_id for call in calls]
    actual = [call_id for group in result.groups for call_id in group.conversation_ids]
    if len(set(expected)) != len(expected) or Counter(actual) != Counter(expected):
        raise NebiusOutputError("Groups must include every supplied call exactly once, with no unknown conversation IDs. Nothing was saved.")
    return result


def validate_evals(result: UpdateEvalsResult, criteria: list[CurrentCriterion]) -> UpdateEvalsResult:
    current = {item.id: item for item in criteria}
    edited_ids = [item.id for item in result.edited_criteria]
    new_names = [item.name.strip().casefold() for item in result.new_criteria]
    existing_names = {item.name.strip().casefold() for item in criteria}
    if len(current) != len(criteria) or len(set(edited_ids)) != len(edited_ids):
        raise NebiusOutputError("Evaluation IDs must be unique. Nothing was saved.")
    if len(set(new_names)) != len(new_names) or existing_names.intersection(new_names):
        raise NebiusOutputError("New criteria must not duplicate existing or proposed names. Nothing was saved.")
    for edit in result.edited_criteria:
        original = current.get(edit.id)
        if original is None or edit.old != original.description or edit.new == edit.old:
            raise NebiusOutputError("An edited criterion must reference an existing ID, match its current wording, and propose a change. Nothing was saved.")
    if len(criteria) + len(result.new_criteria) > 30:
        raise NebiusOutputError("Proposed criteria would exceed the 30-criterion limit. Nothing was saved.")
    return result
