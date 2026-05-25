# v0.1 RC readiness is scenario last-mile, not full enum saturation

ADR-0013 remains the long-term product-quality goal: broad taxonomy axis coverage is still the right way to prove the catalog is complete across every primary enum. The current v0.1 release-candidate decision is narrower. The package being prepared for judge/user installation is a local `.mcpb` snapshot with Gov24 task cards, curated Hometax task cards, and curated data.go.kr insight cards. It must prove the end-to-end product promise without fabricating rows simply to satisfy enum-wide counts.

## Decision

For v0.1 RC, the merge/release-candidate gate is:

1. `npm run typecheck`, `npm run build`, `npm run compile`, and `npm test` pass.
2. The MCPB pack succeeds from a release-like environment with production dependencies only.
3. The packed MCPB contains no credentials, environment files, generated reports, local runtime state, source tests, or catalog source JSON.
4. Judge robustness scenarios prove the path:
   `natural-language prompt -> host interview skill -> taxonomy payload -> rank_portal_entries -> compose_genui_artifact`.
5. The scenarios cover, at minimum: freelancer tax, relocation, youth employment discovery, welfare exploration, data.go.kr data/API application, and regional living evidence.
6. data.go.kr remains an Insight/Evidence/portal-handoff source in v0.1. Live multi-source OpenAPI gateway behavior is deferred by ADR-0017.

`npm run coverage` remains a read-only diagnostic for the ADR-0013 full enum matrix. A `NOT READY` verdict means “do not claim full taxonomy saturation.” It does not block this v0.1 RC if the scenario last-mile gate passes.

## Rationale

The full ADR-0013 gate currently fails because many primary enum values have little or no official-source coverage in the present Gov24/Hometax/data.go.kr snapshot. Raising those counts by hand would create synthetic quality and weaken the safety model. The immediate product risk for the judge/demo setting is different: whether arbitrary user questions are safely mapped into structured taxonomy input, ranked against the bundled catalog, and rendered with evidence, portal separation, and safe copy.

Scenario last-mile tests are therefore the correct v0.1 RC proof. They are property-based rather than exact `entry_id` snapshots so catalog refreshes can change specific rows without causing false failures.

## Consequences

- CI may run `npm run coverage` as a diagnostic, but it must not fail the v0.1 RC solely because enum saturation is incomplete.
- Release notes and checklists must not claim full taxonomy coverage unless `npm run coverage` prints `READY`.
- Maintainers must not fabricate Entries or inflate taxonomy tags to satisfy ADR-0013.
- A later v0.2/v1.0 planning cycle can decide whether to re-promote ADR-0013 to a required gate after targeted ingestion, maintainer approval, and source expansion close the real gaps.

Constraint: Current official-source data includes intentionally small curated Hometax and data.go.kr cohorts, so N>=20 for every enum is not an honest v0.1 RC blocker.
Rejected: Fabricating or over-tagging rows to satisfy coverage counts | It would improve the metric while weakening answer quality and safety.
Confidence: high
Scope-risk: moderate
Directive: Treat `npm run coverage` as a saturation diagnostic until this ADR is explicitly superseded; keep scenario last-mile tests as the v0.1 RC gate.
Tested: `npm run coverage` was run and reported `NOT READY: persona/freelancer`; scenario integration tests pass separately.
Not-tested: Future targeted ingestion sufficient to restore full ADR-0013 coverage as a hard release gate.
