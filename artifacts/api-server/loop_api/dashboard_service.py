"""Actual conversation analytics, impact mappings, and persistent incident groups."""
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import HTTPException
from sqlalchemy import select

from .models import Conversation, MonitoringIncident
from .call_scoring import score_call, call_passed
from .monitoring import monitoring_state

IMPACTS = ("Margin", "Trust", "Returns", "Conversion", "Experience")


def impact_default(name):
    name = name.lower()
    for impact, terms in (
        ("Margin", ("coupon", "pricing", "price", "best deal", "discount", "margin")),
        ("Trust", ("sensitive", "safety", "privacy", "guardrail", "personal data")),
        ("Returns", ("sizing", "size", "fit", "return")),
        ("Conversion", ("silent", "cut-off", "cut off", "error", "task completion", "tool use")),
    ):
        if any(term in name for term in terms):
            return impact
    return "Experience"


def verdicts(call, criteria):
    grouped = {c.remote_id or f"local:{c.id}": [] for c in criteria}
    for result in call.evaluations:
        grouped.setdefault(result["criterionId"], []).append(result["result"])
    return {
        key: ("failure" if "failure" in values else "success" if values and all(v == "success" for v in values) else "unknown")
        if call.status in ("done", "failed") else "unknown"
        for key, values in grouped.items()
    }


def observations(session, agent):
    calls = list(session.scalars(select(Conversation).where(
        Conversation.agent_id == agent.id,
    ).order_by(Conversation.started_at.desc(), Conversation.id.desc())))
    return [(call, score_call(call, agent.criteria), verdicts(call, agent.criteria)) for call in calls]


def average(values):
    values = [v for v in values if v is not None]
    return sum(values) / len(values) if values else None


def conditions(data, now):
    """Rolling-hour alert conditions; unknown analyses never become successful."""
    recent = [r for r in data if now - timedelta(hours=1) <= r[0].started_at <= now]
    baseline = [r for r in data if now - timedelta(days=7) <= r[0].started_at < now - timedelta(hours=1)]
    complete = [r for r in recent if r[0].status in ("done", "failed")]
    errors = [r for r in complete if r[1]["outcome"] == "error"]
    alerts = []
    current_score = average(r[1]["score"] for r in recent)
    baseline_score = average(r[1]["score"] for r in baseline)
    if current_score is not None and baseline_score is not None and baseline_score - current_score >= 20:
        alerts.append(("score-drop", "Average score dropped",
                       f"Last hour {current_score:.1f}/100 versus {baseline_score:.1f}/100 over the preceding seven days (excluding this hour).",
                       [r[0].id for r in recent if r[1]["score"] is not None]))
    if complete and len(errors) / len(complete) > .1:
        alerts.append(("errors", "Error calls exceed 10%",
                       f"{len(errors)} of {len(complete)} completed calls in the last hour had errors.",
                       [r[0].id for r in errors]))
    failures = defaultdict(list)
    for call, _, results in recent:
        for criterion_id, result in results.items():
            if result == "failure":
                failures[criterion_id].append(call.id)
    for criterion_id, ids in failures.items():
        if len(ids) >= 3:
            alerts.append((f"criterion:{criterion_id}", "Repeated criterion failures",
                           f"This criterion failed on {len(ids)} calls in the last hour.", ids))
    return alerts


