# API-first ingestion with access_mode discrimination

The original architecture treated every Entry as portal-crawled. Real Korean public services split into two camps: (a) structured data exposed through stable REST APIs — gov24 service catalog, 복지로 welfare catalogs, 워크넷 jobs, NTS live checks, data.go.kr/KOSIS datasets — and (b) actions that still terminate on portal screens (홈택스 신고, 정부24 신청류). We pivot the Catalog to **API-first**: every Entry carries an `access_mode` field in `{api_cached, portal_handoff, manual_check}` (v0.1 subset), and the Refresh pipeline splits into two parallel tracks — `api-refresh-pipeline` (automated, nightly) for API-sourced Task Entries and `portal-refresh-pipeline` (manual-trigger) for hand-curated handoff URLs. One Task API row becomes one Entry; "search" or "discovery" itself is never an Entry. Datasets are not Entries — they live in a separate Evidence Registry referenced by Entries via `evidence_refs`.

## API role taxonomy

Generic public APIs exist, but v0.1 correctness depends on assigning each API to the right role rather than attaching every API as an Entry source:

| API family | Catalog role | Rationale |
| --- | --- | --- |
| Gov24 공공서비스 정보 | Task Entry candidates | Service rows describe user-facing public-service tasks. |
| 복지로 중앙부처복지서비스 / 지자체복지서비스 | Task Entry candidates | Welfare-service rows map to benefits/tasks users can check or apply for. |
| 워크넷 채용정보 / 정부지원일자리 | Task Entry candidates | Job/support rows map to employment-support tasks. |
| 공공데이터포털 목록조회 / 검색서비스 | Discovery tool (maintainer only) | Returns metadata *about* other datasets, not data itself. Helps the maintainer find new Evidence candidates; **not wired into the v0.1 catalog pipeline** and never surfaced to end users. Lives in `tooling/discover/` if implemented at all. |
| KOSIS OpenAPI | Evidence Registry | Statistics support Evidence Rail context and confidence, not Task cards. |
| 소상공인 상권정보 API | Evidence Registry | Commercial-area facts support small-business evidence and ranking context. |
| 국세청 사업자 상태조회 | Live Check Entry | A narrow runtime check for a specific business-status task, not a bulk catalog source. |

Therefore: general-purpose APIs are available, but the architecture's consistency comes from separating API roles into four surfaces — **Task Entry** (catalog rows that user can act on), **Evidence Registry** (reference statistics referenced by Tasks), **Live Check Entry** (a single curated Entry, label only — runs as `portal_handoff` in v0.1), and **Discovery tool** (maintainer-side only, never user-visible). Adding more APIs is not a goal by itself.

**Live Check Entry is a role label, not a new `access_mode`.** In v0.1 the single Live Check Entry (NTS 사업자 상태조회) is published with `access_mode = portal_handoff` and a `menu_path` to 홈택스 / 정부24's status screen. The MCP server does **not** call the NTS API at runtime — there are no credentials on user machines and the `.mcpb` distribution promises `env = {}`. Reviving live API calls is deferred to v1.0+ behind a credential proxy and is recorded as such; until then, the user experience for a Live Check is identical to any other `portal_handoff` Entry.

## Considered options

- **Portal-only crawling (status quo).** Rejected — stale-data risk, brittle to portal redesigns, ignores stable APIs that already exist.
- **API-only.** Rejected — 홈택스 신고 and 정부24 신청류 have no public action API; they must remain Handoff.
- **Meta-Entry for "혜택 후보 탐색" with runtime API expansion.** Rejected — collapses [[ADR-0003]] (card copy = Catalog data) and makes Ranking meaningless on a single Entry.
- **Mixing Tasks and datasets in one Catalog.** Rejected — comparing "근로장려금 신청" to "상권 통계" in the same Q score space is semantically incoherent.

## Consequences

- Two ingestion pipelines must coexist. Operational complexity is acceptable at the v0.1 maintainer-with-AI-agents scale; see [[ADR-0008]].
- `access_mode` participates in dedup: API-sourced Entries reuse the API row's stable id where possible; portal-sourced Entries still follow the ULID + content_fingerprint path of [[ADR-0001]].
- Runtime CTA behaviour differs by mode — `api_cached` exposes `api_payload` through `get_entry_detail` (user sees data inline), `portal_handoff` opens an external link.
- `api_live` and `hybrid` modes were considered and explicitly **excluded** from v0.1: `api_live` requires credentials in the user's stdio MCP and was scope-cut under [[ADR-0009]]; `hybrid` is redundant with `api_cached` + populated [[Handoff]].
- The Catalog must accommodate two derived feature classes (api_availability, official_handoff_need) that read off `access_mode`; see [[ADR-0002]] amendment.
