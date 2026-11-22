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
    passRate: float | None = None
    openFailures: int | None = None
    status: str = "connected"
    keyMasked: str = "••••••••••••"


class AgentDetail(AgentSummary):
    criteria: list[Criterion]
    warning: str | None = None


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
