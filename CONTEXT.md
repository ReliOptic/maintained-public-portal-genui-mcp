# Context — Public Portal GenUI Gateway

This file is the project's glossary. It defines the canonical meaning of domain terms used in this codebase. It is **not** a spec, design doc, or implementation note.

## Glossary

### Entry

The atomic unit of the Catalog. **An Entry represents a single Leaf Service** — one concrete action a citizen can take on a public portal (e.g. "종합소득세 신고", "전입신고", "근로장려금 신청", "공공데이터 dataset 조회"). Also known as a **Public Task Entry** when emphasising that the source can be either a public API row or a portal handoff target.

A single API row from a structured source (e.g. one `gov24/serviceList` row, one `nts-businessman/status` operation) is exactly one Entry. The API itself is **not** the Entry — "discovery" or "search" is a means, not a Leaf Service. This preserves the Entry/Leaf Service definition across both crawled-portal and API-sourced origins.

An Entry is **not** a URL, a menu node, or a portal page. The relationship between Entry and URL is many-to-many:

- A single page may host multiple Leaf Services (e.g. a tax page offering both "신고" and "조회") → multiple Entries.
- A single Leaf Service may be reachable from multiple URLs (mirror paths, query-string variants) → one Entry.

Consequence: the Collector is not a pure crawler — it must produce **semantic units**, not raw page records. See [[collector-role]] (TBD).

### access_mode

A required field on every [[Entry]] that names **how this Task is fulfilled**. The Catalog v0.1 uses three values; the broader enum is reserved for v0.2+.

| value             | meaning                                                                    | v0.1 |
| ----------------- | -------------------------------------------------------------------------- | ---- |
| `api_cached`      | Entry's data comes from a scheduled API sync (gov24 service rows, etc.).   | ✓    |
| `portal_handoff`  | Entry is performed on a public portal screen; we provide [[Handoff]] only. | ✓    |
| `manual_check`    | Entry requires the user to confirm/authenticate at the portal; we only point. | ✓    |
| `api_live`        | Entry calls a live API per request (e.g. NTS businessman status).          | deferred to v0.2 (credential issue) |
| `hybrid`          | Discovery via API + action via portal.                                     | not a value — expressed by `api_cached` + populated [[Handoff]] together |

`access_mode` discriminates the ingestion pipeline and the runtime CTA, not the ranking math. Every Entry, regardless of mode, still has the same Feature vector and is ranked by the same [[Ranking pipeline]].

### Evidence Registry

Public datasets and reference statistics (data.go.kr file/auto-OpenAPI rows, KOSIS statistics, regional data, 소상공인 상권정보) are **not** Entries — they are not Leaf Services. They live in a separate registry under `catalog/v1.0.0/evidence/*.json` with its own refresh cadence. Tasks reference them through an `Entry.evidence_refs: string[]` field; the composer resolves those references when assembling the §13 Evidence Rail.

This separation keeps the [[Ranking pipeline]] semantically single-purposed ("how relevant is this Task to the user?") and avoids comparing a Task ("근로장려금 신청") against a dataset ("상권 통계") in the same score space.

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

Catalog ingestion is **two parallel pipelines**, both running in maintainer-operated CI:

**api-refresh-pipeline** (primary, automated):
- Triggered nightly on a cron schedule (or manually).
- For each registered Task API source (Gov24 serviceList primary in v0.1; 복지로 중앙부처/지자체 복지서비스 and 워크넷 채용정보/정부지원일자리 are future Task candidates), calls the API, paginates, normalises each row into an `EntryCandidate`, and runs LLM Annotation to produce taxonomy tags, intrinsic ordinals, and card_copy.
- ADR-0001 (LLM Splitter) is **not** in this path — one Task API row = one Entry by definition.
- General-purpose data APIs are deliberately excluded from Entry generation: 공공데이터포털 목록조회/검색, KOSIS OpenAPI, and 소상공인 상권정보 feed the [[Evidence Registry]] or source registry, not Task cards. 국세청 사업자 상태조회 is a specific live-check source, not a bulk Task catalog source.
- Output: a draft PR containing the diff of `catalog/v1.0.0/entries/*.json`. Often auto-mergeable (small `patch` bumps).

