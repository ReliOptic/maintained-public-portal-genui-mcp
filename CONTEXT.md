# Context — Public Portal GenUI Gateway

This file is the project's glossary. It defines the canonical meaning of domain terms used in this codebase. It is **not** a spec, design doc, or implementation note.

## Glossary

### Entry

The atomic unit of the Catalog. **An Entry represents a single Leaf Service** — one concrete action a citizen can take on a public portal (e.g. "종합소득세 신고", "전입신고", "근로장려금 신청", "공공데이터 dataset 조회").

An Entry is **not** a URL, a menu node, or a portal page. The relationship between Entry and URL is many-to-many:

- A single page may host multiple Leaf Services (e.g. a tax page offering both "신고" and "조회") → multiple Entries.
- A single Leaf Service may be reachable from multiple URLs (mirror paths, query-string variants) → one Entry.

Consequence: the Collector is not a pure crawler — it must produce **semantic units**, not raw page records. See [[collector-role]] (TBD).

### Leaf Service

A single, user-performable public-administration action. The unit at which `persona_fit`, `intent_fit`, `actionability`, and `evidence_value` are meaningful to score.

Counter-examples (these are **not** Leaf Services):
- "홈택스 메인 메뉴" — a navigation hub, not an action
- "세금 정보" — a category, not an action
- "민원24 전체 서비스 목록" — a directory, not an action

### Collector

The ingestion pipeline that produces Catalog Entries from public portals. The Collector is **two-stage**:

- **Stage 1 (Agentic capture)** — implemented as a Codex-style computer-use agent (not a plain headless fetcher). Visits each seed URL like a human: renders SSR/iframe/JSF-heavy pages (홈택스 most importantly), interacts with menus and tabs to surface dynamic content, and records what it sees. Produces `RawPageRecord`s; produces no [[Entry]] yet. Stage 1 still does **not** decide how many Leaf Services a page contains — that is Stage 2's job.
- **Stage 2 (Splitter)** — LLM-driven. Takes `RawPageRecord` as input and emits one or more `EntryCandidate`s — one per detected [[Leaf Service]]. Confidence-scored; routes to auto-accept, sampling review, or human review queue per the thresholds in the architecture doc §10.

The Collector is therefore **not** "crawler only" as the architecture doc §3.1 suggested. The LLM Annotation Layer (§3.4) and the Splitter share the same LLM dependency surface.

### RawPageRecord

The output of Collector Stage 1. A faithful capture of one seed URL produced by the agentic-capture pass: source URL, final rendered DOM (post-navigation), screenshots, observed interactive actions (buttons/tabs visited), extracted `menu_path` text, surrounding paragraphs, source timestamp, fetch_status. Has no `title`, `intent`, or `persona_tags` — those are produced downstream by Stage 2 inside an `EntryCandidate`.

### Seed list

The set of URLs that Collector Stage 1 will visit on the next ingestion. Lives in `catalog/seed/<portal>.yaml` and is the **only** entry point for adding new candidate Entries to the catalog. New URLs are added by community PR. Stage 1 is intentionally seed-driven (not sitemap-walking or search-enumerating) for v0.1 — the human PR step is itself a value gate before any LLM/compute is spent.

### Refresh pipeline

Catalog ingestion runs in a **maintainer-operated CI**, not on contributor machines. Reason: the Stage 1 agentic capture and Stage 2 LLM Splitter both depend on credentialed APIs (computer-use, LLM). The flow:

1. Contributor opens a PR adding URLs to a `catalog/seed/<portal>.yaml`.
2. Maintainer merges to `main`.
3. CI picks up the diff, runs Stage 1 (agentic capture) on the new URLs, then Stage 2 (LLM Splitter) and the LLM Annotation Layer on the resulting `RawPageRecord`s.
4. CI opens a **draft PR** containing the generated `EntryCandidate` JSON files and a confidence summary. Auto-accepted candidates are pre-marked; review-required candidates are flagged inline.
5. Reviewer approves and merges → `catalog_version` patch (or minor) bump → git tag.

### EntryCandidate

The output of Collector Stage 2. A proposed [[Entry]] not yet committed to the published Catalog. Carries `confidence_score`, `review_required`, and pointers back to its source `RawPageRecord`(s). Promoted to a published [[Entry]] only after passing the confidence/review gate.

### Handoff

How the Gen UI directs a user from a ranked Entry to the source portal. The Gen UI is itself the user's primary entry point, so Handoff is **textual guidance + optional link**, not "a URL always".

