"""Safe connection-validation diagnostics. Never inspect or return input values."""

CONNECTION_PATHS = {
    "/api/connections/discover": "discovery",
    "/api/connections/preview": "preview",
    "/api/agents": "save",
}
SAFE_FIELDS = {"apiKey", "remoteId", "userCriteria"}
SAFE_TYPES = {
    "missing", "json_invalid", "model_attributes_type", "model_type",
    "string_type", "string_too_short", "string_too_long",
    "too_short", "too_long", "extra_forbidden", "value_error",
}


def connection_validation(errors: list[dict]) -> tuple[str, list[dict[str, str]]]:
    # Do not include Pydantic's input, msg, ctx or arbitrary field names: each
    # may contain the submitted credential, even when SecretStr is used.
    issues = []
    for error in errors:
        loc = error.get("loc", ())
        field = loc[1] if len(loc) > 1 and loc[1] in SAFE_FIELDS else "body"
        kind = error.get("type", "")
        issues.append({"field": field, "type": kind if kind in SAFE_TYPES else "invalid"})

    if any(i["type"] == "json_invalid" for i in issues):
        message = "Loop received invalid JSON. Reload the Connect page and try Find my agents again."
    elif any(i["field"] == "apiKey" and i["type"] == "missing" for i in issues):
        message = "The connection request is missing your ElevenLabs API key. Reload the page, paste the key, and try again."
    elif any(i["field"] == "apiKey" for i in issues):
        message = "The API key must be text between 1 and 1024 characters, not blank. Paste only the ElevenLabs key, without a JSON object or header name."
    elif any(i["type"] == "extra_forbidden" for i in issues):
        message = "The connection request has unexpected fields. Reload the page to use the latest connection form."
    elif any(i["field"] == "remoteId" for i in issues):
        message = "The selected agent ID is missing or invalid. Find your agents again and select one from the list."
    elif any(i["field"] == "userCriteria" for i in issues):
        message = "Additional criteria must be nonblank text, at most 4000 characters each, with no more than 30 criteria."
    else:
        message = "Loop expected a JSON connection request. Reload the Connect page and try again."
    return message, issues
