---
name: GitHub access paths
description: Distinguish the GitHub connector API from Replit-managed Git transport access.
---

An unavailable GitHub connector API is not proof that normal Git operations are unavailable.

**Why:** In this project, the connector remained unavailable after authorization, while ordinary Git commands successfully authenticated through Replit's secure GitHub proxy.

**How to apply:** When the user supplies a repository URL and authorizes an upload, try a normal noninteractive `git ls-remote` before declaring the upload blocked. Use the configured Git transport; never extract credentials or bypass authentication. Fetch and inspect the destination before pushing, and never force-push over existing history.
