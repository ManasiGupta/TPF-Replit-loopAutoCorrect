---
name: Provider test provenance
description: Do not confuse an ElevenLabs environment label with proof of a test-suite run.
---

Do not claim that a conversation passed a Tests run based on its provider `environment` string.

**Why:** The official conversation documentation exposes arbitrary environment strings but does not establish an environment-to-Tests provenance contract. An explicit `test` environment can label a monitored call without proving that the Tests API ran it.

**How to apply:** When later implementing Tests and regression verification, record an actual run-to-conversation relationship. Keep environment-based browsing labels separate from verified test-run evidence. Never use those labels alone to approve shipping.
