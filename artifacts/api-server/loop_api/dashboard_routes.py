from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.orm import Session

from .auth import current_owner
from .calls import owned_agent
from .database import get_session
from .dashboard_service import dashboard

router = APIRouter(prefix="/api/agents")


class ImpactMapping(BaseModel):
    model_config = ConfigDict(extra="forbid")
    criterionId: str = Field(min_length=1, max_length=1000)
    name: str = Field(max_length=1000)
    impact: Literal["Margin", "Trust", "Returns", "Conversion", "Experience"]


class ImpactMappingsInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    mappings: list[ImpactMapping] = Field(max_length=200)


@router.get("/{agent_id}/dashboard")
def get_dashboard(
    agent_id: UUID, bucket: Literal["hour", "day"] = "hour",
    timezone: str = Query(default="UTC", max_length=100),
    session: Session = Depends(get_session), owner: str = Depends(current_owner),
):
    return dashboard(session, owned_agent(session, agent_id, owner), bucket, timezone)


@router.put("/{agent_id}/impact-mappings", response_model=ImpactMappingsInput)
def update_impacts(agent_id: UUID, body: ImpactMappingsInput,
                   session: Session = Depends(get_session), owner: str = Depends(current_owner)):
    agent = owned_agent(session, agent_id, owner)
    allowed = {item["criterionId"] for item in dashboard(session, agent)["mappings"]}
    if any(m.criterionId not in allowed for m in body.mappings):
        raise HTTPException(400, "A criterion has changed. Refresh Settings before saving.")
    if len({m.criterionId for m in body.mappings}) != len(body.mappings):
        raise HTTPException(400, "Each criterion must have exactly one impact.")
    agent.impact_mappings = {**(agent.impact_mappings or {}), **{m.criterionId: m.impact for m in body.mappings}}
    session.commit()
    return body
