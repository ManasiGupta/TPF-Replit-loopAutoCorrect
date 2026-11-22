"""FastAPI equivalent of the canonical managed Clerk production proxy.

Do not forward browser auth headers or expose the app secret to the response.
Buffer responses to provide Content-Length (required by the publishing edge).
"""
import os

import httpx
from fastapi import APIRouter, Request
from starlette.responses import Response

from .auth import public_origin

router = APIRouter()
HOP_HEADERS = {"connection", "keep-alive", "transfer-encoding", "te", "trailer", "upgrade", "proxy-authenticate", "proxy-authorization"}


@router.api_route("/api/__clerk{path:path}", methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"])
async def clerk_proxy(request: Request, path: str):
    secret = os.environ.get("CLERK_SECRET_KEY")
    if os.environ.get("NODE_ENV") != "production" or not secret:
        return Response(status_code=404)
    # Match the canonical template: constant upstream, never a URL from input.
    target = f"https://frontend-api.clerk.dev/{path.lstrip('/')}"
    if request.url.query:
        target += "?" + request.url.query
    excluded = HOP_HEADERS | {"host", "content-length", "authorization", "clerk-secret-key", "clerk-proxy-url"}
    headers = {k: v for k, v in request.headers.items() if k.lower() not in excluded}
    headers["Clerk-Proxy-Url"] = public_origin(request) + "/api/__clerk"
    headers["Clerk-Secret-Key"] = secret
    forwarded = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
    if forwarded:
        headers["X-Forwarded-For"] = forwarded
    try:
        async with httpx.AsyncClient(timeout=30, follow_redirects=False) as client:
            upstream = await client.send(client.build_request(
                request.method, target, headers=headers, content=await request.body(),
            ), stream=True)
            # Preserve wire encoding, including compressed JS assets.
            body = b"".join([chunk async for chunk in upstream.aiter_raw()])
            await upstream.aclose()
        response = Response(content=body, status_code=upstream.status_code)
        raw_headers = [
            (k, v) for k, v in upstream.headers.raw
            if k.decode().lower() not in HOP_HEADERS | {"content-length"}
        ]
        if upstream.status_code not in (204, 304) and request.method != "HEAD":
            raw_headers.append((b"content-length", str(len(body)).encode()))
        response.raw_headers = raw_headers
        return response
    except httpx.HTTPError:
        return Response(status_code=502, content=b"", headers={"Content-Length": "0"})
