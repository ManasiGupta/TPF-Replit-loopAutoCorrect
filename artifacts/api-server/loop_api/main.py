import logging
import asyncio
import os
from contextlib import asynccontextmanager
from uuid import UUID

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy import select, text
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session
from starlette.exceptions import HTTPException as StarletteHTTPException

from .database import get_engine, get_session
from .models import Agent, EvalCriterion
from .provider import discover, load_agent
from .schemas import AgentDetail, AgentPreview, AgentSelection, AgentSummary, ConnectionInput, CredentialInput, RemoteAgent, Setup
from .security import encrypt_api_key, get_cipher
from .auth import authenticate_request, current_owner
from .clerk_proxy import router as clerk_router
from .calls import router as calls_router, measured_stats
from .monitoring import monitor_loop, monitoring_state
from .request_validation import CONNECTION_PATHS, connection_validation

logger = logging.getLogger("loop")


@asynccontextmanager
async def lifespan(app):
    stop = asyncio.Event()
    worker = None
    if os.environ.get("LOOP_MONITORING_DISABLED") != "1":
        worker = asyncio.create_task(monitor_loop(stop))
    yield
    stop.set()
    if worker:
        await worker


app = FastAPI(title="Loop API", docs_url="/api/docs", openapi_url="/api/openapi.json", redoc_url=None, lifespan=lifespan)
app.include_router(clerk_router)
app.include_router(calls_router)


@app.middleware("http")
async def secure_responses(request: Request, call_next):
    # No request-body logging, and no browser/proxy caching of connection responses.
    if request.url.path.startswith("/api") and request.url.path != "/api/healthz" and not (
        request.url.path == "/api/__clerk" or request.url.path.startswith("/api/__clerk/")
    ):
        try:
            request.state.owner_id = await authenticate_request(request)
        except HTTPException as error:
            response = JSONResponse({"error": error.detail}, status_code=error.status_code)
        else:
            response = await call_next(request)
    else:
        response = await call_next(request)
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    return response


@app.exception_handler(StarletteHTTPException)
async def http_error(request, error):
    return JSONResponse({"error": error.detail}, status_code=error.status_code)


@app.exception_handler(RequestValidationError)
async def invalid_request(request, error):
    # FastAPI's default error includes the submitted input, including secret values.
    if request.url.path in CONNECTION_PATHS:
        message, issues = connection_validation(error.errors())
        logger.warning(
            "Connection validation rejected: stage=%s issues=%s",
            CONNECTION_PATHS[request.url.path], issues,
        )
        return JSONResponse({"error": message}, status_code=422)
    return JSONResponse({"error": "Invalid request. Check the API key, agent selection, and criteria."}, status_code=422)


@app.exception_handler(SQLAlchemyError)
async def database_error(request, error):
    logger.error("Database operation failed (%s)", type(error).__name__)
    return JSONResponse({"error": "Database operation failed. No connection was saved. Please try again."}, status_code=503)


@app.exception_handler(Exception)
async def unexpected_error(request, error):
    # Never log the exception body: provider exceptions may contain request secrets.
    logger.error("Request failed (%s)", type(error).__name__)
    return JSONResponse({"error": "The request could not be completed. Please try again."}, status_code=500)


def warning(count: int) -> str | None:
    return f"This agent has {count} of 30 evaluation criteria. ElevenLabs allows at most 30." if count >= 25 else None


def serialize(agent: Agent, detail=False, session=None) -> dict:
    result = {
        "id": agent.id, "remoteId": agent.remote_id, "name": agent.name, "platform": agent.platform,
        "createdAt": agent.created_at.isoformat(), "criteriaCount": len(agent.criteria), "passRate": None,
        "openFailures": None, "status": "monitoring" if agent.monitoring_enabled else "paused", "keyMasked": "••••••••••••",
    }
    if detail:
        result.update(criteria=[{"id": c.id, "name": c.name, "text": c.text, "source": c.source, "passed": 0, "failed": 0, "unknown": 0} for c in agent.criteria], warning=warning(len(agent.criteria)), monitoring=monitoring_state(agent))
    if session:
        result.update(measured_stats(session, agent, detail))
    return result


