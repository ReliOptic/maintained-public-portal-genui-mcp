import { describe, expect, it } from "vitest";
import { composeGenUiArtifact, resolveFrameSegment } from "../../src/services/composer.js";
import type { EntryRecord, JsonObject } from "../../src/types/catalog.js";
import type { RankedEntry } from "../../src/types/ranking.js";

const segments: JsonObject = {
  segments: [
    { segment: "relocation", priority: 1, match: { life_event_any: ["relocation", "address_change"] } },
    { segment: "family_event", priority: 2, match: { life_event_any: ["marriage", "birth", "family_relation"] } },
    { segment: "startup_business", priority: 3, match: { life_event_any: ["startup"], persona_any: ["sole_proprietor"] } },
    { segment: "tax_season", priority: 4, match: { intent_any: ["tax_filing", "tax_inquiry"], season_any: ["jan", "may"] } },
    { segment: "benefit_check", priority: 5, match: { intent_any: ["benefit_check", "certificate_issue"] } },
    { segment: "general", priority: 6, match: { fallback: true } },
  ],
};

const frameCopy: JsonObject = {
  tax_season: { hero: { title: "세무" }, handoff_notice: "홈택스 확인", evidence_rail: { label: "세무 근거" } },
  general: { hero: { title: "일반" }, handoff_notice: "공식 확인", evidence_rail: { label: "추천 근거" } },
};

const entry: EntryRecord = {
  entry_id: "entry-a",
  title: "국세 납부",
  card_title: "국세 납부 확인",
  card_body: "납부할 세금을 확인하세요.",
  cta_label: "홈택스에서 확인",
  access_mode: "portal_handoff",
  menu_path: "홈택스 > 납부",
  evidence_refs: ["ev-tax"],
  handoff: { portal: "hometax", tier: "tier2", url: "https://api.odcloud.kr/api/hidden", menu_path: "홈택스 > 납부" },
};

const ranked: RankedEntry = { entry, score: 0.5, ui_slot: "primary_card", safe_copy_rule: "standard", weight_snapshot: {
  IF: 1,
  PF: 0,
  LF: 0,
  SE: 0,
  UR: 0,
  AC: 0,
  EV: 0,
  api_availability: 0,
  freshness: 0,
} };

describe("composer", () => {
  it("resolves all frame segments with AND across keys and OR inside arrays", () => {
    expect(resolveFrameSegment({ life_event: ["relocation"] }, segments)).toBe("relocation");
    expect(resolveFrameSegment({ life_event: ["birth"] }, segments)).toBe("family_event");
    expect(resolveFrameSegment({ life_event: ["startup"] }, segments)).toBe("general");
    expect(resolveFrameSegment({ life_event: ["startup"], persona: ["sole_proprietor"] }, segments)).toBe("startup_business");
    expect(resolveFrameSegment({ intent: ["tax_inquiry"], season: "may" }, segments)).toBe("tax_season");
    expect(resolveFrameSegment({ intent: ["certificate_issue"] }, segments)).toBe("benefit_check");
    expect(resolveFrameSegment({}, segments)).toBe("general");
  });

  it("assembles reviewed copy and evidence without internal API URLs", () => {
    const artifact = composeGenUiArtifact([ranked], { intent: ["tax_inquiry"], season: "may" }, frameCopy, segments, [
      { evidence_id: "ev-tax", title: "세무 근거", role: "registry" },
    ]);
    expect(artifact.segment).toBe("tax_season");
    expect(artifact.cards[0]?.title).toBe("국세 납부 확인");
    expect(artifact.cards[0]?.handoff.url).toBeUndefined();
    expect(artifact.evidence_rail.items[0]?.evidence_id).toBe("ev-tax");
  });
});
