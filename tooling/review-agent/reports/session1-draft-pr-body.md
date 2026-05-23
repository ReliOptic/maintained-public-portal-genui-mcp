# Session 1 Catalog Ingestion Draft

Maintainer-side only. No catalog publish tag is part of this PR.

## Scope

- API refresh candidates: 10945
- Portal handoff candidates: 30
- Evidence records: 6
- Review Agent parallelism: N=8

## Confidence distribution

```json
{
  ">=0.95": 0,
  "0.85-0.95": 21,
  "0.60-0.85": 10954,
  "<0.60": 0
}
```

## Sensitive-domain count

- sensitive candidates: 10968

## Review decisions

```json
{
  "auto_accept": 5,
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
- [ ] Evidence metadata was refreshed for every seed dataset.
- [ ] Review Agent ran with N=8 chunks and `processed_percent` is `100`.
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
