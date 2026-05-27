# ADR-0017: Defer data.go.kr multi-source runtime gateway to v0.2

Status: Proposed for v0.2; explicitly out of v0.1 RC

## Context

A teammate proposed `public_data_api_proposal.pdf` (2026-05-26), arguing that data.go.kr becomes most compelling when multiple OpenAPI sources are combined into one generated UI. The proposal recommends a small runtime MCP Gateway that wraps 2–4 APIs, normalizes XML/JSON rows, caches results, keeps mock responses for demos, and renders tables/charts/source lists.

The idea is directionally aligned with the product vision: users should not need to know agency names, API schemas, XML formats, or dataset search syntax. However, it changes the runtime contract.

## v0.1 decision

v0.1 remains a local, catalog-first `.mcpb` release candidate:

- no live data.go.kr API calls at runtime;
- no end-user service keys, credentials, `.env` setup, or API approval flow;
- Gov24 + Hometax remain Action-card sources;
- hand-authored data.go.kr records remain `Insight Entry` / `Evidence Rail` / `portal_handoff` records;
- `compiled.sqlite` is built before release and bundled into MCPB;
- the runtime MCP server reads the bundled catalog and composes GenUI artifacts only.

The teammate proposal is accepted as a v0.2 roadmap candidate, not a v0.1 implementation task.

## Why not v0.1

A runtime multi-source OpenAPI gateway requires new operational surfaces that v0.1 deliberately avoids:

- API approval and service-key management;
- XML/JSON schema drift handling;
- timeout/retry/cache policy;
- mock/fallback response contracts;
- per-source source metadata and freshness telemetry;
- a broader GenUI component schema for tables/charts/maps;
- a security review for runtime network access.

Adding these now would weaken the v0.1 value proposition: three-click local MCPB install, no credentials, no runtime fetch, and predictable reviewed copy.

## v0.2 candidate shape

[[ADR-0019]] supersedes the earlier "separate gateway" shape. If pursued, v0.2 should extend the existing MCP server with an `ApiAdapter` plugin layer discovered through `resource://adapters/v1`, with tests before implementation.

Candidate MVP constraints:

1. choose exactly one scenario bundle first, not every public API;
2. connect 2–4 approved APIs only;
3. define a normalized row/source/error schema before UI work;
4. ship mock responses and cache behavior from day one;
5. keep service keys outside end-user local MCPB unless a credential proxy is designed;
6. keep current catalog/evidence/insight behavior as the default when live calls fail or are disabled;
7. start with at least one `refresh_mode: "scheduled"` adapter before enabling any `on_demand` adapter.

## Relationship to current architecture

v0.1:

```text
catalog JSON → CI compile → compiled.sqlite → local MCPB → ranked Action Cards + Insight Rail + Evidence Rail
```

v0.2 candidate:

```text
structured user context → ApiAdapter plugin → normalized DataRecords/SourceManifest → GenUI DataSections
```

The two should compose, not replace each other. v0.1 catalog ranking decides which official tasks and evidence rails matter; the v0.2 ApiAdapter layer may enrich a subset with fresh tables, charts, or regional data.

## Non-goals for v0.1 RC

- No new `fetch_dataset` or `normalize_rows` runtime tool.
- No live data.go.kr request path.
- No `.env.example` or user API-key setup for the general-user path.
- No React iframe/app renderer requirement for RC.
