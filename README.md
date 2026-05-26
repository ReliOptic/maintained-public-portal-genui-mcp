# portal-genui-mcp

[![npm version](https://badge.fury.io/js/portal-genui-mcp.svg)](https://www.npmjs.com/package/portal-genui-mcp)
[![MCP](https://img.shields.io/badge/MCP-stdio-blue)](https://modelcontextprotocol.io)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**흩어진 공공포털을 하나의 GenUI 경험으로.**

정부24 · 홈택스 · 공공데이터포털에 흩어진 10,000개 이상의 공공서비스를 한 번의 자연어 발화로 통합 탐색하고, 사용자 맥락에 맞춘 Action 카드 + 근거 데이터 + 공식 포털 이행 경로를 함께 안내하는 **로컬 stdio MCP 서버**입니다.

Claude Desktop, Cursor, Windsurf, Zed, Claude Code 등 stdio MCP를 지원하는 모든 AI 클라이언트에서 사용 가능합니다.

---

## 왜 필요한가

대국민 포털은 메뉴가 많고, 검색 방식이 다르고, 근거 경로도 다릅니다.

- **정부24** — 전입신고, 주민등록등본 발급, 출산지원, 주거급여, 가족관계증명서
- **홈택스** — 종합소득세 신고, 사업자등록 상태, 세금 신고, 사업장 주소 변경
- **공공데이터포털** — 지역 생활 데이터, 주거 통계, 인구·가구, 지역 인프라

"대전 유성구로 이사 왔어요. 행정·세무·우리 동네 데이터를 한곳에서 확인하고 싶어요." — 한 줄로 끝나야 합니다.

## 어떻게 작동하는가

1. **호스트 LLM**(Claude)이 사용자 발화를 `persona / intent / life_event / region / season` taxonomy 구조체로 변환합니다.
2. MCP 서버가 `Entry Features × Context Weights = Ranked Actions` 가중곱으로 상위 카드를 결정합니다.
3. `clip_cap = 0.40`이 단일 축의 결과 지배를 막고, Stage 0이 컨텍스트 교집합으로 후보군을 1차 필터링합니다.
4. 컴포저가 **Action 카드**(정부24·홈택스 핸드오프) + **Insight Rail** + **Evidence Rail** + **Data Sections**(공공 API 실시간 데이터)를 하나의 artifact로 조립합니다.

같은 발화라도 페르소나가 다르면 GenUI가 달라집니다:

- **프리랜서 / 5월** → 종합소득세 신고, 사업장 주소 변경, 청년 디지털 전환 지원
- **신혼부부 / 이사** → 전입신고, 신혼부부 특별공급, 전세자금 대출, 어린이집·돌봄

## v0.2 — ApiAdapter 플러그인 레이어

v0.2는 기존 카탈로그 랭킹 위에 **공공 OpenAPI 어댑터** 레이어를 추가합니다.

- `resource://adapters/v1` — 등록된 어댑터 전체 스키마를 노출하는 MCP 리소스
- `trigger_intents` 교집합으로 intent 기반 어댑터 자동 라우팅
- `compose_genui_artifact` 응답에 `data_sections` 배열 추가
- `WELFARE_API_KEY` 설정 시 복지시설 현황 실데이터 연동 (미설정 시 샘플 데이터)

국가에서 운영하는 공공 OpenAPI라면 `ApiAdapter` 인터페이스를 구현해 어댑터를 추가할 수 있습니다. 자세한 내용은 [`docs/adr/0019-apiadapter-refresh-mode-per-adapter.md`](docs/adr/0019-apiadapter-refresh-mode-per-adapter.md)를 참고하세요.

---

## 설치 및 사용법

> **참고**: 이 서버는 **stdio 전용**입니다. Claude.ai 웹은 지원하지 않습니다. Claude Desktop · Cursor · Windsurf · Claude Code 등 로컬 MCP 클라이언트에서 사용하세요.

### 방법 1: Claude Code 플러그인 (가장 쉬움) ⚡

Claude Code를 쓴다면 두 줄이면 끝납니다:

```
/plugin marketplace add ReliOptic/maintained-public-portal-genui-mcp
/plugin install maintained-public-portal-genui-mcp@maintained-public-portal-genui-mcp-marketplace
```

업데이트:

```
/plugin marketplace update maintained-public-portal-genui-mcp-marketplace
```

### 방법 2: Claude Desktop

설정 파일 위치: `~/Library/Application Support/Claude/claude_desktop_config.json` (Mac) / `%APPDATA%\Claude\claude_desktop_config.json` (Windows)

```json
{
  "mcpServers": {
    "portal-genui": {
      "command": "npx",
      "args": ["-y", "portal-genui-mcp"]
    }
  }
}
```

저장 후 Claude Desktop 재시작. 채팅에서 바로 사용합니다.

### 방법 3: Cursor / Windsurf / Zed

프로젝트 폴더 `.cursor/mcp.json` 또는 `.windsurf/mcp.json`:

```json
{
  "mcpServers": {
    "portal-genui": {
      "command": "npx",
      "args": ["-y", "portal-genui-mcp"]
    }
  }
}
```

### 방법 4: Claude Code (수동 설정)

터미널에서 한 줄로 추가합니다:

```bash
claude mcp add portal-genui -- npx -y portal-genui-mcp
```

또는 `~/.claude.json`의 `mcpServers`에 방법 1과 동일하게 추가합니다.

### 방법 5: 로컬 직접 설치 (개발자)

```bash
npm install -g portal-genui-mcp

# 테스트 실행
portal-genui-mcp
```

Claude Desktop config에서 `command: "portal-genui-mcp"` (args 없이)로 사용합니다.

---

## (선택) 공공데이터 API 키 — 복지시설 실데이터 연동

기본 상태에서는 복지시설 Data Sections에 샘플 데이터가 표시됩니다. 실데이터를 원하면 공공데이터포털 API 키를 발급해 설정합니다.

**1단계: API 키 발급 (무료, 5분)**

1. [공공데이터포털](https://www.data.go.kr) 가입 및 로그인
2. [한국사회보장정보원_사회복지시설정보서비스 현황](https://www.data.go.kr/data/15001848/openapi.do) 페이지에서 활용 신청
3. 발급된 인증키(예: `AbCdEf12345...`) 복사

**2단계: MCP 클라이언트 config에 env 추가**

```json
{
  "mcpServers": {
    "portal-genui": {
      "command": "npx",
      "args": ["-y", "portal-genui-mcp"],
      "env": {
        "WELFARE_API_KEY": "여기에_발급받은_인증키"
      }
    }
  }
}
```

키가 설정되면 `benefit_check` · `benefit_application` intent 요청 시 `data_sections`에 실시간 복지시설 데이터가 포함됩니다.

---

## MCP 도구 및 리소스

**도구 4개**

| 도구 | 설명 |
|---|---|
| `search_portal_entries` | 키워드로 항목 검색 (텍스트 매칭) |
| `rank_portal_entries` | taxonomy 구조체로 항목 랭킹 + Data Sections 포함 |
| `get_entry_detail` | `entry_id`로 단일 항목 전체 필드 조회 |
| `compose_genui_artifact` | Action 카드 + Insight Rail + Evidence Rail + Data Sections 조립 |

**리소스 3개**

| 리소스 URI | 설명 |
|---|---|
| `resource://taxonomy/v1.0` | taxonomy 전체 enum 값 |
| `resource://evidence/v1.0` | Evidence Registry |
| `resource://adapters/v1` | 등록된 ApiAdapter 전체 스키마 |

---

## 카탈로그는 매번 크롤링하지 않습니다

GitHub → cron 워크플로 → AI Review Agent → 메인테이너 승인 → 태그된 릴리스 → npm publish.

런타임은 읽기 전용입니다. 서버는 `catalog/compiled.sqlite`만 읽고, 포털을 크롤링하거나 사용자 자격증명을 요구하지 않습니다.

- **Daily patch** — 카드 카피 보정, freshness 갱신
- **Weekly minor** — Entry 추가/제거
- **Manual major** — 스키마 또는 taxonomy 파괴적 변경

---

## 다른 나라·도메인으로 포크하기

이 프로젝트는 **공통 Catalog 계약 + source-role 분류 + ApiAdapter 플러그인 레이어**를 제공하는 레퍼런스 구현입니다. 일본 공공서비스, EU e-gov, 사내 정책 DB 등으로 포크 가능합니다.

**고정 구조** (수정 금지): 5개 taxonomy 축, Feature 공식, 5-stage ranking 파이프라인, MCP tool surface.

**5개 교체 항목**: Taxonomy enum 값, Source adapter, Safety policy, Handoff allowlist, Review Agent rubric.

자세한 절차는 [`docs/TEMPLATE.md`](docs/TEMPLATE.md) 참조.

---

## 안전 정책

- **민감 도메인**(`tax / welfare / family / immigration / legal`) — 메인테이너 승인 + `safe_copy_rule = confirm_not_assert` 강제
- **Handoff allowlist** — `gov.kr / hometax.go.kr / data.go.kr` 외 URL 거부
- **자격·환급·수급 단정 금지** — 모든 안내는 공식 포털 확인 유도로 끝남
- 서버는 신청·로그인·자격판정을 수행하지 않습니다

## 한계

- 카탈로그는 스냅샷입니다. 30일 이상 오래된 카탈로그는 stderr 경고를 출력합니다.
- 공식 포털의 화면·메뉴 경로가 스냅샷 이후 바뀔 수 있습니다.
- 자연어 이해 품질은 호스트 LLM에 의존합니다.
- `WELFARE_API_KEY` 미설정 시 복지시설 Data Sections는 샘플 데이터입니다.

## 문서

- [`CONTEXT.md`](CONTEXT.md) — 도메인 용어집
- [`docs/adr/`](docs/adr/) — 아키텍처 결정 기록 (ADR-0001 ~ ADR-0019)
- [`docs/TEMPLATE.md`](docs/TEMPLATE.md) — 포크·확장 가이드
- [`docs/CODEX-HANDOFF-3.md`](docs/CODEX-HANDOFF-3.md) — v0.2 구현 브리프

## License

MIT

> 공공서비스는, 한 자리에 모여야 합니다.
> 덜 검색하고, 더 빠르게 이해하고, 근거 있는 링크로 실행하세요.
