import { describe, expect, it } from "vitest";
import { parseWeightConfig } from "../../src/services/weights-loader.js";
import { passesRankGate, rankEntries, scoreEntry } from "../../src/services/ranker.js";
import { resolveWeights } from "../../src/services/weight-resolver.js";
import type { EntryRecord, JsonObject } from "../../src/types/catalog.js";
import type { RankRequest } from "../../src/types/ranking.js";

const weightsPayload: JsonObject = {
  weights_version: "1.0.0",
  feature_order: ["IF", "PF", "LF", "SE", "UR", "AC", "EV", "api_availability", "freshness"],
  W_base: {
    IF: { weight: 0.2 },
    PF: { weight: 0.15 },
    LF: { weight: 0.14 },
    SE: { weight: 0.08 },
    UR: { weight: 0.1 },
    AC: { weight: 0.12 },
    EV: { weight: 0.08 },
    api_availability: { weight: 0.08 },
    freshness: { weight: 0.05 },
  },
  delta_axis: { persona: { freelancer: { delta: { PF: 0.1 } } } },
  score_ordinals: {
    actionability: { low: 0.2, medium: 0.5, high: 0.85 },
    evidence_value: { low: 0.2, medium: 0.5, high: 0.85 },
  },
  gate_ordinals: { sensitivity_risk: { low: 0.1, medium: 0.5, high: 0.9 } },
  clip_cap: 0.4,
  stage0_empty_context_top_n: 500,
  cache_lru_size: 1024,
  insight_intent_set: ["data_search", "dataset_download", "api_application", "policy_information"],
  insight_portal_set: ["data_go_kr"],
  handoff_allowlist: ["gov.kr", "hometax.go.kr", "data.go.kr"],
};

const config = parseWeightConfig(weightsPayload);

const entry: EntryRecord = {
  entry_id: "entry-a",
  status: "published",
  confidence_score: 0.9,
  merged_into: null,
  menu_path: "정부24 > 신고",
  access_mode: "api_cached",
  canonical_intent: "tax_payment",
  task_intent: ["tax_payment"],
  persona_tags: ["freelancer"],
  life_event_tags: ["tax_season"],
  region_tags: ["nationwide"],
  seasonality_hint: "may",
  intrinsic_ordinals: { actionability: "high", evidence_value: "medium", sensitivity_risk: "medium" },
  last_sync_at: "2026-05-20",
};

const request: RankRequest = {
  intent: ["tax_payment"],
  persona: ["freelancer"],
  life_event: ["tax_season"],
  season: "may",
  region: ["nationwide"],
  top_k: 5,
};

describe("ranker", () => {
  it("applies stage one gates", () => {
    expect(passesRankGate(entry)).toBe(true);
    expect(passesRankGate({ ...entry, confidence_score: 0.84 })).toBe(false);
    expect(passesRankGate({ ...entry, status: "draft" })).toBe(false);
    expect(passesRankGate({ ...entry, merged_into: "entry-a" })).toBe(false);
    expect(passesRankGate({ ...entry, menu_path: "" })).toBe(false);
  });

  it("scores Q from feature weights", () => {
    const override = resolveWeights(config, { weight_override: { IF: 1 }, weight_rationale: "테스트사유입니다" });
    const score = scoreEntry(entry, config, override.weights, request, new Date("2026-05-20T00:00:00Z"));
    expect(score).toBeGreaterThan(0.4);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("caps high sensitivity entries into secondary cards", () => {
    const highRisk = { ...entry, intrinsic_ordinals: { actionability: "high", evidence_value: "high", sensitivity_risk: "high" } };
    const [ranked] = rankEntries([highRisk], config, request);
    expect(ranked?.ui_slot).toBe("secondary_card");
    expect(ranked?.safe_copy_rule).toBe("confirm_not_assert");
  });

  it("assigns data.go.kr insight cards from configured insight intents", () => {
    const dataEntry = { ...entry, portal: "data_go_kr", task_intent: ["data_search"], canonical_intent: "data_search" };
    const [ranked] = rankEntries([dataEntry], config, { intent: ["data_search"] });
    expect(ranked?.ui_slot).toBe("insight_card");
  });

  it("does not assign insight cards without matching portal and intent", () => {
    const dataTax = { ...entry, portal: "data_go_kr", task_intent: ["tax_filing"], canonical_intent: "tax_filing" };
    const govData = { ...entry, portal: "gov24", task_intent: ["data_search"], canonical_intent: "data_search" };
    const [rankedDataTax] = rankEntries([dataTax], config, { intent: ["tax_filing"] });
    const [rankedGovData] = rankEntries([govData], config, { intent: ["data_search"] });
    expect(rankedDataTax?.ui_slot).not.toBe("insight_card");
    expect(rankedGovData?.ui_slot).not.toBe("insight_card");
  });

  it("keeps sensitive data.go.kr insight entries in insight slot", () => {
    const highRisk = { ...entry, portal: "data_go_kr", task_intent: ["data_search"], canonical_intent: "data_search", intrinsic_ordinals: { actionability: "high", evidence_value: "high", sensitivity_risk: "high" } };
    const [ranked] = rankEntries([highRisk], config, { intent: ["data_search"] });
    expect(ranked?.ui_slot).toBe("insight_card");
    expect(ranked?.safe_copy_rule).toBe("confirm_not_assert");
  });
});
