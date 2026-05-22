# Catalog source of truth is JSON-in-git

The Catalog lives as plain JSON files under `catalog/<version>/` in this repository — not in a database. The MCP server reads JSON at startup into in-memory indices. A [[catalog_version]] release is a git tag (`catalog@MAJOR.MINOR.PATCH`). A `compiled.sqlite` snapshot may be emitted alongside JSON when scale demands, but JSON remains canonical.

## Considered options

- **Postgres (Vercel Marketplace, Neon).** Was the recommended default for atomic publish and indexing. Rejected for v0.1 because the project is OSS community-operated: making the Catalog content live in a hosted database hides curation from contributors and forces a maintainer-only infra dependency. Retained as the form the **runtime** may take when the project moves to HTTP multi-tenant deployment (v1.0+).
- **SQLite file snapshots as canonical.** Rejected as the source of truth — diffs are opaque in PR review. Adopted instead as the optional **compiled** runtime form once startup latency or memory pressure demands it.
- **Vector-DB primary.** Premature for the v0.1 90-Entry scale; revisit when semantic search is needed.

## Consequences

- The [[Human Review Queue]] is GitHub PR review. CODEOWNERS routes `catalog/**` to the maintainer.
- v0.1 transport is stdio with a per-user local MCP process — every user pulls a published tag and runs locally. No multi-instance sync problem to solve yet.
- A catalog refresh is a CI-driven PR: Stage 1 + Stage 2 + Annotation produce a draft PR. This couples the [[Refresh pipeline]] to GitHub.
- Scaling past ~5k Entries, or measurable startup-latency regression, triggers the `compiled.sqlite` step — not a rewrite, just an additional build artifact.
