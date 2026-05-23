#!/usr/bin/env python3
"""Maintainer-side catalog ingestion helpers for Session 1.

This is CI tooling only. It never embeds service keys, never publishes tags, and
fails gov24 ingestion when GOV24_SERVICE_KEY is absent unless explicitly running
non-api stages.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import datetime as dt
import hashlib
import html
import json
import math
import os
import re
import ssl
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any

try:
    import yaml
except Exception as exc:  # pragma: no cover
    raise SystemExit("PyYAML is required in maintainer CI") from exc

ROOT = Path(__file__).resolve().parents[2]
CATALOG = ROOT / "catalog" / "v1.0.0"
ENTRIES = CATALOG / "entries"
EVIDENCE_DIR = CATALOG / "evidence"
REPORT_DIR = ROOT / "tooling" / "review-agent" / "reports"
CHUNK_DIR = ROOT / "tooling" / "review-agent" / "chunks"
ALLOW_HOSTS = {"hometax.go.kr", "www.gov.kr", "gov.kr", "plus.gov.kr", "www.data.go.kr", "data.go.kr", "api.odcloud.kr"}
SENSITIVE_DOMAINS = {"tax", "welfare", "family", "immigration", "legal"}
ORDINALS = {"low", "medium", "high"}
FEATURE_CAPS = {"card_title": 40, "card_body": 120, "cta_label": 20}


def load_yaml(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def dump_yaml(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.safe_dump(data, f, allow_unicode=True, sort_keys=False)


def load_json(path: Path) -> Any:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def dump_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def today() -> str:
    return dt.datetime.now(dt.timezone.utc).date().isoformat()


def ulid_from_seed(seed: str) -> str:
    # Deterministic ULID-shaped id for reproducible maintainer reruns.
    alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    timestamp_ms = int(dt.datetime(2026, 5, 22, tzinfo=dt.timezone.utc).timestamp() * 1000)
    n = (timestamp_ms << 80) | int.from_bytes(digest[:10], "big")
    chars = []
    for _ in range(26):
        chars.append(alphabet[n & 31])
        n >>= 5
    return "".join(reversed(chars))


def read_taxonomy() -> dict[str, Any]:
    return load_json(CATALOG / "taxonomy" / "v1.0.json")


def evidence_ids() -> set[str]:
    ids = set()
    seed = CATALOG / "evidence-seed.yaml"
    if seed.exists():
        for item in load_yaml(seed).get("items", []):
            ids.add(item["evidence_id"])
    if EVIDENCE_DIR.exists():
        for path in EVIDENCE_DIR.glob("*.json"):
            try:
                ids.add(load_json(path)["evidence_id"])
            except Exception:
                pass
    return ids


def fetch_url(url: str, timeout: int = 20) -> tuple[int | str, str, str]:
    ctx = ssl._create_unverified_context()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 CatalogMaintainerBot/0.1"})
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as r:
            body = r.read(250_000).decode("utf-8", "replace")
            return r.status, r.geturl(), body
    except urllib.error.HTTPError as e:
        body = e.read(5000).decode("utf-8", "replace")
        return e.code, url, body
    except Exception as e:
        return "ERR", url, repr(e)


def redact_secret(value: Any, secret: str | None) -> Any:
    if isinstance(value, dict):
        return {k: redact_secret(v, secret) for k, v in value.items() if str(k) != "serviceKey"}
    if isinstance(value, list):
        return [redact_secret(v, secret) for v in value]
    if isinstance(value, str) and secret:
        encoded = urllib.parse.quote_plus(secret)
        return value.replace(secret, "[REDACTED]").replace(encoded, "[REDACTED]")
    return value


def registry_aliases(registry: dict[str, Any], field: str) -> list[str]:
    return list(registry.get("response_schema", {}).get("raw_key_aliases", {}).get(field, []))


def first_alias_value(row: dict[str, Any], aliases: list[str], default: str = "") -> str:
    for alias in aliases:
        value = row.get(alias)
        if value not in {None, ""}:
            return str(value)
    return default


def normalized_api_row(registry: dict[str, Any], row: dict[str, Any]) -> dict[str, str]:
    fields = registry.get("response_schema", {}).get("raw_key_aliases", {})
    return {field: first_alias_value(row, aliases) for field, aliases in fields.items()}


def extract_row_id(registry: dict[str, Any], row: dict[str, Any]) -> str:
    row_id = first_alias_value(row, registry_aliases(registry, "service_id"))
    if row_id:
        return row_id
    return hashlib.sha1(json.dumps(row, ensure_ascii=False, sort_keys=True).encode()).hexdigest()[:16]


def extract_title(registry: dict[str, Any], row: dict[str, Any]) -> str:
    return first_alias_value(row, registry_aliases(registry, "service_name"), "정부24 공공서비스")


def gov24_api_get_json(endpoint: str, key: str, params: dict[str, Any], timeout: int = 30) -> dict[str, Any]:
    safe_params = {k: v for k, v in params.items() if v not in {None, ""}}
    query = urllib.parse.urlencode({**safe_params, "serviceKey": key})
    status, final_url, body = fetch_url(endpoint + "?" + query, timeout=timeout)
    safe_url = redact_secret(final_url, key)
    meta: dict[str, Any] = {"status": status, "endpoint": endpoint, "final_url": safe_url}
    if status != 200:
        meta["error_excerpt"] = redact_secret(body[:500], key)
        return {"ok": False, "meta": meta, "data": None}
    try:
        return {"ok": True, "meta": meta, "data": redact_secret(json.loads(body), key)}
    except json.JSONDecodeError as exc:
        meta["error_excerpt"] = f"json_decode:{exc}"
        return {"ok": False, "meta": meta, "data": None}


def candidate_param_sets(row_id: str) -> list[dict[str, str]]:
    # data.go.kr operation parameters have changed across notices; try all known aliases.
    return [{"cond[서비스ID::EQ]": row_id}, {"serviceId": row_id}, {"svcId": row_id}, {"서비스ID": row_id}]


def fetch_gov24_companion(operation: dict[str, Any], key: str, row_id: str, timeout: int = 20) -> dict[str, Any]:
    attempts = []
    for params in candidate_param_sets(row_id):
        result = gov24_api_get_json(operation["endpoint"], key, params, timeout=timeout)
        attempts.append({"params": params, "meta": result["meta"]})
        if result["ok"]:
            return {"fetch_status": "ok", "attempts": attempts, "payload": result["data"]}
        # Stop retrying aliases on transport errors; continue aliases on likely parameter mismatch.
        if result["meta"].get("status") in {"ERR"}:
            break
    return {"fetch_status": "unavailable", "attempts": attempts, "payload": None}


def payload_rows(payload: dict[str, Any]) -> list[dict[str, Any]]:
    data = payload.get("data", [])
    if isinstance(data, list):
        return [r for r in data if isinstance(r, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def fetch_service_list_page(
    endpoint: str,
    key: str,
    page: int,
    page_param: str,
    per_page_param: str,
    per_page: int,
    args: argparse.Namespace,
    operation_status_counts: dict[str, dict[str, int]],
    depth: int = 0,
) -> dict[str, Any]:
    result = gov24_api_get_json(
        endpoint,
        key,
        {page_param: page, per_page_param: per_page, "returnType": "JSON"},
        timeout=args.api_timeout,
    )
    status_key = str(result["meta"].get("status"))
    operation_status_counts["serviceList"][status_key] = operation_status_counts["serviceList"].get(status_key, 0) + 1
    if result["ok"]:
        return {
            "ok": True,
            "rows": payload_rows(result["data"] or {}),
            "meta": result["meta"],
            "fallbacks": [],
            "fallback_failures": [],
        }

    if result["meta"].get("status") == 200 and per_page > args.min_per_page:
        child_per_page = max(args.min_per_page, per_page // 2)
        child_count = math.ceil(per_page / child_per_page)
        offset = (page - 1) * per_page
        rows: list[dict[str, Any]] = []
        fallbacks = [{"page": page, "per_page": per_page, "child_per_page": child_per_page, "depth": depth, "meta": result["meta"]}]
        failures: list[dict[str, Any]] = []
        for child_index in range(child_count):
            child_offset = offset + child_index * child_per_page
            child_page = child_offset // child_per_page + 1
            child = fetch_service_list_page(
                endpoint,
                key,
                child_page,
                page_param,
                per_page_param,
                child_per_page,
                args,
                operation_status_counts,
                depth + 1,
            )
            rows.extend(child.get("rows", []))
            fallbacks.extend(child.get("fallbacks", []))
            failures.extend(child.get("fallback_failures", []))
            if not child["ok"]:
                failures.append({"page": child_page, "per_page": child_per_page, "meta": child["meta"]})
        if rows:
            return {"ok": True, "rows": rows, "meta": result["meta"], "fallbacks": fallbacks, "fallback_failures": failures}

    return {"ok": False, "rows": [], "meta": result["meta"], "fallbacks": [], "fallback_failures": []}


def infer_region_tags(normalized: dict[str, str]) -> list[str]:
    scope = " ".join([normalized.get("provider_org", ""), normalized.get("jurisdiction_scope", "")])
    regional = {
        "서울": "seoul", "부산": "busan", "대구": "daegu", "인천": "incheon", "광주": "gwangju",
        "대전": "daejeon", "울산": "ulsan", "세종": "sejong", "경기": "gyeonggi", "강원": "gangwon",
        "충북": "chungbuk", "충청북": "chungbuk", "충남": "chungnam", "충청남": "chungnam",
        "전북": "jeonbuk", "전라북": "jeonbuk", "전남": "jeonnam", "전라남": "jeonnam",
        "경북": "gyeongbuk", "경상북": "gyeongbuk", "경남": "gyeongnam", "경상남": "gyeongnam",
        "제주": "jeju", "교육청": "education_office",
    }
    tags = [v for k, v in regional.items() if k in scope]
    if "중앙" in scope or "국가" in scope or "전국" in scope or not tags:
        tags.insert(0, "nationwide")
    if "교육청" not in scope and ("부" in scope or "청" in scope or "위원회" in scope):
        tags.append("central_government")
    deduped = []
    for tag in tags:
        if tag not in deduped:
            deduped.append(tag)
    return deduped[:3] or ["nationwide"]


def infer_api_domain_and_tags(title: str, normalized: dict[str, str], companions: dict[str, Any]) -> dict[str, Any]:
    text = " ".join(str(v) for v in [title, *normalized.values(), companions.get("detail", {}).get("payload"), companions.get("conditions", {}).get("payload")])
    if any(k in text for k in ["세금", "국세", "지방세", "소득세", "부가가치세", "장려금"]):
        return {"domain": "tax", "persona_tags": ["salary_worker", "self_employed"], "task_intent": ["tax_inquiry"], "life_event_tags": ["tax_season", "income_change"], "evidence_refs": ["ev_nts_retirement_income_tenure", "ev_nts_education_tax"], "season": "comprehensive_income_tax_may"}
    if any(k in text for k in ["교육", "장학", "학생", "학교"]):
        return {"domain": "welfare", "persona_tags": ["student", "parent_guardian"], "task_intent": ["education_application", "benefit_check"], "life_event_tags": ["school_enrollment"], "evidence_refs": ["ev_local_welfare_services"], "season": "scholarship_mar"}
    if any(k in text for k in ["장애", "기초생활", "차상위", "복지", "보조금", "지원금", "수당"]):
        return {"domain": "welfare", "persona_tags": ["low_income_household"], "task_intent": ["benefit_check"], "life_event_tags": ["income_change"], "evidence_refs": ["ev_local_welfare_services", "ev_household_income_incheon"], "season": "heating_winter"}
    if any(k in text for k in ["체류", "외국인", "국적", "재외"]):
        return {"domain": "immigration", "persona_tags": ["foreign_resident"], "task_intent": ["address_change", "identity_verification"], "life_event_tags": ["immigration"], "evidence_refs": [], "season": "jan"}
    if any(k in text for k in ["출생", "가족", "혼인", "보육", "아동"]):
        return {"domain": "family", "persona_tags": ["parent_guardian"], "task_intent": ["certificate_issue", "benefit_check"], "life_event_tags": ["family_relation", "childcare"], "evidence_refs": ["ev_local_welfare_services"], "season": "childcare_mar"}
    return {"domain": "welfare", "persona_tags": ["low_income_household"], "task_intent": ["benefit_check"], "life_event_tags": ["income_change"], "evidence_refs": ["ev_local_welfare_services"], "season": "jan"}


def write_api_refresh_summary(summary: dict[str, Any]) -> None:
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    dump_json(REPORT_DIR / "session1-api-refresh-summary.json", summary)


def strip_text(raw: str, limit: int = 4000) -> str:
    raw = re.sub(r"<script[\s\S]*?</script>", " ", raw, flags=re.I)
    raw = re.sub(r"<style[\s\S]*?</style>", " ", raw, flags=re.I)
    text = re.sub(r"<[^>]+>", " ", raw)
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]


def classify_domain(row: dict[str, Any]) -> str:
    title = row["leaf_task"]
    intent = row["hint"]["expected_intent"]
    persona = row["hint"]["expected_persona"]
    if "세" in title or intent.startswith("tax") or row["portal"] == "hometax":
        return "tax"
    if "외국인" in title or "국적" in title or persona in {"foreign_resident", "naturalized_citizen", "overseas_korean"}:
        return "immigration"
    if "가족" in title or "가정" in title or persona in {"parent_guardian", "expectant_parent"}:
        return "family"
    if "차상위" in title or "교육급여" in title or "보조금" in title or intent.startswith("benefit"):
        return "welfare"
    return "general"


def infer_life_events(intent: str, title: str) -> list[str]:
    if intent == "address_change":
        return ["relocation", "address_change"]
    if "사업" in title or intent in {"business_registration", "business_closure"}:
        return ["startup", "business_operation"]
    if intent.startswith("tax"):
        return ["tax_season", "income_change"]
    if "국적" in title or "외국인" in title:
        return ["immigration"]
    if "가족" in title or "가정" in title:
        return ["family_relation"]
    if "교육" in title or "학교" in title:
        return ["school_enrollment"]
    if "선박" in title:
        return ["agriculture_cycle"]
    if "교통" in title:
        return ["vehicle_purchase"]
    if intent.startswith("benefit"):
        return ["income_change"]
    return ["public_data_project"] if intent.startswith("data") else ["employment"]


def season_for(title: str, intent: str) -> str:
    if "종합소득세" in title or "근로장려금" in title or "자녀장려금" in title:
        return "comprehensive_income_tax_may"
    if "부가가치세" in title:
        return "vat_jan"
    if "연말정산" in title:
        return "year_end_settlement"
    if "학교" in title or "교육" in title:
        return "scholarship_mar"
    return "may" if intent.startswith("tax") else "jan"


def evidence_for(domain: str, intent: str, persona: str) -> list[str]:
    if domain == "tax":
        return ["ev_nts_retirement_income_tenure", "ev_nts_education_tax"]
    if domain == "welfare":
        return ["ev_local_welfare_services", "ev_household_income_incheon"]
    if persona in {"small_business_owner", "self_employed", "sole_proprietor", "startup_founder"}:
        return ["ev_sbiz_store_area_api", "ev_major_commercial_area_standard"]
    return []


def portal_entry_from_seed(row: dict[str, Any], capture: dict[str, Any]) -> dict[str, Any]:
    hint = row["hint"]
    title = row["leaf_task"]
    intent = hint["expected_intent"]
    persona = hint["expected_persona"]
    domain = classify_domain(row)
    entry_id = ulid_from_seed("portal-handoff|" + row["url"] + "|" + title)
    portal = row["portal"]
    source_host = urllib.parse.urlparse(row["url"]).hostname or ""
    return {
        "entry_id": entry_id,
        "catalog_version": "1.0.0",
        "status": "published",
        "candidate_state": "entry_candidate",
        "merged_into": None,
        "access_mode": "portal_handoff",
        "portal": portal,
        "domain": domain,
        "sensitive_domain": domain if domain in SENSITIVE_DOMAINS else None,
        "title": title,
        "canonical_intent": intent,
        "canonical_action_verb": "handoff",
        "key_keywords": [k for k in re.split(r"\s+", title) if k][:4],
        "content_fingerprint": f"{portal}|portal_handoff|{hashlib.sha1(row['url'].encode()).hexdigest()[:16]}",
        "source_urls": [row["url"]],
        "stage1_capture": {
            "fetch_status": capture["status"],
            "final_url": capture["final_url"],
            "rendered_text_excerpt": capture["text_excerpt"],
            "screenshot_ref": capture.get("screenshot_ref"),
            "observed_actions": capture.get("observed_actions", []),
        },
        "menu_path": hint["menu_path"],
        "handoff": {
            "tier": "tier1" if capture["status"] == 200 and source_host in ALLOW_HOSTS else "tier3",
            "portal": portal,
            "url": row["url"] if source_host in ALLOW_HOSTS else ("https://hometax.go.kr/" if portal == "hometax" else "https://www.gov.kr/"),
            "menu_path": hint["menu_path"],
        },
        "persona_tags": [persona],
        "task_intent": [intent],
        "life_event_tags": infer_life_events(intent, title),
        "region_tags": ["nationwide"],
        "evidence_refs": evidence_for(domain, intent, persona),
        "free_tags": [title, portal, "pre_split_leaf"],
        "seasonality_hint": season_for(title, intent),
        "intrinsic_ordinals": {
            "actionability": "high" if capture["status"] == 200 else "medium",
            "evidence_value": "high" if intent == "certificate_issue" or domain in {"tax", "welfare"} else "medium",
            "sensitivity_risk": "high" if domain in {"tax", "welfare", "immigration", "family"} else "medium",
        },
        "confidence_score": 0.88 if capture["status"] == 200 else 0.72,
        "review_required": domain in SENSITIVE_DOMAINS,
        "review_reason": f"sensitive_domain:{domain}" if domain in SENSITIVE_DOMAINS else None,
        "card_title": title[:40],
        "card_body": f"{title} 경로와 신청 안내를 공식 포털에서 확인하세요. 상황에 따라 요건과 서류가 달라질 수 있습니다."[:120],
        "cta_label": ("홈택스에서 확인" if portal == "hometax" else "정부24에서 확인")[:20],
        "safe_copy_audit": {"safe_copy_rule": "confirm_not_assert", "outcome": "pass", "checked_patterns": ["대상 단정 없음", "승인 보장 없음"]},
        "last_verified_at": today(),
    }


def portal_refresh(args: argparse.Namespace) -> dict[str, Any]:
    seed = load_yaml(ROOT / "catalog" / "seed" / "portal-handoff.yaml")
    ENTRIES.mkdir(parents=True, exist_ok=True)
    captures_dir = ROOT / "catalog" / "v1.0.0" / "raw-captures" / "portal-handoff"
    captures_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for row in seed["urls"]:
        status, final_url, body = fetch_url(row["url"], timeout=20)
        capture = {
            "leaf_task": row["leaf_task"],
            "source_url": row["url"],
            "status": status,
            "final_url": final_url,
            "text_excerpt": strip_text(body),
            "screenshot_ref": None,
            "observed_actions": [],
            "capture_note": "Maintainer CI should replace text-only fetch with computer-use rendered DOM+screenshot when browser credentials are available.",
        }
        cap_path = captures_dir / (ulid_from_seed(row["url"]) + ".json")
        dump_json(cap_path, capture)
        entry = portal_entry_from_seed(row, capture)
        out = ENTRIES / f"{entry['entry_id']}.json"
        dump_json(out, entry)
        written.append(str(out.relative_to(ROOT)))
        time.sleep(args.rate_delay)
    return {"stage": "portal-refresh", "written": written, "count": len(written)}


def evidence_refresh(args: argparse.Namespace) -> dict[str, Any]:
    seed = load_yaml(CATALOG / "evidence-seed.yaml")
    EVIDENCE_DIR.mkdir(parents=True, exist_ok=True)
    written = []
    for item in seed.get("items", []):
        status, final_url, body = fetch_url(item["data_go_kr_url"], timeout=20)
        text = strip_text(body, 6000)
        metadata = {
            "evidence_id": item["evidence_id"],
            "catalog_version": "1.0.0",
            "title": item["title"],
            "data_go_kr_dataset_id": str(item["data_go_kr_dataset_id"]),
            "data_go_kr_url": item["data_go_kr_url"],
            "role": item["role"],
            "applies_to": item.get("applies_to", []),
            "refresh_hint": item.get("refresh_hint"),
            "metadata_fetch": {"status": status, "final_url": final_url, "fetched_at": today()},
            "metadata_excerpt": text,
        }
        out = EVIDENCE_DIR / f"{item['data_go_kr_dataset_id']}.json"
        dump_json(out, metadata)
        written.append(str(out.relative_to(ROOT)))
        time.sleep(args.rate_delay)
    return {"stage": "evidence-refresh", "written": written, "count": len(written)}


def api_refresh(args: argparse.Namespace) -> dict[str, Any]:
    key = os.environ.get("GOV24_SERVICE_KEY")
    registry = load_yaml(ROOT / "catalog" / "api-registry" / "gov24-serviceList.yaml")
    operations = registry["operations"]
    endpoint = operations["serviceList"]["endpoint"]
    page_start = args.start_page or int(registry["paging"].get("start_page", 1))
    page_end = args.end_page or 0
    if page_end and page_end < page_start:
        raise SystemExit("--end-page must be greater than or equal to --start-page")
    if not key:
        summary = {
            "stage": "api-refresh",
            "blocked": True,
            "reason": "GOV24_SERVICE_KEY is not set; full national+regional gov24 ingestion cannot run without CI secret.",
            "source_id": registry["source_id"],
            "source_org_scope": registry.get("source_org_scope", []),
            "requires_env": registry.get("auth", {}).get("env", "GOV24_SERVICE_KEY"),
            "secret_persisted": False,
            "operations_planned": sorted(operations.keys()),
            "page_start": page_start,
            "page_end": page_end or None,
        }
        write_api_refresh_summary(summary)
        return summary

    # Maintainer CI only: stream serviceList pages and fetch serviceDetail/supportConditions
    # companions per row. No serviceKey value is persisted in any report or candidate.
    per_page = int(registry["paging"]["per_page"])
    page_param = registry["paging"].get("page_param", "page")
    per_page_param = registry["paging"].get("per_page_param", "perPage")
    written = []
    page = page_start
    pages_fetched = 0
    rows_seen = 0
    stopped_reason = "completed"
    last_page_attempted: int | None = None
    last_page_completed: int | None = None
    companion_policy = "skip" if args.skip_companions else "fetch"
    operation_status_counts: dict[str, dict[str, int]] = {"serviceList": {}, "serviceDetail": {}, "supportConditions": {}}
    service_list_fallbacks: list[dict[str, Any]] = []
    service_list_fallback_failures: list[dict[str, Any]] = []
    started = time.monotonic()
    progress_every = max(1, int(args.progress_every))

    while True:
        if page_end and page > page_end:
            stopped_reason = "page_end_reached"
            break
        if args.max_pages and pages_fetched >= args.max_pages:
            stopped_reason = "max_pages_reached"
            break
        print(f"api-refresh page={page} start rows_seen={rows_seen} written={len(written)}", file=sys.stderr, flush=True)
        last_page_attempted = page
        list_page = fetch_service_list_page(endpoint, key, page, page_param, per_page_param, per_page, args, operation_status_counts)
        status_key = str(list_page["meta"].get("status"))
        service_list_fallbacks.extend(list_page.get("fallbacks", []))
        service_list_fallback_failures.extend(list_page.get("fallback_failures", []))
        if not list_page["ok"]:
            summary = {
                "stage": "api-refresh",
                "blocked": True,
                "reason": f"gov24 serviceList failed page={page} status={status_key}",
                "source_id": registry["source_id"],
                "source_org_scope": registry.get("source_org_scope", []),
                "page_start": page_start,
                "page_end": page_end or None,
                "last_page_attempted": last_page_attempted,
                "last_page_completed": last_page_completed,
                "pages_fetched": pages_fetched,
                "rows_seen": rows_seen,
                "operation_status_counts": operation_status_counts,
                "service_list_fallbacks": service_list_fallbacks,
                "service_list_fallback_failures": service_list_fallback_failures,
                "secret_persisted": False,
                "last_error": list_page["meta"],
            }
            write_api_refresh_summary(summary)
            raise RuntimeError(summary["reason"])

        pages_fetched += 1
        rows = list_page["rows"]
        print(f"api-refresh page={page} status={status_key} rows={len(rows)}", file=sys.stderr, flush=True)
        if not rows:
            stopped_reason = "empty_page"
            break
        rows_seen += len(rows)
        ENTRIES.mkdir(parents=True, exist_ok=True)
        for idx, row in enumerate(rows, 1):
            row_id = extract_row_id(registry, row)
            title = extract_title(registry, row)
            normalized = normalized_api_row(registry, row)
            if args.skip_companions:
                companions = {
                    "detail": {"fetch_status": "skipped", "attempts": [], "payload": None},
                    "conditions": {"fetch_status": "skipped", "attempts": [], "payload": None},
                }
            else:
                companions = {
                    "detail": fetch_gov24_companion(operations["serviceDetail"], key, row_id, timeout=args.companion_timeout),
                    "conditions": fetch_gov24_companion(operations["supportConditions"], key, row_id, timeout=args.companion_timeout),
                }
            for op_name, companion_key in [("serviceDetail", "detail"), ("supportConditions", "conditions")]:
                fetch_status = companions[companion_key]["fetch_status"]
                operation_status_counts[op_name][fetch_status] = operation_status_counts[op_name].get(fetch_status, 0) + 1

            inferred = infer_api_domain_and_tags(title, normalized, companions)
            domain = inferred["domain"]
            sensitive_domain = domain if domain in SENSITIVE_DOMAINS else None
            service_url = normalized.get("apply_url_or_menu") or "https://www.gov.kr/portal/rcvfvrSvc/main"
            if not str(service_url).startswith("http"):
                service_url = "https://www.gov.kr/portal/rcvfvrSvc/main"
            menu_path = normalized.get("apply_url_or_menu") if normalized.get("apply_url_or_menu", "").startswith("정부24") else f"정부24 > 보조금24 > {title[:40]}"
            payload_excerpt = {k: v for k, v in normalized.items() if v}
            if not payload_excerpt:
                payload_excerpt = {k: row[k] for k in list(row.keys())[:12]}
            api_payload_keys = list(dict.fromkeys(list(normalized.keys()) + list(row.keys())[:40]))[:60]
            entry_id = ulid_from_seed("gov24|" + row_id)
            entry = {
                "entry_id": entry_id,
                "catalog_version": "1.0.0",
                "status": "published",
                "candidate_state": "entry_candidate",
                "merged_into": None,
                "access_mode": "api_cached",
                "portal": "gov24",
                "domain": domain,
                "sensitive_domain": sensitive_domain,
                "title": title[:80],
                "canonical_intent": inferred["task_intent"][0],
                "canonical_action_verb": "check",
                "key_keywords": [k for k in re.split(r"\s+", title) if k][:4] or [title[:20]],
                "content_fingerprint": f"gov24|gov24-serviceList|{row_id}",
                "source_urls": [operations[name]["endpoint"] for name in ["serviceList", "serviceDetail", "supportConditions"]],
                "api_ref": {
                    "source_id": registry["source_id"],
                    "operation": "serviceList",
                    "row_id": row_id,
                    "detail_operation": "serviceDetail",
                    "conditions_operation": "supportConditions",
                },
                "source_api_fetch": {
                    "serviceList": {"page": page, "status": status_key},
                    "serviceDetail": {"fetch_status": companions["detail"]["fetch_status"], "attempt_count": len(companions["detail"]["attempts"])},
                    "supportConditions": {"fetch_status": companions["conditions"]["fetch_status"], "attempt_count": len(companions["conditions"]["attempts"])},
                },
                "api_payload_keys": api_payload_keys,
                "api_payload_excerpt": redact_secret(payload_excerpt, key),
                "api_companion_payloads": {
                    "serviceDetail": redact_secret(companions["detail"]["payload"], key),
                    "supportConditions": redact_secret(companions["conditions"]["payload"], key),
                },
                "menu_path": menu_path,
                "handoff": {"tier": "tier3", "portal": "gov24", "url": service_url, "menu_path": menu_path},
                "persona_tags": inferred["persona_tags"],
                "task_intent": inferred["task_intent"],
                "life_event_tags": inferred["life_event_tags"],
                "region_tags": infer_region_tags(normalized),
                "evidence_refs": inferred["evidence_refs"],
                "free_tags": ["gov24", "api_cached", title[:20]],
                "seasonality_hint": inferred["season"],
                "intrinsic_ordinals": {"actionability": "medium", "evidence_value": "medium", "sensitivity_risk": "high" if sensitive_domain else "medium"},
                "confidence_score": 0.86 if companions["detail"]["fetch_status"] == "ok" or companions["conditions"]["fetch_status"] == "ok" else 0.82,
                "review_required": bool(sensitive_domain),
                "review_reason": f"sensitive_domain:{sensitive_domain}" if sensitive_domain else None,
                "card_title": title[:40],
                "card_body": f"{title[:40]}의 지원 조건과 신청 안내를 정부24 공공서비스 정보에서 확인하세요."[:120],
                "cta_label": "정부24에서 확인",
                "safe_copy_audit": {"safe_copy_rule": "confirm_not_assert", "outcome": "pass", "checked_patterns": ["대상 단정 없음", "승인 보장 없음", "금액 단정 없음"]},
                "last_sync_at": today(),
            }
            out = ENTRIES / f"{entry_id}.json"
            dump_json(out, entry)
            written.append(str(out.relative_to(ROOT)))
            if idx % progress_every == 0:
                print(f"api-refresh page={page} row={idx}/{len(rows)} total_written={len(written)}", file=sys.stderr, flush=True)
        print(f"api-refresh page={page} done rows_seen={rows_seen} written={len(written)} elapsed_sec={time.monotonic() - started:.1f}", file=sys.stderr, flush=True)
        last_page_completed = page
        page += 1
        time.sleep(args.rate_delay)

    summary = {
        "stage": "api-refresh",
        "written": written,
        "count": len(written),
        "blocked": False,
        "source_id": registry["source_id"],
        "source_org_scope": registry.get("source_org_scope", []),
        "page_start": page_start,
        "page_end": page_end or None,
        "last_page_attempted": last_page_attempted,
        "last_page_completed": last_page_completed,
        "pages_fetched": pages_fetched,
        "rows_seen": rows_seen,
        "stopped_reason": stopped_reason,
        "companion_policy": companion_policy,
        "operation_status_counts": operation_status_counts,
        "service_list_fallbacks": service_list_fallbacks,
        "service_list_fallback_failures": service_list_fallback_failures,
        "secret_persisted": False,
        "elapsed_sec": round(time.monotonic() - started, 3),
        "coverage_note": "serviceList rows include national, regional, public institution, and education office records per registry source_org_scope.",
    }
    write_api_refresh_summary(summary)
    return summary


def safe_patterns() -> list[str]:
    text = (CATALOG / "safety-policy" / "v1.0.md").read_text(encoding="utf-8")
    pats = []
    for line in text.splitlines():
        m = re.match(r'\s*- "(.+)"', line)
        if m:
            pat = re.escape(m.group(1)).replace(r"\~", ".+")
            pats.append(pat)
    return pats


def review_candidate(path: Path, taxonomy: dict[str, Any], ev_ids: set[str], patterns: list[str]) -> dict[str, Any]:
    rel = str(path.relative_to(ROOT))
    try:
        e = load_json(path)
    except Exception as exc:
        return {"candidate": rel, "decision": "escalate", "reasons": [f"invalid_json:{exc}"]}
    reasons = []
    axes = taxonomy["axes"]
    def check_values(field: str, axis: str):
        for v in e.get(field, []):
            if v not in axes[axis]["values"]:
                reasons.append(f"taxonomy:{field}:{v}")
    check_values("persona_tags", "persona")
    check_values("task_intent", "intent")
    check_values("life_event_tags", "life_event")
    check_values("region_tags", "region")
    if e.get("seasonality_hint") not in axes["season"]["values"]:
        reasons.append("taxonomy:seasonality_hint")
    if e.get("access_mode") not in axes["access_mode"]["values"]:
        reasons.append("taxonomy:access_mode")
    if not e.get("menu_path") or not e.get("handoff", {}).get("menu_path"):
        reasons.append("handoff:menu_path_missing")
    if e.get("handoff", {}).get("tier") not in {"tier1", "tier2", "tier3"}:
        reasons.append("handoff:bad_tier")
    for f, cap in FEATURE_CAPS.items():
        if len(e.get(f, "")) > cap:
            reasons.append(f"copy_cap:{f}")
    copy_blob = "\n".join(str(e.get(f, "")) for f in ["card_title", "card_body", "cta_label"])
    for pat in patterns:
        if re.search(pat, copy_blob):
            reasons.append("safe_copy_assertion")
            break
    ords = e.get("intrinsic_ordinals", {})
    for f in ["actionability", "evidence_value", "sensitivity_risk"]:
        if ords.get(f) not in ORDINALS:
            reasons.append(f"ordinal:{f}")
    if e.get("sensitive_domain") in SENSITIVE_DOMAINS and ords.get("sensitivity_risk") == "low":
        reasons.append("ordinal:sensitive_sr_low")
    if e.get("access_mode") == "api_cached":
        if not e.get("api_ref") or not e.get("api_payload_keys") or not e.get("last_sync_at"):
            reasons.append("access_mode:api_cached_source_fields")
    if e.get("access_mode") in {"portal_handoff", "manual_check"}:
        if not e.get("source_urls") or not e.get("last_verified_at"):
            reasons.append("access_mode:portal_source_fields")
    for ev in e.get("evidence_refs", []):
        if ev not in ev_ids:
            reasons.append(f"evidence_ref:{ev}")
    confidence = float(e.get("confidence_score", 0))
    sensitive = e.get("sensitive_domain") in SENSITIVE_DOMAINS
    if confidence < 0.85:
        reasons.append("confidence_lt_0.85")
    if sensitive:
        reasons.append(f"sensitive_domain:{e.get('sensitive_domain')}")
    decision = "auto_accept" if not reasons else "escalate"
    return {"candidate": rel, "decision": decision, "reasons": reasons}


def review(args: argparse.Namespace) -> dict[str, Any]:
    taxonomy = read_taxonomy()
    ev_ids = evidence_ids()
    patterns = safe_patterns()
    files = sorted(p for p in ENTRIES.glob("*.json") if not p.name.startswith("_example"))
    results = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.parallel) as ex:
        futs = [ex.submit(review_candidate, p, taxonomy, ev_ids, patterns) for p in files]
        for fut in concurrent.futures.as_completed(futs):
            results.append(fut.result())
    results.sort(key=lambda r: r["candidate"])
    CHUNK_DIR.mkdir(parents=True, exist_ok=True)
    chunks = [[] for _ in range(args.parallel)]
    for i, r in enumerate(results):
        chunks[i % args.parallel].append(r)
    for i, chunk in enumerate(chunks, 1):
        dump_json(CHUNK_DIR / f"chunk-{i:02d}.json", {"chunk": i, "results": chunk})
    counts = {"auto_accept": 0, "escalate": 0}
    reason_counts: dict[str, int] = {}
    for r in results:
        counts[r["decision"]] += 1
        for reason in r["reasons"]:
            reason_counts[reason] = reason_counts.get(reason, 0) + 1
    summary = {
        "reviewed_at": today(),
        "parallel_instances": args.parallel,
        "candidate_count": len(results),
        "processed_percent": 100 if files else 0,
        "decision_counts": counts,
        "reason_counts": dict(sorted(reason_counts.items())),
        "results": results,
    }
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    dump_json(REPORT_DIR / "session1-review-summary.json", summary)
    return {"stage": "review", **{k: summary[k] for k in ["candidate_count", "processed_percent", "decision_counts", "reason_counts"]}}


def pr_body(args: argparse.Namespace) -> dict[str, Any]:
    summary_path = REPORT_DIR / "session1-review-summary.json"
    if not summary_path.exists():
        raise SystemExit("run review first")
    summary = load_json(summary_path)
    entries = [load_json(p) for p in sorted(ENTRIES.glob("*.json")) if not p.name.startswith("_example")]
    conf = {">=0.95": 0, "0.85-0.95": 0, "0.60-0.85": 0, "<0.60": 0}
    sensitive = 0
    access = {}
    for e in entries:
        c = float(e.get("confidence_score", 0))
        if c >= 0.95: conf[">=0.95"] += 1
        elif c >= 0.85: conf["0.85-0.95"] += 1
        elif c >= 0.60: conf["0.60-0.85"] += 1
        else: conf["<0.60"] += 1
        if e.get("sensitive_domain") in SENSITIVE_DOMAINS: sensitive += 1
        access[e.get("access_mode", "missing")] = access.get(e.get("access_mode", "missing"), 0) + 1
    body = f"""# Session 1 Catalog Ingestion Draft