**portal-refresh-pipeline** (secondary, manual-trigger):
- Triggered when a maintainer merges a PR adding URLs to `catalog/seed/<portal>.yaml`.
- v0.1: runs Stage 1 (agentic capture via Codex computer use) → LLM Annotation → confidence routing → draft PR. **Stage 2 LLM Splitter is not active in v0.1** — the maintainer pre-splits any multi-Task pages into leaf URLs in the seed file. ADR-0001 remains the policy of record and activates in a later release once seed volume justifies the automation.
- Lower cadence (≈ monthly), heavier review.

Both pipelines converge on the same `catalog/v1.0.0/entries/*.json` and obey the same [[Human Review Queue]] gates. The `access_mode` field on each Entry records which pipeline produced it.

### EntryCandidate

The output of Collector Stage 2. A proposed [[Entry]] not yet committed to the published Catalog. Carries `confidence_score`, `review_required`, and pointers back to its source `RawPageRecord`(s). Promoted to a published [[Entry]] only after passing the confidence/review gate.

### Handoff

How the Gen UI directs a user from a ranked Entry to the source portal. The Gen UI is itself the user's primary entry point, so Handoff is **textual guidance + optional link**, not "a URL always".

Three tiers, in preference order:

- **tier1 — deep_link**: a verified, login-free URL that lands directly on the Leaf Service screen. Subject to periodic health-check; if it fails, the Entry falls back to tier2 automatically.
- **tier2 — search_link**: the portal's own search-result URL (e.g. `gov.kr/search?q=전입신고`). Stable but adds one click. Optional.
- **tier3 — menu_path** *(mandatory floor)*: human-readable navigation text such as `"홈택스 > 신고/납부 > 종합소득세"`. **Every published Entry must carry a menu_path.** This is the publishable floor — a card with only tier3 is still a valid card; the CTA becomes "포털 열기" pointing at the portal root, with menu_path shown as guidance text.

Therefore: tier1 and tier2 are upgrades to the user experience, not preconditions for publishing.

For seeded portal handoffs, including HomeTax seed URLs, `handoff.tier` is determined during ingestion/browser validation from the rendered page and final URL. The seed URL alone does not guarantee tier1; `menu_path` remains the mandatory publish floor.

The `handoff_ref` string in the architecture doc §6.2 is replaced by a structured `handoff` object: `{ tier, url?, menu_path, portal }`.

### entry_id

A registry-assigned ULID issued at the moment an [[EntryCandidate]] is promoted into the published Catalog. **Independent of URL, title, or portal layout.** Stable across re-ingestion, portal redesigns, and title revisions.

### content_fingerprint

A deterministic hash used **only** for dedup between an incoming `EntryCandidate` and the existing Catalog. v0.1 inputs (in this order):
`canonical_intent | canonical_action_verb | normalized_title | region_scope | persona_scope`.

**`portal` is deliberately not in the fingerprint** so that the same Leaf Service surfaced from multiple [[Task source]] APIs (e.g. "근로장려금 신청" from both gov24 service catalog and 복지로 central) collapses to a single Entry. All inputs are drawn from fixed enums or normalised lemmas (see [[Taxonomy]]) — never free text — so the same Leaf Service produces the same fingerprint across LLM re-runs and across sources.

On match: the incoming candidate updates the existing Entry; **entry_id is preserved**, and the second source attaches to the Entry's `secondary_sources` array (see [[Task source]]).
On miss: a new entry_id is issued.

### API role

Every external API integrated into this project is assigned exactly one of four roles. The role determines whether and how the API is wired into the pipeline — adding APIs is not a goal in itself; assigning each one a single role is.

| role             | what it produces                                                  | v0.1 examples                                    | user-visible? |
| ---------------- | ----------------------------------------------------------------- | ------------------------------------------------ | ------------- |
| Task source      | rows that become catalog Entries (1 row = 1 Entry)                | gov24, 복지로 central/regional, 워크넷 정부지원일자리 | yes (as cards) |
| Evidence source  | rows that become [[Evidence Registry]] entries (statistics, refs) | KOSIS, 소상공인 상권, hand-picked data.go.kr file rows | yes (as Evidence Rail) |
| Live Check Entry | a single hand-curated Entry, label only — runs as `portal_handoff` in v0.1 | NTS 사업자 상태조회 | yes (as one card) |
| Discovery tool   | metadata *about* other datasets — used by the maintainer to find Evidence candidates | 공공데이터포털 목록조회 / 검색서비스 | **no** — maintainer-side only, never in catalog |

