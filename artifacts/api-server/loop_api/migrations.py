"""Additive ownership migration; legacy records deliberately remain unclaimed."""
from sqlalchemy import inspect, text

from .database import Base
from . import models  # noqa: F401; register tables for standalone migrations


def apply_schema(engine):
    with engine.begin() as connection:
        if inspect(connection).has_table("loop_agents"):
            connection.execute(text("ALTER TABLE loop_agents ADD COLUMN IF NOT EXISTS owner_id VARCHAR(255)"))
            # Originally remote_id was globally unique. Different owners may
            # connect the same provider agent using their own credentials.
            for constraint in inspect(connection).get_unique_constraints("loop_agents"):
                if constraint["column_names"] == ["remote_id"]:
                    name = connection.dialect.identifier_preparer.quote(constraint["name"])
                    connection.execute(text(f"ALTER TABLE loop_agents DROP CONSTRAINT {name}"))
            connection.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_loop_agent_owner_remote ON loop_agents (owner_id, remote_id)"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_loop_agents_owner_id ON loop_agents (owner_id)"))
            for definition in (
                "monitoring_enabled BOOLEAN NOT NULL DEFAULT true",
                "poll_minutes INTEGER NOT NULL DEFAULT 5",
                "last_attempt_at TIMESTAMPTZ",
                "last_success_at TIMESTAMPTZ",
                "next_poll_at TIMESTAMPTZ",
                "poll_error TEXT",
            ):
                connection.execute(text(f"ALTER TABLE loop_agents ADD COLUMN IF NOT EXISTS {definition}"))
            connection.execute(text("CREATE INDEX IF NOT EXISTS ix_loop_agents_next_poll_at ON loop_agents (next_poll_at)"))
            for definition in (
                "impact_mappings JSONB NOT NULL DEFAULT '{}'",
                "release_history JSONB NOT NULL DEFAULT '[]'",
                "release_error TEXT",
            ):
                connection.execute(text(f"ALTER TABLE loop_agents ADD COLUMN IF NOT EXISTS {definition}"))
            connection.execute(text("ALTER TABLE loop_agents ALTER COLUMN poll_minutes SET DEFAULT 1"))
            connection.execute(text("UPDATE loop_agents SET poll_minutes = 1 WHERE poll_minutes <> 1"))
        if inspect(connection).has_table("loop_conversations"):
            connection.execute(text("ALTER TABLE loop_conversations ADD COLUMN IF NOT EXISTS provider_metadata JSONB NOT NULL DEFAULT '{}'"))
        Base.metadata.create_all(connection)
