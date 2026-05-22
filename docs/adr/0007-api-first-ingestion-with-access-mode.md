# API-first ingestion with access_mode discrimination

The original architecture treated every Entry as portal-crawled. Real Korean public services split into two camps: (a) structured data exposed through stable REST APIs — gov24 service catalog, NTS businessman status, data.go.kr datasets — and (b) actions that still terminate on portal screens (홈택스 신고, 정부24 신청류). We pivot the Catalog to **API-first**: every Entry carries an `access_mode` field in `{api_cached, portal_handoff, manual_check}` (v0.1 subset), and the Refresh pipeline splits into two parallel tracks — `api-refresh-pipeline` (automated, nightly) for API-sourced Entries and `portal-refresh-pipeline` (manual-trigger) for hand-curated handoff URLs. One API row becomes one Entry; "search" or "discovery" itself is never an Entry. Datasets are not Entries — they live in a separate Evidence Registry referenced by Entries via `evidence_refs`.

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
