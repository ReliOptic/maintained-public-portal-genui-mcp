# ADR-0016: Interview Skill reads `resource://taxonomy/v1.0` at runtime

Status: Accepted

## Context

The Public Portal Interview Skill is a host-side instruction file at `skills/public-portal-interview.md`. It fulfils the [[Context extraction boundary]] contract by turning a user's natural-language public-service request into the structured payload required by `rank_portal_entries` and `compose_genui_artifact`.

The skill may ask at most two clarification questions. Those questions are safety-critical: they must not ask for credentials or sensitive identifiers, and their answers must map into the closed taxonomy axes used by the ranking pipeline. The skill therefore needs the current taxonomy vocabulary.

## Decision

The Interview Skill reads `resource://taxonomy/v1.0` at the start of each session before composing any clarification question or MCP payload.

Rules:

- Question option lists are built exclusively from the enum values returned by `resource://taxonomy/v1.0`.
- The skill file must not hard-code taxonomy enum values.
- The skill may specify which axes to ask about (`intent`, `persona`, `life_event`, `region`, `season`) and the order of questioning.
- If the host supports a native user-question facility such as `AskUserQuestion`, the skill may use it as the presentation transport for the bounded question. The MCP server does not activate, require, or depend on that host-native tool.
- If the taxonomy resource is unavailable and no previously read resource is available, the skill must not invent option lists. It proceeds best-effort with only safely inferred structured context and omits `weight_override`.

## Consequences

- Taxonomy changes propagate to the interview layer without editing this skill.
- Forks that replace taxonomy files do not need a separate skill edit for enum values.
- `resource://taxonomy/v1.0` becomes load-bearing for both host-side intake and server-side ranking contract validation.
- Malformed or empty taxonomy resource output is a visible integration error; it must not silently produce empty or fabricated question choices.
- The MCP server remains responsible only for structured input, ranking, safe copy, evidence, and handoff. Natural-language interview remains host-side.

## Considered options

### Hard-code enum values in the skill

Rejected. Static enum copies drift when taxonomy versions change and violate the fork/distribution model. They also let the host ask users to choose values the current server may not accept.

### Add a server-side intake prompt/resource

Rejected for v0.1. A prompt resource would blur the current boundary by making the server appear responsible for natural-language interview policy. The server should expose taxonomy and tools; the host skill decides how to ask.

### Let MCP trigger native user-question UI

Rejected as a server contract. Host-native question tools are useful, but they are not MCP server capabilities the catalog server can guarantee. The skill may call them when available; chat fallback is acceptable.

## Related decisions

- [[Context extraction boundary]] — natural language to taxonomy is host responsibility.
- [[ADR-0006]] — host may propose per-query weights together with structured context.
- [[ADR-0012]] — server enforces rationale, clipping, and fallback for host-proposed weights.
