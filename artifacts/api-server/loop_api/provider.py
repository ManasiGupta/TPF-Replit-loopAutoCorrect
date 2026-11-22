"""Read-only ElevenLabs operations, confirmed against official docs and SDK 2.79."""
from contextlib import contextmanager
from datetime import datetime, timezone

import httpx
from elevenlabs import ElevenLabs
from elevenlabs.core.api_error import ApiError
from fastapi import HTTPException
from .analysis_versions import evaluation_versions


@contextmanager
def client_for(key: str):
    # The HTTP client is closed after every operation; keys never persist in globals.
    with httpx.Client(timeout=25) as transport:
        yield ElevenLabs(api_key=key, httpx_client=transport)


@contextmanager
def provider_errors():
    try:
        yield
    except ApiError as error:
        status = error.status_code
        if status in (401, 403):
            raise HTTPException(400, "ElevenLabs rejected this key. Check that it is valid and has permission to read agents, analysis items, and conversations.") from None
        if status == 404:
            raise HTTPException(404, "This ElevenLabs agent, criterion, or conversation is no longer available.") from None
        if status == 429:
            raise HTTPException(429, "ElevenLabs rate limit reached. Please wait and try again.") from None
        raise HTTPException(502, "ElevenLabs could not complete the request. Please try again.") from None
    except httpx.TimeoutException:
        raise HTTPException(504, "ElevenLabs took too long to respond. Please try again.") from None
    except httpx.HTTPError:
        raise HTTPException(502, "Could not reach ElevenLabs. Please try again.") from None


def conversation_data(remote, agent_id: str) -> dict:
    """Normalize only documented fields; never persist raw provider bodies."""
    if remote.agent_id != agent_id:
        raise HTTPException(502, "ElevenLabs returned a conversation for a different agent.")
    analysis = remote.analysis
    results = []
    if analysis:
        # The list preserves multiple criterion versions; don't collapse by ID.
        items = analysis.evaluation_criteria_results_list
        if items is None:
            items = list((analysis.evaluation_criteria_results or {}).values())
        for item in items:
            if item.result not in ("success", "failure", "unknown"):
                raise HTTPException(502, "ElevenLabs returned an unsupported evaluation result.")
            results.append({
                "criterionId": item.criteria_id, "name": item.criteria_id,
                "result": item.result, "rationale": item.rationale,
                "score": item.score, "maxScore": item.max_score,
            })
    # Processing conversations are never counted as measured, even if a partial
    # analysis has already appeared. A failure criterion overrides overall success.
    result = "unknown"
    if remote.status in ("done", "failed") and analysis:
        outcomes = [item["result"] for item in results]
        if "failure" in outcomes or analysis.call_successful == "failure":
            result = "failed"
        elif outcomes and all(item == "success" for item in outcomes) and analysis.call_successful != "unknown":
            result = "passed"
    environment = remote.environment
    return {
        "remote_id": remote.conversation_id,
        "started_at": datetime.fromtimestamp(remote.metadata.start_time_unix_secs, timezone.utc),
        "duration_secs": remote.metadata.call_duration_secs,
        "status": remote.status, "result": result,
        # Environment is the only explicit provider label used here. It does not
        # prove that a test suite ran. Custom/missing environments stay unknown.
        "source": environment if environment in ("production", "test") else "unknown",
        "environment": environment, "version_id": remote.version_id,
        "summary": analysis.transcript_summary if analysis else None,
        "transcript": [{"role": turn.role, "text": turn.message, "timeInCallSecs": turn.time_in_call_secs} for turn in remote.transcript],
        "evaluations": results,
    }


