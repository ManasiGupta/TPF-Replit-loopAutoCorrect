"""Explicitly export an approved, frozen demo; never include connection secrets.

Run with PYTHONPATH=artifacts/api-server. This reads only PostgreSQL, never the
provider, and never changes the private connection. Sharing is opt-in per export.
"""
import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session, load_only

from loop_api.calls import measured_stats, serialize_call
from loop_api.database import get_engine
from loop_api.models import Agent, Conversation
from loop_api.schemas import CallDetail, Criterion


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--agent-id", required=True, type=UUID)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--approve-sharing-original-content", action="store_true")
    args = parser.parse_args()
    if not args.approve_sharing_original_content:
        parser.error("Original criteria, transcripts and rationales require explicit sharing approval.")

    with Session(get_engine()) as session:
        # Whitelist columns; even loading a connection key is unnecessary here.
        agent = session.scalar(
            select(Agent).where(Agent.id == str(args.agent_id), Agent.owner_id.is_not(None))
            .options(load_only(
                Agent.id, Agent.name, Agent.remote_id, Agent.platform, Agent.created_at,
                raiseload=True,
            ))
        )
        if agent is None:
            parser.error("The selected private connection was not found.")
        stats = measured_stats(session, agent, detail=True)
        criteria = [
            Criterion.model_validate(criterion).model_dump()
            for criterion in stats["criteria"]
        ]
        calls = [
            CallDetail.model_validate(serialize_call(call, detail=True, criteria=agent.criteria)).model_dump()
            for call in session.scalars(
                select(Conversation).where(Conversation.agent_id == agent.id)
                .order_by(Conversation.started_at.desc(), Conversation.id.desc())
            )
        ]
        snapshot = {
            "capturedAt": datetime.now(timezone.utc).isoformat(),
            "agent": {
                "name": agent.name, "remoteId": agent.remote_id,
                "platform": agent.platform, "createdAt": agent.created_at.isoformat(),
                "criteriaCount": len(criteria),
                "failedCriteriaCount": stats["failedCriteriaCount"],
                "criteria": criteria,
            },
            "calls": calls,
        }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(snapshot, ensure_ascii=False, indent=2) + "\n")
    # Do not print any original content, identifiers, or connection credentials.
    print(f"Exported approved snapshot: {len(criteria)} criteria, {len(calls)} calls.")


if __name__ == "__main__":
    main()
