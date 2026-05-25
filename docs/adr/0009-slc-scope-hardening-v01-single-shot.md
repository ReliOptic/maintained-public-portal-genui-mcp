# SLC scope hardening — v0.1 is a single-shot launch

Earlier grilling deferred features to "v0.2" liberally. The product reality is that **v0.1 is the only launch we get** — if v0.1 does not feel Simple, Lovable, and Complete (SLC), there will be no second attempt. This ADR codifies the principle and resolves the borderline scope items it forces. Every item previously labelled "v0.2 deferred" is reclassified to either **IN v0.1** (must be polished to launch) or **OUT of product** (not deferred, just absent). Four resolutions:

- **지자체 + 교육청 gov24 services — IN.** Without regional coverage, end users will see "이거있는데 없어요" gaps. Coverage is the value proposition.
- **Evidence Rail (curated datasets) — IN.** A handful of hand-picked data.go.kr datasets, referenced from Entries via `evidence_refs`, surfaced in the Gen UI as the §13 rail. Confidence-bounded.
- **`api_reliability` + `link_stability` features — OUT.** Without operational telemetry they are dead-weight in the W vector. Feature Dictionary shrinks from 13 to 11.
- **portal-pipeline LLM Splitter — OUT.** The maintainer hand-splits multi-Task pages into leaf URLs in the seed file. ADR-0001 stays on the books as a future policy but is **deactivated for v0.1**.

## Considered options

- **Keep the "deferred to v0.2" pattern.** Rejected as planning fiction. If a feature is deferred to a release that may not exist, it is not a plan.
- **Tiny demo v0.1, full product v0.2.** Rejected by product owner — single-shot launch.
- **Maximalist v0.1 (include everything ever considered).** Rejected — violates "Simple"; also balloons review and operational surface beyond the maintainer-plus-AI-agents capacity.

## Consequences

- Catalog grows to ≈10k Entries, forcing the [[Review Agent]] (ADR-0008) and the compiled-SQLite distribution path (ADR-0004 amendment).
- The Feature Dictionary, MCP Tool surface, `access_mode` enum, and other surfaces become smaller-but-final — no placeholder slots.
- The phrase "v0.2 will fix it" is banned from planning documents in this codebase until the product demonstrates viability.
- A feature that cannot be made Complete inside the v0.1 window is removed, not parked. Re-introduction requires a fresh ADR.

## Subsequent amendments

- [[ADR-0013]] — Replaces the implicit "≈10k Entries" / "10,972 entries" launch promise with an explicit taxonomy axis-coverage gate (N ≥ 20 published Entries per primary enum value; 100% maintainer-reviewed for sensitive-domain values) measured by `npm run coverage`. The single-shot SLC posture defined here is preserved; only the operational definition of "Complete" changes.
