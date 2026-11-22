"""Group recorded failures by criterion; do not invent diagnoses or evaluations."""
from fastapi import HTTPException
from sqlalchemy import column, distinct, func, select, true
from sqlalchemy.dialects.postgresql import JSONB

from .models import Conversation


def criterion_label(name):
    """Make provider identifiers readable without inventing a diagnosis."""
    label = name.removeprefix("__system_eval_criteria_").replace("_", " ").strip()
    return label[:1].upper() + label[1:]


def category_filter(category):
    if category == "all":
        return true()
    if category in ("unknown", "passed"):
        return Conversation.result == category
    if category == "other-failure":
        return (Conversation.result == "failed") & ~Conversation.evaluations.contains([{"result": "failure"}])
    if category.startswith("criterion:") and category.removeprefix("criterion:"):
        return Conversation.status.in_(["done", "failed"]) & Conversation.evaluations.contains([{
            "criterionId": category.removeprefix("criterion:"), "result": "failure",
        }])
    raise HTTPException(422, "Choose a valid conversation category.")


def conversation_categories(session, agent, source):
    filters = [Conversation.agent_id == agent.id]
    if source != "all":
        filters.append(Conversation.source == source)
    totals = dict(session.execute(
        select(Conversation.result, func.count()).where(*filters).group_by(Conversation.result)
    ).all())
    categories = [{"id": "all", "name": "All conversations", "count": sum(totals.values())}]

    # Expand just evaluation JSON in PostgreSQL, not transcripts, and count each
    # conversation only once even when multiple versions failed the same criterion.
    evaluation = func.jsonb_array_elements(Conversation.evaluations).table_valued(
        column("value", JSONB),
    ).lateral()
    criterion_id = evaluation.c.value["criterionId"].astext
    names = {criterion.remote_id: criterion.name for criterion in agent.criteria if criterion.remote_id}
    rows = session.execute(
        select(criterion_id, func.max(evaluation.c.value["name"].astext),
               func.count(distinct(Conversation.id)))
        .select_from(Conversation).join(evaluation, true())
        .where(*filters, Conversation.status.in_(["done", "failed"]),
               evaluation.c.value["result"].astext == "failure")
        .group_by(criterion_id).order_by(func.count(distinct(Conversation.id)).desc(), criterion_id)
    )
    for remote_id, stored_name, count in rows:
        categories.append({
            "id": f"criterion:{remote_id}",
            "name": criterion_label(names.get(remote_id) or stored_name or remote_id),
            "count": count,
        })
    other = session.scalar(select(func.count()).select_from(Conversation).where(
        *filters, category_filter("other-failure"),
    ))
    if other:
        categories.append({"id": "other-failure", "name": "Other reported failure", "count": other})
    categories.extend([
        {"id": "unknown", "name": "Not evaluated / unknown", "count": totals.get("unknown", 0)},
        {"id": "passed", "name": "Passed", "count": totals.get("passed", 0)},
    ])
    return categories
