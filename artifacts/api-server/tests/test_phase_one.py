import json
from contextlib import contextmanager
from uuid import uuid4

import httpx
import pytest
from cryptography.fernet import Fernet
from elevenlabs import ElevenLabs
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from loop_api import main, provider, security
from loop_api.database import get_engine, get_session
from loop_api.models import Agent


@pytest.fixture
def db():
    # Endpoint commits release savepoints, not the outer transaction.
    with get_engine().connect() as connection:
        transaction = connection.begin()
        with Session(connection, join_transaction_mode="create_savepoint") as session:
            yield session
        transaction.rollback()


@pytest.fixture
def client(db):
    main.app.dependency_overrides[get_session] = lambda: db
    with TestClient(main.app) as client:
        yield client
    main.app.dependency_overrides.clear()


@pytest.fixture
def cipher(monkeypatch):
    cipher = Fernet(Fernet.generate_key())
    monkeypatch.setattr(security, "get_cipher", lambda: cipher)
    return cipher


@pytest.fixture
def remote(monkeypatch):
    remote_id = "loop_test_" + uuid4().hex
    monkeypatch.setattr(main, "load_agent", lambda key, selected: ("Phase 1 Test Agent", [
        {"remote_id": "criterion_imported", "name": "Confirm request", "text": "Confirm the caller's request.", "definition": {"scope": "conversation"}},
    ]))
    return {"apiKey": "synthetic-test-value-not-a-credential", "remoteId": remote_id, "userCriteria": ["Be helpful."]}


def test_save_encrypts_key_and_persists_imported_and_user_criteria(client, db, cipher, remote):
    response = client.post("/api/agents", json=remote)
    assert response.status_code == 201, response.text
    saved = response.json()
    assert saved["passRate"] is None and saved["openFailures"] is None
    assert [c["source"] for c in saved["criteria"]] == ["imported", "user"]
    row = db.scalar(select(Agent).where(Agent.remote_id == remote["remoteId"]))
    assert row.encrypted_api_key != remote["apiKey"]
    assert cipher.decrypt(row.encrypted_api_key.encode()).decode() == remote["apiKey"]
    for url in ["/api/agents", "/api/agents/" + saved["id"]]:
        fetched = client.get(url)
        assert fetched.status_code == 200
        assert remote["apiKey"] not in fetched.text
        assert row.encrypted_api_key not in fetched.text
    detail = client.get("/api/agents/" + saved["id"]).json()
    assert detail["criteriaCount"] == 2
    assert detail["criteria"][0]["text"] == "Confirm the caller's request."
    assert client.post("/api/agents", json=remote).status_code == 409


def test_missing_encryption_never_calls_provider_or_writes(client, db, monkeypatch, remote):
    def missing():
        raise HTTPException(503, "ENCRYPTION_KEY is missing.")
    monkeypatch.setattr(security, "get_cipher", missing)
    monkeypatch.setattr(main, "load_agent", lambda *_: pytest.fail("Provider called without encryption readiness"))
    response = client.post("/api/agents", json=remote)
    assert response.status_code == 503
    assert db.scalar(select(Agent.id).where(Agent.remote_id == remote["remoteId"])) is None


def test_invalid_input_does_not_echo_secrets(client):
    marker = "synthetic-sensitive-marker"
    response = client.post("/api/connections/preview", json={"apiKey": marker, "remoteId": "../bad"})
    assert response.status_code == 422
    assert marker not in response.text
    assert response.headers["cache-control"] == "no-store"


def test_bad_request_and_missing_agent(client):
    assert client.post("/api/connections/discover", json={"apiKey": "   "}).status_code == 422
    assert client.get("/api/agents/" + str(uuid4())).status_code == 404
    assert client.get("/api/agents/not-a-uuid").status_code == 422


def test_criteria_limit_and_warning(client, cipher, remote, monkeypatch, db):
    monkeypatch.setattr(main, "load_agent", lambda *_: ("Limit test", [
        {"remote_id": f"c{i}", "name": f"Criterion {i}", "text": "Be clear.", "definition": {}} for i in range(30)
    ]))
    assert client.post("/api/agents", json=remote).status_code == 422
    assert db.scalar(select(Agent.id).where(Agent.remote_id == remote["remoteId"])) is None
    remote["userCriteria"] = []
    response = client.post("/api/agents", json=remote)
    assert response.status_code == 201
    assert "30" in response.json()["warning"]


