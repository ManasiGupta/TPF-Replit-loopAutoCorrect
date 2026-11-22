"""Measured criterion scoring; transport/runtime errors never become successes."""
from .criterion_metrics import criterion_breakdown


def score_call(call, criteria=()):
    counts = criterion_breakdown(call.evaluations, criteria, completed=call.status in ("done", "failed"))
    metadata = call.provider_metadata or {}
    errors = list(metadata.get("errorReasons", []))
    complete = call.status in ("done", "failed")
    if call.status == "failed" and not errors:
        errors.append("ElevenLabs reported a call error.")
    if complete and not any(t.get("role") == "agent" and (t.get("text") or "").strip() for t in call.transcript):
        errors.append("No agent reply was recorded.")
    for turn in call.transcript:
        if complete and turn.get("interrupted") and "An agent reply was cut off." not in errors:
            errors.append("An agent reply was cut off.")
    measured = counts["passedCriteriaCount"] + counts["failedCriteriaCount"]
    score = 100 * counts["passedCriteriaCount"] / counts["criteriaCount"] if complete and measured and counts["criteriaCount"] and not errors else None
    outcome = "error" if errors else "analyzing" if not complete else "scored" if score is not None else "unknown"
    return {
        **counts, "score": score, "outcome": outcome, "errorReasons": errors,
        "title": metadata.get("title") or next((t["text"][:100] for t in call.transcript if t.get("role") == "user" and t.get("text")), None) or (call.summary or "Conversation")[:100],
        "messageCount": metadata.get("messageCount", sum(bool(t.get("text")) for t in call.transcript)),
        "language": metadata.get("language"),
        "guardrails": metadata.get("guardrails", []),
        "failedTurnIndexes": metadata.get("failedTurnIndexes", []),
    }


def call_passed(call, scored):
    return scored["outcome"] == "scored" and scored["score"] == 100 and call.result != "failed"
