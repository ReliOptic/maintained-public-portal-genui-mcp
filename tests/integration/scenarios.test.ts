import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import weightsConfig from "../../catalog/v1.0.0/weights/v1.0.0.json";

const allowedHosts: readonly string[] = weightsConfig.handoff_allowlist;
const credentialPatterns = [/주민등록번호/u, /비밀번호/u, /인증번호/u, /공인인증/u];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const payload = (result: unknown): Record<string, unknown> => {
  if (!isRecord(result) || !isRecord(result.structuredContent)) return {};
  return result.structuredContent;
};

const records = (value: unknown): readonly Record<string, unknown>[] =>
  Array.isArray(value) ? value.filter(isRecord) : [];

const artifactFrom = (result: Record<string, unknown>): Record<string, unknown> =>
  isRecord(result.artifact) ? result.artifact : {};

const text = (value: unknown): string => typeof value === "string" ? value : "";

const handoff = (card: Record<string, unknown>): Record<string, unknown> =>
  isRecord(card.handoff) ? card.handoff : {};

const cardUrl = (card: Record<string, unknown>): string =>
  text(card.handoff_url) || text(handoff(card).url) || text(handoff(card).tier2);

const cardBody = (card: Record<string, unknown>): string => text(card.card_body) || text(card.body);

const cardPortal = (card: Record<string, unknown>): string => text(card.portal) || text(handoff(card).portal);

const cards = (artifact: Record<string, unknown>): readonly Record<string, unknown>[] => records(artifact.cards);

const insights = (artifact: Record<string, unknown>): readonly Record<string, unknown>[] => records(artifact.insight_rail);

const allCards = (artifact: Record<string, unknown>): readonly Record<string, unknown>[] => [...cards(artifact), ...insights(artifact)];