See [[ADR-0007]] for the binding decision.

### Task source

A registered API source whose rows produce candidate Entries. v0.1 has four Task sources, listed in **primary-source priority order** for cross-source dedup:

1. `gov24-serviceList` (행정안전부 공공서비스 정보) — most authoritative for general public-service tasks.
2. `bokjiro-central` (복지로 중앙부처복지서비스) — welfare-specialised, richer support-conditions.
3. `bokjiro-regional` (복지로 지자체복지서비스) — regional welfare detail.
4. `worknet-supported-jobs` (워크넷 정부지원일자리) — employment-support tasks.

When the same [[content_fingerprint]] appears in multiple sources, the **primary source's row owns the Entry** — its `entry_id`, `title`, and `card_copy` win. Lower-priority sources are recorded on the Entry's `secondary_sources: { source_id, row_id, fields }[]` field; they enrich `api_payload`, `support_conditions`, `evidence_refs`, etc., but do **not** create a separate Entry.

`worknet-supported-jobs` uses a `last_sync_at + 60-day TTL`: rows not refreshed within 60 days are auto-marked `status=archived` and removed from the published Catalog. This handles the short-lived nature of job postings without inventing a new lifecycle.

The single Live Check Entry (`nts-business-status`, NTS 사업자 상태조회) is not a bulk Task source — it is one curated Entry with `access_mode = portal_handoff`. **It is excluded from the cross-source [[content_fingerprint]] dedup pool**: it is hand-authored, lives outside the api-refresh-pipeline's row stream, and never merges into a secondary source. See [[ADR-0007]].

Session 1 implementation status: the three non-Gov24 Task sources have registry YAML contracts and are CI-validated as `registry_validated_only` until endpoint mappings and maintainer secrets are added. Gov24 remains the only full-ingestion source in the current GitHub Actions workflow; the workflow still runs the semantic fingerprint/dedup pass so later Bokjiro/Worknet rows attach as `secondary_sources` instead of creating duplicate Entries.

### merged_into

A nullable `entry_id` pointer used when two previously-distinct Entries are discovered to be the same Leaf Service (e.g. an early Splitter split incorrectly). The losing Entry is not deleted — its `merged_into` field points to the surviving id, and the Catalog hides it from search/rank but resolves any incoming references to the survivor. This guarantees **no entry_id is ever reused or orphaned**.

### Taxonomy

The fixed controlled vocabulary used to populate `persona_tags`, `task_intent`, and `life_event_tags` on every [[Entry]] and every ranking request. Versioned as `taxonomy/v1.0`; each entry value is a short snake_case key (e.g. `freelancer`, `tax_filing`, `relocation`).

Two layers per axis:

- **Primary (closed enum)** — the only values that participate in ranking, caching, and [[content_fingerprint]]. ~20–30 keys per axis at v1.0.
- **Free tags** — additional descriptive keywords on an [[Entry]] only; never used for ranking input, cache key, or fingerprint. Captures gaps; a free tag whose observed frequency crosses a threshold becomes a candidate for promotion to the primary enum in the next taxonomy version (v1.0 → v1.1 schema migration).

The taxonomy itself is exposed as an MCP Resource (`resource://taxonomy/v1.0`) so clients can build valid ranking-input payloads without guessing strings.

### Ranking pipeline

The ranking pipeline is **five-stage context-filter / safety-gate / score / SR-shape / cut**, not a single weighted sum. Safety and confidence are gates, not score terms.

**Stage 0 — Context-keyed candidate filter.** Bounds the candidate set to keep Stage 2 within a known cost envelope and to keep the rank result responsive to the request context. An Entry enters Stage 1 only if **at least one** of the following set overlaps is non-empty:

- `entry.persona_tags ∩ req.persona`
- `entry.task_intent ∩ req.intent` (also accepting `entry.canonical_intent` membership)
- `entry.life_event_tags ∩ req.life_event`

