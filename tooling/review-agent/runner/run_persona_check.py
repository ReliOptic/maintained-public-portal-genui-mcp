#!/usr/bin/env python3
"""Hero persona smoke validator for Session 1 EntryCandidates.

No external APIs are called. The check loads generated Entry JSON, verifies that
entry_id values are unique, and computes deterministic mock IF/PF intersection
scores for three launch personas. It is intentionally lightweight: failures mean
structural catalog issues, while Top-K output is review evidence.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CATALOG = ROOT / "catalog" / "v1.0.0"
ENTRIES = CATALOG / "entries"
REPORT = ROOT / "tooling" / "review-agent" / "reports" / "session1-persona-check.json"

HERO_PERSONAS: dict[str, dict[str, list[str]]] = {
    "프리랜서": {
        "intent": ["tax_filing", "certificate_issue"],
        "persona": ["freelancer", "sole_proprietor"],
    },
    "신혼부부": {
        "life_event": ["relocation", "marriage"],
        "intent": ["address_change", "benefit_check"],
    },
    "창업자": {
        "persona": ["startup_founder", "sole_proprietor"],
        "intent": ["business_registration", "benefit_check"],
    },
}


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def axis_score(entry_values: list[str], wanted: list[str]) -> float:
    if not wanted:
        return 0.0
    return len(set(entry_values or []) & set(wanted)) / max(len(set(wanted)), 1)


def score_entry(entry: dict[str, Any], query: dict[str, list[str]]) -> dict[str, Any]:
    intent_fit = axis_score(entry.get("task_intent", []), query.get("intent", []))
    # PF is persona-fit when a persona axis is supplied; for the 신혼부부 smoke
    # case, life_event fit stands in as the persona-context fit requested by the
    # launch scenario.
    persona_fit = axis_score(entry.get("persona_tags", []), query.get("persona", []))
    life_event_fit = axis_score(entry.get("life_event_tags", []), query.get("life_event", []))
    context_fit = persona_fit if query.get("persona") else life_event_fit
    mock_score = round((intent_fit + context_fit) / 2, 6)
    return {
        "entry_id": entry.get("entry_id"),
        "title": entry.get("title"),
        "access_mode": entry.get("access_mode"),
        "intent_fit": round(intent_fit, 6),
        "persona_fit": round(persona_fit, 6),
        "life_event_fit": round(life_event_fit, 6),
        "mock_score": mock_score,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Session 1 hero persona checks")
    parser.add_argument("--fail-on-error", action="store_true", help="exit non-zero on duplicate entry_id or invalid JSON")
    args = parser.parse_args()

    entries: list[dict[str, Any]] = []
    errors: list[dict[str, Any]] = []
    seen: dict[str, str] = {}
    duplicates: list[dict[str, str]] = []
    for path in sorted(ENTRIES.glob("*.json")):
        if path.name.startswith("_example"):
            continue
        try:
            entry = load_json(path)
        except Exception as exc:  # pragma: no cover - defensive CI reporting
            errors.append({"path": str(path.relative_to(ROOT)), "error": repr(exc)})
            continue
        entry_id = str(entry.get("entry_id", ""))
        if entry_id in seen:
            duplicates.append({"entry_id": entry_id, "first": seen[entry_id], "second": str(path.relative_to(ROOT))})
        else:
            seen[entry_id] = str(path.relative_to(ROOT))
        entries.append(entry)

    hero_results: dict[str, Any] = {}
    for name, query in HERO_PERSONAS.items():
        scored = [score_entry(entry, query) for entry in entries]
        top = sorted(scored, key=lambda row: (-row["mock_score"], row["entry_id"] or ""))[:5]
        hero_results[name] = {"query": query, "top_k": 5, "results": top}

    summary = {
        "stage": "persona-check",
        "candidate_count": len(entries),
        "hero_personas": hero_results,
        "duplicate_entry_id_count": len(duplicates),
        "duplicate_entry_ids": duplicates,
        "error_count": len(errors) + len(duplicates),
        "errors": errors,
    }
    dump_json(REPORT, summary)
    print(json.dumps({k: summary[k] for k in ["candidate_count", "duplicate_entry_id_count", "error_count"]}, ensure_ascii=False, indent=2))
    if args.fail_on_error and summary["error_count"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
