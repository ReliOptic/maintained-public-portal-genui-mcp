# Host W clipping and rationale enforcement

[[ADR-0006]] made the host LLM's `weight_override` the primary source of `W_context`, with the compositional `W_base + Σ Δ_axis` retained as a fallback. The ADR text says the server "clips negatives, renormalises to Σ = 1" and that "rationale must be returned by the host for auditability". The implementation in `src/services/ranker.ts` (`normalizeWeights`) clips negatives and renormalises but has **no per-feature ceiling**, accepts requests without `weight_rationale`, and on the all-zero-after-clip degenerate case silently distributes `1/N` across the nine positive features. The first gap means a host that emits `{ IF: 0.99, … : ~0 }` collapses the Stage 2 score into a single-axis sort, undoing the multi-feature value proposition. The second gap means the launched product cannot honour the [[explain_ranking]] auditability promise after launch. The third gap is a third weight source — uniform distribution — that contradicts ADR-0006's text and silently shapes user-visible rank when a malformed proposal arrives. We tighten the host-W path to three rules: per-feature ceiling `clip_cap = 0.40` (data, in `weights/<weights_version>.json.clip_cap`); `weight_rationale` is required (`≥ 8` non-whitespace characters) for any host proposal to be honoured; if a host proposal passes type checks but reduces to all-zero after clipping, the server falls back to **compositional** W (not uniform).

## Considered options

- **Keep the current normaliser (negatives + Σ).** Rejected: the IF-monopoly degenerate case above; rationale missing; uniform-fallback contradicts [[ADR-0006]].
- **Distance-from-baseline limit (`||W − W_base||₁ ≤ threshold`).** Rejected: introduces a second threshold whose value has no obvious calibration; per-feature ceiling is intuitive ("no single axis above 0.40") and lives in the same JSON as everything else.
- **Rationale as soft signal (logged, not enforced).** Rejected: by the time logs are queried, the rationale-less period is fossilised into launch data. [[explain_ranking]] is the future product surface that needs this; the cost of enforcement is zero at v0.1.
- **Reject the entire proposal on any single violation (no salvage).** Rejected: throws away signal from an otherwise correct proposal. Clip-and-renormalise preserves intent while bounding the worst case.

## Consequences

- `weights/v1.0.0.json` gains `clip_cap` (default 0.40 ≈ 2 × max(`W_base`)). Changing this value is a [[weights_version]] patch + ADR.
- `server.ts`'s zod schema gains `weight_rationale: z.string().min(8).regex(/\S{8,}/)` semantics (length is measured after whitespace).
- `mcp-tools.ts` and `ranker.ts`: the all-zero degenerate path no longer returns `1/N`. It returns the compositional fallback. The branch is reachable but the result space is one fewer mode.
- Response carries `weight_source: "host_proposed" | "compositional_no_rationale" | "compositional_no_override" | "compositional_total_zero"` (only when `include_debug = true`). The runtime cache key (see [[ADR-0014]]) keys on the *resolved* W's hash, so the four sources are not separate cache rows — they collapse to the same key whenever they produce identical W.
- [[explain_ranking]], when it lands, can use `weight_source` and the persisted `weight_rationale` to surface "why this LLM chose differently from baseline" without retroactive log mining.