If the request carries **no taxonomy context at all** (the documented empty-payload fallback in [[Context extraction boundary]]), Stage 0 instead admits the top `N=500` Entries by `confidence_score DESC` as a deterministic baseline.

`region` is treated as a **strict exclusion** at Stage 0: when the request specifies `region`, an Entry is dropped unless `entry.region` is `nationwide` or matches one of the requested regions. Region mismatch is administrative impossibility, not a relevance penalty, and must not survive into the score.

Stage 0 is the only stage whose population depends on the request context. Subsequent stages operate only on the Stage-0 admitted set.

**Stage 1 — Safety/quality gate.** An Entry is dropped from the candidate set if any of:
- `confidence_score < 0.85`
- `status != "published"`
- `merged_into != null`
- `menu_path` is missing (violates [[Handoff]] floor)

**Stage 2 — Positive-feature score.** Nine of the eleven Feature Dictionary entries participate:
`IF, PF, LF, SE, UR, AC, EV, api_availability, freshness`.
Two features are deliberately excluded — `sensitivity_risk` (safety gate, see Stage 3) and `official_handoff_need` (handled by [[access_mode]]-driven CTA, not by the score; excluding it avoids a zero-sum conflict with `api_availability`).
`Q(entry) = Σ_i  S_entry[i] × W_context[i]`, with `Σ W_context[i] = 1` (weights normalised per request).

**Stage 3 — SR-driven adjustment.** `sensitivity_risk` shapes presentation, not score:
- `SR ≥ 0.85` → `ui_slot` capped at `secondary_card` (never `primary_card`).
- `SR ≥ 0.85` → `safe_copy_rule = "confirm_not_assert"` enforced.

**Stage 4 — Top-K cut + slot assignment.** Sort by Q descending, take `top_k`, then assign `ui_slot` honouring the Stage-3 caps.

Consequence: `explain_ranking` can answer "why not shown?" (Stage 0 context miss / region exclusion, or Stage 1 safety reason) and "why this order?" (Stage 2 score breakdown) independently. The questions never collapse into a single number.

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

The Feature Dictionary v1.1 has **eleven** features produced in **four** ways. (The original eight grew when the API-first pivot added `freshness` plus two access-mode-derived features.)

**Intrinsic stored ordinal.** Authored at annotation time, stored on the [[Entry]] as `{low, medium, high}`. Mapped to numeric values at ranking time.

| label  | AC, EV | SR  |
| ------ | ------ | --- |
| low    | 0.20   | 0.10 |
| medium | 0.50   | 0.50 |
| high   | 0.85   | 0.90 |

Members: `actionability` (AC), `evidence_value` (EV), `sensitivity_risk` (SR).

**Source of these numbers.** The mapping is **data**, not code. It lives in `catalog/<version>/weights/<weights_version>.json` under two siblings of `W_base`:

- `score_ordinals` — keyed by `actionability`, `evidence_value`. Participates in Stage 2 Q.
- `gate_ordinals` — keyed by `sensitivity_risk`. Consumed only by the Stage 3 `SR ≥ 0.85` cap and `safe_copy_rule` enforcement; never multiplied into Q.

Changing any numeric here is a [[catalog_version]]-independent **[[weights_version]] patch** and requires an ADR. Loading is schema-validated at startup: a missing key or a non-`{low,medium,high}→number` shape throws on `CatalogStore.getWeights()`. The runtime is **not** permitted to fall back to defaults — a corrupted mapping must fail loudly, not silently drift the rank.

(`api_reliability` and `link_stability` were considered and dropped — without operational telemetry they would be dead-weight in v0.1, violating SLC "complete". They may return in a later release once monitoring data exists.)

**Intrinsic derived from `access_mode`.** Not stored — computed at Entry-load time from the [[access_mode]] field.

| access_mode      | api_availability | official_handoff_need |
| ---------------- | ---------------- | --------------------- |
| `api_cached`     | 1.0              | 0.0                   |
| `api_live`       | 1.0              | 0.0                   |
| `portal_handoff` | 0.0              | 1.0                   |
| `manual_check`   | 0.0              | 1.0                   |

