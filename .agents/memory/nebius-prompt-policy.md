---
name: Nebius prompt policy
description: User-mandated wording and output-validation policy for Loop's reasoning calls.
---

Use the user's exact system prompts for Group Failures, Write the Fix, and Update Evals. Do not paraphrase their instructions, merge the three tasks into one prompt, or append runtime evidence to the system text. Always request JSON output and validate it before saving.

**Why:** The user explicitly supplied the three prompts and required their exact wording, JSON output, and validation.

**How to apply:** Keep runtime evidence separate from the fixed system text. Reject malformed responses rather than silently repairing or saving them. Structural validation does not replace human approval or no-regression checks.
