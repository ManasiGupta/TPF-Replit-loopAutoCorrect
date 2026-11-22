import sys
import pytest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


@pytest.fixture(autouse=True)
def no_background_provider_calls(monkeypatch):
    # TestClient must never poll stored real credentials as a side effect.
    monkeypatch.setenv("LOOP_MONITORING_DISABLED", "1")
