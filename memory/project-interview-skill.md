# Project memory — Public Portal Interview Skill decisions

This note records the Q1–Q8 decisions for the host-side interview layer. It is intentionally separate from the MCP runtime: the server accepts structured taxonomy input only.

## Q1 — Location / ownership

Decision: keep the interview as a host-side skill at `skills/public-portal-interview.md`.

Rationale: natural-language understanding, clarification, and taxonomy mapping belong to Claude/the host LLM. The MCP server should remain limited to structured input, ranking, safe copy, evidence, and handoff. A global `CLAUDE.md` rule would be too broad, and a server prompt/resource would blur server responsibility.

## Q2 — Interview skip condition

Decision: skip clarification and call MCP immediately when the first utterance contains `intent + (persona or life_event)`.

If that condition is not met, ask at most two questions. If the user explicitly asks for speed (`바로`, `급함`, `링크만`, `빠르게`, etc.), ask zero or one question and proceed best-effort.

## Q3 — Weight proposal strategy

Decision: send taxonomy plus a purpose-mode `weight_override` and required `weight_rationale` when the user's purpose is clear.

Purpose modes:

1. action / filing / issuance → bump at most three of `AC`, `IF`, `freshness`
2. comparison / exploration / understanding → bump at most three of `EV`, `PF`, `LF`
3. data / evidence → choose data/evidence intent values from taxonomy and bump at most three of `EV`, `IF`, `freshness`

The server enforces `clip_cap`, clipping, renormalisation, and fallback. If purpose remains unclear, omit `weight_override` and `weight_rationale`.

## Q4 — Question safety and shape

Decision: questions must be answerable by values from `resource://taxonomy/v1.0` closed enums. The skill may ask which axis is intended, but it must not ask for sensitive identifiers.

Forbidden intake data includes resident registration numbers, passwords, authentication codes, account numbers, certificate files, exact income amounts, tax IDs, API keys, service keys, and login credentials.

## Q5 — Taxonomy synchronization

Decision: read `resource://taxonomy/v1.0` at runtime and do not hard-code taxonomy enum values in the skill.

This is captured as ADR-0016. The skill stores interview logic and axis priority, not vocabulary copies.

## Q6 — Fallback after bounded interview

Decision: after two questions, stop interviewing. Use the partial taxonomy available and call MCP best-effort. Omit `weight_override` when the purpose or mapping is still unclear.

The server's Stage 0 fallback and compositional weighting handle partial or empty structured context.

## Q7 — Native question UI / AskUserQuestion

Decision: native host question tools such as `AskUserQuestion` are optional presentation transports, not MCP server capabilities.

The skill may use a native user-question UI when the host exposes one. If unavailable, it asks the same bounded question in chat. The MCP server never tries to activate or depend on that feature.

## MCPB distribution boundary

Decision: the `.mcpb` package distributes the local MCP server, `manifest.json`, compiled catalog, dependencies, and the source copy of the companion interview skill. Claude Desktop must not be assumed to auto-activate a file-based skill from inside MCPB. The skill remains a host-side companion instruction; MCPB tool descriptions and docs should point hosts toward the same `resource://taxonomy/v1.0` contract.

## Q8 — Tool call and output contract

Decision: call `rank_portal_entries(payload)` first, then `compose_genui_artifact(payload)` with the same payload.

The final answer must use MCP-returned cards, evidence, handoff notices, and URLs only. It must not invent URLs, perform login/application/eligibility decisions, or override `safe_copy_rule = "confirm_not_assert"`.
