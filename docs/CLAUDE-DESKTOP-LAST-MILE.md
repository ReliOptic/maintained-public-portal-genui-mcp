# Claude Desktop Last-Mile Verification — v0.1 RC

This checklist proves the release candidate behaves like an installable product rather than a local dev demo.

## Scope lock

v0.1 is a local `.mcpb` MCP server with a bundled `catalog/compiled.sqlite` snapshot. It never fetches Gov24, Hometax, or data.go.kr at runtime and never asks the general user for credentials, service keys, JSON config, or environment variables.

The companion `skills/public-portal-interview.md` is a host-side instruction artifact. Claude Desktop must not be assumed to auto-activate it from the MCPB. The skill explains the intended natural-language → taxonomy → rank/compose flow for hosts that can use file-based skills or equivalent instructions.

## Build and package

Run from the repository root:

```bash
npm ci
npm run typecheck
npm run build
npm run compile
npm test
npm run pack
```

Expected result:

- `catalog/compiled.sqlite` exists;
- `npm test` runs the unit + integration suite;
- `mcpb pack` validates `manifest.json` and emits a `.mcpb` archive.

## No-secret package audit

After packing, inspect the archive:

```bash
unzip -l *.mcpb | rg 'env_|SERVICE_KEY|serviceKey|\.env|\.omx|\.omc|tooling/|reports/|claude-extension.json'
```

Expected result: no matches.

Required files should be present:

```bash
unzip -l *.mcpb | rg 'manifest.json|dist/index.js|catalog/compiled.sqlite|skills/public-portal-interview.md|package.json'
```

## Claude Desktop install path

1. Download the `.mcpb` from GitHub Releases or use the local packed archive.
2. Open Claude Desktop → Settings → Extensions.
3. Use Advanced settings / Install Extension to install the `.mcpb`.
4. Start a new conversation after installation.
5. Confirm the MCP server logs contain `server_ready`.
6. Confirm the tool list contains:
   - `search_portal_entries`
   - `rank_portal_entries`
   - `get_entry_detail`
   - `compose_genui_artifact`
7. Confirm resources are readable:
   - `resource://taxonomy/v1.0`
   - `resource://evidence/v1.0`

## Expected question flow

For a broad user prompt, Claude/the host should:

1. read `resource://taxonomy/v1.0`;
2. ask at most two bounded questions if `intent + (persona or life_event)` is missing;
3. produce a structured taxonomy payload;
4. optionally add `weight_override` plus `weight_rationale`;
5. call `rank_portal_entries(payload)`;
6. call `compose_genui_artifact(payload)`;
7. present Action Cards, Insight Rail, Evidence Rail, and official handoff guidance.

If a native user-question UI such as `AskUserQuestion` is available, it may be used to ask the bounded questions. If not, the same questions are asked in chat. The MCP server itself does not trigger native question popups.

## Manual smoke prompts

Use these as judge-style probes, not as a memorized demo script:

1. `프리랜서인데 5월에 세금 관련해서 뭘 확인해야 해?`
2. `대전으로 이사 왔는데 전입이랑 동네 데이터도 같이 보고 싶어`
3. `청년 취업 지원 뭐가 있어?`
4. `저소득 가구가 받을 수 있는 복지 혜택을 비교하고 싶어`
5. `공공데이터 API 활용신청은 어디서 해?`
6. `우리 지역 생활 통계나 상권 근거를 같이 보여줘`

Pass condition: every answer is grounded in MCP-returned tools/resources, uses allowlisted handoff URLs only, does not ask for credentials or sensitive identifiers, and routes data.go.kr as Insight/Evidence rather than live runtime API calls.
