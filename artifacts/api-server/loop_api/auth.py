"""Verify Clerk's same-origin session cookie without exposing tokens to browser code.

References: clerk.com/docs/guides/sessions/manual-jwt-verification
and the authenticated Clerk Backend API GET /v1/jwks.
"""
import asyncio
import base64
import hashlib
import os
import re
import time
from urllib.parse import urlsplit

import httpx
import jwt
from fastapi import HTTPException, Request

_jwks: dict = {}
_expires_at = 0.0
_fingerprint = ""
_last_attempt_at = 0.0
_lock = asyncio.Lock()


def public_host(request: Request) -> str:
    return (request.headers.get("x-forwarded-host") or request.headers.get("host", "")).split(",")[0].strip().lower()


def public_origin(request: Request) -> str:
    scheme = (request.headers.get("x-forwarded-proto") or request.url.scheme).split(",")[0].strip()
    if scheme not in ("http", "https"):
        raise HTTPException(401, "Invalid request origin.")
    return f"{scheme}://{public_host(request)}"


def expected_issuers(request: Request) -> list[str]:
    key = os.environ.get("CLERK_PUBLISHABLE_KEY", "")
    issuers = []
    try:
        encoded = key.split("_", 2)[2]
        domain = base64.b64decode(encoded + "=" * (-len(encoded) % 4)).decode().rstrip("$")
        if domain and re.fullmatch(r"[A-Za-z0-9.-]+", domain):
            issuers.append(f"https://{domain}")
    except (IndexError, ValueError, UnicodeError):
        pass
    # Managed production custom domains resolve their own publishable key.
    if os.environ.get("NODE_ENV") == "production":
        host = urlsplit(public_origin(request)).hostname
        if host:
            issuers.append(f"https://clerk.{host}")
    if not issuers:
        raise HTTPException(503, "Sign-in verification is not configured.")
    return issuers


async def get_jwks(force=False) -> dict:
    global _jwks, _expires_at, _fingerprint, _last_attempt_at
    secret = os.environ.get("CLERK_SECRET_KEY")
    if not secret:
        raise HTTPException(503, "Sign-in verification is not configured.")
    fingerprint = hashlib.sha256(secret.encode()).hexdigest()
    async with _lock:
        now = time.monotonic()
        if fingerprint != _fingerprint:
            _jwks, _expires_at, _last_attempt_at, _fingerprint = {}, 0, 0, fingerprint
        # Untrusted unknown kid values must not cause a backend request flood.
        if _jwks and _expires_at > now and (not force or now - _last_attempt_at < 30):
            return _jwks
        if now - _last_attempt_at < 5:
            raise HTTPException(503, "Sign-in could not be verified. Please try again.")
        _last_attempt_at = now
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://api.clerk.com/v1/jwks",
                    headers={"Authorization": f"Bearer {secret}"},
                )
                response.raise_for_status()
                data = response.json()
            if not isinstance(data.get("keys"), list) or not data["keys"]:
                raise ValueError("Missing signing keys")
        except (httpx.HTTPError, ValueError, TypeError):
            # Never fall back to accepting an unsigned/unverified request.
            raise HTTPException(503, "Sign-in could not be verified. Please try again.") from None
        _jwks, _expires_at = data, time.monotonic() + 300
        return data


async def authenticate_request(request: Request) -> str:
    token = request.cookies.get("__session")
    if not token or len(token) > 16384:
        raise HTTPException(401, "Sign in to access your private workspace.")
    try:
        header = jwt.get_unverified_header(token)
        if header.get("alg") != "RS256" or not isinstance(header.get("kid"), str):
            raise jwt.InvalidTokenError()
        keys = await get_jwks()
        key = next((k for k in keys["keys"] if k.get("kid") == header["kid"]), None)
        if key is None:
            # One refresh permits rotation; don't cache untrusted token content.
            keys = await get_jwks(force=True)
            key = next((k for k in keys["keys"] if k.get("kid") == header["kid"]), None)
        if key is None:
            raise jwt.InvalidTokenError()
        claims = jwt.decode(
            token, jwt.PyJWK.from_dict(key).key, algorithms=["RS256"],
            issuer=expected_issuers(request), leeway=5,
            options={"require": ["exp", "iat", "nbf", "iss", "sub", "sid"], "verify_aud": False},
        )
        owner = claims["sub"]
        if not isinstance(owner, str) or not re.fullmatch(r"user_[A-Za-z0-9_-]{1,240}", owner):
            raise jwt.InvalidTokenError()
        if claims.get("sts") == "pending" or not claims["sid"]:
            raise jwt.InvalidTokenError()
        origin = public_origin(request)
        if claims.get("azp") and claims["azp"] != origin:
            raise jwt.InvalidTokenError()
        # Independent CSRF boundary for browser state-changing requests.
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            submitted_origin = request.headers.get("origin")
            if submitted_origin and submitted_origin != origin:
                raise jwt.InvalidTokenError()
            if request.headers.get("sec-fetch-site") == "cross-site":
                raise jwt.InvalidTokenError()
        return owner
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise HTTPException(401, "Your sign-in session is invalid or expired. Please sign in again.") from None


def current_owner(request: Request) -> str:
    owner = getattr(request.state, "owner_id", None)
    if not owner:
        raise HTTPException(401, "Sign in to access your private workspace.")
    return owner
