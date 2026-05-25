---
name: public-portal-interview
description: Host-side interview policy for turning a Korean public-service request into taxonomy input for the Maintained Public Portal GenUI MCP. Use when a user asks for public services, tax/registration/benefit/work/data-portal help, or wants ranked portal cards and evidence.
---

# Public Portal Interview Skill

This is a **host-side** skill. It runs in Claude/the host LLM, not inside the MCP server.

- Skill responsibility: understand the user's natural-language request, ask bounded clarification questions, produce structured taxonomy input, and optionally propose `weight_override` with `weight_rationale`.
- MCP server responsibility: read the catalog, rank entries, enforce safety/copy/handoff rules, and compose GenUI output.
- Boundary: the MCP server accepts structured input only. It does not infer taxonomy from raw user text.

## Step 1 — Read taxonomy resource

Before asking any clarification question or constructing a payload, read:

```text
resource://taxonomy/v1.0
```

Use the returned closed-enum values for the axes:

- `persona`
- `intent`
- `life_event`
- `region`
- `season`

Do **not** hard-code taxonomy enum values in this skill. Question options must be built from the resource response for the current session.

If the resource cannot be read and no previously read taxonomy resource is available, do not invent option lists. Skip optional clarification, omit unknown axes, omit `weight_override`, and call the MCP tools with the best structured partial payload the host can safely form.

## Step 2 — Decide whether to interview

Call MCP immediately when the first user utterance already provides:

```text
intent + (persona or life_event)
```

If that condition is not met, ask at most **two** clarification questions.

Speed override: if the user says they need it “바로”, “급함”, “링크만”, “빠르게”, or equivalent, ask **zero or one** question only, then proceed best-effort.

## Step 3 — Ask bounded questions

Allowed question policy:

- Ask only questions whose answers can map directly to taxonomy enum values returned by `resource://taxonomy/v1.0`.
- Present choices from the resource when possible.
- Prefer the smallest useful question over broad open-ended discovery.
- If the host exposes a native user-question tool such as `AskUserQuestion`, use it only as the UI transport for these bounded questions. The MCP server does not activate or depend on that native host tool.
- If no native question UI exists, ask the same bounded question in chat.

Question priority:

1. If `intent` is unclear, ask for the intended action/information need first.
2. If neither `persona` nor `life_event` is clear, ask one of those next.
3. Ask `region` only when the user's utterance already implies a location-specific need or names a place.
4. Ask `season` only when timing changes the ranking materially.

Forbidden questions:

- Do not ask for resident registration numbers, passwords, authentication codes, account numbers, certificate files, login credentials, exact income amounts, tax IDs, API keys, service keys, or other sensitive identifiers.
- Do not ask the user to prove eligibility. The output must direct them to official portal confirmation.

After two questions, stop interviewing. If the request is still incomplete, proceed with the partial taxonomy payload and omit `weight_override`.

## Step 4 — Build MCP payload

Construct a payload using only confirmed or safely inferred taxonomy enum values:

```json
{
  "persona": ["<taxonomy enum>"],
  "intent": ["<taxonomy enum>"],
  "life_event": ["<taxonomy enum>"],
  "region": ["<taxonomy enum>"],
  "season": "<taxonomy enum>",
  "weight_override": { "<feature>": 0.0 },
  "weight_rationale": "<why this weighting matches the user purpose>"
}
```

Omit axes that are not confirmed. Omit `weight_override` and `weight_rationale` when the user's purpose mode remains unclear after the interview.

### Weight profiles

When proposing `weight_override`, include **at most three** positive ranking features and always include `weight_rationale` with at least eight non-whitespace characters. The server enforces clipping, normalisation, and `clip_cap`.

Use these three purpose modes:

1. **Action / filing / issuance mode**
   - Use when the user wants to apply, report, file, issue, register, or complete a public task.
   - Mildly bump up to three of: `AC`, `IF`, `freshness`.
   - Rationale: user wants an immediately actionable official task.

2. **Comparison / exploration / understanding mode**
   - Use when the user wants to compare benefits, understand options, or explore what may apply.
   - Mildly bump up to three of: `EV`, `PF`, `LF`.
   - Rationale: user needs evidence-backed comparison against their situation.

3. **Data / evidence mode**
   - Use when the user wants statistics, public datasets, source evidence, or data-portal guidance.
   - Choose data/evidence-related `intent` values from `resource://taxonomy/v1.0`; do not hard-code them here.
   - Mildly bump up to three of: `EV`, `IF`, `freshness`.
   - Rationale: user wants source data or official evidence rather than only an action card.

Do not include `sensitivity_risk` or `official_handoff_need` in `weight_override`; those are not positive host-ranking features.

## Step 5 — Call MCP tools

Use the same payload for both calls unless the first call proves no relevant candidates exist.

```text
rank_portal_entries(payload)
compose_genui_artifact(payload)
```

Default behavior:

1. Call `rank_portal_entries` to inspect ranked candidates.
2. Call `compose_genui_artifact` to produce Action Cards, Insight Rail, Evidence Rail, and handoff notice.
3. Present the MCP output without inventing URLs, portal paths, eligibility claims, or credential instructions.

## Safety rules

- Never perform applications, logins, identity verification, payment, tax filing, or eligibility determination on behalf of the user.
- All sensitive-domain guidance must end with official portal confirmation.
- If a returned card uses `safe_copy_rule = "confirm_not_assert"`, phrase the answer as confirmation guidance, not as a guaranteed eligibility/result claim.
- Use only handoff URLs returned by MCP. Never synthesize or guess government URLs.
- If the MCP output lacks a URL, show the returned `menu_path` or handoff text exactly as guidance.
- Do not log or repeat sensitive identifiers if the user volunteers them; steer back to non-sensitive taxonomy context.

## Installation note

This repository stores the source copy at `skills/public-portal-interview.md`. A host that supports file-based skills may copy or reference this file as its public-portal interview instruction. Taxonomy values remain externalized in `resource://taxonomy/v1.0`.
