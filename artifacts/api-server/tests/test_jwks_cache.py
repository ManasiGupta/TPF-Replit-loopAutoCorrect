import asyncio
import time

import httpx
import pytest
from fastapi import HTTPException

from loop_api import auth


@pytest.mark.parametrize("unavailable", [False, True])
def test_unknown_signing_keys_and_outages_cannot_flood_clerk(monkeypatch, unavailable):
    monkeypatch.setenv("CLERK_SECRET_KEY", "synthetic-signing-key-test")
    monkeypatch.setattr(auth, "_fingerprint", "")
    monkeypatch.setattr(auth, "_jwks", {})
    monkeypatch.setattr(auth, "_expires_at", 0)
    monkeypatch.setattr(auth, "_last_attempt_at", 0)
    calls = []
    class Client:
        def __init__(self, **kwargs):
            pass
        async def __aenter__(self):
            return self
        async def __aexit__(self, *args):
            pass
        async def get(self, url, headers):
            calls.append(url)
            return httpx.Response(503 if unavailable else 200,
                                  json={"keys": [{"kid": "trusted"}]},
                                  request=httpx.Request("GET", url))
    monkeypatch.setattr(auth.httpx, "AsyncClient", Client)
    async def exercise():
        for _ in range(3):
            if unavailable:
                with pytest.raises(HTTPException) as error:
                    await auth.get_jwks(force=True)
                assert error.value.status_code == 503
            else:
                assert (await auth.get_jwks(force=True))["keys"][0]["kid"] == "trusted"
        assert len(calls) == 1
        # A secret/tenant change must never reuse the previous tenant's keys.
        monkeypatch.setenv("CLERK_SECRET_KEY", "synthetic-replacement")
        if unavailable:
            with pytest.raises(HTTPException):
                await auth.get_jwks()
            assert auth._jwks == {}
        else:
            await auth.get_jwks()
        assert len(calls) == 2
    asyncio.run(exercise())
