# Session 1 CI-only full ingestion runbook

This runbook is for maintainer CI only. It must not be executed on an end-user machine, and it must not publish a catalog tag. The output is a draft PR containing EntryCandidate JSON and Review Agent reports for maintainer review.

## Required GitHub secret

Configure one repository or environment secret before running the full API refresh:

- `GOV24_SERVICE_KEY` — data.go.kr / Gov24 API key used only by maintainer CI.

Rules:

- Keep the value in GitHub Secrets only.
- Do not commit the value to code, JSON, markdown reports, CI logs, or generated artifacts.
- Do not copy the value into local shell history.
- The local repository is expected to have no value for this variable.

## Expected local behavior

Local `api-refresh` must block when the secret is absent. This is a success condition for local safety, not a failure to work around.

```bash
unset GOV24_SERVICE_KEY
python3 tooling/ingestion/run_pipeline.py api-refresh
```

Expected result:

- exits without generating fake Gov24 rows;
- writes `tooling/review-agent/reports/session1-api-refresh-summary.json` with `blocked: true`;
- records that `GOV24_SERVICE_KEY` is required;
- records `secret_persisted: false`.

Do not fabricate the national/regional Gov24 candidate set locally.

## Maintainer CI sequence

Run these steps in a GitHub Actions job that has access to `secrets.GOV24_SERVICE_KEY`:

```bash
python3 tooling/ingestion/run_pipeline.py api-refresh
python3 tooling/ingestion/run_pipeline.py source-registry-check
python3 tooling/ingestion/run_pipeline.py portal-refresh
python3 tooling/ingestion/run_pipeline.py evidence-refresh
python3 tooling/ingestion/run_pipeline.py dedup
python3 tooling/review-agent/runner/run_review_chunks.py --parallel 8
python3 tooling/review-agent/runner/run_persona_check.py --fail-on-error
python3 tooling/ingestion/run_pipeline.py pr-body
```

Expected full-run evidence before opening the draft PR:

- Gov24 national + regional API candidates are generated from `serviceList` rows, with `serviceDetail` and `supportConditions` companion fetch status recorded.
- `bokjiro-central`, `bokjiro-regional`, and `worknet-supported-jobs` registry contracts are present and CI-validated as planned Task sources. Session 1 does not fabricate rows for these sources.
- Portal handoff candidates are at least the 30 pre-split seed URLs.
- The hand-curated `nts-business-status` Live Check Entry exists and is excluded from cross-source dedup.
- Evidence seed metadata JSON exists under `catalog/v1.0.0/evidence/`.
- ADR-0001 semantic content fingerprints are written before review, and cross-source duplicates merge only when two or more registered Task sources share a fingerprint.
- Review Agent processed percent is `100` across N=8 chunks.
- Persona check writes `tooling/review-agent/reports/session1-persona-check.json` and has zero errors.
- Review summary has no taxonomy, menu_path, copy-cap, safe-copy, ordinal, access-mode/source, or evidence-ref rubric violations.
- No catalog publish tag is created.

## Report credential checks

Before committing generated reports or opening the draft PR, CI must verify that reports contain no credential material and no API query-key literal:

```bash
if [ -n "${GOV24_SERVICE_KEY:-}" ] && \
   grep -R -F -q -- "$GOV24_SERVICE_KEY" tooling/review-agent/reports catalog/v1.0.0; then
  echo "Secret value leaked into generated artifacts" >&2
  exit 1
fi

if grep -R -n "serviceKey" tooling/review-agent/reports; then
  echo "API key query literal leaked into reports" >&2
  exit 1
fi
```

`GOV24_SERVICE_KEY` may appear as the name of the required GitHub secret. The secret value must never appear.

## Draft PR checklist

Include this checklist in the draft PR body and keep the PR as draft until all boxes are true:

- [ ] `GOV24_SERVICE_KEY` was supplied by GitHub Secrets, not by a committed file.
- [ ] Local secret-absent blocking behavior remains documented and verified.
- [ ] API refresh generated the full national + regional Gov24 candidate set; no local fake rows were used.
- [ ] Non-Gov24 Task source registries (`bokjiro-central`, `bokjiro-regional`, `worknet-supported-jobs`) were validated without pretending they were full-ingested.
- [ ] Portal handoff generated at least 30 EntryCandidates and every candidate has `menu_path`.
- [ ] `nts-business-status` exists as the v0.1 label-only Live Check Entry.
- [ ] Evidence metadata was refreshed for every seed dataset.
- [ ] ADR-0001 semantic fingerprints and the cross-source dedup pass ran before Review Agent chunking.
- [ ] Review Agent ran with N=8 chunks and `processed_percent` is `100`.
- [ ] Persona check ran and has zero errors.
- [ ] Auto-accept / escalation counts and reason counts are included in the PR body.
- [ ] Rubric violation counts are zero for taxonomy, menu_path, safe-copy, copy caps, ordinal sanity, access-mode/source fields, and evidence refs.
- [ ] Reports and catalog artifacts contain no secret value and no report contains the API query-key literal.
- [ ] ADR-0001 Splitter remains inactive for v0.1 portal handoff seeds.
- [ ] No catalog publish tag was created.
- [ ] CODEOWNERS review is triggered before merge.
