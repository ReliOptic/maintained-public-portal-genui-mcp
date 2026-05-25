# Codex Handoff 2 — Product Readiness implementation brief

Decisions from two grilling sessions (2026-05-25): Evidence Registry Q1–Q3, Product Readiness Q1–Q7. Every decision is in CONTEXT.md, ADR-0015, and the notes below. **Do not re-debate any decision recorded here.** If a decision is technically impossible as stated, stop and surface the conflict.

## Read first (required, in order)

1. `CONTEXT.md` — sections `Evidence Registry`, `Insight Entry`, `Ranking pipeline` Stage 4, `Frame segment`
2. `docs/adr/0015-insight-card-slot-for-data-go-kr-entries.md`
3. `docs/CODEX-HANDOFF.md` — house rules and already-implemented tasks 1–6 still apply

## House rules (same as Handoff 1)

- `CLAUDE.md` ground rules verbatim: file ≤ 200 lines, function ≤ 50 lines, no `any`, named exports only, kebab-case files.
- Service triplet: implementation + types + tests — none optional.
- All tunables in `weights/v1.0.0.json`, never code constants.
- `npm run build && npm test` after every task before moving on.
- No new npm dependencies.

---

## Task A — `insight_card` in UiSlot type + Stage 4 assignment

**Files**: `src/types/ranking.ts`, `src/services/ranker.ts`

### A1. Type change

```typescript
// src/types/ranking.ts — line 17 today reads:
export type UiSlot = "primary_card" | "secondary_card";
// Change to:
export type UiSlot = "primary_card" | "secondary_card" | "insight_card" | "hidden";
```

### A2. Stage 4 slot assignment in ranker

After Stage 3 SR-cap, add an additional rule before returning:

```typescript
// Insight Entry detection: portal=data_go_kr AND task_intent overlaps insight set
const INSIGHT_INTENTS = new Set(["data_search", "dataset_download", "api_application", "policy_information"]);
function assignUiSlot(entry: RankedEntry, srCapped: UiSlot): UiSlot {
  if (
    entry.portal === "data_go_kr" &&
    entry.task_intent.some((i) => INSIGHT_INTENTS.has(i))
  ) {
    return "insight_card";
  }
  return srCapped;
}
```

`INSIGHT_INTENTS` and the portal check must NOT be code constants — read both from `weights/v1.0.0.json`. Add to weights JSON:

```json
"insight_intent_set": ["data_search", "dataset_download", "api_application", "policy_information"],
"insight_portal_set": ["data_go_kr"],
"handoff_allowlist": ["gov.kr", "hometax.go.kr", "data.go.kr"]
```

The ranker reads `insight_portal_set` and `insight_intent_set` from the loaded weights object — no string literals for portal names or intent values in code.

**Tests**: `tests/unit/ranker.test.ts` — add cases:
- `portal: "data_go_kr"` + `task_intent: ["data_search"]` → `ui_slot = "insight_card"`
- `portal: "data_go_kr"` + `task_intent: ["tax_filing"]` → normal slot (not insight_card)
- `portal: "gov24"` + `task_intent: ["data_search"]` → normal slot (portal check required)
- SR ≥ 0.85 + data_go_kr insight → still `insight_card` (SR cap does not override insight classification)

---

## Task B — Composer `insight_card` handling + Insight Rail

**Files**: `src/services/composer.ts`, `src/types/genui.ts`

### B1. GenUI artifact type

Add `insight_rail` alongside `cards` in the artifact response:

```typescript
// src/types/genui.ts
export interface GenUIArtifact {
  readonly segment: string;
  readonly hero: HeroCopy;
  readonly cards: readonly GenUICard[];           // primary_card + secondary_card
  readonly insight_rail: readonly GenUICard[];    // insight_card entries
  readonly evidence_rail: readonly EvidenceRef[]; // evidence registry refs (unchanged)
  readonly handoff_notice: string;
}
```

### B2. Composer split

In `compose_genui_artifact`, after collecting ranked entries, partition by `ui_slot`:

```typescript
const actionCards = entries.filter((e) => e.ui_slot !== "insight_card" && e.ui_slot !== "hidden");
const insightCards = entries.filter((e) => e.ui_slot === "insight_card");
```

Render `insight_rail` with the same card shape as `cards`. Do not mix the two arrays.

**Tests**: `tests/unit/composer.test.ts` — add case: when input includes a data_go_kr insight entry, artifact.insight_rail is non-empty and artifact.cards does not contain it.

---

## Task C — `resource://evidence/v1.0` MCP Resource

**Files**: `src/server.ts`, `src/services/catalog.ts` (or `catalog-store.ts`)

