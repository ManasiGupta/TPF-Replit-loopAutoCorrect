import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Index
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Agent(Base):
    __tablename__ = "loop_agents"
    __table_args__ = (Index("uq_loop_agent_owner_remote", "owner_id", "remote_id", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Nullable only to preserve pre-auth records, never automatically claimed.
    owner_id: Mapped[str | None] = mapped_column(String(255), index=True, nullable=True)
    remote_id: Mapped[str] = mapped_column(String(200))
    name: Mapped[str] = mapped_column(Text)
    platform: Mapped[str] = mapped_column(String(30), default="ElevenLabs")
    encrypted_api_key: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=True, server_default="true")
    poll_minutes: Mapped[int] = mapped_column(Integer, default=1, server_default="1")
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_success_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    next_poll_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)
    poll_error: Mapped[str | None] = mapped_column(Text)
    impact_mappings: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")
    release_history: Mapped[list] = mapped_column(JSONB, default=list, server_default="[]")
    release_error: Mapped[str | None] = mapped_column(Text)
    criteria: Mapped[list["EvalCriterion"]] = relationship(back_populates="agent", cascade="all, delete-orphan", lazy="selectin", order_by="EvalCriterion.position")


class EvalCriterion(Base):
    __tablename__ = "loop_eval_criteria"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(ForeignKey("loop_agents.id", ondelete="CASCADE"), index=True)
    remote_id: Mapped[str | None] = mapped_column(Text)
    name: Mapped[str] = mapped_column(Text)
    text: Mapped[str] = mapped_column(Text)
    source: Mapped[str] = mapped_column(String(20))
    position: Mapped[int] = mapped_column(Integer)
    # Preserve scope/scoring/reference metadata for faithful later-phase use.
    provider_definition: Mapped[dict] = mapped_column(JSONB, default=dict)
    agent: Mapped[Agent] = relationship(back_populates="criteria")


class Conversation(Base):
    __tablename__ = "loop_conversations"
    __table_args__ = (
        Index("uq_loop_conversation_agent_remote", "agent_id", "remote_id", unique=True),
        Index("ix_loop_conversation_agent_started", "agent_id", "started_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    # Ownership is inherited from the private connection, never supplied by a client.
    agent_id: Mapped[str] = mapped_column(ForeignKey("loop_agents.id", ondelete="CASCADE"))
    remote_id: Mapped[str] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_secs: Mapped[int] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(30))
    result: Mapped[str] = mapped_column(String(20))
    source: Mapped[str] = mapped_column(String(20))
    environment: Mapped[str | None] = mapped_column(Text)
    version_id: Mapped[str | None] = mapped_column(Text)
    summary: Mapped[str | None] = mapped_column(Text)
    transcript: Mapped[list] = mapped_column(JSONB, default=list)
    evaluations: Mapped[list] = mapped_column(JSONB, default=list)
    provider_metadata: Mapped[dict] = mapped_column(JSONB, default=dict, server_default="{}")


class MonitoringIncident(Base):
    __tablename__ = "loop_monitoring_incidents"
    __table_args__ = (Index("uq_loop_incident_fingerprint", "agent_id", "fingerprint", unique=True),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    agent_id: Mapped[str] = mapped_column(ForeignKey("loop_agents.id", ondelete="CASCADE"), index=True)
    fingerprint: Mapped[str] = mapped_column(Text)
    title: Mapped[str] = mapped_column(Text)
    kind: Mapped[str] = mapped_column(String(30))
    state: Mapped[str] = mapped_column(String(20), default="open")
    first_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    detail: Mapped[str] = mapped_column(Text)
    call_ids: Mapped[list] = mapped_column(JSONB, default=list)
