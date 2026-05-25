# CODEX Marathon Notes

## catalog-growth-iteration-001 — coverage cannot reach READY from current local tooling/data

- recorded_at: `2026-05-25T19:02:53+09:00`
- task_id: `catalog-growth-iteration-001`
- failing_gate: `npm run coverage` exits `1` with `NOT READY: persona/salary_worker`.
- smallest_gap_by_compiled_count: many `0/20` values; sensitive tie-priority currently sees `life_event/immigration = 2/20, approval_ratio=0`.
- pipeline_check: `python3 tooling/ingestion/run_pipeline.py --help` exposes subcommands only; the requested `--source gov24 --tags <axis>=<value>` interface is not implemented.
- api_refresh_check: `python3 tooling/ingestion/run_pipeline.py api-refresh --max-pages 1 --skip-companions` returns `blocked=true` because `GOV24_SERVICE_KEY` is not set locally.
- review_check: `python3 tooling/review-agent/runner/run_review_chunks.py --parallel 8` reports `candidate_count=10976`, `auto_accept=8`, `escalate=10968`, `confidence_lt_0.85=10949`.
- current_source_candidate_confidence_distribution: `{0.82: 10945, 0.88: 26, 0.72: 4, 1.0: 1}`
- sensitive_candidate_counts_by_domain: `{'welfare': 10160, 'family': 470, 'tax': 301, 'immigration': 37}`
- source_pool_still_below_N20_even_if_all_candidates_were_promoted: `56` primary enum values.
- first_below_N20_source_values: `[('intent', 'api_application', 0, 0), ('intent', 'appeal_objection', 0, 0), ('intent', 'data_search', 0, 0), ('intent', 'dataset_download', 0, 0), ('intent', 'employment_support', 0, 0), ('intent', 'fee_payment', 0, 0), ('intent', 'policy_information', 0, 0), ('intent', 'refund_claim', 0, 0), ('intent', 'reservation_booking', 0, 0), ('intent', 'subsidy_application', 0, 0), ('life_event', 'birth', 0, 0), ('life_event', 'business_closure', 0, 0), ('life_event', 'death_in_family', 0, 0), ('life_event', 'disaster_damage', 0, 0), ('life_event', 'home_purchase', 0, 0), ('life_event', 'illness_disability', 0, 0), ('life_event', 'job_loss', 0, 0), ('life_event', 'marriage', 0, 0), ('life_event', 'overseas_travel', 0, 0), ('life_event', 'public_data_project', 0, 0)]`

### First 30 stderr/output lines relevant to blocker

```text
api-refresh: GOV24_SERVICE_KEY is not set; full national+regional gov24 ingestion cannot run without CI secret.
review: candidate_count=10976 processed_percent=100 auto_accept=8 escalate=10968
review: confidence_lt_0.85=10949
coverage: NOT READY: persona/salary_worker
```

### Proposed minimal patch / handoff

1. Run Gov24 ingestion where `GOV24_SERVICE_KEY` is available, or provide it to this local environment without committing it.
2. Add/enable a tag-targeted ingestion/annotation path in a separate code change, because the current pipeline has no `--source/--tags` selector and current source rows contain `<20` candidates for 56 required enum values.
3. Keep code frozen in this marathon; do not fabricate rows or raise `confidence_score` to satisfy coverage.
4. Route sensitive-domain approvals through maintainer review; do not auto-publish unresolved sensitive rows in this run.