### C1. CatalogStore method

Add `getEvidenceRegistry(): EvidenceRecord[]` that returns all parsed records from `catalog/v1.0.0/evidence/*.json`. Parse at startup alongside entries (not per-request).

### C2. Resource registration

Follow the exact same pattern as `resource://taxonomy/v1.0` (line 90 of server.ts):

```typescript
server.registerResource(
  "evidence",
  "resource://evidence/v1.0",
  { mimeType: "application/json" },
  () => ({
    contents: [{
      uri: "resource://evidence/v1.0",
      mimeType: "application/json",
      text: JSON.stringify(store.getEvidenceRegistry()),
    }],
  })
);
```

Update `mcp-server.test.ts` to assert `resource://evidence/v1.0` appears in `listResources()`.

---

## Task D — compile-catalog evidence auto-matching

**Files**: `scripts/compile-catalog.ts`

### D1. Auto-match logic

After compiling entries, for each `published` entry that has an empty `evidence_refs` array (or only maintainer-authored refs), run:

```typescript
function autoMatchEvidence(
  entry: CompiledEntry,
  evidenceRecords: EvidenceRecord[],
  rolePriority: string[]   // from weights evidence_role_priority
): string[] {
  const entryTags = new Set([
    ...entry.persona_tags,
    ...entry.task_intent,
    ...entry.life_event_tags,
  ]);

  const candidates = evidenceRecords.filter((ev) => {
    // applies_to intersection
    const hasTagMatch = ev.applies_to.some((t) => entryTags.has(t));
    if (!hasTagMatch) return false;
    // region scoping (if evidence has region field)
    if (ev.region && ev.region.length > 0) {
      const entryRegion = new Set(entry.region_tags ?? []);
      const hasRegionMatch = ev.region.some((r) => entryRegion.has(r));
      if (!hasRegionMatch) return false;
    }
    return true;
  });

  // sort by role priority order, then take top 3
  candidates.sort((a, b) => {
    const ai = rolePriority.indexOf(a.role);
    const bi = rolePriority.indexOf(b.role);
    return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
  });

  return candidates.slice(0, 3).map((ev) => ev.evidence_id);
}
```

### D2. Maintainer override precedence

If `entry.evidence_refs` is non-empty (manually set by maintainer), **skip auto-match** and preserve as-is.

### D3. Unknown `applies_to` warning

During compile, for each evidence record, check every `applies_to` value against the full taxonomy enum set (persona + intent + life_event). Emit a structured warning to stderr for unknown values:

```
WARN evidence ev_sbiz_store_area_api applies_to "unknown_value" not in taxonomy enum — ignored
```

Exit code remains 0 (warning, not error) for unknown values.

**Tests**: `tests/unit/compile-catalog.test.ts` — add cases:
- entry with matching applies_to gets evidence_refs populated
- entry with region mismatch does not get region-scoped evidence
- entry with maintainer-authored evidence_refs is not overwritten
- evidence with unknown applies_to value emits warning, does not throw

---

## Task E — data.go.kr Insight Entry JSON files (hand-authored)

Create **8 files** in `catalog/v1.0.0/entries/`. All share:
- `catalog_version: "1.0.0"`
- `status: "published"`
- `portal: "data_go_kr"`
- `access_mode: "portal_handoff"`
- `confidence_score: 1.0`
- `review_required: false`
- `sensitive_domain: false`
- `intrinsic_ordinals: { actionability: "medium", evidence_value: "high", sensitivity_risk: "low" }`
- `safe_copy_audit: { rule: "standard", audited_at: "2026-05-25", auditor: "maintainer" }`

| file | entry_id | title | task_intent | persona_tags | life_event_tags | handoff.tier3 |
|---|---|---|---|---|---|---|
| dgo_search.json | dgo_integrated_search | 공공데이터 통합검색 | data_search | data_user | public_data_project | "공공데이터포털 > 데이터찾기 > 데이터목록" |
| dgo_file_download.json | dgo_file_data_download | 파일데이터 다운로드 | dataset_download | data_user, public_official | public_data_project | "공공데이터포털 > 데이터찾기 > 데이터목록 > 파일데이터" |
| dgo_api_apply.json | dgo_openapi_application | 오픈API 활용 신청 | api_application | data_user, startup_founder | startup, public_data_project | "공공데이터포털 > 데이터찾기 > 오픈API > 활용신청" |
| dgo_standard_data.json | dgo_standard_data_query | 표준데이터 조회 | data_search, dataset_download | data_user, public_official | public_data_project | "공공데이터포털 > 데이터찾기 > 국가중점데이터" |
| dgo_sbiz_market.json | dgo_sbiz_market_api | 소상공인 상권정보 API | api_application, data_search | small_business_owner, startup_founder | startup, business_operation | "공공데이터포털 > 소상공인시장진흥공단 상가(상권)정보 API" |
| dgo_regional_stats.json | dgo_regional_statistics | 지역 통계 자료 조회 | data_search, policy_information | data_user, public_official | public_data_project | "공공데이터포털 > 데이터찾기 > 데이터목록 (지역 필터)" |
| dgo_welfare_stats.json | dgo_welfare_statistics | 복지 통계 데이터 조회 | data_search, policy_information | low_income_household, parent_guardian | public_data_project | "공공데이터포털 > 사회복지 분류 > 데이터목록" |
| dgo_population_stats.json | dgo_population_statistics | 인구·가구 통계 조회 | data_search, policy_information | data_user, homeowner, tenant | relocation, public_data_project | "공공데이터포털 > 인구·가구 분류 > 데이터목록" |