def test_provider_failure_is_atomic(client, cipher, remote, monkeypatch, db):
    def unavailable(*args):
        raise HTTPException(502, "ElevenLabs unavailable")
    monkeypatch.setattr(main, "load_agent", unavailable)
    assert client.post("/api/agents", json=remote).status_code == 502
    assert db.scalar(select(Agent.id).where(Agent.remote_id == remote["remoteId"])) is None


@contextmanager
def sdk_transport(handler):
    with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
        yield ElevenLabs(api_key="synthetic-test-key", httpx_client=transport)


def agent_payload(platform):
    return {"agent_id": "remote_test", "name": "Support", "conversation_config": {},
            "metadata": {"created_at_unix_secs": 1, "updated_at_unix_secs": 1}, "platform_settings": platform}


def test_sdk_pagination_uses_confirmed_endpoint(monkeypatch):
    paths = []
    def handler(request):
        assert request.method == "GET"
        assert request.url.path == "/v1/convai/agents"
        assert request.url.params["page_size"] == "100"
        paths.append(str(request.url))
        return httpx.Response(200, json={"agents": [], "has_more": len(paths) == 1, "next_cursor": "next" if len(paths) == 1 else None})
    monkeypatch.setattr(provider, "client_for", lambda _: sdk_transport(handler))
    assert provider.discover("synthetic") == []
    assert len(paths) == 2 and "cursor=next" in paths[1]


def test_sdk_imports_inline_criteria(monkeypatch):
    def handler(request):
        assert request.method == "GET"
        assert request.url.path == "/v1/convai/agents/remote_test"
        return httpx.Response(200, json=agent_payload({"evaluation": {"criteria": [
            {"id": "goal", "name": "Resolve issue", "type": "prompt", "conversation_goal_prompt": "Resolve the caller's issue."}
        ]}}))
    monkeypatch.setattr(provider, "client_for", lambda _: sdk_transport(handler))
    name, criteria = provider.load_agent("synthetic", "remote_test")
    assert name == "Support"
    assert criteria[0]["text"] == "Resolve the caller's issue."


def test_sdk_imports_referenced_criteria(monkeypatch):
    paths = []
    def handler(request):
        paths.append(request.url.path)
        if request.url.path.endswith("/agents/remote_test"):
            return httpx.Response(200, json=agent_payload({"analysis_items": {"evaluation_criteria": [
                {"source": "user", "analysis_item_id": "item_a", "version_id": "version_a"}
            ]}}))
        assert request.url.path == "/v1/convai/analysis-items/item_a"
        return httpx.Response(200, json={
            "id": "item_a", "definition": {"kind": "evaluation", "name": "Be accurate", "conversation_goal_prompt": "Answer accurately."},
            "access_info": {"is_creator": True, "creator_name": "Test", "creator_email": "test@example.invalid", "role": "admin"},
            "created_at_unix_secs": 1, "updated_at_unix_secs": 1, "current_version_id": "version_a",
        })
    monkeypatch.setattr(provider, "client_for", lambda _: sdk_transport(handler))
    _, criteria = provider.load_agent("synthetic", "remote_test")
    assert criteria[0]["text"] == "Answer accurately."
    assert len(paths) == 2


@pytest.mark.parametrize("status,expected", [(401, 400), (403, 400), (404, 404), (429, 429), (500, 502)])
def test_provider_errors_do_not_return_provider_body(monkeypatch, status, expected):
    def handler(request):
        return httpx.Response(status, json={"detail": "synthetic-sensitive-marker"})
    monkeypatch.setattr(provider, "client_for", lambda _: sdk_transport(handler))
    with pytest.raises(HTTPException) as caught:
        provider.discover("synthetic")
    assert caught.value.status_code == expected
    assert "synthetic-sensitive-marker" not in caught.value.detail
