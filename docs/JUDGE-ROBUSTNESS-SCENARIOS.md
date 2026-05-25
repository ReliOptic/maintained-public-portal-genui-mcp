# Judge Robustness Scenarios — v0.1 RC

These scenarios are the release-candidate evidence that the project handles varied judge questions through the same contract:

```text
natural-language prompt → host interview skill → taxonomy payload → rank_portal_entries → compose_genui_artifact
```

They are not a fixed demo script. They define coverage classes and expected properties.

## Global invariants

Every scenario must satisfy:

- no live data.go.kr API call;
- no user credential, service key, resident number, password, authentication code, or exact income request;
- handoff URL, if present, is returned by MCP and is allowlisted;
- sensitive cards use confirmation language rather than eligibility/result guarantees;
- data.go.kr appears as Insight/Evidence/portal handoff, not as a runtime API fetch.

## Scenario 1 — Tax / freelancer

User prompt: `프리랜서인데 5월 종합소득세 신고랑 관련 증빙을 확인하고 싶어요.`

Expected host payload shape:

```json
{ "persona": ["freelancer"], "intent": ["tax_filing"], "life_event": ["tax_season"] }
```

Expected MCP behavior:

- Hometax appears in Action Cards.
- Evidence Rail is non-empty.
- Any sensitive tax copy is `confirm_not_assert` style.

Executable coverage: `tests/integration/scenarios.test.ts` — `routes freelancer tax season to Hometax with evidence`.

## Scenario 2 — Relocation / registration

User prompt: `대전으로 이사 왔는데 전입신고랑 필요한 행정 절차를 알려줘.`

Expected host payload shape:

```json
{ "intent": ["registration_report"], "life_event": ["relocation"], "region": ["daejeon"] }
```

Expected MCP behavior:

- Gov24 전입신고 card appears.
- Region mismatch is not used as a soft score; incompatible regional entries are excluded.

Executable coverage: `tests/integration/scenarios.test.ts` — `surfaces Gov24 relocation reporting`.

## Scenario 3 — Youth employment

User prompt: `청년 취업 지원 뭐가 있어?`

Expected host behavior:

- If taxonomy mapping is uncertain, use keyword search as the discovery rail.
- `search_portal_entries({ "query": "청년 취업", "limit": 5 })` returns youth/employment entries.
- Host may then ask one bounded question to map the user's situation before ranking.

Expected MCP behavior:

- Search results include entries whose titles contain 청년 and 취업.
- No Worknet live source is required in v0.1.

Executable coverage: `tests/integration/scenarios.test.ts` — `finds youth employment entries by keyword search`.

## Scenario 4 — Welfare exploration

User prompt: `저소득 가구가 받을 수 있는 복지 혜택을 비교하고 싶어요.`

Expected host payload shape:

```json
{ "persona": ["low_income_household"], "intent": ["benefit_application"] }
```

Expected MCP behavior:

- Gov24 benefit/application cards are returned.
- Comparison/exploration mode may bump `EV`, `PF`, and `LF` with a `weight_rationale`.

Executable coverage: `tests/integration/scenarios.test.ts` — `returns low-income benefit application entries`.

## Scenario 5 — data.go.kr API application

User prompt: `공공데이터 API 활용신청은 어디서 해?`

Expected host payload shape:

```json
{ "persona": ["data_user"], "intent": ["api_application"], "life_event": ["public_data_project"] }
```

Expected MCP behavior:

- data.go.kr appears in the Insight Rail.
- The answer links to portal handoff/search guidance only.
- The runtime does not call data.go.kr OpenAPI.

Executable coverage: `tests/integration/scenarios.test.ts` — `places API application in the insight rail`.

## Scenario 6 — Regional living evidence

User prompt: `대전 유성구로 이사 갈지 고민 중인데 생활 통계나 지역 근거도 같이 보여줘.`

Expected host payload shape:

```json
{ "persona": ["tenant"], "intent": ["policy_information"], "life_event": ["relocation"], "region": ["daejeon"] }
```

Expected MCP behavior:

- Gov24 action card can remain primary.
- data.go.kr regional/population/statistics cards appear as Insight Rail.
- Evidence Rail is non-empty.

Executable coverage: `tests/integration/scenarios.test.ts` — `returns regional living evidence with data.go.kr insight cards`.

## Scenario 7 — Empty or broad judge question

User prompt: `나한테 맞는 공공서비스 뭐가 있어?`

Expected host behavior:

- Ask at most two bounded questions from `resource://taxonomy/v1.0`.
- If the judge refuses to answer, call MCP with partial or empty context.

Expected MCP behavior:

- Empty structured payload is accepted.
- Deterministic Stage 0 baseline returns cards.

Executable coverage: `tests/integration/scenarios.test.ts` — `falls back for empty context`.

## Scenario 8 — Same prompt, different context

User prompts:

1. `5월에 뭐 챙겨야 해?` + freelancer/tax context
2. `이사했는데 뭐 챙겨야 해?` + relocation context

Expected MCP behavior:

- Top card differs between contexts.
- This demonstrates `Entry Features × Context Weights = Ranked Actions` rather than static search.

Executable coverage: `tests/integration/scenarios.test.ts` — `changes top card between tax and relocation queries` and `changes top card between tax and parent benefit personas`.
