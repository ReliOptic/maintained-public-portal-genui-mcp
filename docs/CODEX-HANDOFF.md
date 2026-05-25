# Codex Handoff — v0.1 grilling-session implementation brief

This document is the single source of execution truth for the code patches that close the gaps surfaced by the grilling session of 2026-05-25. Every decision is fixed in ADR-0010 through ADR-0014 and in CONTEXT.md; this file is the implementation index, not a re-debate surface.

## Read first (required, in order)

1. `CONTEXT.md` — sections `Ranking pipeline`, `Feature value origin`, `W_context`, `catalog_version`, `Launch readiness gate`.
2. `docs/adr/0010-stage-0-context-keyed-candidate-filter.md`
3. `docs/adr/0011-ordinal-mapping-in-weights-json.md`
4. `docs/adr/0012-host-w-clipping-and-rationale-enforcement.md`
5. `docs/adr/0013-launch-readiness-axis-coverage.md`
6. `docs/adr/0014-in-process-lru-rank-cache.md`

Do **not** alter any decision recorded above. If implementation reveals that a decision is unsafe, stop and raise — do not amend silently.

## House rules (project-wide, enforced)

- `CLAUDE.md` ground rules apply verbatim: file ≤ 200 lines, function ≤ 50 lines, no `any`, named exports only, kebab-case files, structured logging on every side effect, no `process.env` outside `src/config/`.
- Service creation triplet: `src/services/<name>.ts` + `src/types/<name>.types.ts` + `tests/unit/<name>.test.ts` — none of the three is optional.
- All numeric and policy tunables introduced below **must** land in `catalog/v1.0.0/weights/<weights_version>.json`, never as code constants.
- Run `npm run build && npm test` after each task and report pass/fail before opening the next.

## Weights JSON additions (single migration, do this first)

Add these sibling keys to `catalog/v1.0.0/weights/v1.0.0.json`. They become part of `weights_version = 1.0.0` and the runtime must zod-validate them at startup:

```jsonc
{
  // existing: weights_version, feature_order, W_base, W_base_sum, delta_axis ...

  "score_ordinals": {
    "actionability":   { "low": 0.20, "medium": 0.50, "high": 0.85 },
    "evidence_value":  { "low": 0.20, "medium": 0.50, "high": 0.85 }
  },
  "gate_ordinals": {
    "sensitivity_risk":{ "low": 0.10, "medium": 0.50, "high": 0.90 }
  },
  "clip_cap": 0.40,
  "stage0_empty_context_top_n": 500,
  "cache_lru_size": 1024
}
```

Bump nothing else in the JSON. Numbers are frozen until v0.1 ships.

Re-run `npm run compile` so `catalog/compiled.sqlite` carries the new `weights` row payload. Verify with `sqlite3 catalog/compiled.sqlite "SELECT payload_json FROM weights"` — the new keys must round-trip.

## Task units (execute in listed order — each depends on the previous landing first)

### Task 1 — Ordinal mapping moves to weights JSON (ADR-0011)

- **Goal**: remove `ORDINALS` and `SENSITIVITY` from `src/services/ranker.ts`. Ranker reads `score_ordinals` and `gate_ordinals` from the loaded weights payload.
- **Boundary**: `rankEntries` signature change — pass resolved `score_ordinals` / `gate_ordinals` alongside `weightsPayload`, or factor the resolved bundle into a `RankerConfig` type in `src/types/ranking.ts`.
- **Startup validation**: a new `src/services/weights-loader.ts` (or extend `catalog.ts`) zod-parses the weights payload at `CatalogStore.getWeights()` and **throws** on missing or malformed shape. Server must refuse to start; no silent defaults.
- **Tests**: `tests/unit/ranker.test.ts` is updated to inject a `RankerConfig` fixture; add a case that asserts startup-throw on missing `score_ordinals`.

### Task 2 — Stage 0 context-keyed candidate filter (ADR-0010)

- **Goal**: insert a context-keyed filter before Stage 1.
- **Implementation**: extend `CatalogStore.queryEntries` (or add `queryStage0Admitted`) so the SQL `WHERE` clause includes axis-overlap predicates and `region` exclusion. The empty-context branch returns top `stage0_empty_context_top_n` by `confidence_score DESC`. Existing `LIMIT 100` in `mcp-tools.ts` is **removed** — Stage 0 now bounds the candidate set.
- **`region` semantics**: `entry.region` may be `nationwide`, an array of 광역 codes, or an array including 시군구 codes. Strict-match means `request.region ∩ entry.region ≠ ∅` OR `entry.region` contains `nationwide`. Sub-광역 mismatch is not gated.
- **Indexes**: add SQLite indexes on `taxonomy` lookup columns if the new WHERE would otherwise be a full scan. Verify with `EXPLAIN QUERY PLAN`.
- **Tests**: `tests/unit/ranker.test.ts` and a new `tests/unit/catalog-store.stage0.test.ts` cover: (a) axis OR overlap admits expected ids; (b) empty context returns top-N by confidence; (c) region mismatch drops Entry; (d) `nationwide` survives region-specific request.

### Task 3 — Host W clipping and rationale enforcement (ADR-0012)