def refresh_incidents(session, agent, now):
    data = observations(session, agent)
    recent = [r for r in data if now - timedelta(days=7) <= r[0].started_at <= now]
    groups = {}
    names = {c.remote_id or f"local:{c.id}": c.name for c in agent.criteria}
    for call, score, results in recent:
        for result in call.evaluations:
            names.setdefault(result["criterionId"], result["name"])
        if score["outcome"] == "error":
            groups.setdefault("errors", ("Call errors", "error", []))[2].append(call)
        for criterion_id, value in results.items():
            if value == "failure":
                groups.setdefault(f"criterion:{criterion_id}", (names.get(criterion_id, criterion_id), "criterion", []))[2].append(call)
    active_alerts = conditions(data, now)
    score_drop = next((a for a in active_alerts if a[0] == "score-drop"), None)
    if score_drop:
        ids = set(score_drop[3])
        groups["score-drop"] = ("Average score dropped", "score_drop", [r[0] for r in recent if r[0].id in ids])
    existing = {i.fingerprint: i for i in session.scalars(select(MonitoringIncident).where(
        MonitoringIncident.agent_id == agent.id,
    ))}
    for fingerprint, (title, kind, calls) in groups.items():
        incident = existing.get(fingerprint)
        if incident is None:
            incident = MonitoringIncident(agent_id=agent.id, fingerprint=fingerprint,
                                          first_seen_at=min(c.started_at for c in calls))
            session.add(incident)
        incident.title, incident.kind, incident.state = title, kind, "open"
        incident.last_seen_at = max(c.started_at for c in calls)
        incident.resolved_at = None
        incident.call_ids = list(dict.fromkeys(c.id for c in calls))
        incident.detail = (score_drop[2] if fingerprint == "score-drop" else
                           f"{len(incident.call_ids)} affected calls in the rolling seven-day window. Automatically grouped from provider evidence.")
    for fingerprint, incident in existing.items():
        if fingerprint not in groups and incident.state == "open":
            incident.state, incident.resolved_at = "resolved", now
    session.flush()


