# Stage 0 context-keyed candidate filter

[[ADR-0005]] defined a four-stage `filter → score → SR-shape → cut` pipeline whose first stage was a pure safety/quality gate (`confidence_score ≥ 0.85`, `status = published`, `merged_into = null`, `menu_path` present). At v0.1 launch scale (≈10k Entries) the runtime then ranked an unbounded candidate set, which the implementation truncated by an arbitrary `LIMIT 100 ORDER BY confidence_score DESC` SQL clause inside `CatalogStore.queryEntries`. That truncation **discarded the request context** before scoring — meaning a fixed top-100 by confidence was scored against every user query, and any Entry past the 100th most confident never reached Stage 2 regardless of how well it matched the user's persona/intent/life_event. The product promise of "상황마다 재정렬" was structurally unreachable. We insert a **Stage 0 context-keyed candidate filter** between the catalog and the Stage 1 safety gate. An Entry enters Stage 1 only if it intersects the request on at least one of `persona`, `intent`, or `life_event`. If the request carries no taxonomy context, Stage 0 admits the top `N = 500` Entries by `confidence_score DESC` as a deterministic baseline. `region` is treated as a **strict exclusion**: when the request specifies `region`, an Entry is dropped unless `entry.region` is `nationwide` or matches a requested region.

## Considered options

- **Drop only Stage 1 and pass every `published` Entry to Stage 2.** Solves the context-blindness symptom but unbounded Stage 2 cost as the catalog grows; also wastes compute on Entries that can never plausibly rank.
- **Free-text pre-filter at the MCP boundary** (the external critique's suggestion). Rejected: `rank_portal_entries` does not accept free text — [[ADR-0006]] and [[Context extraction boundary]] fix the host LLM as the only translator from utterance to structured taxonomy. A free-text input would re-introduce the very surface those decisions removed.
- **Keep `LIMIT 100` by `confidence_score`.** Rejected — the failure mode is documented above.
- **Per-axis required intersections (AND across persona/intent/life_event).** Rejected: at v0.1 catalog density most queries would empty the candidate set, producing zero-result responses on perfectly reasonable utterances. OR-of-axes is the floor for "발견(discovery)".

## Consequences

- The [[Ranking pipeline]] becomes a five-stage `context-filter → safety-gate → score → SR-shape → cut`. CONTEXT.md is updated; [[ADR-0005]] is amended (its body still describes four stages — readers should treat this ADR as the authoritative shape).
- "Why not shown?" gains a new permissible answer: *Stage 0 missed*. [[explain_ranking]] (deferred past v0.1) must distinguish Stage 0 (context overlap empty) from Stage 1 (safety gate) and Stage 2 (low Q).
- The `N = 500` empty-context fallback is a tunable, not a constant. It lives in `weights/<weights_version>.json.stage0_empty_context_top_n`; changing it is a [[weights_version]] patch.
- `region` mismatch is no longer a relevance penalty — it is administrative impossibility, removed at Stage 0. The Stage 2 score never sees the value, which prevents a high-IF `nationwide` Entry from out-ranking a region-correct local Entry by score accident.
- Implementation lands in `CatalogStore.queryEntries` (axis-aware WHERE) or a new `queryStage0Admitted` method; the choice is left to the executor (codex). The new SQL must use indexed taxonomy lookups to avoid replacing the old O(N) scan with a different O(N) scan.
