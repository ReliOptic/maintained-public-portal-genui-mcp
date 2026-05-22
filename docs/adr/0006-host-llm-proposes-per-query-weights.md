# Host LLM proposes per-query W; compositional baseline retained as fallback

The earlier grilling-session Q9 fixed `W = clip(W_base + Σ_axis Δ_axis(req[axis])) / Σ` as canonical. We now reverse that: the host LLM **emits a `weight_override` vector together with the structured context** in the same call, and the MCP server clips negatives, renormalises to Σ = 1, and uses the host's W. The compositional baseline still runs when `weight_override` is absent — it is the deterministic fallback used by debug clients, CI replay, and any host that cannot propose weights. The reason for the reversal: a static `Δ_axis` lookup table cannot encode the host's interpretation of a nuanced user utterance ("프리랜서인데 5월에 세금이랑 지원금 뭐 확인해야 하지?"), and an AI gateway that ignores the host's read is "AI" in name only.

## Considered options

- **Compositional W as canonical (Q9 original).** Deterministic and cache-friendly, but the table is hand-tuned and cannot reflect query-specific intent.
- **Hybrid: compositional default + LLM override only on "ambiguous" queries.** Rejected — detecting ambiguity itself takes another LLM call, and the boundary is fuzzy.
- **LTR ML.** Deferred — no logged user data exists in v0.1.

## Consequences

- Cache key for `rank_portal_entries` gains a `weight_override_hash` component; per-query cache hits become rare and acceptable.
- The Stage-1 safety gate ([[ADR-0005]]) is untouched: `confidence_score`, `merged_into`, and `sensitivity_risk` blocks survive because they are evaluated before the score is applied.
- `explain_ranking` (deferred past v0.1) must surface the host's `weight_rationale` alongside the feature-score breakdown.
- `weights/v1.0.0.json` (W_base + Δ_axis tables) is still authored, shipped, and version-tagged — it is the fallback, not dead code.