Of these two, **`api_availability` participates in the [[Ranking pipeline]] Stage 2 score, while `official_handoff_need` does not**. The latter is consumed by the composer at presentation time — it drives `access_mode`-specific CTA wording and slot decisions — but is excluded from W_base to avoid a zero-sum conflict with `api_availability`. Both are still computed on every Entry so the composer and Stage 3 / safe_copy adjustments can reference them.

**Match (derived at ranking time from set overlap).** `IF`, `PF`, `LF`, `SE` — same as before.

- `IF = |entry.task_intent ∩ req.intent| / max(|req.intent|, 1)`
- `PF = |entry.persona_tags ∩ req.persona| / max(|req.persona|, 1)`
- `LF = |entry.life_event_tags ∩ req.life_event| / max(|req.life_event|, 1)`
- `SE = 1.0` if `entry.seasonality_hint == req.season`, `0.3` if adjacent month, else `0.0`.

**Time-derived (computed at ranking time).**

- `UR` (urgency) — a function of `entry.seasonality_hint` and the current date.
- `freshness` — a function of `entry.last_sync_at` (for `api_cached`/`api_live`) or `entry.last_verified_at` (for `portal_handoff`/`manual_check`) and the current date. Decays smoothly; e.g. `freshness = 1.0` if synced within 7 days, `0.5` at 30 days, `0.1` at 180 days.

Extending the [[Taxonomy]] from v1.0 → v1.1 still does **not** require re-annotating existing Entries (Match features stay derived). Adding telemetry-backed ordinals for `api_reliability` / `link_stability` is a `patch` bump per Entry once data accrues.

### W_context

The per-request weight vector applied to the positive features in the [[Ranking pipeline]]. The host LLM produces W **as part of the same call that produces structured context** (see [[Context extraction boundary]]).

**Resolution order at request time.** The MCP server walks the list top-to-bottom and uses the first branch that yields a usable W. Every produced W carries a `weight_source` tag that is returned in `include_debug` responses.

1. **Host-proposed W** *(primary path; tag `host_proposed`)* — the host LLM emits both `weight_override: number[]` **and** a non-empty `weight_rationale: string` (≥ 8 non-whitespace characters). The server then:
   - **Clips negatives.** Any `W[i] < 0` → 0.
   - **Caps per-feature ceiling.** Any `W[i] > clip_cap` → `clip_cap`. `clip_cap` is data (`weights/<weights_version>.json.clip_cap`, default 0.40); changing it is a [[weights_version]] patch, not a code change.
   - **Renormalises to Σ = 1.**
   - The rationale string is persisted to the rank-request log for [[explain_ranking]] auditability.
2. **Compositional fallback** *(tag `compositional_no_rationale`)* — if `weight_override` is present but `weight_rationale` is missing, empty, or shorter than 8 non-whitespace characters, **the host proposal is rejected** and W is computed from `clip(W_base + Σ_axis Δ_axis(req[axis])) / Σ`. The server does **not** silently accept a rationale-less proposal.
3. **Compositional fallback** *(tag `compositional_no_override`)* — if `weight_override` is absent, the same compositional formula applies.
4. **Compositional fallback** *(tag `compositional_total_zero`)* — if a host proposal passes (1)'s gates but reduces to all-zero after clipping (every component ≤ 0), the server falls back to compositional. **Uniform 1/N distribution is not a permitted W source** in v0.1 — it is the single behaviour from earlier code that contradicts this ADR and is removed.

**Per-feature ceiling rationale.** `clip_cap = 0.40` is approximately `2 × max(W_base)` (the largest W_base entry is `IF = 0.20`). The intent is: the host LLM may double-emphasise any single feature relative to the catalog baseline, but cannot collapse the rank into a single-axis sort. Without this cap a host proposal of `IF = 0.99` would degenerate the [[Ranking pipeline]] Stage 2 into "highest intent overlap wins, nothing else matters", undoing the multi-feature value proposition.

This reverses the earlier v0.1 decision to make compositional W canonical. Recorded in [[ADR-0006]]. The compositional path is retained as a baseline so that:

