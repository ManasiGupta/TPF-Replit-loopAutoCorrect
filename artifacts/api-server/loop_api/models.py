import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .database import Base


class Agent(Base):
    __tablename__ = "loop_agents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    remote_id: Mapped[str] = mapped_column(String(200), unique=True)
    name: Mapped[str] = mapped_column(Text)
    platform: Mapped[str] = mapped_column(String(30), default="ElevenLabs")
    encrypted_api_key: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
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