Each file's `handoff` field must follow the Handoff schema:
```json
"handoff": {
  "tier2": "https://www.data.go.kr/search/index.do",
  "tier3": "<menu_path above>"
}
```

`menu_path` = same string as `tier3` above.

`card_title`, `card_body`, `cta_label` must follow copy length caps from CONTEXT.md:
- `card_title` ≤ 40 chars
- `card_body` ≤ 120 chars
- `cta_label` ≤ 20 chars

`last_sync_at` and `last_verified_at`: `"2026-05-25T00:00:00Z"`

---

## Task F — `tests/integration/scenarios.test.ts`

Create `tests/integration/scenarios.test.ts`. This file runs against the live MCP server via stdio (same setup as `mcp-server.test.ts`).

### F0. Test setup

At the top of `scenarios.test.ts`, load `catalog/v1.0.0/weights/v1.0.0.json` once and extract `handoff_allowlist`:

```typescript
import weightsJson from "../../catalog/v1.0.0/weights/v1.0.0.json" assert { type: "json" };
const ALLOWED_HOSTS: string[] = weightsJson.handoff_allowlist;
```

Pass `ALLOWED_HOSTS` to every `assertInvariants(artifact, ALLOWED_HOSTS)` call. This keeps the test data-driven — changing the weights JSON allowlist automatically updates the test assertion.

### F1. assertInvariants helper

```typescript
function assertInvariants(
  artifact: Record<string, unknown>,
  allowedHosts: string[]  // pass weights.handoff_allowlist — never hardcode
): void {
  const cards = (artifact.cards as readonly Record<string,unknown>[]) ?? [];
  const insightRail = (artifact.insight_rail as readonly Record<string,unknown>[]) ?? [];
  const allCards = [...cards, ...insightRail];

  // 1. All handoff URLs must be in allowlist
  const ALLOWED_HOSTS = allowedHosts;
  for (const card of allCards) {
    const url = card.handoff_url as string | undefined;
    if (url) {
      const host = new URL(url).hostname;
      const allowed = ALLOWED_HOSTS.some((h) => host === h || host.endsWith("." + h));
      expect(allowed, `URL ${url} not in allowlist`).toBe(true);
    }
  }

  // 2. safe_copy_rule: only "standard" or "confirm_not_assert"
  for (const card of allCards) {
    expect(["standard", "confirm_not_assert"]).toContain(card.safe_copy_rule);
  }

  // 3. Insight Rail cards must not appear in action cards
  const insightIds = new Set(insightRail.map((c) => c.entry_id));
  for (const card of cards) {
    expect(insightIds.has(card.entry_id as string)).toBe(false);
  }

  // 4. No card body contains credential hints
  const CREDENTIAL_PATTERNS = [/주민등록번호/, /비밀번호/, /인증번호/, /공인인증/];
  for (const card of allCards) {
    const body = (card.card_body as string) ?? "";
    for (const p of CREDENTIAL_PATTERNS) {
      expect(p.test(body), `Credential pattern ${p} found in card body`).toBe(false);
    }
  }
}
```

### F2. Fixture scenarios (minimum 12)

Each `it()` block calls `rank_portal_entries` + `compose_genui_artifact` and asserts:

| # | input | assert |
|---|---|---|
| 1 | `intent:["tax_filing"], persona:["freelancer"], life_event:["tax_season"]` | cards include ≥1 hometax entry; evidence_rail non-empty |
| 2 | `intent:["registration_report"], life_event:["relocation"]` | cards include ≥1 gov24 entry with title matching /전입/ |
| 3 | `intent:["benefit_application"], persona:["low_income_household"]` | cards include ≥1 entry; assertInvariants passes |
| 4 | `intent:["business_registration"], life_event:["startup"]` | cards include ≥1 hometax entry |
| 5 | `intent:["data_search"], persona:["data_user"]` | insight_rail non-empty; insight_rail[0].portal == "data_go_kr" |
| 6 | `intent:["api_application"], persona:["startup_founder"]` | insight_rail non-empty |
| 7 | `intent:["tax_filing"], persona:["freelancer"], life_event:["tax_season"]` vs `intent:["registration_report"], life_event:["relocation"]` | top card differs between the two queries |
| 8 | `{}` (empty context) | response non-empty (Stage 0 fallback); assertInvariants passes |
| 9 | `intent:["benefit_check"], persona:["senior"]` | assertInvariants passes; no SR=high entry in primary_card slot |
| 10 | `intent:["certificate_issue"]` | cards count ≥ 1; assertInvariants passes |
| 11 | `intent:["tax_filing"], persona:["freelancer"]` + `intent:["benefit_application"], persona:["parent_guardian"]` | top card differs |
| 12 | any query with `include_debug:true` | response contains `catalog_version` and `weights_version` |

---

## Task G — GitHub Workflows

### G1. `coverage-gate.yml`

```yaml
name: Coverage Gate
on:
  pull_request:
permissions:
  contents: read
jobs:
  coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npm run compile
      - name: Run coverage gate
        run: npm run coverage
```

Exit code 1 from `npm run coverage` blocks the PR merge (GitHub treats non-zero as failure).

### G2. `release-mcpb.yml`

```yaml
name: Release MCPB
on:
  push:
    tags: ["v*"]
permissions:
  contents: write
jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: npm }
      - run: npm ci
      - run: npm run build
      - run: npm run compile
      - name: Pack MCPB
        run: npm pack
      - name: Create GitHub Release
        uses: softprops/action-gh-release@v2
        with:
          files: "*.tgz"
```

Do **not** introduce new actions beyond `actions/checkout`, `actions/setup-node`, and `softprops/action-gh-release@v2` (already a common action, no new dependency concern).

---

## Task H — manifest.json tool descriptions

Replace the four tool `description` fields with richer text that helps a Korean-language host LLM pick the correct tool. Stay under 200 characters per description.

```json
{
  "name": "search_portal_entries",
  "description": "공공포털 항목을 키워드로 검색합니다. 랭킹 없이 텍스트 매칭만 수행. persona·intent·region 없이 title/keyword 검색이 필요할 때 사용. Returns entries array."
},
{
  "name": "rank_portal_entries",
  "description": "persona/intent/life_event/region/season taxonomy 구조체로 공공서비스 항목을 랭킹합니다. 자연어 발화를 taxonomy로 변환한 뒤 호출. 핵심 추천 도구. Returns ranked entries with ui_slot."
},
{
  "name": "get_entry_detail",
  "description": "entry_id로 단일 항목의 전체 필드를 조회합니다. card_copy·handoff·evidence_refs 포함. rank 후 특정 항목 상세 확인 시 사용."
},
{
  "name": "compose_genui_artifact",
  "description": "entry_id 목록과 frame_segment로 GenUI artifact를 조합합니다. hero copy·action cards·insight rail·evidence rail·handoff_notice 포함. 최종 UI 렌더링 직전에 호출."
}
```

---

## Acceptance criteria

- [ ] `npm run build` clean, zero TypeScript errors
- [ ] `npm test` clean — unit + integration (including `scenarios.test.ts` 12 fixtures)
- [ ] `UiSlot` type includes `insight_card` and `hidden`
- [ ] `resource://evidence/v1.0` appears in `listResources()` response
- [ ] `compose_genui_artifact` response includes `insight_rail` array
- [ ] 8 data.go.kr Insight Entry files exist in `catalog/v1.0.0/entries/`, all `published`
- [ ] `npm run compile` produces SQLite with data.go.kr entries and auto-matched `evidence_refs` on relevant entries
- [ ] `npm run coverage` runs (verdict may be NOT READY if catalog not yet full — that is expected)
- [ ] `.github/workflows/coverage-gate.yml` and `release-mcpb.yml` exist
- [ ] `manifest.json` tool descriptions updated

## Out of scope for this handoff

- `explain_ranking` tool — deferred past v0.1 per ADR-0006
- frame_copy.json / frame_copy_segments.json — already complete, do not touch
- Evidence Registry content expansion beyond the 6 existing files — maintainer curates separately
- `session1-full-ingestion.yml` — separate ingestion pipeline, not this handoff
- HTTP transport, persistent cache — post-launch
