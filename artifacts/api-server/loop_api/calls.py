"""Private, read-only access to saved provider call evidence."""
from uuid import UUID
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .auth import current_owner
from .database import get_session
from .models import Agent, Conversation
from .monitoring import locked_agent, monitoring_state, poll_locked, utcnow
from .schemas import CallDetail, CallPage, Monitoring, MonitoringInput

router = APIRouter(prefix="/api/agents")


def owned_agent(session, agent_id, owner):
    agent = session.scalar(select(Agent).where(Agent.id == str(agent_id), Agent.owner_id == owner))
    if agent is None:
        raise HTTPException(404, "Connected agent not found.")
    return agent


def serialize_call(call: Conversation, detail=False, criteria=()):
    data = {
        "id": call.id, "conversationId": call.remote_id, "startedAt": call.started_at.isoformat(),
        "durationSecs": call.duration_secs, "status": call.status, "result": call.result,
        "source": call.source, "versionId": call.version_id, "summary": call.summary,
        "evaluationCount": len(call.evaluations),
    }
    if detail:
        evaluations = list(call.evaluations)
        measured = {item["criterionId"] for item in evaluations}
        for criterion in criteria:
            if criterion.remote_id not in measured or criterion.remote_id is None:
                evaluations.append({
                    "criterionId": criterion.remote_id or criterion.id, "name": criterion.name,
                    "result": "unknown", "score": None, "maxScore": None,
                    "rationale": "This criterion was added in Loop and has not been evaluated by ElevenLabs." if criterion.source == "user" else "ElevenLabs did not return a result for this saved criterion.",
                })
        data.update(transcript=call.transcript, evaluations=evaluations, environment=call.environment)
    return data


@router.patch("/{agent_id}/monitoring", response_model=Monitoring)
def update_monitoring(agent_id: UUID, body: MonitoringInput, session: Session = Depends(get_session), owner: str = Depends(current_owner)):
    owned_agent(session, agent_id, owner)
    agent = locked_agent(session, str(agent_id), owner)
    if agent is None:
        raise HTTPException(409, "A poll is running. Try saving the settings again shortly.")
    agent.monitoring_enabled = body.enabled
    agent.poll_minutes = body.pollMinutes
    agent.next_poll_at = utcnow() if body.enabled else None
    session.commit()
    return monitoring_state(agent)


@router.post("/{agent_id}/poll", response_model=Monitoring)
def poll_agent(agent_id: UUID, session: Session = Depends(get_session), owner: str = Depends(current_owner)):
    owned_agent(session, agent_id, owner)
    agent = locked_agent(session, str(agent_id), owner)
    if agent is None:
        raise HTTPException(409, "A poll is already running. Refresh shortly for its result.")
    poll_locked(session, agent)
    return monitoring_state(agent)


@router.get("/{agent_id}/calls", response_model=CallPage)
def list_calls(
    agent_id: UUID,
    result: Literal["all", "passed", "failed", "unknown"] = "all",
    source: Literal["all", "production", "test", "unknown"] = "all",
    offset: int = Query(default=0, ge=0), limit: int = Query(default=30, ge=1, le=100),
    session: Session = Depends(get_session), owner: str = Depends(current_owner),
):
    agent = owned_agent(session, agent_id, owner)
    filters = [Conversation.agent_id == agent.id]
    if result != "all":
        filters.append(Conversation.result == result)
    if source != "all":
        filters.append(Conversation.source == source)
    total = session.scalar(select(func.count()).select_from(Conversation).where(*filters))
    rows = session.scalars(select(Conversation).where(*filters).order_by(
        Conversation.started_at.desc(), Conversation.id.desc(),
    ).offset(offset).limit(limit))
    return {"items": [serialize_call(row) for row in rows], "total": total,
            "offset": offset, "limit": limit, "monitoring": monitoring_state(agent)}


@router.get("/{agent_id}/calls/{call_id}", response_model=CallDetail)
def get_call(agent_id: UUID, call_id: UUID, session: Session = Depends(get_session), owner: str = Depends(current_owner)):
    agent = owned_agent(session, agent_id, owner)
    row = session.scalar(select(Conversation).where(Conversation.id == str(call_id), Conversation.agent_id == agent.id))
    if row is None:
        raise HTTPException(404, "Call not found.")
    return serialize_call(row, detail=True, criteria=agent.criteria)


def measured_stats(session, agent: Agent, detail=False):
    groups = dict(session.execute(select(Conversation.result, func.count()).where(
        Conversation.agent_id == agent.id, Conversation.source == "production",
    ).group_by(Conversation.result)).all())
    measured = groups.get("passed", 0) + groups.get("failed", 0)
    stats = {
        "passRate": 100 * groups.get("passed", 0) / measured if measured else None,
        # Clusters aren't built in this phase; this is a failed-call count.
        "openFailures": groups.get("failed", 0) if groups else None,
    }
    if detail:
        counts = {criterion.remote_id: {"success": 0, "failure": 0, "unknown": 0} for criterion in agent.criteria if criterion.remote_id}
        total = 0
        for results in session.scalars(select(Conversation.evaluations).where(
            Conversation.agent_id == agent.id, Conversation.source == "production",
            Conversation.status.in_(["done", "failed"]),
        )):
            total += 1
            # Multiple versions of a criterion still count as a single call:
            # any failure wins; otherwise unknown wins over success.
            for criterion_id, tally in counts.items():
                outcomes = [r["result"] for r in results if r["criterionId"] == criterion_id]
                verdict = "failure" if "failure" in outcomes else "success" if outcomes and all(r == "success" for r in outcomes) else "unknown"
                tally[verdict] += 1
        stats["criteria"] = [{
            "id": c.id, "name": c.name, "text": c.text, "source": c.source,
            "passed": counts.get(c.remote_id, {}).get("success", 0),
            "failed": counts.get(c.remote_id, {}).get("failure", 0),
            "unknown": counts.get(c.remote_id, {}).get("unknown", total),
        } for c in agent.criteria]
    return stats