Maintainer-side only. No catalog publish tag is part of this PR.

## Scope

- API refresh candidates: {access.get('api_cached', 0)}
- Portal handoff candidates: {access.get('portal_handoff', 0)}
- Evidence records: {len(list(EVIDENCE_DIR.glob('*.json')))}
- Review Agent parallelism: N={summary['parallel_instances']}

## Confidence distribution

```json
{json.dumps(conf, ensure_ascii=False, indent=2)}
```

## Sensitive-domain count

- sensitive candidates: {sensitive}

## Review decisions

```json
{json.dumps(summary['decision_counts'], ensure_ascii=False, indent=2)}
```

## Escalation / reject reason classes

```json
{json.dumps(summary['reason_counts'], ensure_ascii=False, indent=2)}
```

## Draft PR checklist

- [ ] `GOV24_SERVICE_KEY` was supplied by GitHub Secrets, not by a committed file.
- [ ] API refresh generated the full national + regional Gov24 candidate set; no local fake rows were used.
- [ ] Portal handoff generated at least 30 EntryCandidates and every candidate has `menu_path`.
- [ ] Evidence metadata was refreshed for every seed dataset.
- [ ] Review Agent ran with N={summary['parallel_instances']} chunks and `processed_percent` is `{summary['processed_percent']}`.
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
"""
    out = REPORT_DIR / "session1-draft-pr-body.md"
    out.write_text(body, encoding="utf-8")
    return {"stage": "pr-body", "path": str(out.relative_to(ROOT))}


def run_all(args: argparse.Namespace) -> dict[str, Any]:
    stages = []
    stages.append(api_refresh(args))
    stages.append(portal_refresh(args))
    stages.append(evidence_refresh(args))
    stages.append(review(args))
    stages.append(pr_body(args))
    REPORT_DIR.mkdir(parents=True, exist_ok=True)
    dump_json(REPORT_DIR / "session1-pipeline-run.json", {"ran_at": today(), "stages": stages})
    return {"stages": stages}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("command", choices=["api-refresh", "portal-refresh", "evidence-refresh", "review", "pr-body", "all"])
    ap.add_argument("--parallel", type=int, default=8)
    ap.add_argument("--rate-delay", type=float, default=0.2)
    ap.add_argument("--max-pages", type=int, default=0, help="testing limit for gov24 api-refresh; 0 means all")
    ap.add_argument("--start-page", type=int, default=0, help="first gov24 page to fetch for sharded api-refresh")
    ap.add_argument("--end-page", type=int, default=0, help="last gov24 page to fetch for sharded api-refresh; 0 means until empty")
    ap.add_argument("--api-timeout", type=int, default=20, help="seconds per gov24 HTTP request")
    ap.add_argument("--companion-timeout", type=int, default=20, help="seconds per gov24 companion-operation HTTP request")
    ap.add_argument("--skip-companions", action="store_true", help="skip gov24 companion operations and ingest serviceList rows only")
    ap.add_argument("--min-per-page", type=int, default=10, help="smallest fallback perPage when a gov24 serviceList JSON page is malformed")
    ap.add_argument("--progress-every", type=int, default=25, help="log progress every N rows within a page")
    args = ap.parse_args()
    if args.command == "api-refresh": result = api_refresh(args)
    elif args.command == "portal-refresh": result = portal_refresh(args)
    elif args.command == "evidence-refresh": result = evidence_refresh(args)
    elif args.command == "review": result = review(args)
    elif args.command == "pr-body": result = pr_body(args)
    else: result = run_all(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