- Catalog `weights/v1.0.0.json` (W_base + Δ_axis tables, see [[Weights bootstrap]]) is still authored and shipped.
- Hosts without a proposal step (CI checks, debug clients, deterministic replay) still get reproducible rankings.
- [[explain_ranking]] (deferred past v0.1) can compare host-proposed W against the compositional baseline to surface "why this LLM chose differently".

Trade-offs adopted: per-query cache miss is the common case; rationale is **required** (not advisory) for any host proposal to be honoured; SR safety gate (Stage 1) is untouched — the LLM cannot weight its way around a `sensitivity_risk` block.

**weight_source exposure.** The chosen tag (`host_proposed` / `compositional_no_rationale` / `compositional_no_override` / `compositional_total_zero`) is part of the rank response only when `include_debug=true`. It never appears in the default L2 payload (see [[Exposure level]]).

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

**Match-rule semantics (fixed).** A segment's `match` block may contain multiple condition keys (e.g. `intent_any`, `season_any`, `persona_any`, `life_event_any`):

- **Across different keys: AND.** Every present key must match.
- **Within a single `_any` array: OR.** Any one value in the array satisfies that key.
- A `fallback: true` block matches unconditionally (used only by the `general` last-priority segment).

Example: `tax_season` with `intent_any = [tax_filing, tax_inquiry]` and `season_any = [jan, may]` matches when `(intent contains tax_filing OR tax_inquiry) AND (season is jan OR may)`. This convention is the implementation contract for the composer's segment resolver.

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

v0.1 ships an **in-process LRU rank cache** (see [[ADR-0014]]). Key shape:

```
hash(
  catalog_version, weights_version, taxonomy_version,
  sorted(persona), sorted(intent), sorted(life_event), sorted(region),
  season, access_mode, top_k,
  weight_override_hash
)
```

`weight_rationale` is intentionally **not** in the key — it does not change the result. The cache key carries the resolved W only, so all four `weight_source` outcomes (`host_proposed`, `compositional_no_rationale`, `compositional_no_override`, `compositional_total_zero` — see [[W_context]]) collapse to the same row whenever they produce identical W.

**Invalidation is by process restart only.** In the v0.1 stdio transport model, a `.dxt` update = new catalog/weights load = new process — the OS already guarantees invalidation. No version-change detection logic runs in the server. When [[MCP transport (v0.1)]] is eventually replaced by HTTP, the storage backend changes; the key shape above stays.

`cache_lru_size` (default 1024) lives in `weights/<weights_version>.json` and is a [[weights_version]]-patch tunable, not a code constant.

### Catalog source of truth

The Catalog is **JSON-in-git as source of truth, pre-compiled SQLite as runtime artifact shipped inside two distribution targets**. The distribution model is fixed by the product reality: the MCP server runs locally inside Claude Desktop, and the general user installs it through Claude Desktop's Extensions UI — not by running `npm`.

Three layers:

