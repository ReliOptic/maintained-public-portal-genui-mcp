# Catalog Review Agent Rubric v0.1

Maintainer-side only. The Review Agent reviews generated `catalog/**` EntryCandidate JSON before draft PR merge. It never publishes a catalog tag.

## Pass/fail checks

1. Taxonomy enum compliance: every `persona_tags`, `task_intent`, `life_event_tags`, `region_tags`, `seasonality_hint`, and `access_mode` value must exist in `catalog/v1.0.0/taxonomy/v1.0.json`.
2. Handoff floor: every candidate must have `menu_path` and `handoff.menu_path`; `handoff.tier` must be one of `tier1`, `tier2`, `tier3`.
3. Copy length caps: `card_title <= 40`, `card_body <= 120`, `cta_label <= 20` Korean characters.
4. Safe-copy lint: reject assertion patterns listed in `catalog/v1.0.0/safety-policy/v1.0.md`.
5. Ordinal sanity: `actionability`, `evidence_value`, `sensitivity_risk` must be low/medium/high. Sensitive tax/welfare/family/immigration/legal entries must have `sensitivity_risk` medium or high.
6. Access-mode/source consistency: `api_cached` entries require `api_ref`, `api_payload_keys`, and `last_sync_at`; `portal_handoff`/`manual_check` entries require source URLs and `last_verified_at`.
7. Evidence references: every `evidence_refs[]` id must exist in `catalog/v1.0.0/evidence/*.json` or `catalog/v1.0.0/evidence-seed.yaml`.

## Classification

- Auto-accept: rubric pass, `confidence_score >= 0.85`, and no `sensitive_domain`.
- Escalate: any rubric failure, `confidence_score < 0.85`, or `sensitive_domain` present.
