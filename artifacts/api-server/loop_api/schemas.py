from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field, SecretStr, field_validator


class CredentialInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    apiKey: SecretStr = Field(min_length=1, max_length=1024)

    @field_validator("apiKey")
    @classmethod
    def validate_key(cls, value):
        if not value.get_secret_value().strip():
            raise ValueError("API key cannot be blank")
        return SecretStr(value.get_secret_value().strip())


class AgentSelection(CredentialInput):
    remoteId: str = Field(min_length=1, max_length=200, pattern=r"^[A-Za-z0-9_-]+$")


class ConnectionInput(AgentSelection):
    userCriteria: list[Annotated[str, Field(min_length=1, max_length=4000)]] = Field(max_length=30)

    @field_validator("userCriteria")
    @classmethod
    def validate_criteria(cls, values):
        stripped = [v.strip() for v in values]
        if any(not v for v in stripped):
            raise ValueError("Criteria cannot be blank")
        return list(dict.fromkeys(stripped))


class Criterion(BaseModel):
    id: str
    name: str
    text: str
    source: str
    passed: int = 0
    failed: int = 0
    unknown: int = 0


class AgentSummary(BaseModel):
    id: str
    remoteId: str
    name: str
    platform: str
    createdAt: str
    criteriaCount: int
    failedCriteriaCount: int | None = None
    passRate: float | None = None
    openFailures: int | None = None
    status: str = "connected"
    keyMasked: str = "••••••••••••"


class AgentDetail(AgentSummary):
    criteria: list[Criterion]
    warning: str | None = None
    monitoring: "Monitoring"


class RemoteAgent(BaseModel):
    remoteId: str
    name: str
    tags: list[str]


class AgentPreview(BaseModel):
    remoteId: str
    name: str
    criteria: list[Criterion]
    warning: str | None = None


class Setup(BaseModel):
    databaseReady: bool
    encryptionReady: bool
    message: str


class MonitoringInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    enabled: bool = Field(strict=True)
    pollMinutes: int = Field(strict=True, ge=1, le=1440)


class Monitoring(BaseModel):
    enabled: bool
    pollMinutes: int
    lastAttemptAt: str | None
    lastSuccessAt: str | None
    nextPollAt: str | None
    lastError: str | None


class CallSummary(BaseModel):
    id: str
    conversationId: str
    startedAt: str
    durationSecs: int
    status: str
    result: str
    source: str
    versionId: str | None
    summary: str | None
    evaluationCount: int
    failureReasons: list["CallEvaluation"]
    criteriaCount: int
    failedCriteriaCount: int
    passedCriteriaCount: int
    unknownCriteriaCount: int


class TranscriptTurn(BaseModel):
    role: str
    text: str | None
    timeInCallSecs: int


class CallEvaluation(BaseModel):
    criterionId: str
    name: str
    result: str
    rationale: str
    score: int | None
    maxScore: int | None


class CallDetail(CallSummary):
    transcript: list[TranscriptTurn]
    evaluations: list[CallEvaluation]
    environment: str | None


class CallCategory(BaseModel):
    id: str
    name: str
    count: int


class CallPage(BaseModel):
    items: list[CallSummary]
    total: int
    offset: int
    limit: int
    monitoring: Monitoring
    categories: list[CallCategory]
