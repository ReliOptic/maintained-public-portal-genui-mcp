# AI Review Agent as first-pass reviewer

The original Review Queue assumed a single human maintainer would review every candidate change. At v0.1 launch scale — national + regional gov24 plus hand-curated portal_handoff plus Evidence rows, roughly 10k Entries — that workload is not survivable for a one-person OSS project. We introduce a **Review Agent**: Claude Code, Codex, or any equivalent agent that applies a fixed rubric to every PR diff under `catalog/**`. The rubric checks taxonomy enum compliance, `menu_path` presence, copy length and `safe_copy_rule` lint, intrinsic-ordinal sanity, and `access_mode`-vs-source consistency. The Agent posts an approval comment when the rubric passes, confidence is ≥ 0.85, and the Entry is either non-sensitive or a sensitive `api_cached` row with `confirm_not_assert` safe-copy audit passing; otherwise it tags the maintainer with a structured findings comment. At launch the Agent runs as **N parallel instances over disjoint chunks** (N≈8) to clear the initial backlog inside a launch window; the daily incremental delta is small enough for a single instance afterward.

## Considered options

- **Single human maintainer for everything (original Q16).** Rejected under [[ADR-0009]] SLC framing — does not scale to 10k Entries within one OSS launch.
- **Skip review for high-confidence candidates entirely (≥ 0.85 auto-merge).** Rejected: rubric failure rate is unknown at v0.1, and sensitive-domain Entries still need source/copy checks before any auto-accept.
- **Hard-escalate every sensitive-domain Entry.** Rejected after the API-first pivot: sensitive `api_cached` Gov24 rows come from official structured API data and have machine-checkable `confirm_not_assert` copy constraints, while sensitive `portal_handoff` rows still depend on portal-screen interpretation.
- **Crowd review (any PR commenter can approve).** Rejected: no enforceable quality bar.

## Consequences

- A new tooling artifact lives at `tooling/review-agent/{prompt,rubric,runner}` and is versioned independently of `catalog_version`.
- The rubric prompt is itself PR-reviewable — the maintainer's loop becomes "review the reviewer" plus "review escalations", trading volume for meta-work.
- Every accept / escalate decision leaves a PR-comment audit trail, so rollback is precise.
- If the Agent regresses, the `catalog_version` rollback path covers user-visible damage; the broken rubric is fixed in a separate PR under `tooling/`.
- The parallel-runner concurrency level N is a tunable in `tooling/review-agent/runner/`, not a hard constant.

## Subsequent amendments

- [[ADR-0011]] — The Review Agent rubric's "intrinsic ordinal sanity" check now operates against the ordinal numerics in `weights/<weights_version>.json` (`score_ordinals`, `gate_ordinals`), not code constants. The rubric verifies per-Entry labels; the JSON file verifies the label→number mapping. A malformed mapping fails server startup rather than silently degrading rank.
