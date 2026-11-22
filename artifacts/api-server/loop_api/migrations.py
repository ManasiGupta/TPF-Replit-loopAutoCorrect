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
        Base.metadata.create_all(connection)