@app.get("/api/healthz")
def health():
    return {"status": "ok"}


@app.get("/api/setup", response_model=Setup)
def setup():
    database_ready = False
    messages = []
    try:
        with get_engine().connect() as connection:
            connection.execute(text("SELECT id, owner_id, poll_minutes, next_poll_at FROM loop_agents LIMIT 0"))
            connection.execute(text("SELECT id FROM loop_eval_criteria LIMIT 0"))
            connection.execute(text("SELECT id FROM loop_conversations LIMIT 0"))
        database_ready = True
    except (SQLAlchemyError, RuntimeError):
        messages.append("Database schema is not ready.")
    encryption_ready = False
    try:
        get_cipher()
        encryption_ready = True
    except HTTPException as error:
        messages.append(error.detail)
    return {"databaseReady": database_ready, "encryptionReady": encryption_ready, "message": " ".join(messages) or "Ready to connect your ElevenLabs agents securely."}


@app.post("/api/connections/discover", response_model=list[RemoteAgent])
def discover_agents(body: CredentialInput):
    return discover(body.apiKey.get_secret_value())


@app.post("/api/connections/preview", response_model=AgentPreview)
def preview_agent(body: AgentSelection):
    name, criteria = load_agent(body.apiKey.get_secret_value(), body.remoteId)
    return {
        "remoteId": body.remoteId, "name": name, "warning": warning(len(criteria)),
        "criteria": [{"id": c["remote_id"], "name": c["name"], "text": c["text"], "source": "imported", "passed": 0, "failed": 0, "unknown": 0} for c in criteria],
    }


@app.get("/api/agents", response_model=list[AgentSummary])
def list_agents(session: Session = Depends(get_session), owner: str = Depends(current_owner)):
    return [serialize(agent, session=session) for agent in session.scalars(select(Agent).where(Agent.owner_id == owner).order_by(Agent.created_at.desc())).all()]


@app.post("/api/agents", response_model=AgentDetail, status_code=201)
def connect_agent(body: ConnectionInput, session: Session = Depends(get_session), owner: str = Depends(current_owner)):
    ciphertext = encrypt_api_key(body.apiKey.get_secret_value())
    if session.scalar(select(Agent.id).where(Agent.owner_id == owner, Agent.remote_id == body.remoteId)):
        raise HTTPException(409, "This agent is already connected. Open it from your Agents list.")
    # Re-fetch on save: never trust browser-submitted provider names or criteria.
    name, criteria = load_agent(body.apiKey.get_secret_value(), body.remoteId)
    if len(criteria) + len(body.userCriteria) > 30:
        raise HTTPException(422, "An agent can have at most 30 evaluation criteria, including imported and additional criteria.")
    agent = Agent(owner_id=owner, remote_id=body.remoteId, name=name, encrypted_api_key=ciphertext)
    for index, criterion in enumerate(criteria):
        agent.criteria.append(EvalCriterion(remote_id=criterion["remote_id"], name=criterion["name"], text=criterion["text"], source="imported", position=index, provider_definition=criterion["definition"]))
    for index, criterion in enumerate(body.userCriteria, start=len(criteria)):
        agent.criteria.append(EvalCriterion(name=criterion[:80], text=criterion, source="user", position=index, provider_definition={}))
    session.add(agent)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, "This agent was already connected. Refresh the Agents list.") from None
    session.refresh(agent)
    return serialize(agent, detail=True, session=session)


@app.get("/api/agents/{agent_id}", response_model=AgentDetail)
def get_agent(agent_id: UUID, session: Session = Depends(get_session), owner: str = Depends(current_owner)):
    agent = session.scalar(select(Agent).where(Agent.id == str(agent_id), Agent.owner_id == owner))
    if agent is None:
        raise HTTPException(404, "Connected agent not found.")
    return serialize(agent, detail=True, session=session)
