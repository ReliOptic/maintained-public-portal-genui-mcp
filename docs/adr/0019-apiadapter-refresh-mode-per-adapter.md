# ADR-0019: ApiAdapter refresh_mode declares scheduled vs on-demand execution

Status: Accepted for v0.2 design

## Context

ADR-0017 deferred the teammate public-data OpenAPI proposal out of v0.1 because a live multi-source gateway would add credential handling, retry/cache/fallback, runtime network behavior, and a broader GenUI schema. The v0.2 design is now narrowed: extend the existing MCP server with adapter plugins rather than creating a separate server or replacing the catalog/ranking core.

Public APIs differ in how stale their data can be before it loses value:

- 관세청 수출입 통계, 복지시설 현황: monthly/daily pre-fetch is sufficient.
- 기상청 대기질, 재난안전 경보: staleness of hours can make the answer misleading.

The server therefore needs two execution paths, but the branch point must be declarative. Application code must not special-case adapter identities such as `customs` or `welfare_facilities`.

## Decision

Each `ApiAdapter` declares `refresh_mode: "scheduled" | "on_demand"` in its registration entry in `resource://adapters/v1`. The MCP server branches only on this field:

- `scheduled`: CI/GitHub Actions calls the adapter on a schedule, normalizes to `DataRecord[]`, stores output in `compiled.sqlite`, and ships it in the `.mcpb` snapshot. No live network call or credential exists on the user's machine.
- `on_demand`: request-time execution goes through a maintainer-operated credential proxy. The local MCP server never asks the user for upstream API keys.

The adapter identity describes source semantics only. It never decides execution routing.

Adapters also declare `availability: "available" | "unavailable" | "parked"`:

- `available`: eligible for taxonomy-triggered data sections.
- `unavailable`: discoverable but not routed; used for sources that need proxy/failure UX before activation.
- `parked`: discoverable but not routed; used for human decision gates such as legal-evidence integration.

An `on_demand` adapter may omit `proxy_url` only while it is `unavailable` or `parked`. An `available` on-demand adapter still requires a maintainer proxy URL before the server will accept the registration.

## Confirmed v0.2 design decisions

1. **Existing server extension, not a separate server.** v0.2 adds an `ApiAdapter` plugin layer inside the current MCP server and preserves the existing catalog/ranking/tool surface.
2. **`resource://adapters/v1` is the discovery path.** Host LLMs and server code discover available adapters through an MCP resource, following the `resource://taxonomy/v1.0` pattern.
3. **Taxonomy-driven routing.** Each adapter declares `trigger_intents: string[]` from the closed taxonomy enum. The server activates an adapter when `req.intent ∩ adapter.trigger_intents ≠ ∅`.
4. **No extra interview question for adapter mode.** The host-side Interview Skill still asks at most two taxonomy questions. It does not ask whether the user wants a live API, dataset, or catalog path.
5. **Credentials stay off user devices.** Scheduled adapters use GitHub Secrets + CI bot. On-demand adapters use a maintainer-operated credential proxy. The general `.mcpb` user path has no user Node config, JSON config, service key, or environment variable requirement.
6. **`compose_genui_artifact` is extended, not replaced.** v0.2 adds `data_sections: DataSection[]` alongside `cards`, `insight_rail`, and `evidence_rail`.
7. **Pre-fetch and on-demand are both first-class.** The mode is declared by each adapter as `refresh_mode`; the server path is selected from the declaration, not from adapter identity.
8. **MVP starts with at least one scheduled adapter.** The first v0.2 slice should validate the CI pre-fetch path with one low-infrastructure source, e.g. 관세청 수출입 통계 or 복지시설 현황.
9. **On-demand is allowed only after proxy/fallback design exists.** Until proxy infrastructure and failure disclosure are ready, on-demand adapters must remain disabled or return disclosed mock/sample status rather than silently failing.

## Interface shape

A single `resource://adapters/v1` manifest lists adapter registrations:

```json
{
  "adapters_version": "v1",
  "adapters": [
    {
      "adapter_id": "customs_trade_statistics",
      "refresh_mode": "scheduled",
      "availability": "available",
      "trigger_intents": ["policy_information", "data_search"],
      "fetch_params": {
        "region": { "type": "taxonomy_region_enum" },
        "period": { "type": "YYYY-MM" },
        "domain_filter": { "type": "enum", "values": ["export", "import"] },
        "limit": { "type": "integer", "default": 50 }
      },
      "source": {
        "agency": "관세청",
        "api_name": "수출입 통계",
        "auth_type": "key_required"
      }
    }
  ]
}
```

Each adapter implements the three-method interface documented in `CONTEXT.md`:

- `fetch(params)`
- `normalize(rawResponse)`
- `sourceManifest()`

## Consequences

- `compiled.sqlite` gains adapter storage for scheduled output, such as a `data_records` table keyed by adapter, region, and period.
- The existing `compose_genui_artifact` implementation becomes the integration point for DataSections; a new top-level MCP tool is not required for MVP.
- `resource://adapters/v1` becomes a contract and needs fixture tests before the first adapter implementation.
- `availability` lets hosts inspect planned or blocked adapters without letting unfinished integrations participate in request routing.
- On-demand adapters require explicit proxy, timeout, retry, cache, and failure-disclosure design before activation.
- v0.2 can ship an MVP with one scheduled adapter without committing to live request-time infrastructure.

## Considered options

- **Separate public-data MCP server.** Rejected: splits ranking, evidence, taxonomy, and GenUI composition across servers and makes host orchestration harder.
- **Branch by adapter identity.** Rejected: creates source-specific application code and makes adding adapters risky.
- **Scheduled-only.** Rejected: cannot support time-sensitive APIs such as weather or disaster alerts later.
- **On-demand-only.** Rejected: forces all adapters to need infrastructure even when source freshness does not require it.
- **Ask the user which data path they want.** Rejected: violates the Interview Skill constraint; taxonomy intent should be enough for routing.

Constraint: v0.2 must preserve the v0.1 `.mcpb` user path: no user credential prompts, no local service keys, and no natural-language routing logic inside the MCP server.
Rejected: A separate live public-data gateway server | It would duplicate catalog/evidence/ranking context and increase host orchestration burden.
Confidence: high
Scope-risk: moderate
Directive: Add adapters by manifest + interface implementation; route only by `refresh_mode` and `trigger_intents`, never by adapter identity.
Tested: Documentation-only ADR; cross-linked from `CONTEXT.md`.
Not-tested: `resource://adapters/v1` implementation, `data_records` schema migration, first scheduled adapter, on-demand proxy.
