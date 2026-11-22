"""Resolve ElevenLabs scoring and comparison versions without changing the agent."""
from fastapi import HTTPException


def evaluation_versions(client, item, ref):
    """Return the primary definition plus non-scoring comparison snapshots.

    Official AttachedUserEvaluationRef semantics: 'latest' tracks the published
    version; additional_version_ids run only for comparison, not scoring.
    """
    def resolve(version_id):
        return item.current_version_id if version_id in (None, "latest") else version_id

    primary_id = resolve(ref.version_id)
    comparison_ids = list(dict.fromkeys(
        resolve(version_id) for version_id in (ref.additional_version_ids or [])
        if resolve(version_id) != primary_id
    ))
    needed = {primary_id, *comparison_ids}
    definitions = {item.current_version_id: item.definition}
    cursor = None
    seen = set()
    while needed - definitions.keys():
        page = client.conversational_ai.analysis_items.list_versions(
            analysis_item_id=item.id, page_size=100, cursor=cursor,
        )
        for version in page.versions:
            if version.id in needed:
                definitions[version.id] = version.definition
        if not (needed - definitions.keys()):
            break
        if not page.has_more:
            raise HTTPException(502, "ElevenLabs did not return an evaluation version attached to this agent. No connection was saved.")
        cursor = page.next_cursor
        if not cursor or cursor in seen:
            raise HTTPException(502, "ElevenLabs returned an invalid evaluation-version cursor. No connection was saved.")
        seen.add(cursor)

    if any(definitions[version_id].kind != "evaluation" for version_id in needed):
        raise HTTPException(502, "An attached evaluation version has an unexpected type. No connection was saved.")
    comparisons = [{
        "version_id": version_id,
        "included_in_scoring": False,
        "definition": definitions[version_id].model_dump(mode="json", exclude_none=True),
    } for version_id in comparison_ids]
    return definitions[primary_id], primary_id, comparisons