Three tiers, in preference order:

- **tier1 — deep_link**: a verified, login-free URL that lands directly on the Leaf Service screen. Subject to periodic health-check; if it fails, the Entry falls back to tier2 automatically.
- **tier2 — search_link**: the portal's own search-result URL (e.g. `gov.kr/search?q=전입신고`). Stable but adds one click. Optional.
- **tier3 — menu_path** *(mandatory floor)*: human-readable navigation text such as `"홈택스 > 신고/납부 > 종합소득세"`. **Every published Entry must carry a menu_path.** This is the publishable floor — a card with only tier3 is still a valid card; the CTA becomes "포털 열기" pointing at the portal root, with menu_path shown as guidance text.

Therefore: tier1 and tier2 are upgrades to the user experience, not preconditions for publishing.

The `handoff_ref` string in the architecture doc §6.2 is replaced by a structured `handoff` object: `{ tier, url?, menu_path, portal }`.

### entry_id

A registry-assigned ULID issued at the moment an [[EntryCandidate]] is promoted into the published Catalog. **Independent of URL, title, or portal layout.** Stable across re-ingestion, portal redesigns, and title revisions.

### content_fingerprint

A deterministic hash used **only** for dedup between an incoming `EntryCandidate` and the existing Catalog. Inputs (in this order):
`portal | canonical_intent | canonical_action_verb | key_keywords (sorted)`.

All four inputs are drawn from fixed enums or normalized lemmas (see [[taxonomy]], TBD) — not free text — so the same Leaf Service produces the same fingerprint across LLM re-runs.

On match: the incoming candidate updates the existing Entry; **entry_id is preserved**.
On miss: a new entry_id is issued.

### merged_into

A nullable `entry_id` pointer used when two previously-distinct Entries are discovered to be the same Leaf Service (e.g. an early Splitter split incorrectly). The losing Entry is not deleted — its `merged_into` field points to the surviving id, and the Catalog hides it from search/rank but resolves any incoming references to the survivor. This guarantees **no entry_id is ever reused or orphaned**.

### Taxonomy

The fixed controlled vocabulary used to populate `persona_tags`, `task_intent`, and `life_event_tags` on every [[Entry]] and every ranking request. Versioned as `taxonomy/v1.0`; each entry value is a short snake_case key (e.g. `freelancer`, `tax_filing`, `relocation`).

Two layers per axis:

- **Primary (closed enum)** — the only values that participate in ranking, caching, and [[content_fingerprint]]. ~20–30 keys per axis at v1.0.
- **Free tags** — additional descriptive keywords on an [[Entry]] only; never used for ranking input, cache key, or fingerprint. Captures gaps; a free tag whose observed frequency crosses a threshold becomes a candidate for promotion to the primary enum in the next taxonomy version (v1.0 → v1.1 schema migration).

The taxonomy itself is exposed as an MCP Resource (`resource://taxonomy/v1.0`) so clients can build valid ranking-input payloads without guessing strings.

### Ranking pipeline

The ranking pipeline is **two-stage filter-then-score**, not a single weighted sum. Safety and confidence are gates, not score terms.

**Stage 1 — Safety/quality gate.** An Entry is dropped from the candidate set if any of:
- `confidence_score < 0.85`
- `status != "published"`
- `merged_into != null`
- `menu_path` is missing (violates [[Handoff]] floor)

**Stage 2 — Positive-feature score.** Only seven features participate:
`IF, PF, LF, SE, UR, AC, EV` — `sensitivity_risk` is **excluded** from the score.
`Q(entry) = Σ_i  S_entry[i] × W_context[i]`, with `Σ W_context[i] = 1` (weights normalised per request).

**Stage 3 — SR-driven adjustment.** `sensitivity_risk` shapes presentation, not score:
- `SR ≥ 0.85` → `ui_slot` capped at `secondary_card` (never `primary_card`).
- `SR ≥ 0.85` → `safe_copy_rule = "confirm_not_assert"` enforced.

**Stage 4 — Top-K cut + slot assignment.** Sort by Q descending, take `top_k`, then assign `ui_slot` honouring the Stage-3 caps.

Consequence: `explain_ranking` can answer "why not shown?" (Stage 1 reason) and "why this order?" (Stage 2 score breakdown) independently. The two questions never collapse into a single number.

### Context extraction boundary

Translating a user's natural-language utterance into the structured `(persona[], intent[], life_event[], season, region?)` payload required by [[MCP Tool: rank_portal_entries]] is the **host LLM's job, not the MCP server's**. The MCP server accepts structured input only.