- **Source of truth (git, `catalog/<version>/*.json`)** — human- and AI-authored content; PR-reviewable; gated by the [[Review Queue]] and the [[Review Agent]]. This is where OSS contribution happens.
- **Build artifact (CI, `compiled.sqlite`)** — generated automatically by the publish pipeline from the JSON source. Smaller, indexed, instant-load. Bundled into both distribution targets below; never committed to git.
- **Runtime form (end user's machine)** — the installed package (whichever distribution target) contains both the MCP server binary and `compiled.sqlite`. Server starts via stdio in <100ms. The MCP server never compiles or fetches at runtime.

**Two distribution targets:**

- **Primary — `.dxt` Claude Desktop Extension** for general users. Three-click install in Claude Desktop's Extensions UI, no Node install, no JSON config, no env vars, no credentials. Bundles server + `compiled.sqlite` + `node_modules`. See [[Session 1.5]].
- **Secondary — `npm install -g portal-genui-mcp`** for developers validating the server during iteration. Requires manual `claude_desktop_config.json` entry. Not advertised to general users.

Catalog freshness: `.dxt` users get a new file from GitHub Releases each tag (and Claude Desktop's update UI surfaces it); npm users run `npm update -g`. Either way the server prints a stderr warning at start-up if its bundled `catalog_version` is older than ~30 days. No silent auto-update.

The v0.1 launch is a **single bundled snapshot**, not a daily end-user update obligation. Update fatigue from frequent SQLite snapshots and a cloud DB / local DB two-track split are deferred to a v0.2 ADR after release telemetry; v0.1 stays local `.dxt`-first with no runtime fetch, auth, or background update.

This makes the JSON / SQLite split **transparent to both contributors and end users** — contributors see only JSON, end users see only a working extension.

### Launch readiness gate

The set of conditions that mark v0.1 as ready to ship under the SLC "Complete" criterion of [[ADR-0009]]. The earlier implicit promise of "10,972 published Entries" is **replaced** by an explicit **axis coverage** definition. Absolute Entry count is now a by-product, not a target.

**Coverage rule.** Every value in the primary closed enum of every [[Taxonomy]] axis must be covered by **N ≥ 20** `status="published"` Entries.

- `persona`, `intent`, `life_event` — N = 20 each. ("Covered" means the enum value appears in the Entry's matching tag array; `confidence_score` ≥ Stage-1 gate is sufficient, no extra confidence inflation.)
- `region` — N = 20 for the 17 광역시도 + `nationwide`. Sub-광역 시군구 values are **not** launch-gated; they accrete naturally post-launch.

**Sensitive-domain reinforcement.** When the axis value is in `sensitive_domains = ["tax", "welfare", "family", "immigration", "legal"]`, **100 %** of its N Entries must carry a maintainer-recorded approval in the PR audit trail (`api_cached` rows escalated under [[Review Queue]] rules; `portal_handoff` rows already escalated unconditionally). This binds [[ADR-0008]]'s sensitive-domain policy to the launch gate so GIGO pressure cannot relax it.

**Readiness ≠ launch.** Meeting the gate makes v0.1 *eligible* to ship. The actual release is still a maintainer-triggered tag. Automation surfaces readiness; it does not pull the trigger.

**Measurement.** A read-only `npm run coverage` script is the single source of truth for gate status: per-axis × per-value `(published_count, sensitive_approval_ratio)` matrix printed to stdout, plus a one-line `READY / NOT READY` verdict. The script is itself PR-reviewable and is the only acceptable evidence in launch checklists. Spreadsheets, manual counts, and "looks about right" are not.

### Publish cadence

PR merges to `main` do **not** themselves publish. Each merge is a staging-only update. After v0.1 launch, two automated jobs may produce published versions when maintainers enable the normal cadence:

- **Daily `patch`** — every day at 00:00 KST, CI inspects diffs since the last tag. If only `patch`-level changes exist (copy fixes, tier1→tier2 [[Handoff]] downgrades, `last_sync_at` / `last_verified_at` updates, free_tag updates), CI tags `catalog@MAJOR.MINOR.PATCH+1`, builds the npm package, and publishes.
- **Weekly `minor`** — on a fixed weekday, if Entries were added or removed since the last `minor` tag, CI bumps `MINOR`, resets `PATCH=0`, builds, publishes.
- **`major`** — manual maintainer-triggered (schema or [[Taxonomy]] breaking change).

End users get exactly one observable release per day on the patch cadence, regardless of internal PR volume.

### MCP transport (v0.1)

The v0.1 transport is **stdio**, hosted in the user's Claude Desktop process. Per-user local instance. Each user pulls the published Catalog snapshot they want (default: latest tagged release) and the MCP server runs against that local copy.

Consequences:
- No multi-instance synchronisation problem during v0.1.
- No auth surface during v0.1.
- HTTP transport is a later capability triggered by a need to share infra across users; the architecture above does not depend on the transport choice.

### Review Queue

The gate that promotes an [[EntryCandidate]] (or any catalog change PR) into a published [[Entry]]. Operated as GitHub PR review, but with an **AI Review Agent as the first-pass reviewer** and the human maintainer as escalation-only. The CODEOWNERS policy still routes every `catalog/**` change to the maintainer, but the maintainer's effective workload is the escalated minority, not every candidate.

Confidence-driven routing of automation output:

| confidence_score        | route                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| `≥ 0.85`                | auto-accepted by [[Review Agent]] if rubric passes; surfaces in draft PR |
| `[0.60, 0.85)`          | [[Review Agent]] applies full rubric and posts findings; not auto-accepted until confidence reaches 0.85 |
| `< 0.60`                | escalate to maintainer; agent provides a structured analysis but cannot accept |

**Sensitive-domain review gate is access-mode-aware.** v0.1 `sensitive_domains = ["tax", "welfare", "family", "immigration", "legal"]`. Sensitive `portal_handoff` / `manual_check` Entries are forced into maintainer review because the source record depends on LLM/interpreter reading of a portal screen and the card copy may encode that interpretation. Sensitive `api_cached` Entries are not automatically maintainer-blocked when they come from a structured official API row: the Review Agent may auto-accept them only if confidence is ≥ 0.85, the rubric passes, `safe_copy_rule = "confirm_not_assert"`, and safe-copy lint/audit pass. Otherwise they escalate. Schema enforces the fields; policy decides the route.

**Bot auto-merge** is limited to pure data corrections: tier1→tier2 [[Handoff]] downgrades from health-check, `last_verified_at` / `last_sync_at` refreshes, formatting-only changes. Anything touching `card_title`, `card_body`, `cta_label`, taxonomy tags, intrinsic ordinals, or `access_mode` goes through the Review Agent + maintainer-as-needed path.

**v0.1 operational assumption:** the maintainer operates 1+ AI Review Agents, so the throughput ceiling is the agent's, not the human's. The maintainer reviews escalations (estimated ≤ 10 % of candidates at v0.1 scale).

### Review Agent

An AI agent (Claude Code, Codex, or equivalent) tasked with first-pass review of every [[EntryCandidate]] PR. Reads the candidate JSON plus its source `RawPageRecord` (for portal-handoff) or source API row (for api_cached), and applies a fixed rubric:

1. Taxonomy enum compliance (no values outside `taxonomy/v1.0`).
2. `menu_path` present (the [[Handoff]] floor).
3. `card_copy` length-cap compliance and [[safe_copy_rule]] lint pass (no assertive phrases).
4. Intrinsic ordinal sanity (e.g. an Entry tagged `sensitive_domain=tax` must have `sensitivity_risk ≥ medium`).
5. `access_mode` matches the source pipeline (api_cached candidates must carry `api_ref`; portal_handoff must carry tier-resolved [[Handoff]] object).

On rubric pass + confidence ≥ 0.85 + either non-sensitive domain or sensitive `api_cached` with `confirm_not_assert` audit pass: agent posts an approval comment and the PR is auto-mergeable.
On rubric fail, confidence < 0.85, or sensitive `portal_handoff` / `manual_check`: agent posts a structured findings comment and tags the maintainer.

The Review Agent's prompt + rubric checklist itself is versioned in `tooling/review-agent/` and PR-reviewable; changing it is a separate concern from `catalog_version`.

**Throughput.** At v0.1 launch the Catalog is built from scratch (gov24 national + regional, plus hand-curated portal_handoff and Evidence rows — estimated ~10k Entries). A single-agent serial pass would block launch by ~24+ hours. The Review Agent therefore runs as **N parallel agents over disjoint chunks** (N≈8 at v0.1). After launch, the daily incremental delta is small enough for a single agent. The chunk runner lives in `tooling/review-agent/runner/` and is itself PR-reviewable.

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

The fixed set of host names that may appear in any tier1 / tier2 URL or in any `api_ref` endpoint. Currently:

| host              | role                                                            | user-facing? |
| ----------------- | --------------------------------------------------------------- | ------------ |
| `hometax.go.kr`   | tier1 / tier2 [[Handoff]] target for tax actions                | yes          |
| `gov.kr`          | tier1 / tier2 [[Handoff]] target for civic-service actions      | yes          |
| `data.go.kr`      | dataset metadata pages referenced in [[Evidence Registry]]      | yes          |
| `api.odcloud.kr`  | gov24 / NTS / data.go.kr API endpoints (api_cached sync source) | no — internal source only; never surfaced as a card CTA |

Any URL outside this allowlist is rejected at publish time. `api.odcloud.kr` is in the list because it is the canonical host for the API operations driving the api-refresh-pipeline; it is treated as an **internal source**, not as a user-facing CTA target. The composer never renders `api.odcloud.kr` URLs in card UI.
