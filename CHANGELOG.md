# Changelog

## v0.2.0 - Draft

### Added

- Public `DataSection` output beside benefit-search candidates.
- `resource://adapters/v1` adapter discovery with available, unavailable, and
  parked adapter states.
- Daejeon Yuseong fixture-backed regional providers for apartment rent,
  resident population, parking, CCTV, and dong-level population.
- Gov24 JA-code mapping and native region lookup support for `LAWD_CD` and
  `zscode`.
- Demo UI scenario for a newlywed freelancer moving to Daejeon Yuseong.
- Korean-law Option C decision package that keeps legal evidence parked until
  explicit approval, server-side proxying, and citation verification exist.

### Changed

- Workspace package versions are proposed as `0.2.0`.
- MCP server setup now uses a testable server factory.

### Parked

- Live data.go.kr refresh/on-demand adapters remain unimplemented.
- EV charger live availability remains unavailable until proxy and
  failure-disclosure behavior exist.
- Korean-law live integration remains parked behind ADR-0022 approval.

### Verification

- `pnpm rebuild better-sqlite3`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