Consequences:
- The MCP server is stateless w.r.t. user dialogue. It does not see raw user text.
- The MCP server exposes `resource://taxonomy/v1.0` so the host LLM has the enum vocabulary it must produce against. Hosts that support prompt caching (e.g. Anthropic Claude) should cache this resource.
- The architecture doc §6.2 `infer_context` Tool is **removed** from the v0.1 Tool set.
- The MCP server accepts an empty structured payload (`{}`) as a valid request and falls back to a `general` ranking profile.

### MCP Tool: rank_portal_entries

The v0.1 MCP Tool set is reduced to four tools:
`search_portal_entries`, `rank_portal_entries`, `get_entry_detail`, `compose_genui_artifact`. The original §6.2 list of seven shrinks because `infer_context` is removed (see [[Context extraction boundary]]) and `submit_review_feedback` / `explain_ranking` are deferred past v0.1.

### Feature value origin

The eight features of the Feature Dictionary (§4) are produced in **three different ways**, not stored uniformly on every [[Entry]]:

**Intrinsic (stored on Entry as ordinal enum).**
`actionability`, `evidence_value`, `sensitivity_risk` are stored as one of `{low, medium, high}` and mapped to numeric values at ranking time:

| label  | AC, EV | SR  |
| ------ | ------ | --- |
| low    | 0.20   | 0.10 |
| medium | 0.50   | 0.50 |
| high   | 0.85   | 0.90 |

Ordinal-not-floating-point because LLM annotators do not produce calibrated [0,1] scores; ordinals are reviewable by rubric.

**Match (derived at ranking time, never stored).**
`IF`, `PF`, `LF`, `SE` are computed per-request from set overlap between the Entry's [[taxonomy]] tags and the request payload:

- `IF = |entry.task_intent ∩ req.intent| / max(|req.intent|, 1)`
- `PF = |entry.persona_tags ∩ req.persona| / max(|req.persona|, 1)`
- `LF = |entry.life_event_tags ∩ req.life_event| / max(|req.life_event|, 1)`
- `SE = 1.0` if `entry.seasonality_hint == req.season`, `0.3` if adjacent month, else `0.0`.

This is why extending the taxonomy in v1.0 → v1.1 does **not** require re-annotating existing Entries.

**Time-derived (computed at ranking time).**
`UR` is a function of `entry.seasonality_hint` and the current date — proximity to seasonal deadline. Not stored.

### W_context

The per-request weight vector applied to the seven positive features in the [[Ranking pipeline]]. Computed **compositionally** from sparse axis deltas:

```
W = clip(W_base + Σ_axis Δ_axis(req[axis]), lower=0)
W = W / Σ W                                   # normalise so Σ W = 1
```

- `W_base` — the no-context default weight vector, summing to 1.
- `Δ_axis` — sparse dictionaries keyed by [[taxonomy]] enum value, defined per axis (persona, intent, life_event, season, region). Each Δ row alters at most a handful of features.

**Compositional is canonical.** Named profiles (e.g. `freelancer_tax_may`) are **aliases** — convenience names that resolve to the same `(persona, intent, life_event, season)` tuple and therefore the same compositional W. They are a cache key, not a separate definition.

Consequence: adding a new enum value to `taxonomy/v1.1` requires adding one `Δ_axis` row, not authoring profiles. The combinatorial axis-product (~14k combos for v1.0) never has to be enumerated by hand.

### Card copy

All user-facing strings on Gen UI cards are **stored as Catalog data**, not generated at runtime. Each [[Entry]] carries, alongside its structural fields, a fixed set of pre-curated copy fields:

- `card_title` — the card heading. Default = `Entry.title`; may be overridden when the official title is awkward as a card.
- `card_body` — 1–2 sentence description rendered under the title.
- `cta_label` — the action label on the link/button (e.g. `"홈택스에서 확인하기"`).
- `safe_copy_audit` — a record of which `safe_copy_rule` was applied during authoring and the rubric outcome.

Card copy is **authored offline** as part of the LLM Annotation Layer, then routed through the [[EntryCandidate]] confidence gate and [[Human Review Queue]] — the same path that gates intrinsic feature values. The runtime [[MCP Tool: rank_portal_entries]] and `compose_genui_artifact` **never call an LLM to write or rewrite copy**.

