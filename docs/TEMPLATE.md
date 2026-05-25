# Adoption Guide — Forking this project for another domain

## Why this exists

This project is a **reference implementation** of a citizen-facing public-service MCP that:

- Unifies fragmented public portals behind a single natural-language interface
- Ranks services by user context (persona, intent, life event, region)
- Separates task guidance (Action cards) from reference data (Insight Rail, Evidence Rail)
- Manages catalog quality through an AI-assisted review pipeline — not live crawling

The core value is **removing the navigation cost** citizens pay when searching across multiple portals. Korea's v0.1 covers Gov24 + Hometax + data.go.kr. The same architecture applies to any country or domain where services are scattered across multiple portals.

---

## What you get for free (fixed structure)

These are not replaceable — they are the template:

| Component | What it does |
|---|---|
| Five-stage ranking pipeline | Context-filter → safety-gate → score → SR-shape → Top-K cut |
| Feature formula | `IF, PF, LF, SE, UR, AC, EV, api_availability, freshness` over five fixed axes |
| Catalog contract | Entry JSON schema, Evidence Registry, catalog versioning |
| Review pipeline | Confidence routing → AI Review Agent → human escalation |
| MCP tool surface | `search_portal_entries`, `rank_portal_entries`, `get_entry_detail`, `compose_genui_artifact` |
| Distribution model | `.mcpb` Claude Desktop Extension + `npm` developer install |

The **five taxonomy axes** are fixed: `persona`, `intent`, `life_event`, `region`, `season`. You replace the *values* within each axis, not the axes themselves. The ranker computes `IF`, `PF`, `LF`, `SE` from these axes by name — changing axis names requires changing ranker code.

---

## What you replace (5 items)

Fork this repo, then replace exactly these five artifacts. No ranker code changes are required.

### 1. Taxonomy enum values
**File**: `catalog/<version>/taxonomy/*.json`

Replace all enum values with your domain's vocabulary. Keep the five axis names (`persona`, `intent`, `life_event`, `region`, `season`). Axis structure and the `W_base` / `Δ_axis` shape are inherited.

Example: Korea's `"tax_filing"` → Japan's `"確定申告"` (same axis `intent`, different value).

### 2. Source adapter (ingestion pipeline)
**Files**: `scripts/ingest-*.ts`, `catalog/seed/<portal>.yaml`

One adapter per source. Each adapter maps one source API row (or curated seed URL) to one `EntryCandidate`. Assign each source exactly one API role before writing its adapter:

| role | produces |
|---|---|
| Task source | Entries (action cards) |
| Evidence source | Evidence Registry records |
| Live Check Entry | one curated hand-authored Entry |
| Discovery tool | maintainer-side only, never in catalog |

Do not create an Entry for every API row. `Discovery tool` rows never reach the catalog.

### 3. Safety policy
**Files**: `catalog/<version>/weights/<weights_version>.json` (`sensitive_domains` key), `tooling/safe-copy-lint/rules.json`

Replace the `sensitive_domains` list with domains sensitive in your context (e.g. `["tax", "healthcare", "immigration", "legal"]`). Rewrite `safe_copy_rule` lint patterns for your language and legal context.

Rule: any Entry tagged with a sensitive domain must carry `safe_copy_rule = "confirm_not_assert"` and route through the human review queue regardless of confidence score.

### 4. Handoff allowlist
**File**: `catalog/<version>/weights/<weights_version>.json` (`handoff_allowlist` key)

Replace with your domain's trusted portal hostnames. The composer and test suite enforce this list at runtime. No URL outside the allowlist may appear in a card CTA.

Example Korea set: `["gov.kr", "hometax.go.kr", "data.go.kr"]`

### 5. Review Agent rubric
**File**: `tooling/review-agent/rubric.md`

Rewrite for your domain. The rubric must cover:
- Taxonomy enum compliance (values must be in your new enum)
- `menu_path` / handoff presence (mandatory publish floor)
- `card_copy` length-cap compliance
- `safe_copy_rule` lint pass for your language
- Sensitive-domain escalation rules

Do not skip this step. An un-rewritten rubric will apply Korean public-service rules to your domain and produce incorrect auto-accept/escalate decisions.

---

## Fork checklist

- [ ] Replace taxonomy enum values (keep five axis names)
- [ ] Set `W_base` and `Δ_axis` in `weights/<version>.json` for your domain
- [ ] Write source adapters; assign each source an API role first
- [ ] Replace `sensitive_domains` and `handoff_allowlist` in weights JSON
- [ ] Rewrite Review Agent rubric in `tooling/review-agent/rubric.md`
- [ ] Seed `catalog/seed/<portal>.yaml` with your first portal URLs
- [ ] Run `npm run coverage` — it reads your taxonomy enum and reports per-value Entry counts
- [ ] Run `npm test` — integration fixtures will fail until your catalog has entries; fix fixture context to match your taxonomy

---

## Non-public sector (B domain) note

This template is built around `persona / intent / life_event / region / season` as universal axes. Healthcare, HR, finance, and other non-government domains can map to these axes without changing ranker code:

- Medical: `persona = chronic_patient`, `intent = treatment_inquiry`, `life_event = post_diagnosis`
- HR: `persona = new_hire`, `intent = policy_lookup`, `life_event = onboarding`

The `portal_handoff` access_mode and `handoff_allowlist` apply to any domain with a canonical destination URL. The key B-domain preparation items that differ from the public-portal pattern:
- No government API means all sources are either `portal_handoff` or internal API
- `sensitive_domains` likely includes `medical`, `legal`, `financial` rather than `tax`, `welfare`
- The Insight Entry / Insight Rail concept applies to any domain where reference data (statistics, policies) is distinct from actionable tasks

B domain support is not in v0.1 scope but requires no structural change — the fork procedure above applies unchanged.
