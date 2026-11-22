---
name: Private Google sign-in
description: Required sign-in order and privacy boundaries for the Loop onboarding journey.
---

The homepage stays public. Clicking “Connect your agent” must require Google SSO login or sign-up before a visitor can connect their existing ElevenLabs agent. After authentication, return the person to the agent connection flow.

**Why:** The user explicitly requested Google SSO before connecting an agent, and explained that their changes must not be visible to everyone.

**How to apply:** Protect both workspace routes and backend APIs, scope agent data and changes to the authenticated owner, and isolate browser state across accounts. A login page alone is not sufficient. This requirement supersedes the earlier no-signup/single-user prototype assumption.
