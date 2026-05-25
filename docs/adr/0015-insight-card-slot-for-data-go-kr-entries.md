# insight_card ui_slot for data.go.kr informational Entries

data.go.kr hosts a wide range of public datasets, statistics, and API services that are genuinely useful to citizens — commercial area data, population statistics, regional welfare indices, and so on. These map to real **Leaf Services** (downloading a dataset, applying for an OpenAPI key) and thus qualify as Entries under the canonical definition. However, their primary value to a user is **근거/insight** ("why is this decision right?") rather than **action** ("what do I do now?"). Treating them identically to Gov24/Hometax action cards creates a ranking collision: a `data_user`-tagged data.go.kr Entry can displace a `tax_filing`-tagged Hometax action Entry when their scores are similar, because `evidence_value` (high for data entries) and `actionability` (low) partially offset each other.

We introduce **`insight_card`** as a new `ui_slot` value. An Insight Entry is any `portal: "data_go_kr"` Entry whose primary purpose is providing evidence, context, or regional/statistical reference rather than completing an administrative task. Insight Entries participate in the same five-stage ranking pipeline without modification; their distinction is surfaced at slot-assignment time.

## Decided rules

- An Entry with `portal: "data_go_kr"` and `task_intent` overlapping `{data_search, dataset_download, api_application, policy_information}` is classified as an Insight Entry and assigned `ui_slot = "insight_card"` at Stage 4.
- An Entry with `portal: "data_go_kr"` whose `task_intent` is purely administrative (e.g. `registration_report`, `license_application`) is **not** an Insight Entry — it keeps normal slot assignment. (No such entries exist in v0.1; this rule prevents future mis-classification.)
- Stage 3 SR cap applies equally: `SR ≥ 0.85` forces `safe_copy_rule = "confirm_not_assert"` on insight_card entries as on any other.
- `compose_genui_artifact` renders `insight_card` entries in a separate **Insight Rail** section, distinct from the primary/secondary Action card grid and from the §13 Evidence Rail. The Evidence Rail remains the domain of [[Evidence Registry]] records, not Entries.
- `access_mode` for Insight Entries is `portal_handoff` — the user is directed to the data.go.kr dataset page. No new `access_mode` value is introduced.

## Considered options

- **Separate pool via `insight_k` parameter.** Rejected: requires `rank_portal_entries` signature change and bifurcates the ranking path. A slot value achieves the same separation with zero API surface change.
- **New `access_mode` value.** Rejected: `access_mode` discriminates *how the task is fulfilled*, not *what the card looks like*. `portal_handoff` is correct for data.go.kr pages.
- **No distinction — let ranking sort it out.** Rejected: `actionability` low + `evidence_value` high is a known pattern for data entries. Under the current W_base, a high-EV low-AC entry scores comparably to a medium-AC entry. Without slot separation, the composer cannot guarantee Action cards appear before Insight cards for action-intent queries.

## Consequences

- `ui_slot` enum gains a fourth value: `primary_card | secondary_card | insight_card | hidden`. Composer must handle all four.
- v0.1 catalog includes 5–10 hand-authored `portal: "data_go_kr"` Insight Entries covering: 공공데이터 통합검색, 파일데이터 다운로드 안내, 오픈API 활용신청, 표준데이터 조회, 소상공인 상권정보 API, 지역 통계 조회. These are `portal_handoff`, `published`, `confidence_score = 1.0` (maintainer-authored, no LLM annotation uncertainty).
- The phrase "세 포털 통합 (Gov24 + Hometax + data.go.kr)" is now architecturally grounded: Gov24 provides Action cards, Hometax provides Tax Action cards, data.go.kr provides Insight Rail cards.
- `resource://evidence/v1.0` (decided separately) exposes the [[Evidence Registry]] to host LLMs. Insight Entries and Evidence records are distinct surfaces: Entries appear as cards; Evidence records appear only in the §13 Evidence Rail.
