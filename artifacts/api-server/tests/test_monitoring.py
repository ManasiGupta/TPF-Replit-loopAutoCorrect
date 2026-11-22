"""Phase 2: real SDK HTTP fixtures + real PostgreSQL, never live credentials."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import httpx
import pytest
from elevenlabs import ElevenLabs
from fastapi import HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from loop_api import monitoring, provider
from loop_api.models import Agent, Conversation
from loop_api.database import get_engine
from loop_api.security import encrypt_api_key
from test_phase_one import client, db, cipher  # noqa: F401; shared transactional fixtures
from test_privacy import private_client  # noqa: F401

NOW = int(datetime.now(timezone.utc).timestamp())


def payload(conversation_id="conv_one", *, status="done", outcomes=("success",), environment="production"):
    return {
        "agent_id": "remote_monitor", "conversation_id": conversation_id, "status": status,
        "metadata": {"start_time_unix_secs": NOW, "call_duration_secs": 42, "cost_fiat": None},
        "has_audio": False, "has_user_audio": False, "has_response_audio": False, "has_auxiliary_audio": False,
        "transcript": [{"role": "agent", "message": "Private transcript text", "time_in_call_secs": 0}],
        "version_id": "provider_version", "environment": environment,
        "analysis": None if outcomes is None else {
            "call_successful": "failure" if "failure" in outcomes else "success",
            "transcript_summary": "Private provider summary",
            "evaluation_criteria_results": {f"criterion_{i}": {
                "criteria_id": f"criterion_{i}", "result": outcome,
                "rationale": f"Provider reason: {outcome}",
            } for i, outcome in enumerate(outcomes)},
        },
    }


def summary(conversation_id):
    return {"agent_id": "remote_monitor", "conversation_id": conversation_id, "start_time_unix_secs": NOW,
            "call_duration_secs": 42, "message_count": 1, "status": "done", "call_successful": "success"}


@contextmanager
def transport(handler):
    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        yield ElevenLabs(api_key="synthetic-sdk-key", httpx_client=http)


def connection(db, owner="user_phase_one_test", remote_id="remote_monitor"):
    row = Agent(owner_id=owner, remote_id=remote_id, name="Monitoring fixture",
                encrypted_api_key=encrypt_api_key("synthetic-saved-key"))
    db.add(row)
    db.commit()
    return row


def ready(db, agent):
    agent.next_poll_at = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.commit()


def sdk(monkeypatch, outcomes=("success",)):
    requests = []
    def handler(request):
        requests.append(request)
        if request.url.path == "/v1/convai/conversations":
            assert request.url.params["agent_id"] == "remote_monitor"
            assert request.url.params["page_size"] == "100"
            assert "call_start_after_unix" in request.url.params
            return httpx.Response(200, json={"conversations": [summary("conv_one")], "has_more": False})
        assert request.url.path == "/v1/convai/conversations/conv_one"
        return httpx.Response(200, json=payload(outcomes=outcomes))
    monkeypatch.setattr(provider, "client_for", lambda key: transport(handler))
    return requests


def test_poll_decrypts_only_on_backend_and_deduplicates(client, db, cipher, monkeypatch):
    agent = connection(db)
    seen_keys = []
    requests = sdk(monkeypatch)
    original = provider.client_for
    monkeypatch.setattr(provider, "client_for", lambda key: (seen_keys.append(key), original(key))[1])
    response = client.post(f"/api/agents/{agent.id}/poll")
    assert response.status_code == 200 and response.json()["lastSuccessAt"]
    assert seen_keys == ["synthetic-saved-key"]
    calls = client.get(f"/api/agents/{agent.id}/calls").json()
    assert calls["total"] == 1 and calls["items"][0]["result"] == "passed"
    assert "transcript" not in calls["items"][0]
    detail = client.get(f"/api/agents/{agent.id}/calls/{calls['items'][0]['id']}").json()
    assert detail["transcript"][0]["text"] == "Private transcript text"
    assert detail["evaluations"][0]["rationale"] == "Provider reason: success"
    assert detail["versionId"] == "provider_version"
    assert "synthetic-saved-key" not in str(calls) + str(detail) + response.text
    assert agent.encrypted_api_key not in str(calls) + str(detail)
    client.post(f"/api/agents/{agent.id}/poll")  # not due
    assert len(requests) == 2
    ready(db, agent)
    client.post(f"/api/agents/{agent.id}/poll")
    assert len(requests) == 4
    assert db.scalar(select(func.count()).select_from(Conversation).where(Conversation.agent_id == agent.id)) == 1
    stats = client.get(f"/api/agents/{agent.id}").json()
    assert stats["passRate"] == 100 and stats["openFailures"] == 0


@pytest.mark.parametrize("status,outcomes,result", [
    ("done", ("success", "failure"), "failed"),
    ("done", ("success", "unknown"), "unknown"),
    ("processing", ("success",), "unknown"),
    ("in-progress", None, "unknown"), ("failed", None, "unknown"),
    ("done", (), "unknown"),
])
def test_verdict_uses_real_analysis_never_fabricates(status, outcomes, result):
    from elevenlabs.types import GetConversationResponseModel
    actual = provider.conversation_data(GetConversationResponseModel.model_validate(payload(status=status, outcomes=outcomes)), "remote_monitor")
    assert actual["result"] == result


def test_unknown_processing_call_is_updated_not_duplicated(client, db, cipher, monkeypatch):
    agent = connection(db)
    requests = sdk(monkeypatch, outcomes=None)
    client.post(f"/api/agents/{agent.id}/poll")
    row = db.scalar(select(Conversation).where(Conversation.agent_id == agent.id))
    original_id = row.id
    assert row.result == "unknown"
    assert client.get(f"/api/agents/{agent.id}").json()["passRate"] is None
    sdk(monkeypatch, outcomes=("failure",))
    ready(db, agent)
    assert client.post(f"/api/agents/{agent.id}/poll").json()["lastError"] is None
    db.refresh(row)
    assert row.id == original_id and row.result == "failed"
    stats = client.get(f"/api/agents/{agent.id}").json()
    assert stats["passRate"] == 0 and stats["openFailures"] == 1


def test_pagination_and_pending_outside_recent_window(monkeypatch):
    paths = []
    def handler(request):
        paths.append(str(request.url))
        if request.url.path == "/v1/convai/conversations":
            page_two = request.url.params.get("cursor") == "page_two"
            return httpx.Response(200, json={"conversations": [summary("conv_two" if page_two else "conv_one")],
                "has_more": not page_two, "next_cursor": None if page_two else "page_two"})
        return httpx.Response(200, json=payload(request.url.path.split("/")[-1]))
    monkeypatch.setattr(provider, "client_for", lambda _: transport(handler))
    rows = list(provider.recent_conversations("synthetic", "remote_monitor", NOW - 100, ["conv_old", "conv_one"]))
    assert [r["remote_id"] for r in rows] == ["conv_one", "conv_two", "conv_old"]
    assert len(paths) == 5 and "cursor=page_two" in paths[2]


def test_provider_failure_rolls_back_partial_poll_and_retries(client, db, cipher, monkeypatch):
    agent = connection(db)
    def failing(*args):
        from elevenlabs.types import GetConversationResponseModel
        yield provider.conversation_data(GetConversationResponseModel.model_validate(payload()), "remote_monitor")
        raise HTTPException(429, "ElevenLabs rate limit reached. Please wait and try again.")
    monkeypatch.setattr(monitoring, "recent_conversations", failing)
    state = client.post(f"/api/agents/{agent.id}/poll").json()
    assert "rate limit" in state["lastError"] and state["lastSuccessAt"] is None and state["nextPollAt"]
    assert client.get(f"/api/agents/{agent.id}/calls").json()["total"] == 0
    sdk(monkeypatch)
    monkeypatch.setattr(monitoring, "recent_conversations", provider.recent_conversations)
    ready(db, agent)
    state = client.post(f"/api/agents/{agent.id}/poll").json()
    assert state["lastError"] is None and state["lastSuccessAt"]


def test_bad_cipher_does_not_call_provider_or_expose_cipher(client, db, cipher, monkeypatch):
    agent = connection(db)
    agent.encrypted_api_key = "unreadable-sensitive-cipher"
    db.commit()
    monkeypatch.setattr(monitoring, "recent_conversations", lambda *_: pytest.fail("Must not call provider"))
    response = client.post(f"/api/agents/{agent.id}/poll")
    assert response.status_code == 200
    assert "cannot be decrypted" in response.json()["lastError"]
    assert "unreadable-sensitive-cipher" not in response.text


def test_settings_are_persisted_and_pause_polling(client, db, cipher, monkeypatch):
    agent = connection(db)
    path = f"/api/agents/{agent.id}"
    response = client.patch(path + "/monitoring", json={"enabled": False, "pollMinutes": 17})
    assert response.json()["pollMinutes"] == 17 and response.json()["nextPollAt"] is None
    monkeypatch.setattr(monitoring, "recent_conversations", lambda *_: pytest.fail("Paused provider access"))
    assert client.post(path + "/poll").json()["lastAttemptAt"] is None
    assert client.get(path).json()["monitoring"]["enabled"] is False
    for minutes in [0, 1441, "5", 2.5, True]:
        assert client.patch(path + "/monitoring", json={"enabled": True, "pollMinutes": minutes}).status_code == 422
    response = client.patch(path + "/monitoring", json={"enabled": True, "pollMinutes": 1})
    assert response.json()["enabled"] and response.json()["nextPollAt"]


def test_filters_pagination_and_detail_bound_to_connection(client, db, cipher):
    agent = connection(db)
    other = connection(db, remote_id="other_remote")
    from elevenlabs.types import GetConversationResponseModel
    for i, (outcomes, environment) in enumerate([(("success",), "production"), (("failure",), "test"), (None, None)]):
        db.add(Conversation(agent_id=agent.id, **provider.conversation_data(
            GetConversationResponseModel.model_validate(payload(f"conv_{i}", outcomes=outcomes, environment=environment)), "remote_monitor")))
    db.commit()
    path = f"/api/agents/{agent.id}/calls"
    assert client.get(path, params={"result": "failed"}).json()["total"] == 1
    assert client.get(path, params={"result": "unknown", "source": "unknown"}).json()["total"] == 1
    assert client.get(path, params={"source": "test"}).json()["total"] == 1
    page = client.get(path, params={"limit": 1, "offset": 1}).json()
    assert page["total"] == 3 and len(page["items"]) == 1
    assert client.get(f"/api/agents/{other.id}/calls/{page['items'][0]['id']}").status_code == 404
    assert client.get(path, params={"limit": 101}).status_code == 422
    assert client.get(path, params={"offset": -1}).status_code == 422
    assert client.get(path, params={"result": "made-up"}).status_code == 422
    assert client.get(f"/api/agents/{agent.id}").json()["passRate"] == 100  # tests excluded


def test_other_owner_and_signed_out_cannot_read_transcripts_or_control_polling(private_client, cipher, monkeypatch):
    client, db, login = private_client
    agent = connection(db, owner="user_alice")
    sdk(monkeypatch)
    login("user_alice")
    client.post(f"/api/agents/{agent.id}/poll")
    call_id = client.get(f"/api/agents/{agent.id}/calls").json()["items"][0]["id"]
    for owner in ["user_bob", None]:
        if owner:
            login(owner)
        else:
            client.cookies.clear()
        expected = 404 if owner else 401
        for method, suffix, body in [
            ("get", "/calls", None), ("get", "/calls/" + call_id, None),
            ("post", "/poll", None), ("patch", "/monitoring", {"enabled": True, "pollMinutes": 1}),
        ]:
            response = client.request(method, f"/api/agents/{agent.id}" + suffix, json=body)
            assert response.status_code == expected
            assert "Private" not in response.text and response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("failure", ["cursor", "wrong_agent", "wrong_conversation", "upstream"])
def test_bad_provider_response_is_explicit_and_sanitized(monkeypatch, failure):
    def handler(request):
        if failure == "upstream":
            return httpx.Response(401, json={"detail": "synthetic-sensitive-provider-body"})
        if request.url.path == "/v1/convai/conversations":
            return httpx.Response(200, json={"conversations": [summary("conv_one")],
                "has_more": failure == "cursor", "next_cursor": None})
        data = payload()
        if failure == "wrong_agent":
            data["agent_id"] = "another_agent"
        if failure == "wrong_conversation":
            data["conversation_id"] = "another_conversation"
        return httpx.Response(200, json=data)
    monkeypatch.setattr(provider, "client_for", lambda _: transport(handler))
    with pytest.raises(HTTPException) as error:
        list(provider.recent_conversations("synthetic", "remote_monitor", NOW, []))
    assert "synthetic-sensitive-provider-body" not in str(error.value.detail)


def test_worker_honors_each_agents_schedule_and_ignores_unclaimed(db, cipher, monkeypatch):
    due = connection(db)
    later = connection(db, remote_id="later")
    paused = connection(db, remote_id="paused")
    legacy = connection(db, owner=None, remote_id="unclaimed")
    later.next_poll_at = datetime.now(timezone.utc) + timedelta(hours=1)
    paused.monitoring_enabled = False
    due.poll_minutes = 13
    db.commit()
    seen = []
    monkeypatch.setattr(monitoring, "get_engine", lambda: db.connection())
    monkeypatch.setattr(monitoring, "Session", lambda bind: Session(bind, join_transaction_mode="create_savepoint"))
    monkeypatch.setattr(monitoring, "recent_conversations", lambda key, remote, *args: (seen.append(remote), [])[1])
    monitoring.poll_due_agents()
    monitoring.poll_due_agents()
    assert seen == ["remote_monitor"]
    db.refresh(due)
    assert 12 * 60 < (due.next_poll_at - due.last_attempt_at).total_seconds() < 14 * 60
    ready(db, later)
    monitoring.poll_due_agents()
    assert seen == ["remote_monitor", "later"]
    db.refresh(legacy)
    assert legacy.last_attempt_at is None


def test_row_lock_excludes_other_workers_and_refreshes_stale_state(cipher):
    """Independent PostgreSQL connections, with only a temporary synthetic row."""
    engine = get_engine()
    agent_id = str(uuid4())
    try:
        with Session(engine) as writer:
            writer.add(Agent(id=agent_id, owner_id="synthetic-lock-test", remote_id="lock_" + uuid4().hex,
                             name="Temporary lock test", encrypted_api_key=encrypt_api_key("synthetic")))
            writer.commit()
        with Session(engine) as first, Session(engine) as second:
            stale = first.get(Agent, agent_id)
            assert stale.next_poll_at is None
            changed = monitoring.locked_agent(second, agent_id, "synthetic-lock-test")
            changed.next_poll_at = datetime.now(timezone.utc) + timedelta(hours=1)
            second.commit()
            fresh = monitoring.locked_agent(first, agent_id, "synthetic-lock-test")
            assert fresh.next_poll_at is not None
            assert monitoring.locked_agent(second, agent_id, "synthetic-lock-test") is None
            first.rollback()
            assert monitoring.locked_agent(second, agent_id, "synthetic-lock-test") is not None
    finally:
        with Session(engine) as cleanup:
            cleanup.execute(delete(Agent).where(Agent.id == agent_id))
            cleanup.commit()


def test_loop_only_criteria_show_unknown_without_inventing_evaluations(client, db, cipher, monkeypatch):
    from loop_api.models import EvalCriterion
    agent = connection(db)
    agent.criteria.append(EvalCriterion(name="Added in Loop", text="Be polite", source="user", position=0, provider_definition={}))
    db.commit()
    sdk(monkeypatch)
    client.post(f"/api/agents/{agent.id}/poll")
    saved = client.get(f"/api/agents/{agent.id}").json()
    criterion = saved["criteria"][0]
    assert (criterion["passed"], criterion["failed"], criterion["unknown"]) == (0, 0, 1)
    call = client.get(f"/api/agents/{agent.id}/calls").json()["items"][0]
    detail = client.get(f"/api/agents/{agent.id}/calls/{call['id']}").json()
    unknown = [e for e in detail["evaluations"] if e["name"] == "Added in Loop"][0]
    assert unknown["result"] == "unknown" and "not been evaluated" in unknown["rationale"]
