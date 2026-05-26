# Codex Handoff 3 — v0.2 ApiAdapter plugin layer

Decisions from two grilling sessions (2026-05-26): v0.2 architecture (ADR-0019), all four remaining implementation items. Every decision is in CONTEXT.md and ADR-0019. **Do not re-debate any decision recorded there.** If a decision is technically impossible as stated, stop and surface the conflict.

## Read first (required, in order)

1. `CONTEXT.md` — sections `ApiAdapter`, `DataRecord`, `DataSection`, `SourceManifest`, `Interview Skill` (v0.2 extension paragraph)
2. `docs/adr/0019-apiadapter-refresh-mode-per-adapter.md`
3. `docs/CODEX-HANDOFF-2.md` — house rules and tasks 1–8 still apply; do not regress them

## House rules (same as Handoff 1 & 2)

- `CLAUDE.md` ground rules verbatim: file ≤ 200 lines, function ≤ 50 lines, no `any`, named exports only, kebab-case files.
- Service triplet: implementation + types + tests — none optional.
- All tunables in `catalog/v1.0.0/weights/v1.0.0.json`, never code constants.
- `npm run build && npm test` after every task before moving on.
- No new npm dependencies.

---

## Architecture decisions (fixed — no re-debate)

| Decision | Chosen option | Why |
|---|---|---|
| v0.2 extension model | Plugin B — `ApiAdapter` interface, existing server extended | MCP protocol philosophy; no separate server |
| Adapter discovery | `resource://adapters/v1` (mirrors taxonomy resource pattern) | LLM needs full param schema without second round-trip |
| Adapter routing | `trigger_intents` intersection — server-side, Interview Skill unchanged | Keeps 2-question ceiling; no modality question needed |
| Credential model | GitHub Secrets + CI bot; `scheduled` adapters bundle into SQLite | No credentials on user machine for MVP |
| `data_records` schema | Common columns + `payload_json` (mirrors `entries` table pattern) | No migration when new adapters added |
| `GenUiArtifact` extension | Add `data_sections: DataSection[]` alongside `cards`/`insight_rail` | Single compose tool, no new tool needed |
| MVP adapter | `welfare-facility-kr` — 복지시설 현황, `refresh_mode: scheduled` | Augments existing `benefit_check` Entry cards with local facility DataSections |
| `on_demand` proxy | Deferred — `call_status: "mock"` fallback covers it per ADR-0019 | Not needed for MVP; no real-time data in v0.2 |

---

## New files to create

```
src/
  types/
    adapter.types.ts          ← ApiAdapter, DataRecord, DataSection, SourceManifest
  services/
    adapter-registry.ts       ← loads resource://adapters/v1, routes by trigger_intents
    adapters/
      welfare-facility-kr.ts  ← MVP scheduled adapter implementation
scripts/
  compile-adapters.ts         ← runs scheduled adapter fetch+normalize, writes data_records
catalog/
  v1.0.0/
    adapters/
      adapters.json           ← resource://adapters/v1 source of truth
      welfare-facility-kr-records.json   ← pre-fetched DataRecords (CI output, gitignored in prod)
tests/
  unit/
    adapter-registry.test.ts
    welfare-facility-kr.test.ts
    composer-data-sections.test.ts
```

---

## Task A — New types

**File**: `src/types/adapter.types.ts`

```typescript
export interface AdapterFetchParams {
  readonly region?: string;
  readonly period?: string;
  readonly domain_filter?: string;
  readonly limit?: number;
}

export interface SourceManifest {
  readonly adapter_id: string;
  readonly agency: string;
  readonly api_name: string;
  readonly last_updated: string;       // ISO-8601
  readonly call_status: "ok" | "timeout" | "error" | "mock";
  readonly auth_type: "public" | "key_required";
}

export interface DataRecord {
  readonly record_id: string;
  readonly adapter_id: string;
  readonly region: string;
  readonly period: string;
  readonly payload: Readonly<Record<string, string | number | null>>;
}

export interface DataSection {
  readonly type: "metric_cards" | "data_table" | "chart" | "source_list";
  readonly title: string;
  readonly rows: readonly DataRecord[];
  readonly source: SourceManifest;
  readonly error?: string;
}

export interface AdapterParamSchema {
  readonly region?: { readonly type: "taxonomy_region_enum" };
  readonly period?: { readonly type: string };
  readonly domain_filter?: { readonly type: "enum"; readonly values: readonly string[] };
  readonly limit?: { readonly type: "integer"; readonly default: number };
}

export interface AdapterRegistration {
  readonly adapter_id: string;
  readonly name: string;
  readonly refresh_mode: "scheduled" | "on_demand";
  readonly trigger_intents: readonly string[];
  readonly fetch_params: AdapterParamSchema;
  readonly proxy_url?: string;   // on_demand only
}

export interface ApiAdapter {
  readonly registration: AdapterRegistration;
  fetch(params: AdapterFetchParams): Promise<DataRecord[]>;
  normalize(raw: unknown): DataRecord[];
  sourceManifest(callStatus: SourceManifest["call_status"]): SourceManifest;
}
```