def dashboard(session, agent, bucket="hour", timezone_name="UTC"):
    from .calls import serialize_call
    try:
        zone = ZoneInfo(timezone_name)
    except (ZoneInfoNotFoundError, ValueError):
        raise HTTPException(400, "Choose a valid IANA timezone.") from None
    now = datetime.now(timezone.utc)
    data = observations(session, agent)
    end = now.astimezone(zone).replace(minute=0, second=0, microsecond=0) if bucket == "hour" else now.astimezone(zone).replace(hour=0, minute=0, second=0, microsecond=0)
    # Hour buckets advance in UTC so DST repeated/skipped hours stay distinct.
    step = timedelta(hours=1) if bucket == "hour" else timedelta(days=1)
    periods = [end - step * n for n in reversed(range(24 if bucket == "hour" else 7))]
    if bucket == "hour":
        end = now.astimezone(zone).replace(minute=0, second=0, microsecond=0).astimezone(timezone.utc)
        periods = [end - step * n for n in reversed(range(24))]
    names = {c.remote_id or f"local:{c.id}": c.name for c in agent.criteria}
    for call, _, _ in data:
        for e in call.evaluations:
            names.setdefault(e["criterionId"], e["name"])
    mappings = [{"criterionId": key, "name": name,
                 "impact": (agent.impact_mappings or {}).get(key, impact_default(name))}
                for key, name in names.items()]
    impact_map = {m["criterionId"]: m["impact"] for m in mappings}
    impact_calls = {impact: set() for impact in IMPACTS}
    timeline, heatmap = [], {key: [] for key in names}
    for at in periods:
        group = [r for r in data if at <= r[0].started_at < at + step]
        timeline.append({"at": at.isoformat(), "score": average(r[1]["score"] for r in group),
                         "calls": len(group), "errorCalls": sum(r[1]["outcome"] == "error" for r in group)})
        for key in names:
            counts = {"success": 0, "failure": 0, "unknown": 0}
            ids = []
            for call, _, results in group:
                result = results.get(key, "unknown")
                counts[result] += 1
                if result == "failure":
                    ids.append(call.id)
            measured = counts["success"] + counts["failure"]
            heatmap[key].append({"at": at.isoformat(), "passRate": 100 * counts["success"] / measured if measured else None,
                                 "passed": counts["success"], "failed": counts["failure"],
                                 "unknown": counts["unknown"], "callIds": ids})
        for call, scored, results in group:
            for key, result in results.items():
                if result == "failure":
                    impact_calls[impact_map.get(key, "Experience")].add(call.id)
            if scored["outcome"] == "error":
                impact_calls["Conversion"].add(call.id)
            if scored["guardrails"] and (scored["outcome"] == "error" or "failure" in results.values() or call.result == "failed"):
                impact_calls["Trust"].add(call.id)
    historical = [r for r in data if r[0].started_at < now - timedelta(days=7)]

    def success_rate(rows):
        completed = [r for r in rows if r[0].status in ("done", "failed")]
        return 100 * sum(call_passed(r[0], r[1]) for r in completed) / len(completed) if completed else None

    def failed_criteria(rows):
        return len({key for _, _, results in rows for key, value in results.items() if value == "failure"})

    def metric(key, label, value, previous, unit, note):
        return {"key": key, "label": label, "value": value, "baseline": previous,
                "delta": value - previous if value is not None and previous is not None else None,
                "unit": unit, "note": note}

    metrics = [
        metric("success_rate", "Calls success rate", success_rate(data), success_rate(historical), "percent",
               "All completed calls; every criterion must pass. Errors and unknown results are not successes. Change versus the recorded rate as of seven days ago."),
        metric("total_criteria", "Total criteria", len(agent.criteria), None, "count",
               "Current configured criteria. Historical configuration counts are unavailable."),
        metric("total_calls", "Total calls", len(data), len(historical), "count",
               "All imported conversations, including production and test. Change versus the total as of seven days ago."),
        metric("failed_criteria", "Criteria with failures", failed_criteria(data), failed_criteria(historical), "count",
               "Distinct criteria with recorded failures, not failed calls. Change versus seven days ago."),
    ]
    incidents = list(session.scalars(select(MonitoringIncident).where(
        MonitoringIncident.agent_id == agent.id,
    ).order_by(MonitoringIncident.last_seen_at.desc())))
    incident_map = {i.fingerprint: i for i in incidents}
    alerts = [{"id": fingerprint, "title": title, "detail": detail,
               "incidentId": incident_map[fingerprint].id, "callIds": ids}
              for fingerprint, title, detail, ids in conditions(data, now) if fingerprint in incident_map and incident_map[fingerprint].state == "open"]
    versions = list(agent.release_history or [])
    first_observed = {}
    for call, _, _ in reversed(data):
        if call.version_id:
            first_observed.setdefault(call.version_id, call.started_at)
    versions.extend({"id": f"observed:{version}", "at": at.isoformat(), "version": version, "publisher": "Unknown",
                     "evidence": "First observed in an imported conversation; not a verified deployment time or shipper."}
                    for version, at in first_observed.items())
    return {
        "generatedAt": now.isoformat(), "timezone": timezone_name, "bucket": bucket,
        "periodStart": periods[0].isoformat(), "periodEnd": (end + step).isoformat(),
        "totalCalls": len(data), "metrics": metrics, "timeline": timeline,
        "heatmap": [{"criterionId": key, "name": names[key], "cells": cells} for key, cells in heatmap.items()],
        "impacts": [{"impact": impact, "failedCalls": len(ids), "callIds": sorted(ids)} for impact, ids in impact_calls.items()],
        "mappings": mappings, "calls": [serialize_call(call, criteria=agent.criteria) for call, _, _ in data],
        "alerts": alerts,
        "incidents": [{"id": i.id, "title": i.title, "kind": i.kind, "state": i.state,
                       "firstSeenAt": i.first_seen_at.isoformat(), "lastSeenAt": i.last_seen_at.isoformat(),
                       "detail": i.detail, "callIds": i.call_ids} for i in incidents],
        "versions": sorted(versions, key=lambda v: v["at"]),
        "versionNote": agent.release_error or "Provider deployment times are shown when available. Historical version/publisher are unknown unless explicitly recorded. First-observed version markers are not verified go-live times.",
        "monitoring": monitoring_state(agent),
        "scoreNote": "Score = distinct criteria passed / configured or reported criteria. Unknown criteria remain in the denominator. Errors, unfinished calls and calls without measured analysis have no score. Heatmap pass rates use known success/failure results; unknown counts are shown separately.",
    }