const assertAllowedUrl = (url: string): void => {
  if (!url) return;
  const host = new URL(url).hostname.replace(/^www\./u, "");
  expect(allowedHosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`))).toBe(true);
};

const assertInvariants = (artifact: Record<string, unknown>): void => {
  const insightIds = new Set(insights(artifact).map((card) => text(card.entry_id)));
  for (const card of allCards(artifact)) {
    assertAllowedUrl(cardUrl(card));
    expect(["standard", "confirm_not_assert"]).toContain(card.safe_copy_rule);
    for (const pattern of credentialPatterns) expect(pattern.test(cardBody(card))).toBe(false);
  }
  for (const card of cards(artifact)) expect(insightIds.has(text(card.entry_id))).toBe(false);
};

interface RunResult {
  readonly rank: Record<string, unknown>;
  readonly compose: Record<string, unknown>;
  readonly artifact: Record<string, unknown>;
}

describe("Product readiness scenarios", () => {
  const client = new Client({ name: "portal-scenarios-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    cwd: process.cwd(),
    env: { ...getDefaultEnvironment(), PORTAL_CATALOG_DB: "catalog/compiled.sqlite" },
    stderr: "pipe",
  });

  const run = async (input: Record<string, unknown>): Promise<RunResult> => {
    const rank = payload(await client.callTool({ name: "rank_portal_entries", arguments: input }));
    const compose = payload(await client.callTool({ name: "compose_genui_artifact", arguments: input }));
    const artifact = artifactFrom(compose);
    expect(Number(rank.count)).toBeGreaterThan(0);
    assertInvariants(artifact);
    return { rank, compose, artifact };
  };

  beforeAll(async () => {
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("routes freelancer tax season to Hometax with evidence", async () => {
    const { artifact } = await run({ intent: ["tax_filing"], persona: ["freelancer"], life_event: ["tax_season"] });
    expect(cards(artifact).some((card) => cardPortal(card) === "hometax")).toBe(true);
    expect(records(isRecord(artifact.evidence_rail) ? artifact.evidence_rail.items : [])).not.toHaveLength(0);
  });

  it("surfaces Gov24 relocation reporting", async () => {
    const { artifact } = await run({ intent: ["registration_report"], life_event: ["relocation"] });
    expect(cards(artifact).some((card) => cardPortal(card) === "gov24" && /전입/u.test(text(card.title)))).toBe(true);
  });

  it("returns low-income benefit application entries", async () => {
    const { artifact } = await run({ intent: ["benefit_application"], persona: ["low_income_household"] });
    expect(cards(artifact).length).toBeGreaterThan(0);
  });

  it("finds youth employment entries by keyword search", async () => {
    const result = payload(await client.callTool({ name: "search_portal_entries", arguments: { query: "청년 취업", limit: 5 } }));
    const entries = records(result.entries);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries.some((entry) => /청년/u.test(text(entry.title)) && /취업/u.test(text(entry.title)))).toBe(true);
  });

  it("routes startup business registration to Hometax", async () => {
    const { artifact } = await run({ intent: ["business_registration"], life_event: ["startup"] });
    expect(cards(artifact).some((card) => cardPortal(card) === "hometax")).toBe(true);
  });

  it("places public-data search in the insight rail", async () => {
    const { artifact } = await run({ intent: ["data_search"], persona: ["data_user"] });
    expect(insights(artifact).length).toBeGreaterThan(0);
    expect(cardPortal(insights(artifact)[0] ?? {})).toBe("data_go_kr");
  });

  it("places API application in the insight rail", async () => {
    const { artifact } = await run({ intent: ["api_application"], persona: ["startup_founder"] });
    expect(insights(artifact).length).toBeGreaterThan(0);
  });

  it("returns regional living evidence with data.go.kr insight cards", async () => {
    const { artifact } = await run({ intent: ["policy_information"], persona: ["tenant"], life_event: ["relocation"], region: ["daejeon"] });
    expect(insights(artifact).some((card) => /통계|데이터/u.test(text(card.title)) && cardPortal(card) === "data_go_kr")).toBe(true);
    expect(records(isRecord(artifact.evidence_rail) ? artifact.evidence_rail.items : []).length).toBeGreaterThan(0);
  });

  it("changes top card between tax and relocation queries", async () => {
    const tax = await run({ intent: ["tax_filing"], persona: ["freelancer"], life_event: ["tax_season"] });
    const relocation = await run({ intent: ["registration_report"], life_event: ["relocation"] });
    expect(text(cards(tax.artifact)[0]?.entry_id)).not.toBe(text(cards(relocation.artifact)[0]?.entry_id));
  });

  it("falls back for empty context", async () => {
    const { artifact } = await run({});
    expect(allCards(artifact).length).toBeGreaterThan(0);
  });

  it("keeps sensitive senior checks out of primary cards", async () => {
    const { artifact } = await run({ intent: ["benefit_check"], persona: ["senior"] });
    for (const card of cards(artifact).filter((item) => item.ui_slot === "primary_card")) {
      expect(card.safe_copy_rule).not.toBe("confirm_not_assert");
    }
  });

  it("returns certificate issue entries", async () => {
    const { artifact } = await run({ intent: ["certificate_issue"] });
    expect(cards(artifact).length).toBeGreaterThan(0);
  });

  it("changes top card between tax and parent benefit personas", async () => {
    const tax = await run({ intent: ["tax_filing"], persona: ["freelancer"] });
    const benefit = await run({ intent: ["benefit_application"], persona: ["parent_guardian"] });
    expect(text(cards(tax.artifact)[0]?.entry_id)).not.toBe(text(cards(benefit.artifact)[0]?.entry_id));
  });

  it("returns version metadata in debug mode", async () => {
    const { rank, compose } = await run({ intent: ["data_search"], persona: ["data_user"], include_debug: true });
    expect(rank.catalog_version).toBeTruthy();
    expect(rank.weights_version).toBeTruthy();
    expect(compose.catalog_version).toBeTruthy();
    expect(compose.weights_version).toBeTruthy();
  });
});
