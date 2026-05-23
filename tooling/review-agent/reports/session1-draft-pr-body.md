# Session 1 Catalog Ingestion Draft

Maintainer-side only. No catalog publish tag is part of this PR.

## Scope

- API refresh candidates: 10945
- Portal handoff candidates: 31
- Evidence records: 6
- Review Agent parallelism: N=8

## Confidence distribution

```json
{
  ">=0.95": 1,
  "0.85-0.95": 21,
  "0.60-0.85": 10954,
  "<0.60": 0
}
```

## Sensitive-domain count

- sensitive candidates: 10968

## Source registry and dedup

- Task source registries validated: 4
- Cross-source duplicate groups: 0
- Entries merged by cross-source dedup: 0
- Secondary sources attached: 0
- Persona check duplicate entry IDs: 0

## Hero Persona validation

{
  "프리랜서": {
    "query": {
      "intent": [
        "tax_filing",
        "certificate_issue"
      ],
      "persona": [
        "freelancer",
        "sole_proprietor"
      ]
    },
    "top_k": 5,
    "results": [
      {
        "entry_id": "01KS6FPN000WM3VA57T3QKJ100",
        "title": "종합소득세 신고",
        "access_mode": "portal_handoff",
        "intent_fit": 0.5,
        "persona_fit": 0.5,
        "life_event_fit": 0.0,
        "mock_score": 0.5
      },
      {
        "entry_id": "01KS6FPN00A5KA52VMB54QB9BS",
        "title": "사실증명 발급",
        "access_mode": "portal_handoff",
        "intent_fit": 0.5,
        "persona_fit": 0.5,
        "life_event_fit": 0.0,
        "mock_score": 0.5
      },
      {
        "entry_id": "01KS6FPN0001ANR4V6GJA37BJ5",
        "title": "평일 결식아동 급식비 지원",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN00021A5EN2RACQ8HSN",
        "title": "아동청소년 심리지원서비스",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN00025QC35BZ8WX3SHR",
        "title": "승강기검사수수료 감면(아동양육시설)",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      }
    ]
  },
  "신혼부부": {
    "query": {
      "life_event": [
        "relocation",
        "marriage"
      ],
      "intent": [
        "address_change",
        "benefit_check"
      ]
    },
    "top_k": 5,
    "results": [
      {
        "entry_id": "01KS6FPN00HK3R8ZM034YY3MR5",
        "title": "전입신고",
        "access_mode": "portal_handoff",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.5,
        "mock_score": 0.5
      },
      {
        "entry_id": "01KS6FPN000008VPYZ1WKC95WP",
        "title": "유·초·중·고 학생 무상급식비 지원",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN00000DCYQAWH8W8AWW",
        "title": "대전 서구 고등 ·대학생 장학금(특수영상콘텐츠분야)",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN00001SZC9Y2N543FMS",
        "title": "난임부부 약제비 지원",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN0000A4B8CAQ0TTX49M",
        "title": "가축생균제 공급 지원",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      }
    ]
  },
  "창업자": {
    "query": {
      "persona": [
        "startup_founder",
        "sole_proprietor"
      ],
      "intent": [
        "business_registration",
        "benefit_check"
      ]
    },
    "top_k": 5,
    "results": [
      {
        "entry_id": "01KS6FPN003Z030C6KCGA39J8Z",
        "title": "사업자등록 신청",
        "access_mode": "portal_handoff",
        "intent_fit": 0.5,
        "persona_fit": 0.5,
        "life_event_fit": 0.0,
        "mock_score": 0.5
      },
      {
        "entry_id": "01KS6FPN000008VPYZ1WKC95WP",
        "title": "유·초·중·고 학생 무상급식비 지원",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN00000DCYQAWH8W8AWW",
        "title": "대전 서구 고등 ·대학생 장학금(특수영상콘텐츠분야)",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN00001SZC9Y2N543FMS",
        "title": "난임부부 약제비 지원",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      },
      {
        "entry_id": "01KS6FPN0000A4B8CAQ0TTX49M",
        "title": "가축생균제 공급 지원",
        "access_mode": "api_cached",
        "intent_fit": 0.5,
        "persona_fit": 0.0,
        "life_event_fit": 0.0,
        "mock_score": 0.25
      }
    ]
  }
}

## Review decisions

```json
{
  "auto_accept": 6,
  "escalate": 10970
}
```

## Escalation / reject reason classes

```json
{
  "confidence_lt_0.85": 10954,
  "sensitive_domain:family": 470,
  "sensitive_domain:immigration": 37,
  "sensitive_domain:tax": 301,
  "sensitive_domain:welfare": 10160
}
```

## Draft PR checklist

- [ ] `GOV24_SERVICE_KEY` was supplied by GitHub Secrets, not by a committed file.
- [ ] API refresh generated the full national + regional Gov24 candidate set; no local fake rows were used.
- [ ] Portal handoff generated at least 30 EntryCandidates and every candidate has `menu_path`.
- [ ] `bokjiro-central`, `bokjiro-regional`, and `worknet-supported-jobs` registry YAML files exist and are validated as planned Task sources.
- [ ] `nts-business-status` exists as a hand-curated v0.1 Live Check Entry and remains excluded from cross-source dedup.
- [ ] Cross-source dedup writes ADR-0001 `semantic_fingerprint` while preserving `content_fingerprint`; same-source repeats are not collapsed automatically.
- [ ] Evidence metadata was refreshed for every seed dataset.
- [ ] Review Agent ran with N=8 chunks and `processed_percent` is `100`.
- [ ] Persona check ran and produced `tooling/review-agent/reports/session1-persona-check.json`.
- [ ] Auto-accept / escalation counts and reason counts are included below.
- [ ] Rubric violation counts are zero for taxonomy, menu_path, safe-copy, copy caps, ordinal sanity, access-mode/source fields, and evidence refs.
- [ ] Reports and catalog artifacts contain no secret value and no report contains the API query-key literal.
- [ ] ADR-0001 Splitter remains inactive for v0.1 portal handoff seeds.
- [ ] No catalog publish tag was created.
- [ ] CODEOWNERS review is triggered before merge.

## Validation notes

- Taxonomy, menu_path, copy cap, safe-copy lint, ordinal sanity, access_mode/source, and evidence_refs checks were run by `tooling/ingestion/run_pipeline.py review --parallel 8`.
- `GOV24_SERVICE_KEY` is required in maintainer CI for national+regional gov24 full ingestion and must not be committed.
- Local `api-refresh` must block when `GOV24_SERVICE_KEY` is absent; do not fabricate full Gov24 ingestion locally.
- Portal Splitter remains inactive; `catalog/seed/portal-handoff.yaml` is treated as pre-split leaf tasks.
