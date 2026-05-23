# Collector Stage 2 runs an LLM splitter

The architecture v0.1 document §3.1 explicitly excluded LLMs from the Collector ("Collector는 LLM 업무가 아닙니다"). We reverse that for Stage 2: producing one [[Entry]] per [[Leaf Service]] from a raw portal page requires semantic judgment that no rule-based parser can reliably make — a single page typically hosts several actions ("신고", "조회", "안내") that share menu_path and URL prefix but are distinct Leaf Services, while different URLs sometimes describe the same Leaf Service. Stage 1 (agentic capture via Codex computer use) remains non-semantic; Stage 2 produces `EntryCandidate`s by LLM with `confidence_score`, routed through the [[Human Review Queue]].

## Considered options

- **Pure rule-based parser.** Could split on verbs (`신고`/`조회`/`신청`) but cannot decide when verb co-occurrence on one page indicates separate Leaf Services vs sub-actions of one Service. Rejected.
- **Human-curated seed catalog at scale.** Doc §10 explicitly says full hand mapping is infeasible. Rejected as the bulk path; humans now review automation output, not author it.
- **URL-as-Entry + post-hoc dedup.** Regresses Q1 to the rejected page-level Entry unit and makes `actionability` / `persona_fit` meaningless at storage time.

## Consequences

- The Collector has an LLM operational dependency (cost, rate limits, latency on ingestion).
- Annotation pipeline owns the same LLM trust surface as Stage 2 — both gate through the same confidence/review thresholds.
- Re-runs of Stage 2 must be deterministic w.r.t. [[content_fingerprint]] inputs, otherwise `entry_id` stability breaks. The `canonical_intent` / `canonical_action_verb` normalisation step is the load-bearing piece.

## Amendment (API-first session)

Status for v0.1: **policy accepted, runtime deactivated**. Under [[ADR-0007]] the api-refresh-pipeline does not invoke Stage 2 at all (API rows are 1:1 with Entries), and [[ADR-0009]] removes Stage 2 from the portal-refresh-pipeline as well — the maintainer pre-splits multi-Task pages into leaf URLs in the seed file. The policy remains the codified answer for future scale; the runtime activates in a later release when handoff seed volume justifies the LLM cost.

## Amendment (cross-source dedup, API-first follow-up)

The v0.1 fingerprint formula in this ADR was `portal | canonical_intent | canonical_action_verb | sorted_keywords`. With four Task sources now feeding the same Catalog (gov24, 복지로 central, 복지로 regional, 워크넷 정부지원일자리), the same Leaf Service can appear in multiple sources. We therefore **remove `portal` from the fingerprint inputs in v0.1** so cross-source duplicates collapse to a single Entry under primary-source priority (see [[Task source]] in CONTEXT.md).

Revised v0.1 fingerprint: `canonical_intent | canonical_action_verb | normalized_title | region_scope | persona_scope`. The original ADR-0001 fingerprint formula is the design-time policy; the v0.1 implementation uses this portal-free variant.

Implementation binding: source-specific row identity such as `gov24-serviceList:{row_id}` belongs in `api_ref` / `secondary_sources`, not in `content_fingerprint`. The maintainer pipeline writes `semantic:v1|...` fingerprints and runs a cross-source dedup pass before Review Agent chunking. Same-source repeats are not automatically collapsed in Session 1; only duplicates spanning two or more registered Task sources are merged under the primary-source priority in CONTEXT.md.

The hand-curated NTS Live Check Entry is **excluded from this dedup pool** — it does not come from the row stream and never participates in fingerprint matching.
