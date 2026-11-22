"""Criterion-level evidence, independent of the provider's overall call verdict."""


def criterion_breakdown(evaluations, criteria=(), completed=True):
    outcomes = {}
    for criterion in criteria:
        outcomes.setdefault(criterion.remote_id or f"local:{criterion.id}", [])
    for evaluation in evaluations:
        outcomes.setdefault(evaluation["criterionId"], []).append(evaluation["result"])
    counts = {"failedCriteriaCount": 0, "passedCriteriaCount": 0, "unknownCriteriaCount": 0}
    for values in outcomes.values():
        # Repeated versions count as one criterion, not extra failed criteria.
        # Partial analyses remain unknown until the provider finishes the call.
        verdict = (
            "failedCriteriaCount" if completed and "failure" in values else
            "passedCriteriaCount" if completed and values and all(v == "success" for v in values) else
            "unknownCriteriaCount"
        )
        counts[verdict] += 1
    return {"criteriaCount": len(outcomes), **counts}
