"""Official SDK transport tests; no real API key or external requests."""
from contextlib import contextmanager

import httpx
import pytest
from elevenlabs import ElevenLabs
from fastapi import HTTPException

from loop_api import provider


def definition(text):
    return {"kind": "evaluation", "name": "Confirm request", "conversation_goal_prompt": text}


def agent(primary, comparisons):
    return {
        "agent_id": "remote_test", "name": "Support", "conversation_config": {},
        "metadata": {"created_at_unix_secs": 1, "updated_at_unix_secs": 1},
        "platform_settings": {"analysis_items": {"evaluation_criteria": [{
            "source": "user", "analysis_item_id": "item_a",
            "version_id": primary, "additional_version_ids": comparisons,
        }]}},
    }


def version(version_id, text):
    return {"id": version_id, "version_number": 1, "created_at_unix_secs": 1, "definition": definition(text)}


def install_sdk(monkeypatch, primary="latest", comparisons=None, pages=None):
    requests = []
    def handler(request):
        assert request.method == "GET"  # import never edits the live agent
        requests.append(request)
        if request.url.path == "/v1/convai/agents/remote_test":
            return httpx.Response(200, json=agent(primary, comparisons))
        if request.url.path == "/v1/convai/analysis-items/item_a":
            return httpx.Response(200, json={
                "id": "item_a", "definition": definition("Current wording."),
                "current_version_id": "current",
                "access_info": {"is_creator": True, "creator_name": "Test", "creator_email": "test@example.invalid", "role": "admin"},
                "created_at_unix_secs": 1, "updated_at_unix_secs": 1,
            })
        assert request.url.path == "/v1/convai/analysis-items/item_a/versions"
        assert request.url.params["page_size"] == "100"
        cursor = request.url.params.get("cursor")
        assert pages is not None
        return httpx.Response(200, json=pages[cursor])

    @contextmanager
    def client(_key):
        with httpx.Client(transport=httpx.MockTransport(handler)) as transport:
            yield ElevenLabs(api_key="synthetic-not-a-key", httpx_client=transport)
    monkeypatch.setattr(provider, "client_for", client)
    return requests


@pytest.mark.parametrize("primary", [None, "latest", "current"])
def test_latest_is_not_mistaken_for_a_historical_version(monkeypatch, primary):
    requests = install_sdk(monkeypatch, primary=primary)
    _, criteria = provider.load_agent("synthetic", "remote_test")
    assert len(requests) == 2  # no history request is needed
    assert len(criteria) == 1
    assert criteria[0]["text"] == "Current wording."
    assert criteria[0]["definition"]["resolved_version_id"] == "current"


def test_pinned_primary_is_resolved_from_paginated_history(monkeypatch):
    requests = install_sdk(monkeypatch, primary="old", pages={
        None: {"versions": [version("current", "Current wording.")], "current_version_id": "current", "has_more": True, "next_cursor": "next"},
        "next": {"versions": [version("old", "Pinned wording.")], "current_version_id": "current", "has_more": False},
    })
    _, criteria = provider.load_agent("synthetic", "remote_test")
    assert criteria[0]["text"] == "Pinned wording."
    assert criteria[0]["definition"]["resolved_version_id"] == "old"
    assert requests[-1].url.params["cursor"] == "next"


def test_comparison_versions_are_preserved_but_do_not_become_scoring_criteria(monkeypatch):
    install_sdk(monkeypatch, primary="latest", comparisons=["old", "latest", "old"], pages={
        None: {"versions": [version("old", "Comparison wording.")], "current_version_id": "current", "has_more": False},
    })
    _, criteria = provider.load_agent("synthetic", "remote_test")
    assert len(criteria) == 1
    assert criteria[0]["text"] == "Current wording."
    comparisons = criteria[0]["definition"]["comparison_versions"]
    assert len(comparisons) == 1
    assert comparisons[0]["version_id"] == "old"
    assert comparisons[0]["included_in_scoring"] is False
    assert comparisons[0]["definition"]["conversation_goal_prompt"] == "Comparison wording."


def test_pinned_primary_and_latest_comparison_are_not_swapped(monkeypatch):
    install_sdk(monkeypatch, primary="old", comparisons=["latest"], pages={
        None: {"versions": [version("old", "Pinned wording.")], "current_version_id": "current", "has_more": False},
    })
    _, criteria = provider.load_agent("synthetic", "remote_test")
    assert criteria[0]["text"] == "Pinned wording."
    assert criteria[0]["definition"]["comparison_versions"][0]["version_id"] == "current"


@pytest.mark.parametrize("pages", [
    {None: {"versions": [], "current_version_id": "current", "has_more": False}},
    {
        None: {"versions": [], "current_version_id": "current", "has_more": True, "next_cursor": "repeat"},
        "repeat": {"versions": [], "current_version_id": "current", "has_more": True, "next_cursor": "repeat"},
    },
])
def test_unavailable_versions_or_cursors_never_fall_back_to_current(monkeypatch, pages):
    install_sdk(monkeypatch, primary="missing", pages=pages)
    with pytest.raises(HTTPException) as error:
        provider.load_agent("synthetic", "remote_test")
    assert error.value.status_code == 502
