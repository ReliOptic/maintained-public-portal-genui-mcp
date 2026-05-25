## 1. What it is

Maintained Public Portal GenUI MCP is a Korean government public-service catalog exposed through a local Model Context Protocol server.

It packages a reviewed Gov24-centered public-service snapshot for Claude Desktop and other MCP hosts that can run a stdio server.

v0.1 ingests Gov24 national and regional public-service rows (about 11k source rows); launch readiness is gated by taxonomy axis coverage, not by absolute Entry count — see ADR-0013.

The transport is stdio.

The server reads `catalog/compiled.sqlite` and does not crawl portals or call Gov24 at runtime.

The goal is safe service discovery: search entries, inspect service records, list categories, and cite evidence while handing users back to official portals for authoritative actions.

## 2. Install

Prerequisites:

- Node.js 20 or newer.
- Claude Desktop with MCP / Extensions support.
- This repository checkout for developer validation.

Install and build:

```bash
npm ci
npm run build
npm run compile
```

`npm run compile` writes:

```text
catalog/compiled.sqlite
```

For local development, set `PORTAL_CATALOG_DB` explicitly:

```bash
PORTAL_CATALOG_DB=catalog/compiled.sqlite node dist/index.js
```

If `PORTAL_CATALOG_DB` is not set, the server relies on the bundled catalog path used by the packaged extension.

General users should install the `.dxt` through Claude Desktop instead of editing Claude configuration JSON by hand.

The `.dxt` bundles the server, manifest, dependencies, and compiled SQLite catalog.

## 3. Tools

The v0.1 MCP surface exposes four tools:

- `search_portal_entries` — search public-service entries by free-text query.
- `rank_portal_entries` — rank entries from structured taxonomy context (persona, intent, life event, region).
- `get_entry_detail` — fetch one entry record by known `entry_id`.
- `compose_genui_artifact` — assemble reviewed GenUI cards, handoff copy, and evidence rail.

Use `search_portal_entries` first when a user describes a public-service need.

Use `rank_portal_entries` when structured taxonomy context is available (persona, intent, life event, region).

Use `get_entry_detail` after search or rank when a specific entry card needs full detail.

Use `compose_genui_artifact` to produce a display-ready card with handoff copy and evidence rail.

Tool responses are generated from the local SQLite snapshot and must not contain API keys, service keys, or maintainer-only credentials.

## 4. Catalog scope

The v0.1 Task Entry source is Gov24 public-service information.

Coverage includes national and regional Gov24 service rows.

Gov24 API rows are ingested by maintainer CI, reviewed, and compiled into the release catalog.

Sensitive domains are escalated through the review policy before publication.

Sensitive domains include tax, welfare, family, immigration, and legal-adjacent services.

The runtime server does not decide eligibility, legal outcomes, or benefit entitlement.

Excluded from v0.1 Task Entry scope:

- Bokjiro central welfare-service API.
- Bokjiro local-government welfare-service API.
- Worknet hiring and supported-jobs APIs.
- NTS business-status live check.

Those sources remain candidates for later Task, Evidence, Registry, or Live Check roles.

## 5. Update

After new catalog JSON lands locally, rebuild SQLite:

```bash
npm run compile
```

If TypeScript changed, rebuild the server too:

```bash
npm run build
```

Release users should normally update by downloading a new `.dxt` from GitHub Releases.

Each `.dxt` contains the catalog snapshot current at release time.

The runtime server does not silently fetch updates or ask users for Gov24 credentials.

## 6. Limitations

The catalog is a snapshot, not real-time Gov24 data.

A service may change on the official portal after the snapshot is built.

The server emits a startup warning when the bundled catalog snapshot appears older than 30 days.

The stale warning is advisory and does not auto-update the catalog.

Sensitive-domain entries are human-reviewed before publication and use cautious copy plus official handoff framing.

The MCP server does not submit applications, log in to portals, or perform credentialed government transactions.

Users must confirm authoritative status, eligibility, deadlines, and submissions on the official portal.

## 7. License

MIT.

See repository license metadata for package distribution terms.
