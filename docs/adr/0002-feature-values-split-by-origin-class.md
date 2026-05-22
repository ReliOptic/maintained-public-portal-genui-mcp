# Feature values split by origin class

The architecture v0.1 document §4 listed eight ranking features (IF, PF, LF, SE, UR, AC, SR, EV) as if they were a uniform per-Entry vector. We split them by **how the value is produced** rather than storing all eight on every Entry. Intrinsic features (`actionability`, `evidence_value`, `sensitivity_risk`) are stored as `{low, medium, high}` ordinals on the Entry. Match features (`IF`, `PF`, `LF`, `SE`) are **not stored** — they are computed at ranking time from set overlap between the Entry's [[Taxonomy]] tags and the request payload. The urgency feature (`UR`) is time-derived from `seasonality_hint` and the current date.

## Considered options

- **LLM emits all eight as [0,1] floats per Entry.** Rejected because LLM annotators do not produce calibrated floating-point scores; review degenerates to "is 0.84 right?" which has no rubric.
- **All eight stored as context-independent defaults.** Rejected: it kills the architecture-doc §5 promise that "같은 Entry라도 상황에 따라 UI 순서가 달라진다."
- **Embedding cosine as the single feature.** Rejected: collapses [[explain_ranking]] into one number, blocks the safety gate.

## Consequences

- Extending the taxonomy from v1.0 → v1.1 does **not** require re-annotating existing Entries — only new `Δ_axis` rows. Match values recompute themselves.
- The annotation rubric only has to define `low/medium/high` for AC, EV, SR — a small, reviewable surface.
- `explain_ranking` (deferred past v0.1) will need three separate explanation traces (intrinsic, match, time), not one weight vector trace.
