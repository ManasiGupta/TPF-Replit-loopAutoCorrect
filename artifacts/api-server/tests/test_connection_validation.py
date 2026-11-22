"""Discovery diagnostics use synthetic input and never contact a provider."""
import json

import pytest
from fastapi.testclient import TestClient

from loop_api import main
from loop_api.request_validation import connection_validation


@pytest.fixture
def signed_in(monkeypatch):
    async def authenticated(_request):
        return "user_discovery_validation_test"
    monkeypatch.setattr(main, "authenticate_request", authenticated)
    with TestClient(main.app) as client:
        yield client


def test_find_agents_accepts_the_browser_request_shape(signed_in, monkeypatch):
    def discover(key):
        assert key == "synthetic-key"
        return [{"remoteId": "agent_example", "name": "Example", "tags": []}]
    monkeypatch.setattr(main, "discover", discover)
    response = signed_in.post("/api/connections/discover", json={"apiKey": " synthetic-key "})
    assert response.status_code == 200
    assert response.json() == [{"remoteId": "agent_example", "name": "Example", "tags": []}]


@pytest.mark.parametrize("body,expected", [
    ({}, "missing your ElevenLabs API key"),
    ({"apiKey": ""}, "between 1 and 1024"),
    ({"apiKey": "   "}, "between 1 and 1024"),
    ({"apiKey": {"nested": "synthetic-sensitive-marker"}}, "between 1 and 1024"),
    ({"apiKey": "synthetic-sensitive-marker" * 100}, "between 1 and 1024"),
    ({"apiKey": "synthetic-key", "synthetic-sensitive-marker": True}, "unexpected fields"),
])
def test_discovery_validation_is_actionable_and_never_leaks(signed_in, monkeypatch, caplog, body, expected):
    monkeypatch.setattr(main, "discover", lambda _: pytest.fail("Provider called for invalid input"))
    response = signed_in.post("/api/connections/discover", json=body)
    assert response.status_code == 422
    assert expected in response.json()["error"]
    assert "synthetic-sensitive-marker" not in response.text
    assert "synthetic-sensitive-marker" not in caplog.text
    assert "stage=discovery" in caplog.text
    assert response.headers["cache-control"] == "no-store"


def test_malformed_json_is_identified_without_echoing_the_key(signed_in, monkeypatch, caplog):
    monkeypatch.setattr(main, "discover", lambda _: pytest.fail("Provider called for malformed JSON"))
    response = signed_in.post(
        "/api/connections/discover",
        content='{"apiKey":"synthetic-sensitive-marker"',
        headers={"Content-Type": "application/json"},
    )
    assert response.status_code == 422
    assert "invalid JSON" in response.json()["error"]
    assert "synthetic-sensitive-marker" not in response.text + caplog.text


def test_wrong_content_type_explains_that_json_is_required(signed_in, monkeypatch):
    monkeypatch.setattr(main, "discover", lambda _: pytest.fail("Provider called for a text body"))
    response = signed_in.post(
        "/api/connections/discover",
        content=json.dumps({"apiKey": "synthetic-key"}),
        headers={"Content-Type": "text/plain"},
    )
    assert response.status_code == 422
    assert "JSON connection request" in response.json()["error"]


def test_diagnostics_ignore_arbitrary_fields_messages_and_context():
    message, issues = connection_validation([{
        "loc": ("body", "synthetic-sensitive-marker"),
        "msg": "synthetic-sensitive-marker",
        "input": "synthetic-sensitive-marker",
        "type": "synthetic-sensitive-marker",
        "ctx": {"error": "synthetic-sensitive-marker"},
    }])
    assert issues == [{"field": "body", "type": "invalid"}]
    assert "synthetic-sensitive-marker" not in message + str(issues)