Consequences:
- Runtime hot path has zero copywriting tokens.
- `safe_copy_rule` is enforced at annotation/review time, not at request time. Any rule violation is caught before the card is publishable.
- A card's wording is part of the Catalog version — see [[catalog_version]] (TBD).

### Frame copy

Strings that are **not bound to a single [[Entry]]** but to the Gen UI frame as a whole: `hero.title`, `hero.subtitle`, `handoff_notice`, `evidence_rail.label`. Stored as a small catalog-wide table keyed by [[Frame segment]] (not by individual `(intent, season)` tuples) and selected (not generated) at request time. Same authoring/review gate as [[Card copy]].

### Frame segment

The coarse bucket that selects a [[Frame copy]] variant. v0.1 segments:

| segment            | matches request when…                                                                  |
| ------------------ | -------------------------------------------------------------------------------------- |
| `relocation`       | `life_event` contains `relocation` or `address_change`                                 |
| `family_event`     | `life_event` contains `marriage`, `birth`, or `family_relation`                        |
| `startup_business` | `life_event` contains `startup` or `persona` contains `sole_proprietor`                |
| `tax_season`       | `intent` contains `tax_filing`/`tax_inquiry` or `season ∈ {Jan, May}`                  |
| `benefit_check`    | `intent` contains `benefit_check` or `certificate_issue`                               |
| `general`          | fallback when no other segment matches (includes the empty-context case)               |

Resolution is **first-match in the listed priority order**. The mapping table itself is data (`frame_copy_segments.json`) and PR-reviewable; new segments require a `minor` [[catalog_version]] bump.

Consequence: v0.1 needs only ~6 × 4 ≈ 24 frame copy strings (and one segment mapping table), authorable by a single maintainer in one session.

### catalog_version

The Catalog follows **semantic versioning**: `major.minor.patch`.

- **major** — Catalog schema change, including [[taxonomy]] additions/removals that alter `content_fingerprint` inputs. Clients on the prior `major` may break.
- **minor** — Entry additions or removals. Top-K results may shift; `safe_copy_rule` and `card_copy` remain valid.
- **patch** — Card copy corrections, intrinsic-ordinal bumps, automatic tier1→tier2 [[Handoff]] downgrades from health-check, free_tag updates. Pre-existing rendered cards remain correct.

Every Catalog publish is **atomic**: staged build → atomic swap → previous version retained for at least N days for rollback and replay.

`weights_version` (the version of the W_base + Δ_axis tables) is a **separate** version string, also semver. Ranking output carries both:

```
{ catalog_version: "1.0.7", weights_version: "1.0.0", … }
```

Cache key for the runtime ranking cache: `(input_hash, catalog_version, weights_version)`. A `patch` bump invalidates ranking cache; `weights_version` bumps invalidate it independently.

### Catalog source of truth

The Catalog is **JSON-in-git**: a directory of plain JSON files under `catalog/<version>/` is the canonical store of every Entry, frame_copy row, taxonomy file, and `weights.json` (W_base + Δ_axis tables).

Layered:

- **Source of truth (git)**: human- and LLM-authored content. Public, PR-reviewable, transparent for an OSS community. The [[Human Review Queue]] is GitHub PR review.
- **Runtime form (v0.1)**: the MCP server reads JSON at startup, builds an in-memory `Map<entry_id, Entry>` plus inverted indices over `task_intent`, `persona_tags`, `life_event_tags`, and `seasonality_hint`. No external DB. Tractable to ~1k Entries on a single-user stdio process.
- **Runtime form (later, when scale warrants)**: an upstream build step compiles `catalog/<version>/` into a `compiled.sqlite` shipped alongside the JSON. The MCP server loads sqlite instead of JSON; the source of truth stays JSON. Trigger: measurable startup-latency regression or > ~5k Entries.
- **Runtime form (v1.0 multi-tenant HTTP)**: the same compiled artifact is loaded into Postgres in a hosted deployment. Source of truth still JSON.

A [[catalog_version]] release is a git tag (`catalog@1.0.7`) on `main`. A `minor` or `major` bump is one PR (one publish). A `patch` may be a bot PR with auto-merge once safety lint passes.

### MCP transport (v0.1)

The v0.1 transport is **stdio**, hosted in the user's Claude Desktop process. Per-user local instance. Each user pulls the published Catalog snapshot they want (default: latest tagged release) and the MCP server runs against that local copy.

Consequences:
- No multi-instance synchronisation problem during v0.1.
- No auth surface during v0.1.
- HTTP transport is a later capability triggered by a need to share infra across users; the architecture above does not depend on the transport choice.

