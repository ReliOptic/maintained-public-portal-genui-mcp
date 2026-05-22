# All user-facing copy lives in the Catalog

Every string the end user reads — `card_title`, `card_body`, `cta_label`, `hero.title`, `hero.subtitle`, `handoff_notice`, `evidence_rail.label` — is **stored Catalog data**, authored offline through the LLM Annotation Layer and gated by the [[Human Review Queue]]. The runtime MCP server **never calls an LLM to write or rewrite copy**. This reverses the implication of architecture v0.1 §6.2 and §8 that the host LLM would compose card copy at request time.

## Considered options

- **MCP returns structured data, LLM writes all copy at runtime.** Rejected: `safe_copy_rule` cannot be reliably enforced after a free-text LLM generation; each request would burn copywriting tokens; PR review covers tags but not wording, leaving a hole.
- **Layered authorship (MCP fixes safety-bound strings, LLM writes hero/body).** Was the original recommendation. Rejected by maintainer: maintain a single review path (PR), not two.
- **Pre-rendered template + LLM slot fill.** Almost the same as MCP-authored everything; the LLM contribution becomes trivial.

## Consequences

- Annotation pipeline is heavier: every Entry needs copy authored and reviewed, not just tags and ordinals. Maintainer review surface grows accordingly.
- Runtime hot path costs zero copywriting tokens. `compose_genui_artifact` is pure assembly.
- `safe_copy_rule` enforcement is a publish-time schema concern, not a runtime concern. No copy violating it can reach a user.
- The Catalog version number now includes wording changes — see [[catalog_version]] semver `patch` semantics.
