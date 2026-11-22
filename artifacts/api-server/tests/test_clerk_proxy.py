import httpx
from fastapi.testclient import TestClient

from loop_api import clerk_proxy, main


def test_production_proxy_uses_constant_upstream_and_preserves_cookie_headers(monkeypatch):
    monkeypatch.setenv("NODE_ENV", "production")
    monkeypatch.setenv("CLERK_SECRET_KEY", "synthetic-clerk-backend-secret")
    seen = []
    def handler(request):
        seen.append(request)
        assert request.url.host == "frontend-api.clerk.dev"
        assert request.url.path == "/v1/client"
        assert request.headers["Clerk-Proxy-Url"] == "https://loop.example/api/__clerk"
        assert request.headers["Clerk-Secret-Key"] == "synthetic-clerk-backend-secret"
        assert "authorization" not in request.headers
        return httpx.Response(200, stream=httpx.ByteStream(b'{"response":"ok"}'), headers=[
            ("content-type", "application/json"), ("set-cookie", "first=1; Secure"),
            ("set-cookie", "second=2; Secure"), ("transfer-encoding", "chunked"),
        ])
    original_client = httpx.AsyncClient
    monkeypatch.setattr(clerk_proxy.httpx, "AsyncClient", lambda **kw: original_client(transport=httpx.MockTransport(handler), **kw))
    with TestClient(main.app) as client:
        response = client.post("/api/__clerk/v1/client?test=1", content=b"body", headers={
            "X-Forwarded-Host": "loop.example, internal.example",
            "X-Forwarded-Proto": "https", "Authorization": "must-not-be-forwarded",
            "Clerk-Secret-Key": "attacker-value",
        })
    assert response.status_code == 200 and response.json() == {"response": "ok"}
    assert response.headers["content-length"] == str(len(response.content))
    assert len(response.headers.get_list("set-cookie")) == 2
    assert "transfer-encoding" not in response.headers
    assert "synthetic-clerk-backend-secret" not in response.text
    assert seen[0].url.query == b"test=1"


def test_proxy_is_disabled_in_development_and_non_proxy_prefixes_require_auth(monkeypatch):
    monkeypatch.delenv("NODE_ENV", raising=False)
    with TestClient(main.app) as client:
        assert client.get("/api/__clerk/v1/client").status_code == 404
        assert client.get("/api/__clerk-forged/v1/client").status_code == 401