### Human Review Queue

The gate that promotes an [[EntryCandidate]] (or any catalog change PR) into a published [[Entry]]. Operated as GitHub PR review under a `CODEOWNERS` policy that routes every `catalog/**` change to the maintainer(s).

Confidence-driven routing of automation output:

| confidence_score        | route                                                |
| ----------------------- | ---------------------------------------------------- |
| `≥ 0.85`                | auto-accepted (still surfaces as a draft PR for visibility) |
| `[0.60, 0.85)`          | sampling review (~10 % flagged inline for spot check) |
| `< 0.60`                | manual review required, blocked from merge          |

**Sensitive-domain hard gate.** Independent of `confidence_score`, every Entry whose `domain ∈ sensitive_domains` is forced into manual review. v0.1 `sensitive_domains = ["tax", "welfare", "family", "immigration", "legal"]`. This is the codified form of the architecture doc §9 safety constraints — the schema, not LLM intent, enforces them.

**Bot auto-merge** is limited to pure data corrections: tier1→tier2 [[Handoff]] downgrades from health-check, `last_verified_at` refreshes, and formatting-only changes. Anything touching `card_title`, `card_body`, `cta_label`, taxonomy tags, or intrinsic ordinals goes through human review.

**v0.1 operational assumption:** a single maintainer can hold this queue at the MVA scale of ~90 Entries plus weekly patches. Scaling reviewer count or splitting domain ownership is deferred past v0.1.

### Weights bootstrap

The v0.1 `W_base` vector and the per-axis `Δ_axis` tables are **LLM-proposed and maintainer-checked**, not learned from data.

Procedure for `weights/v1.0.0.json`:

1. Maintainer prompts an LLM, citing the [[Ranking pipeline]] feature definitions, to propose:
   - A 7-feature `W_base` (sum = 1) with a one-line rationale per feature.
   - For each axis enum value in [[Taxonomy]] v1.0, a sparse `Δ` (only the features the value should shift) with one-line rationale.
2. The LLM output is committed verbatim as `weights/v1.0.0.json`.
3. Maintainer prose-reviews for outliers, edits where necessary, and commits a corrections diff.
4. Tagged as `weights@1.0.0`.

Subsequent user feedback or audit findings become `weights/v1.0.1.json` patches; the file's git history is the audit trail. The data-driven tuning path (logged ranking events → grid search or RL) is deferred past v0.1; the file format is unchanged when that path lands.

### Exposure level

The Catalog content is partitioned into five exposure levels (L0–L5 in spirit, but L0 is "never"). Each level has a **per-tier response cap** and a fixed visibility gate. Cap is enforced server-side; payloads that would exceed cap are truncated with a `truncated: true` marker.

| Level | Content                              | Cap (bytes) | Visibility                                          |
| ----- | ------------------------------------ | ----------- | --------------------------------------------------- |
| L0    | Full Catalog dump                    | —           | never returned                                      |
| L1    | Candidate id pool (50–100)           | 4 KB        | only when caller passes `include_debug=true`        |
| L2    | Top-K result rows (5–8 by default)   | 2 KB        | always (the default response of `rank_portal_entries`) |
| L3    | A single Entry's full record         | 3 KB        | only via explicit `get_entry_detail`                |
| L4    | Feature vector + Q score breakdown   | 5 KB        | only when caller passes `admin=true`                |

Because L1 is gated by `include_debug`, the L2 default response of `rank_portal_entries` carries **no candidate ids** even though the search step runs internally. This makes `search_portal_entries` safe to expose as a separate MCP Tool — its output is itself an L1 payload, gated on the same flag.

### Copy length cap

Schema-level string-length limits enforced at Catalog publish time (rejected at validation, not at runtime):

| Field                      | Cap (Korean characters) |
| -------------------------- | ----------------------- |
| `card_title`               | 40                      |
| `card_body`                | 120                     |
| `cta_label`                | 20                      |
| `hero.title`               | 30                      |
| `hero.subtitle`            | 60                      |
| `handoff_notice`           | 100                     |
| `evidence_rail.label`      | 40                      |

These caps make the L2 / L3 / L4 byte caps achievable without runtime trimming.

### Handoff allowlist

The fixed set of host names that may appear in any tier1/tier2 URL. Currently: `hometax.go.kr`, `gov.kr`, `data.go.kr`. Any URL outside this allowlist is rejected at publish time, satisfying the architecture doc §9 "Allowlist-based external links" constraint.