**Tests** (`tests/unit/adapter-registry.test.ts`): verify that `AdapterRegistration` with `refresh_mode: "on_demand"` and no `proxy_url` throws on registration. Type-only check is sufficient.

---

## Task B — `catalog/v1.0.0/adapters/adapters.json`

Create the `resource://adapters/v1` source of truth. This file is the adapter registry — adding an adapter = adding one entry here.

```json
{
  "adapters_version": "1.0.0",
  "adapters": [
    {
      "adapter_id": "welfare-facility-kr",
      "name": "복지시설 현황",
      "refresh_mode": "scheduled",
      "trigger_intents": ["benefit_check", "benefit_application"],
      "fetch_params": {
        "region": { "type": "taxonomy_region_enum" },
        "period": { "type": "YYYY-MM" },
        "domain_filter": {
          "type": "enum",
          "values": ["노인복지관", "장애인복지관", "아동복지시설", "사회복지관", "정신건강복지센터"]
        },
        "limit": { "type": "integer", "default": 20 }
      }
    }
  ]
}
```

Register as MCP Resource in `src/server.ts` following the exact pattern of `resource://taxonomy/v1.0` (line 91–93):

```typescript
server.registerResource("adapters", "resource://adapters/v1", { mimeType: "application/json" }, () => ({
  contents: [{
    uri: "resource://adapters/v1",
    mimeType: "application/json",
    text: JSON.stringify(store.getAdapterRegistry()),
  }],
}));
```

Add `getAdapterRegistry(): AdapterRegistration[]` to `CatalogStore` — reads from the `adapters` table in `compiled.sqlite` (Task C adds this table). Parse at startup alongside taxonomy/weights; never per-request.

**Tests** (`tests/unit/adapter-registry.test.ts`): assert `resource://adapters/v1` appears in `listResources()` response (same pattern as existing `mcp-server.test.ts` evidence resource assertion).

---

## Task C — `data_records` table + `adapters` table in `compiled.sqlite`

**File**: `scripts/compile-catalog.ts` (extend) + `scripts/compile-adapters.ts` (new)

### C1. Schema additions in `compile-catalog.ts`

Add two tables inside `createSchema()`:

```sql
CREATE TABLE adapters (
  adapters_version TEXT PRIMARY KEY,
  payload_json TEXT NOT NULL
);

CREATE TABLE data_records (
  record_id       TEXT NOT NULL,
  adapter_id      TEXT NOT NULL,
  region          TEXT NOT NULL,
  period          TEXT NOT NULL,
  last_fetched_at TEXT NOT NULL,
  call_status     TEXT NOT NULL,
  payload_json    TEXT NOT NULL,
  PRIMARY KEY (adapter_id, record_id)
);

CREATE INDEX idx_data_records_adapter_region ON data_records(adapter_id, region);
```

In the compile transaction, insert the adapters registry:

```typescript
insertPayload(db, "adapters", "v1.0.0",
  readJson(path.join(CATALOG, "adapters", "adapters.json")));
```

### C2. `scripts/compile-adapters.ts` (new script)

Runs after `compile-catalog.ts`. For each `scheduled` adapter in `adapters.json`:
1. Calls `adapter.fetch(params)` for each taxonomy region value in the region enum.
2. Writes each `DataRecord` into `data_records` via parameterised `INSERT OR REPLACE`.
3. Emits structured JSON log to stderr on each region: `{ level: "info", adapter_id, region, count }`.
4. On fetch error: writes a single `DataRecord` with `call_status: "error"` and empty payload, logs warning — does **not** throw.

Add to `package.json` scripts:
```json
"compile": "node --loader ts-node/esm scripts/compile-catalog.ts && node --loader ts-node/esm scripts/compile-adapters.ts"
```

`CatalogStore.getDataRecords(adapterId, region, limit)` reads from this table.

**Tests** (`tests/unit/compile-adapters.test.ts`):
- adapter fetch error writes `call_status: "error"` row, does not throw.
- successful fetch rows round-trip through `payload_json`.
- unknown `adapter_id` in adapters.json throws at compile time (not silently skipped).

---

## Task D — `welfare-facility-kr` adapter

**File**: `src/services/adapters/welfare-facility-kr.ts`

Implements `ApiAdapter` interface. Source: 보건복지부 사회복지시설 현황 (공공데이터포털 `api.odcloud.kr`).

```typescript
import type { ApiAdapter, AdapterFetchParams, DataRecord, SourceManifest } from "../../types/adapter.types.js";

const ADAPTER_ID = "welfare-facility-kr";
const AGENCY = "보건복지부";
const API_NAME = "사회복지시설 현황";

// fetch() calls:
// GET https://api.odcloud.kr/api/15001411/v1/uddi:<service-key>
// with query params: page, perPage, returnType=JSON
// Service key injected via process.env.WELFARE_API_KEY (CI only — never end-user machine)
```

