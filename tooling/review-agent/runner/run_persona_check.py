#!/usr/bin/env python3
"""Deterministic persona-fit audit for Session 1 EntryCandidates.

This is a maintainer-side review aid, not an LLM scorer. It checks that every
candidate has taxonomy-valid persona tags and flags obvious persona/domain
misfits for maintainer review. It never fetches external services or reads
credentials.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[3]
CATALOG = ROOT / "catalog" / "v1.0.0"
ENTRIES = CATALOG / "entries"
REPORT = ROOT / "tooling" / "review-agent" / "reports" / "persona-check.json"

DOMAIN_ALLOWED_PERSONAS = {
    "tax": {
        "salary_worker",
        "freelancer",
        "self_employed",
        "sole_proprietor",
        "small_business_owner",
        "startup_founder",
        "corporation_operator",
    },
    "welfare": {
        "job_seeker",
        "student",
        "parent_guardian",
        "expectant_parent",
        "senior",
        "person_with_disability",
        "low_income_household",
        "tenant",
        "foreign_resident",
        "farmer",
        "fisher",
    },
    "family": {"parent_guardian", "expectant_parent", "senior"},
    "immigration": {"foreign_resident", "naturalized_citizen", "overseas_korean"},
    "legal": {"self_employed", "sole_proprietor", "small_business_owner", "foreign_resident"},
}

INTENT_ALLOWED_PERSONAS = {
    "employment_support": {"job_seeker", "student", "low_income_household"},
    "business_registration": {"self_employed", "sole_proprietor", "small_business_owner", "startup_founder", "corporation_operator"},
    "business_closure": {"self_employed", "sole_proprietor", "small_business_owner", "corporation_operator"},
    "tax_filing": {"salary_worker", "freelancer", "self_employed", "sole_proprietor", "small_business_owner", "corporation_operator"},
    "tax_payment": {"salary_worker", "freelancer", "self_employed", "sole_proprietor", "small_business_owner", "corporation_operator"},
    "tax_inquiry": {"salary_worker", "freelancer", "self_employed", "sole_proprietor", "small_business_owner", "corporation_operator"},
    "data_search": {"data_user"},
    "dataset_download": {"data_user"},
    "api_application": {"data_user"},
}


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def main() -> None:
    parser = argparse.ArgumentParser(description="Run deterministic persona-fit checks")
    parser.add_argument("--fail-on-error", action="store_true", help="exit non-zero on missing/unknown persona tags")
    args = parser.parse_args()

    taxonomy = load_json(CATALOG / "taxonomy" / "v1.0.json")
    persona_values = set(taxonomy["axes"]["persona"]["values"])
    entries = [p for p in sorted(ENTRIES.glob("*.json")) if not p.name.startswith("_example")]
    findings: list[dict[str, Any]] = []
    error_count = 0

    for path in entries:
        entry = load_json(path)
        personas = set(entry.get("persona_tags") or [])
        intents = set(entry.get("task_intent") or [])
        reasons = []
        severity = "warning"
        if not personas:
            reasons.append("missing_persona_tags")
            severity = "error"
        unknown = sorted(personas - persona_values)
        if unknown:
            reasons.append("unknown_persona:" + ",".join(unknown))
            severity = "error"
        domain_allowed = DOMAIN_ALLOWED_PERSONAS.get(entry.get("domain"))
        if domain_allowed and personas and personas.isdisjoint(domain_allowed):
            reasons.append(f"domain_persona_mismatch:{entry.get('domain')}")
        for intent in intents:
            intent_allowed = INTENT_ALLOWED_PERSONAS.get(intent)
            if intent_allowed and personas and personas.isdisjoint(intent_allowed):
                reasons.append(f"intent_persona_mismatch:{intent}")
        if reasons:
            if severity == "error":
                error_count += 1
            findings.append({
                "candidate": str(path.relative_to(ROOT)),
                "entry_id": entry.get("entry_id"),
                "title": entry.get("title"),
                "domain": entry.get("domain"),
                "task_intent": sorted(intents),
                "persona_tags": sorted(personas),
                "severity": severity,
                "reasons": reasons,
            })

    summary = {
        "stage": "persona-check",
        "candidate_count": len(entries),
        "finding_count": len(findings),
        "error_count": error_count,
        "warning_count": len(findings) - error_count,
        "policy": "Deterministic taxonomy/persona-fit audit. Warnings require maintainer review but do not block Session 1 CI.",
        "findings": findings,
    }
    dump_json(REPORT, summary)
    print(json.dumps({k: summary[k] for k in ["candidate_count", "finding_count", "error_count", "warning_count"]}, ensure_ascii=False, indent=2))
    if args.fail_on_error and error_count:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