def recent_conversations(key: str, agent_id: str, since: int, pending_ids: list[str]):
    """Paginate the complete recent interval and revisit older unfinished calls."""
    seen_ids, seen_cursors = set(), set()
    cursor = None
    with provider_errors(), client_for(key) as client:
        while True:
            page = client.conversational_ai.conversations.list(
                agent_id=agent_id, call_start_after_unix=since,
                page_size=100, cursor=cursor, request_options={"max_retries": 0},
            )
            for item in page.conversations:
                if item.agent_id != agent_id:
                    raise HTTPException(502, "ElevenLabs returned a conversation for a different agent.")
                if item.conversation_id in seen_ids:
                    continue
                seen_ids.add(item.conversation_id)
                remote = client.conversational_ai.conversations.get(item.conversation_id, request_options={"max_retries": 0})
                if remote.conversation_id != item.conversation_id:
                    raise HTTPException(502, "ElevenLabs returned a different conversation than requested.")
                yield conversation_data(remote, agent_id)
            if not page.has_more:
                break
            cursor = page.next_cursor
            if not cursor or cursor in seen_cursors:
                raise HTTPException(502, "ElevenLabs returned an invalid conversation cursor. The poll was not saved.")
            seen_cursors.add(cursor)
        for conversation_id in pending_ids:
            if conversation_id not in seen_ids:
                remote = client.conversational_ai.conversations.get(conversation_id, request_options={"max_retries": 0})
                if remote.conversation_id != conversation_id:
                    raise HTTPException(502, "ElevenLabs returned a different conversation than requested.")
                yield conversation_data(remote, agent_id)


def discover(key: str) -> list[dict]:
    result = []
    cursor = None
    seen = set()
    with provider_errors(), client_for(key) as client:
        while True:
            page = client.conversational_ai.agents.list(page_size=100, cursor=cursor, archived=False)
            result.extend({"remoteId": agent.agent_id, "name": agent.name, "tags": agent.tags} for agent in page.agents)
            if not page.has_more:
                break
            cursor = page.next_cursor
            if not cursor or cursor in seen:
                raise HTTPException(502, "ElevenLabs returned an invalid pagination cursor. No partial list was saved.")
            seen.add(cursor)
    return result


def load_agent(key: str, agent_id: str) -> tuple[str, list[dict]]:
    with provider_errors(), client_for(key) as client:
        remote = client.conversational_ai.agents.get(agent_id=agent_id)
        if remote.agent_id != agent_id:
            raise HTTPException(502, "ElevenLabs returned a different agent than requested.")
        platform = remote.platform_settings
        if platform is None:
            return remote.name, []
        inline = platform.evaluation.criteria if platform.evaluation and platform.evaluation.criteria else []
        refs = platform.analysis_items
        criteria = []
        if refs is None:
            for item in inline:
                criteria.append({
                    "remote_id": item.id, "name": item.name, "text": item.conversation_goal_prompt,
                    "definition": item.model_dump(mode="json", exclude_none=True),
                })
        else:
            # Analysis-item attachments are authoritative when present.
            for ref in refs.evaluation_criteria or []:
                if ref.source == "system":
                    match = next((i for i in inline if i.id == ref.analysis_item_id), None)
                    if not match:
                        raise HTTPException(422, "This agent has a system evaluation criterion that cannot be imported as a plain-English prompt. No connection was saved.")
                    criteria.append({"remote_id": match.id, "name": match.name, "text": match.conversation_goal_prompt, "definition": match.model_dump(mode="json", exclude_none=True)})
                    continue
                item = client.conversational_ai.analysis_items.get(analysis_item_id=ref.analysis_item_id)
                if item.id != ref.analysis_item_id:
                    raise HTTPException(502, "ElevenLabs returned a different evaluation item than requested.")
                definition, resolved_id, comparisons = evaluation_versions(client, item, ref)
                criteria.append({
                    "remote_id": item.id, "name": definition.name, "text": definition.conversation_goal_prompt,
                    "definition": {
                        "item": definition.model_dump(mode="json", exclude_none=True),
                        "attachment": ref.model_dump(mode="json", exclude_none=True),
                        "current_version_id": item.current_version_id,
                        "resolved_version_id": resolved_id,
                        "comparison_versions": comparisons,
                    },
                })
        return remote.name, criteria
