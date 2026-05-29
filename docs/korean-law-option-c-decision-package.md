# Korean-Law Option C Decision Package

Status: draft decision package, not applied.

## Recommendation

Recommended decision: **Option C**.

Use a hybrid path where `korean-law-evidence` stays parked in the open-source
runtime until a server-side proxy and citation-verification review gate exist.
This keeps the v0.2 adapter discovery surface honest: legal evidence is visible
as a planned adapter, but the runtime does not fetch legal text, require a
user-held OC key, or imply legal eligibility decisions.

Interim path if Option C is too large for this release: **Option A**.

Keep korean-law as a host-layer parallel connection outside this server. The
gateway continues to expose only the parked `korean-law-evidence` adapter state
and does not render legal evidence sections.

## One-Decision Gate

Approve one of these:

- **Approve C**: accept ADR-0022 as the target direction, keep the disabled
  skeleton parked, and add a `verify_citations` review rubric before any legal
  citation can be surfaced.
- **Pick A**: keep korean-law entirely host-layer for now; no server skeleton
  beyond the parked discovery entry.
- **Pick B**: require a separate design pass before this gateway owns any
  korean-law contract.
- **Hold**: keep current parked state; no code changes needed.

## Evidence

- Current runtime already publishes `korean-law-evidence` as `parked`.
- Current schema requires parked adapters to use `decision_required`, have a
  status reason, reference ADR-0022, and expose no data sections.
- Tests assert the parked adapter state and do not call a live legal MCP server.
- `docs/korean-law-decision-gate.md` forbids copied legal text, user-held OC
  keys, live legal calls in tests, and legal eligibility claims.

## Draft Diff For Approve C

This patch is not applied. It is the exact starting diff to apply after explicit
approval of Option C.

```diff
diff --git a/docs/adr/0022-korean-law-evidence.md b/docs/adr/0022-korean-law-evidence.md
new file mode 100644
index 0000000..0000000
--- /dev/null
+++ b/docs/adr/0022-korean-law-evidence.md
@@
+# ADR-0022: Korean Law Evidence Role
+
+Status: Accepted
+
+## Context
+
+The gateway can show public-benefit candidates and regional evidence, but legal
+basis text introduces credential, citation, and interpretation risk. The runtime
+must not require a user-held law.go.kr OC key or present legal eligibility
+decisions.
+
+## Decision
+
+Adopt Option C. Keep `korean-law-evidence` as a disabled/parked adapter until a
+server-side proxy, allowlist, and citation-verification review gate exist.
+Legal citations may be surfaced only after the `verify_citations` rubric passes.
+
+## Consequences
+
+- The open-source runtime continues to expose `korean-law-evidence` as parked.
+- No live korean-law calls are added to tests or demo fixtures.
+- Future legal evidence work must implement a server-side credential boundary.
+- Generated UI must not present legal eligibility decisions.
+
+## Review Rubric: verify_citations
+
+Before legal evidence can be surfaced:
+
+1. Every legal citation must include source law, article/paragraph, and retrieval
+   timestamp.
+2. The cited text must come from the approved server-side proxy, not fixtures or
+   user-provided credentials.
+3. The generated UI must label legal evidence as reference material, not a final
+   eligibility decision.
+4. Tests must assert the disabled state without making live korean-law calls.
diff --git a/docs/korean-law-decision-gate.md b/docs/korean-law-decision-gate.md
index 0000000..0000000 100644
--- a/docs/korean-law-decision-gate.md
+++ b/docs/korean-law-decision-gate.md
@@
-The local design reference records ADR-0022 as:
+ADR-0022 is accepted for this monorepo as Option C:

-- Status: Proposed, decision required.
-- Recommendation: Option C, a hybrid path where legal evidence is disabled
-  until a proxy exists and citation verification is used as a review gate.
-- Interim fallback: Option A, host-layer parallel connection.
-
-That is not an explicit upstream acceptance. Until Option A, B, or C is accepted
-for this monorepo, the integration remains parked rather than guessed.
+- Status: Accepted.
+- Decision: legal evidence remains disabled until a server-side proxy exists and
+  citation verification is used as a review gate.
+- Runtime state: `korean-law-evidence` remains parked; no live call or legal text
+  handling is enabled by this ADR acceptance alone.
```

## No-Approval Current State

If no option is approved, keep the current parked adapter as-is and proceed with
release preparation. No runtime code change is required.
