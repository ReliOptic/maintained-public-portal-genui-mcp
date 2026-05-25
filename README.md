# maintained-public-portal-genui-mcp

**흩어진 공공포털을 하나의 GenUI 경험으로.**

정부24 · 홈택스 · 공공데이터포털에 흩어진 공공서비스를 한 번의 자연어 발화로 통합 탐색하고, 사용자 맥락에 맞춘 카드 + 근거 데이터 + 공식 포털 이행 경로를 함께 안내하는 로컬 MCP 서버입니다.

---

## 왜 필요한가

대국민 포털은 메뉴가 많고, 검색 방식이 다르고, 근거 경로도 다릅니다.

- **정부24** — 전입신고, 주민등록등본 발급, 출산지원, 주거급여, 가족관계증명서
- **홈택스** — 종합소득세 신고, 사업자등록 상태, 세금 신고, 사업장 주소 변경
- **공공데이터포털** — 지역 생활 데이터, 주거 통계, 인구·가구, 지역 인프라

세 포털을 따로 검색하지 않고, "대전 유성구로 이사 왔어요. 이사 관련 행정·세무·우리 동네 데이터를 한곳에서 확인하고 싶어요." 한 줄로 끝나야 합니다.

## 어떻게 작동하는가

1. **호스트 LLM**(Claude)이 사용자 발화를 `persona / intent / life_event / region / season` taxonomy 구조체로 변환합니다.
2. MCP 서버가 컨텍스트와 Entry Features의 가중곱 — `Entry Features × Context Weights = Ranked Actions` — 으로 상위 카드를 결정합니다.
3. `clip_cap = 0.40`이 단일 축의 결과 지배를 막고, Stage 0이 컨텍스트 교집합으로 후보군을 1차 필터링합니다. 지역 불일치는 엄격 제외.
4. 컴포저가 **Action 카드**(정부24·홈택스 핸드오프) + **Insight Rail**(공공데이터포털 근거) + **Evidence Rail**(통계 근거)을 한 artifact로 조립합니다.

같은 발화 "대전 유성구로 이사 왔어요"라도 페르소나가 다르면 GenUI가 달라집니다:

- **프리랜서 / 5월** → 종합소득세 신고, 사업장 주소 변경, 청년 디지털 전환 지원, 대전 유성구 생활·인구 통계
- **신혼부부 / 이사** → 전입신고, 신혼부부 특별공급, 전세자금 대출, 어린이집·돌봄, 대전 유성구 주거 통계

`claude.md`에 저장된 사용자 정보가 다음 호출의 ranking을 바꿉니다.

## 카탈로그는 매번 크롤링하지 않습니다

GitHub 저장소 → cron 워크플로 → AI Review Agent (N=8 병렬 청크) → 메인테이너 escalation → 태그된 릴리스.

런타임은 읽기 전용입니다. 서버는 `catalog/compiled.sqlite`만 읽고, 절대 포털을 크롤링하거나 사용자 자격증명을 요구하지 않습니다.

- **Daily patch** — 카드 카피 보정, tier1→tier2 핸드오프 다운그레이드, freshness 갱신
- **Weekly minor** — Entry 추가/제거
- **Manual major** — 스키마 또는 taxonomy 파괴적 변경

## 설치

```bash
git clone <repo>
cd "Public portal gateway GenUI MCP"
npm ci
npm run build
npm run compile     # catalog/v1.0.0/*.json → catalog/compiled.sqlite
```

로컬 개발 실행:

```bash
PORTAL_CATALOG_DB=catalog/compiled.sqlite node dist/index.js
```

일반 사용자는 GitHub Releases에서 `.mcpb` 파일을 받아 Claude Desktop의 Extensions UI에서 3-click 설치합니다. `.mcpb`는 서버 바이너리 + 컴파일된 카탈로그 + `node_modules`를 모두 포함합니다.

## MCP Tools

v0.1은 네 개의 tool을 노출합니다:

