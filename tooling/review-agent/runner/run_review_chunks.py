#!/usr/bin/env python3
"""Run the Session 1 AI Review Agent chunker.

Maintainer-side convenience wrapper around the repository validator/chunker. It
keeps the review entrypoint under tooling/review-agent/{prompt,rubric,runner}
without duplicating rubric logic.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
PIPELINE = ROOT / "tooling" / "ingestion" / "run_pipeline.py"


def main() -> None:
    parser = argparse.ArgumentParser(description="Run Session 1 review agent chunking")
    parser.add_argument("--parallel", type=int, default=8, help="number of review chunks/instances")
    parser.add_argument("--json", action="store_true", help="print raw JSON result only")
    args = parser.parse_args()

    proc = subprocess.run(
        [sys.executable, str(PIPELINE), "review", "--parallel", str(args.parallel)],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=False,
    )
    if proc.returncode != 0:
        if proc.stdout:
            print(proc.stdout, end="", file=sys.stdout)
        if proc.stderr:
            print(proc.stderr, end="", file=sys.stderr)
        raise SystemExit(proc.returncode)
    if args.json:
        print(proc.stdout, end="")
        return
    result = json.loads(proc.stdout)
    print(
        f"reviewed={result['candidate_count']} processed={result['processed_percent']}% "
        f"auto_accept={result['decision_counts']['auto_accept']} "
        f"escalate={result['decision_counts']['escalate']} chunks={args.parallel}"
    )


if __name__ == "__main__":
    main()