`normalize(raw)` maps the API response rows to `DataRecord[]`:
- `record_id`: `${adapter_id}_${시설코드 or index}`
- `region`: map 시도명 → taxonomy region enum value
- `period`: `YYYY-MM` from fetch date
- `payload`: `{ 시설명, 주소, 전화번호, 운영시간, 대상자, 서비스종류 }`

`sourceManifest(callStatus)` returns:
```typescript
{
  adapter_id: ADAPTER_ID,
  agency: AGENCY,
  api_name: API_NAME,
  last_updated: new Date().toISOString(),
  call_status: callStatus,
  auth_type: "key_required",
}
```

**Environment variable**: `WELFARE_API_KEY` — read via `src/config/` (never `process.env` directly in adapter code). When undefined, `fetch()` returns mock DataRecords with `call_status: "mock"` (enables local dev without a key).

**Tests** (`tests/unit/welfare-facility-kr.test.ts`):
- `normalize()` with fixture raw API response → correct `DataRecord[]` field mapping.
- `normalize()` with missing 시도명 → `region: "nationwide"` fallback.
- `fetch()` when `WELFARE_API_KEY` undefined → returns mock records with `call_status: "mock"`, does not throw.
- `sourceManifest("ok")` → all required fields present.

---

## Task E — Server adapter routing

**File**: `src/services/adapter-registry.ts` (new)

```typescript
import type { AdapterRegistration } from "../types/adapter.types.js";

export const matchingAdapters = (
  registrations: readonly AdapterRegistration[],
  intent: readonly string[] = [],
): AdapterRegistration[] => {
  if (intent.length === 0) return [];
  const intentSet = new Set(intent);
  return registrations.filter((reg) =>
    reg.trigger_intents.some((t) => intentSet.has(t))
  );
};
```

Wire into `src/services/mcp-tools.ts` inside `rankPortalEntries` and `composeGenuiArtifact`:
1. Load adapter registrations from `store.getAdapterRegistry()`.
2. Call `matchingAdapters(registrations, request.intent)`.
3. For each matched `scheduled` adapter: call `store.getDataRecords(adapterId, request.region?.[0], request.top_k ?? 10)`.
4. Pass resulting `DataRecord[]` and `SourceManifest` to composer as `DataSection[]`.

**Tests** (`tests/unit/adapter-registry.test.ts`):
- `matchingAdapters` with matching intent → returns adapter registration.
- `matchingAdapters` with no intent → returns `[]`.
- `matchingAdapters` with non-matching intent → returns `[]`.

---

## Task F — `compose_genui_artifact` extension

**Files**: `src/types/genui.ts`, `src/services/composer.ts`

### F1. Type change

```typescript
// src/types/genui.ts
export interface GenUiArtifact {
  readonly segment: string;
  readonly hero: JsonObject;
  readonly handoff_notice: string;
  readonly evidence_rail: { readonly label: string; readonly items: readonly EvidenceRailItem[] };
  readonly cards: readonly GenUiCard[];
  readonly insight_rail: readonly GenUiCard[];
  readonly data_sections: readonly DataSection[];   // ← add this line only
}
```

### F2. Composer extension

`composeGenUiArtifact` receives a new optional param `dataSections: readonly DataSection[] = []` and passes it straight through to the artifact:

```typescript
return {
  segment,
  hero: ...,
  handoff_notice: ...,
  evidence_rail: ...,
  cards: actionCards,
  insight_rail: insightCards,
  data_sections: dataSections,    // ← add
};
```

The `mcp-tools.ts` caller (Task E) assembles `dataSections` from adapter output before calling `composeGenUiArtifact`.

**Tests** (`tests/unit/composer-data-sections.test.ts`):
- artifact with no adapter match → `data_sections: []`.
- artifact with one matched adapter → `data_sections` length equals input DataSection count.
- `data_sections` entries do not appear in `cards` or `insight_rail`.

---

## Acceptance criteria

- [ ] `npm run build` clean, zero TypeScript errors
- [ ] `npm test` clean — all existing 55 tests still pass + new tests added
- [ ] `resource://adapters/v1` appears in `listResources()` response
- [ ] `compose_genui_artifact` response includes `data_sections` array
- [ ] `npm run compile` completes without error and `data_records` table exists in `compiled.sqlite`
- [ ] `welfare-facility-kr` adapter returns mock records when `WELFARE_API_KEY` is unset
- [ ] `matchingAdapters(["benefit_check"])` activates `welfare-facility-kr`
- [ ] `matchingAdapters(["tax_filing"])` returns `[]` (no adapter activated)
- [ ] `src/types/genui.ts` `GenUiArtifact` includes `data_sections: readonly DataSection[]`

## Out of scope for this handoff

- `on_demand` proxy deployment — deferred per ADR-0019; `call_status: "mock"` covers it
- Additional adapters beyond `welfare-facility-kr` — next maintainer cycle
- `WELFARE_API_KEY` GitHub Secret setup — maintainer ops task, not code
- `explain_ranking` tool — still deferred per ADR-0006
- HTTP transport — post-launch per ADR-0017
- Changes to existing Entry ranking, Evidence Registry, or Interview Skill copy logic
