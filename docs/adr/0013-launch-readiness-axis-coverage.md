# Launch readiness gate = taxonomy axis coverage

[[ADR-0009]] codified v0.1 as a single-shot SLC launch and stated that "Catalog grows to ≈10k Entries". Together with [[ADR-0008]]'s "estimated ~10k Entries" and README's "v0.1 catalog target is 10,972 entries", an **implicit absolute-count promise** had hardened: a launch was felt to require `10,972` published Entries. The implicit promise creates a perverse incentive: when 10,972 is the target, the only way to miss the target is the [[Review Agent]] rubric rejecting too many candidates — which puts pressure on the rubric to soften. That softening is exactly the GIGO failure mode external critique warned about. We replace the absolute-count target with an explicit **axis coverage gate**. The launch is *eligible* when every value in the primary closed enum of every [[Taxonomy]] axis is covered by **N ≥ 20** `status = published` Entries (`persona`, `intent`, `life_event`, and `region`-restricted-to-광역+`nationwide`). Sub-광역 시군구 values are not gated. Sensitive-domain axis values (`tax`, `welfare`, `family`, `immigration`, `legal`) require **100 %** of their N to carry a maintainer-recorded PR approval. Total Entry count is a by-product, not a target. Readiness is detected by a read-only `npm run coverage` script — the only acceptable launch checklist evidence.

## Considered options

- **Keep "≈10k Entries" as the implicit target.** Rejected: the GIGO incentive structure described above.
- **Two-phase: `published` cohort plus a `draft` cohort.** Rejected: a catalog whose visible count and total count diverge creates cognitive dissonance both for end users ("왜 어떤 건 안 나오지?") and contributors (which set are they editing for?).
- **Composite quantitative gate** (e.g., `{published ≥ 80%, avg confidence ≥ 0.88, …}`). Rejected: every additional metric is another decision to author and another softening surface. Axis coverage is one rule.
- **Coverage gate + count target combined.** Rejected: redundant — meeting coverage at N = 20 across all axes already implies a several-thousand published floor.

## Consequences

- The README's "v0.1 catalog target is 10,972 entries" sentence is downgraded to a *scope description* of the source data, not a launch criterion.
- `npm run coverage` becomes a first-class artifact. Its output is the only evidence that satisfies the launch checklist; spreadsheets and manual counts do not. The script must be read-only against `compiled.sqlite` and produce both the axis × value matrix and a one-line `READY / NOT READY` verdict.
- The launch trigger is decoupled from coverage detection. Coverage going `READY` does not automatically tag a release — a maintainer call is still required. This preserves [[ADR-0009]]'s single-shot launch posture.
- [[ADR-0008]]'s sensitive-domain policy is **structurally bound to the gate**. Sensitive-domain `api_cached` Entries that the Review Agent could otherwise auto-accept are still launch-relevant in their per-value cohort: the maintainer-approval ratio is what the gate measures, not just published count.
- [[ADR-0010]]'s Stage 0 context filter has a defensible product foundation only when coverage holds: an axis value that no Entry covers will always Stage-0-fail, which would be a UX failure if launched in that state.
- Empty or thin sub-광역 region coverage is acknowledged as acceptable for v0.1 launch. It is the natural growth surface for post-launch contribution.
