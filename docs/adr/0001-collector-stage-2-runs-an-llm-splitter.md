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