- `search_portal_entries` — 키워드로 항목 검색 (랭킹 없음, 텍스트 매칭만)
- `rank_portal_entries` — taxonomy 구조체로 항목 랭킹 (핵심 추천 도구)
- `get_entry_detail` — `entry_id`로 단일 항목 전체 필드 조회
- `compose_genui_artifact` — Action cards + Insight Rail + Evidence Rail + handoff_notice 조립

Resource 두 개도 노출됩니다: `resource://taxonomy/v1.0`, `resource://evidence/v1.0`.

Claude Desktop 설치/Last Mile 검증은 [`docs/CLAUDE-DESKTOP-LAST-MILE.md`](docs/CLAUDE-DESKTOP-LAST-MILE.md), 심사위원 질문 견고성 시나리오는 [`docs/JUDGE-ROBUSTNESS-SCENARIOS.md`](docs/JUDGE-ROBUSTNESS-SCENARIOS.md)를 기준으로 합니다.

자연어 → taxonomy 변환은 **호스트 LLM의 책임**입니다. MCP 서버는 구조화된 입력만 받습니다 — 사용자 대화 상태를 알지 않고, 사용자 텍스트를 보지 않습니다.

## 다른 나라·도메인으로 포크하기

이 프로젝트는 **공통 Catalog 계약 + source-role 분류 + review 파이프라인**을 제공하는 레퍼런스 구현입니다. 일본 공공서비스, EU e-gov, 사내 정책 DB 등으로 포크 가능합니다.

**고정 구조** (수정 금지): 5개 taxonomy 축(`persona / intent / life_event / region / season`), Feature 공식(`IF, PF, LF, SE, UR, AC, EV, api_availability, freshness`), 5-stage ranking 파이프라인, MCP tool surface.

**5개 교체 항목**:

1. **Taxonomy enum 값** — `catalog/<version>/taxonomy/*.json`. 축은 그대로, 값만 자국 도메인으로.
2. **Source adapter** — `scripts/ingest-*.ts`. API row → Entry 변환기. 각 소스에 API role(`Task source / Evidence source / Live Check Entry / Discovery tool`) 부여 후 작성.
3. **Safety policy** — `weights.json`의 `sensitive_domains` + `tooling/safe-copy-lint/rules.json`. 도메인별 단정 금지·자격 보장 금지 패턴.
4. **Handoff allowlist** — `weights.json`의 `handoff_allowlist`. 자국 신뢰 포털 호스트 목록 (코드 리터럴 금지).
5. **Review Agent rubric** — `tooling/review-agent/rubric.md`. 도메인 기준 재작성 필수.

자세한 절차는 [`docs/TEMPLATE.md`](docs/TEMPLATE.md) 참조.

## 안전 정책

- **민감 도메인**(`tax / welfare / family / immigration / legal`)은 published 전 반드시 메인테이너 승인 + `safe_copy_rule = confirm_not_assert` 강제
- **Handoff allowlist** — `gov.kr / hometax.go.kr / data.go.kr` 외 URL 거부
- **자격·환급·수급 단정 금지** — 모든 안내는 공식 포털 확인 유도로 끝남
- 서버는 신청·로그인·자격판정을 수행하지 **않음**

## 한계

- 카탈로그는 스냅샷. 30일 이상 오래된 카탈로그는 stderr 경고를 출력합니다 (자동 갱신 없음).
- 공식 포털의 화면·메뉴 경로가 스냅샷 이후 바뀔 수 있습니다. 사용자는 공식 포털에서 최종 확인해야 합니다.
- 자연어 이해 품질은 호스트 LLM에 의존합니다. 서버는 taxonomy 매핑이 잘못된 자연어를 교정하지 않습니다.

## 문서

- [`CONTEXT.md`](CONTEXT.md) — 도메인 용어집
- [`docs/adr/`](docs/adr/) — 아키텍처 결정 기록 (ADR-0001 ~ ADR-0015)
- [`docs/TEMPLATE.md`](docs/TEMPLATE.md) — 포크·확장 가이드

## License

MIT.

> 공공서비스는, 한 자리에 모여야 합니다.
> 덜 검색하고, 더 빠르게 이해하고, 근거 있는 링크로 실행하세요.

Sources: 정부24 · 홈택스 · 공공데이터포털
