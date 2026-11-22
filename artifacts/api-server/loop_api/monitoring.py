"""Durable per-connection polling, serialized by PostgreSQL row locks."""
import asyncio
import logging
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from sqlalchemy import or_, select
from sqlalchemy.orm import Session, lazyload

from .database import get_engine
from .models import Agent, Conversation
from .provider import recent_conversations
from .security import decrypt_api_key

logger = logging.getLogger("loop")


def utcnow():
    return datetime.now(timezone.utc)


def monitoring_state(agent: Agent) -> dict:
    def iso(value):
        return value.isoformat() if value else None
    return {
        "enabled": agent.monitoring_enabled, "pollMinutes": agent.poll_minutes,
        "lastAttemptAt": iso(agent.last_attempt_at), "lastSuccessAt": iso(agent.last_success_at),
        "nextPollAt": iso(agent.next_poll_at), "lastError": agent.poll_error,
    }


def locked_agent(session, agent_id, owner=None):
    query = select(Agent).options(lazyload(Agent.criteria)).where(Agent.id == agent_id)
    if owner is not None:
        query = query.where(Agent.owner_id == owner)
    # SKIP LOCKED makes manual and background polls safe across workers.
    return session.scalar(query.with_for_update(skip_locked=True).execution_options(populate_existing=True))


def poll_locked(session: Session, agent: Agent):
    """Caller owns the row lock until commit, including throughout provider I/O."""
    now = utcnow()
    if not agent.monitoring_enabled or (agent.next_poll_at and agent.next_poll_at > now):
        return
    error = None
    try:
        # One atomic savepoint: provider failure cannot commit partial pages.
        with session.begin_nested():
            key = decrypt_api_key(agent.encrypted_api_key)
            since = int((agent.last_success_at - timedelta(days=1) if agent.last_success_at else now - timedelta(days=7)).timestamp())
            pending = list(session.scalars(select(Conversation.remote_id).where(
                Conversation.agent_id == agent.id,
                or_(Conversation.status.in_(["initiated", "in-progress", "processing"]),
                    Conversation.result == "unknown"),
            )))
            names = {criterion.remote_id: criterion.name for criterion in agent.criteria if criterion.remote_id}
            for data in recent_conversations(key, agent.remote_id, since, pending):
                row = session.scalar(select(Conversation).where(
                    Conversation.agent_id == agent.id, Conversation.remote_id == data["remote_id"],
                ))
                if row is None:
                    row = Conversation(agent_id=agent.id)
                    session.add(row)
                for evaluation in data["evaluations"]:
                    evaluation["name"] = names.get(evaluation["criterionId"], evaluation["criterionId"])
                for field, value in data.items():
                    setattr(row, field, value)
            # Force validation/constraints before recording a successful poll.
            session.flush()
    except HTTPException as exc:
        # Only our sanitized errors are persisted, never SDK bodies or credentials.
        error = exc.detail
    except Exception as exc:
        logger.warning("Conversation poll failed (%s)", type(exc).__name__)
        error = "Call monitoring could not finish. No partial poll was saved; it will retry at the next interval."
    agent.last_attempt_at = now
    agent.next_poll_at = utcnow() + timedelta(minutes=agent.poll_minutes)
    agent.poll_error = error
    if error is None:
        agent.last_success_at = now
    session.commit()


def poll_due_agents():
    # Each agent has its own transaction. One broken connection cannot roll back
    # another owner's calls. Skip legacy/unclaimed credentials entirely.
    with Session(get_engine()) as session:
        ids = list(session.scalars(select(Agent.id).where(
            Agent.owner_id.is_not(None), Agent.monitoring_enabled.is_(True),
            or_(Agent.next_poll_at.is_(None), Agent.next_poll_at <= utcnow()),
        ).order_by(Agent.next_poll_at.asc().nullsfirst(), Agent.id)))
    for agent_id in ids:
        try:
            with Session(get_engine()) as session:
                agent = locked_agent(session, agent_id)
                if agent and agent.owner_id:
                    poll_locked(session, agent)
        except Exception as exc:
            # No exception bodies: even database errors may carry private input.
            logger.warning("Monitoring transaction failed (%s)", type(exc).__name__)


async def monitor_loop(stop: asyncio.Event):
    while not stop.is_set():
        try:
            await asyncio.to_thread(poll_due_agents)
        except Exception as exc:
            logger.warning("Monitoring scan unavailable (%s)", type(exc).__name__)
        try:
            await asyncio.wait_for(stop.wait(), timeout=10)
        except TimeoutError:
            pass