- **Goal**: tighten `normalizeWeights` in `src/services/ranker.ts` and the `weight_override` schema in `src/server.ts`.
- **Schema (`server.ts`)**: `rank_portal_entries` and `compose_genui_artifact` accept an **optional object**: `weight_override` (the existing number-array or per-feature object) **and** `weight_rationale: z.string().refine(s => s.replace(/\s/g,"").length >= 8)`. If `weight_override` present but `weight_rationale` fails, **drop the override and use compositional fallback** — return `weight_source: "compositional_no_rationale"` in `include_debug` responses; do not error.
- **Normaliser**: in this order — (1) clip negatives to 0; (2) clip values above `clip_cap` down to `clip_cap`; (3) renormalise to Σ=1. If the post-clip sum is ≤ 0, return compositional fallback with tag `compositional_total_zero` (never `1/N`).
- **`weight_source` plumbing**: thread the tag from the resolver to the rank-tool response; expose **only** when `include_debug = true`.
- **Tests**: `tests/unit/ranker.test.ts` cases — IF=0.99 monopoly is clipped to 0.40; missing rationale routes to compositional; all-zero proposal routes to compositional, not uniform; resolved W is identical across rationale variants (cache-key invariance).

### Task 4 — In-process LRU rank cache (ADR-0014)

- **Goal**: wrap `rank_portal_entries` and `compose_genui_artifact` with an LRU keyed as defined in CONTEXT.md `catalog_version`.
- **Implementation**: new `src/services/rank-cache.ts` exporting `getCachedRank(key, computeFn)`. Capacity from `weights.cache_lru_size`. Use a simple Map-based LRU (no extra dependency); reject ideas of TTL or persistent storage for v0.1.
- **Key**: `hash(catalog_version, weights_version, taxonomy_version, sorted(persona), sorted(intent), sorted(life_event), sorted(region), season, access_mode, top_k, weight_override_hash)`. `weight_override_hash` is sha256 of the **resolved** W (post-clip, post-renormalise) — not the raw host input. `weight_rationale` is NEVER hashed.
- **Response additions** (always present, regardless of debug):
  - `catalog_version: string`
  - `weights_version: string`
- **Response additions** (only when `include_debug = true`):
  - `processing_ms: number`
  - `candidates_in: number` (Stage 0 admitted)
  - `candidates_out: number` (post-Stage-1)
  - `weight_source: "host_proposed" | "compositional_no_rationale" | "compositional_no_override" | "compositional_total_zero"`
  - `cache: "hit" | "miss"`
- **Structured logging**: emit `{ level:"info", event:"rank_done", details:{ ms, candidates_in, candidates_out, weight_source, cache } }` on every rank/compose call. Never log free text — only taxonomy enum values.
- **Tests**: `tests/unit/rank-cache.test.ts` covers — (a) identical request hits cache; (b) different `weight_rationale` with same resolved W is a hit; (c) different sorted-region order is still the same key; (d) LRU evicts at capacity.

### Task 5 — Coverage gate script (ADR-0013)

- **Goal**: `npm run coverage` prints axis × value matrix and a one-line verdict.
- **Implementation**: new `scripts/coverage-gate.ts` reading `catalog/compiled.sqlite` (read-only). For each axis (`persona`, `intent`, `life_event`, `region`) and each primary-enum value, count `published` Entries that include that value. For sensitive-domain values (`tax`, `welfare`, `family`, `immigration`, `legal`), additionally compute the maintainer-approval ratio from a new `maintainer_approved` flag (or from PR-merge metadata if the compile script can capture it).
- **Output**: table to stdout, JSON to `coverage-report.json`, exit code 0 if READY, 1 if NOT READY. Final line: `READY` or `NOT READY: <first failing axis/value>`.
- **`package.json`**: add `"coverage": "node --loader ts-node/esm scripts/coverage-gate.ts"`.
- **Tests**: `tests/unit/coverage-gate.test.ts` covers — (a) thin axis fails verdict; (b) sensitive value at N=20 but 19/20 approval fails; (c) full coverage passes; (d) sub-광역 시군구 thinness does not affect verdict.

### Task 6 — README + RELEASE-CHECKLIST sync (ADR-0013)

- **README §1**: change "v0.1 catalog target is 10,972 entries." to a sentence that describes scope (e.g. "v0.1 ingests Gov24 national + regional public-service rows, ≈11k source rows. Launch readiness is gated by taxonomy axis coverage, not by absolute Entry count — see ADR-0013.") Do not promise the absolute number.
- **docs/RELEASE-CHECKLIST.md**: insert a new first step before "Download `.dxt`": "0. Run `npm run coverage` and confirm READY." Renumber the rest.

## Acceptance criteria (entire handoff)

- [ ] `npm run build` clean.
- [ ] `npm test` clean (all unit + integration).
- [ ] `npm run compile` produces a SQLite with `weights` row containing the new keys.
- [ ] `npm run coverage` runs successfully and prints a verdict (may say `NOT READY` for v0.1.0-rc since the 27-Entry SQLite cannot pass — that is expected; the script's correctness is what is tested here, not the data state).
- [ ] `node dist/index.js` boots and a manual `rank_portal_entries` call with empty input returns a non-zero `entries.length` (uses Stage 0 empty-context fallback).
- [ ] A manual `rank_portal_entries` call with `weight_override = [0.99, 0, 0, 0, 0, 0, 0, 0, 0]` and `weight_rationale = "테스트 사유"` is accepted (post-clip W[0] = 0.40) and `include_debug = true` exposes `weight_source: "host_proposed"`.
- [ ] A manual call with `weight_override` present but `weight_rationale = ""` returns `weight_source: "compositional_no_rationale"`.

## Out of scope for this handoff

- Re-running ingestion to grow `compiled.sqlite` from 27 to coverage-passing state — that is a separate ingestion run.
- `explain_ranking` Tool — deferred past v0.1 per ADR-0006.
- HTTP transport, persistent cache, `api_reliability`/`link_stability` features — all post-launch ADRs.
- Composer `URL()` parsing safety (separate severity-medium fix tracked outside this brief).

If any item above must change to make a task work, stop and surface the conflict before patching.
