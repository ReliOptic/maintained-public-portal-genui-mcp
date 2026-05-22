# Session 1 Catalog Ingestion Draft

Maintainer-side only. No catalog publish tag is part of this PR.

## Scope

- API refresh candidates: 0
- Portal handoff candidates: 30
- Evidence records: 6
- Review Agent parallelism: N=8

## Confidence distribution

```json
{
  ">=0.95": 0,
  "0.85-0.95": 24,
  "0.60-0.85": 6,
  "<0.60": 0
}
```

## Sensitive-domain count

- sensitive candidates: 23

## Review decisions

```json
{
  "auto_accept": 7,
  "escalate": 23
}
```

## Escalation / reject reason classes

```json
{
  "confidence_lt_0.85": 6,
  "sensitive_domain:family": 1,
  "sensitive_domain:immigration": 4,
  "sensitive_domain:tax": 15,
  "sensitive_domain:welfare": 3
}
```

## Validation notes

- Taxonomy, menu_path, copy cap, safe-copy lint, ordinal sanity, access_mode/source, and evidence_refs checks were run by `tooling/ingestion/run_pipeline.py review --parallel 8`.
- `GOV24_SERVICE_KEY` is required in maintainer CI for national+regional gov24 full ingestion and must not be committed.
- Portal Splitter remains inactive; `catalog/seed/portal-handoff.yaml` is treated as pre-split leaf tasks.
