import base64
import json
import time
from contextlib import contextmanager
from uuid import uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.orm import Session

from loop_api import auth, main, security
from loop_api.database import get_engine, get_session
from loop_api.migrations import apply_schema
from loop_api.models import Agent, EvalCriterion

ISSUER = "https://privacy-test.clerk.accounts.dev"


@pytest.fixture
def private_client(monkeypatch):
    private_key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    jwk = json.loads(jwt.algorithms.RSAAlgorithm.to_jwk(private_key.public_key()))
    jwk.update(kid="privacy-test", alg="RS256")
    monkeypatch.setenv("CLERK_PUBLISHABLE_KEY", "pk_test_" + base64.b64encode((ISSUER[8:] + "$").encode()).decode())
    async def keys(force=False):
        return {"keys": [jwk]}
    monkeypatch.setattr(auth, "get_jwks", keys)
    with get_engine().connect() as connection:
        transaction = connection.begin()
        with Session(connection, join_transaction_mode="create_savepoint") as session:
            main.app.dependency_overrides[get_session] = lambda: session
            with TestClient(main.app) as client:
                def login(owner="user_alice", **patch):
                    claims = {"sub": owner, "sid": "sess_test", "iss": ISSUER, "azp": "http://testserver",
                              "iat": int(time.time()), "nbf": int(time.time()) - 1, "exp": int(time.time()) + 60}
                    claims.update(patch)
                    client.cookies.set("__session", jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": "privacy-test"}))
                yield client, session, login
            main.app.dependency_overrides.clear()
        transaction.rollback()


@pytest.mark.parametrize("method,path,body", [
    ("get", "/api/agents", None), ("get", "/api/setup", None),
    ("get", "/api/agents/" + str(uuid4()), None),
    ("post", "/api/connections/discover", {"apiKey": "not-a-real-key"}),
    ("post", "/api/connections/preview", {"apiKey": "not-a-real-key", "remoteId": "test"}),
    ("post", "/api/agents", {"apiKey": "not-a-real-key", "remoteId": "test", "userCriteria": []}),
    ("get", "/api/docs", None), ("get", "/api/openapi.json", None),
])
def test_signed_out_cannot_reach_any_private_route(private_client, monkeypatch, method, path, body):
    client, _, _ = private_client
    monkeypatch.setattr(main, "discover", lambda *_: pytest.fail("Unauthenticated provider access"))
    monkeypatch.setattr(main, "load_agent", lambda *_: pytest.fail("Unauthenticated provider access"))
    response = client.request(method, path, json=body)
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"
    assert "not-a-real-key" not in response.text
    assert client.get("/api/healthz").status_code == 200


@pytest.mark.parametrize("patch", [
    {"azp": "https://another-app.example"}, {"iss": "https://wrong-issuer.example"},
    {"exp": 1}, {"nbf": 9999999999}, {"sub": ""}, {"sts": "pending"}, {"sid": ""},
])
def test_rejects_bad_claims(private_client, patch):
    client, _, login = private_client
    login(**patch)
    assert client.get("/api/agents").status_code == 401


def test_rejects_forgery_and_cross_site_requests(private_client):
    client, _, login = private_client
    client.cookies.set("__session", jwt.encode({"sub": "user_forged"}, "synthetic-wrong-secret-at-least-32-bytes", algorithm="HS256"))
    assert client.get("/api/agents").status_code == 401
    login()
    assert client.post("/api/connections/discover", json={"apiKey": "not-a-key"}, headers={"Origin": "https://evil.example"}).status_code == 401
    assert client.post("/api/connections/discover", json={"apiKey": "not-a-key"}, headers={"Sec-Fetch-Site": "cross-site"}).status_code == 401


def test_two_accounts_are_isolated_and_legacy_records_stay_unclaimed(private_client, monkeypatch):
    client, db, login = private_client
    remote = "privacy_" + uuid4().hex
    monkeypatch.setattr(main, "load_agent", lambda *_: ("Private agent", [
        {"remote_id": "private-criterion", "name": "Private criterion", "text": "A private instruction.", "definition": {}},
    ]))
    monkeypatch.setenv("ENCRYPTION_KEY", __import__("cryptography.fernet", fromlist=["Fernet"]).Fernet.generate_key().decode())
    payload = {"apiKey": "synthetic-elevenlabs-key", "remoteId": remote, "userCriteria": []}
    legacy = Agent(owner_id=None, remote_id=remote + "_legacy", name="Unclaimed legacy agent", encrypted_api_key="legacy-ciphertext")
    db.add(legacy)
    db.commit()
    login("user_alice")
    alice = client.post("/api/agents", json=payload)
    assert alice.status_code == 201, alice.text
    alice_id = alice.json()["id"]
    assert client.post("/api/agents", json=payload).status_code == 409
    login("user_bob")
    ids = {r["id"] for r in client.get("/api/agents").json()}
    assert alice_id not in ids and legacy.id not in ids
    denied = client.get("/api/agents/" + alice_id)
    assert denied.status_code == 404
    assert "Private criterion" not in denied.text
    # Same provider agent belongs to independent account-scoped connections.
    bob = client.post("/api/agents", json=payload)
    assert bob.status_code == 201
    assert bob.json()["id"] != alice_id
    assert client.get("/api/agents/" + legacy.id).status_code == 404
    assert db.get(Agent, legacy.id).owner_id is None
    login("user_alice")
    assert client.get("/api/agents/" + bob.json()["id"]).status_code == 404
    own = client.get("/api/agents/" + alice_id)
    assert own.status_code == 200 and own.json()["criteria"][0]["text"] == "A private instruction."
    ciphertext = db.get(Agent, alice_id).encrypted_api_key
    assert ciphertext != payload["apiKey"] and ciphertext not in own.text and payload["apiKey"] not in own.text
    assert db.scalar(select(EvalCriterion).where(EvalCriterion.agent_id == alice_id)) is not None


def test_domain_separated_encryption_is_stable_and_fails_closed(monkeypatch):
    monkeypatch.delenv("ENCRYPTION_KEY", raising=False)
    monkeypatch.setenv("SESSION_SECRET", "synthetic-stable-root-secret-" * 3)
    encrypted = security.encrypt_api_key("synthetic-key")
    assert security.get_cipher().decrypt(encrypted.encode()) == b"synthetic-key"
    monkeypatch.setenv("ENCRYPTION_KEY", "invalid-explicit-key")
    with pytest.raises(Exception) as error:
        security.get_cipher()
    assert error.value.status_code == 503  # never ignore invalid explicit config
    monkeypatch.delenv("ENCRYPTION_KEY")
    monkeypatch.delenv("SESSION_SECRET")
    with pytest.raises(Exception) as error:
        security.get_cipher()
    assert error.value.status_code == 503


def test_additive_migration_preserves_unclaimed_rows_and_criteria():
    schema = "privacy_migration_" + uuid4().hex
    with get_engine().connect() as connection:
        transaction = connection.begin()
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        connection.execute(text(f'SET LOCAL search_path TO "{schema}"'))
        connection.execute(text("""CREATE TABLE loop_agents (
            id VARCHAR(36) PRIMARY KEY, remote_id VARCHAR(200) UNIQUE, name TEXT,
            platform VARCHAR(30), encrypted_api_key TEXT, created_at TIMESTAMPTZ)"""))
        connection.execute(text("""CREATE TABLE loop_eval_criteria (
            id VARCHAR(36) PRIMARY KEY, agent_id VARCHAR(36) REFERENCES loop_agents(id),
            remote_id TEXT, name TEXT, text TEXT, source VARCHAR(20),
            position INTEGER, provider_definition JSONB)"""))
        connection.execute(text("INSERT INTO loop_agents(id,remote_id,name,encrypted_api_key) VALUES ('legacy','provider-existing','Keep me','opaque-cipher')"))
        connection.execute(text("INSERT INTO loop_eval_criteria(id,agent_id,text) VALUES ('criterion','legacy','Keep criterion')"))
        class TransactionEngine:
            @contextmanager
            def begin(self):
                with connection.begin_nested():
                    yield connection
        apply_schema(TransactionEngine())
        apply_schema(TransactionEngine())
        row = connection.execute(text("SELECT name,encrypted_api_key,owner_id FROM loop_agents")).one()
        assert row == ("Keep me", "opaque-cipher", None)
        assert connection.scalar(text("SELECT text FROM loop_eval_criteria")) == "Keep criterion"
        connection.execute(text("INSERT INTO loop_agents(id,remote_id,owner_id) VALUES ('a','same-provider','user_a'),('b','same-provider','user_b')"))
        transaction.rollback()
