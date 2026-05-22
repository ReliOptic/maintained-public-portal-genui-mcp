# Two-stage filter-then-score ranking

The architecture v0.1 document §4 expressed ranking as `Q = S_entry × W_context` over all eight features. We replace that with a four-stage pipeline:

1. **Safety / quality gate** drops the candidate if `confidence_score < 0.85`, status is not `published`, `merged_into != null`, or `menu_path` is missing.
2. **Positive-feature score** computes `Q = Σ_i S_entry[i] × W_context[i]` over the **seven positive** features (IF, PF, LF, SE, UR, AC, EV). `sensitivity_risk` is **excluded** from the score.
3. **SR-driven presentation adjustment** caps `ui_slot` at `secondary_card` when `SR ≥ 0.85` and forces `safe_copy_rule = "confirm_not_assert"`.
4. **Top-K cut and slot assignment.**

`sensitivity_risk` and `confidence_score` are **gates and presentation modifiers, never score terms**.

## Considered options

- **Pure dot product (§4 literal).** Rejected: under a literal `Q = S × W`, a high `sensitivity_risk` raises the score (because weights are positive), which is the opposite of the safety intent. Also collapses "why not shown?" and "why this order?" into one number.
- **`Q = Σ positive_sum − λ · SR`.** Rejected: blurs the safety boundary with the relevance score, making [[explain_ranking]] ambiguous ("low score because of safety or because of fit?").
- **Learning-to-rank ML model.** Rejected for v0.1 — no logged user interactions exist yet.

## Consequences

- `explain_ranking` (deferred past v0.1) can answer "why not shown?" and "why this order?" from disjoint mechanisms — the gate result and the weighted-sum trace.
- The Stage 1 gate is hard-coded thresholds; tuning them is a `weights_version` patch (not a Catalog change), kept separate from any per-Entry data change.
- `compose_genui_artifact` can trust `ui_slot` and `safe_copy_rule` on every result item — they are already post-Stage-3.
