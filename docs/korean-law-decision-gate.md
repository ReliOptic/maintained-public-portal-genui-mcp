# Korean-Law Decision Gate

This checkout does not implement `korean-law-mcp` as part of the v0.2 teammate
schema integration yet.

## Current Decision State

The local design reference records ADR-0022 as:

- Status: Proposed, decision required.
- Recommendation: Option C, a hybrid path where legal evidence is disabled
  until a proxy exists and citation verification is used as a review gate.
- Interim fallback: Option A, host-layer parallel connection.

That is not an explicit upstream acceptance. Until Option A, B, or C is accepted
for this monorepo, the integration remains parked rather than guessed.

## Guardrails

- Do not copy legal text into fixtures as if it were verified.
- Do not require a user-held law.go.kr OC key at runtime.
- Do not make live `korean-law-mcp` calls from tests.
- Do not describe benefit recommendations as legal eligibility decisions.
- Keep legal evidence outside generated UI until the upstream role decision is
  accepted.

## If Option C Is Accepted

The next implementation slice should add only a disabled skeleton:

- a `korean-law-evidence` data section shape for "legal basis" output;
- a provider entry marked disabled or unavailable until a server-side proxy and
  allowlist exist;
- a citation-verification review hook contract for generated legal citations;
- deterministic tests that assert the disabled state and never call the live MCP
  server.

This preserves the "one screen with grounded links" direction while keeping
legal interpretation and credential handling out of the current open-source
runtime.
