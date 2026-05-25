# Maintainer Review Queue

## catalog-growth-iteration-001 — unresolved sensitive-domain queue

- recorded_at: `2026-05-25T19:02:53+09:00`
- queue_source: `catalog/v1.0.0/entries/*.json` where `sensitive_domain != null`.
- total_sensitive_candidates: `10968`
- counts_by_sensitive_domain: `{'welfare': 10160, 'family': 470, 'tax': 301, 'immigration': 37}`
- expansion_status: exact per-candidate expansion is intentionally not committed here because `10968` rows would violate the repository ≤200-lines/file guardrail.
- exact_reproduction_command:

```bash
python3 - <<'PY2'
import json, pathlib
for p in sorted(pathlib.Path('catalog/v1.0.0/entries').glob('*.json')):
    e=json.loads(p.read_text())
    if e.get('sensitive_domain'):
        print(e.get('entry_id'), e.get('sensitive_domain'), e.get('access_mode'), e.get('confidence_score'), e.get('title'))
PY2
```

- maintainer_action_required: approve/reject sensitive-domain candidates outside this automated run, then re-run `npm run compile && npm run coverage`.

