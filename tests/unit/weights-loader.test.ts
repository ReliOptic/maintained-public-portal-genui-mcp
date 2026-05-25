import { describe, expect, it } from "vitest";
import { parseWeightConfig } from "../../src/services/weights-loader.js";
import type { JsonObject, JsonValue } from "../../src/types/catalog.js";

const validPayload = (): JsonObject => ({
  weights_version: "1.0.0",
  feature_order: ["IF", "PF", "LF", "SE", "UR", "AC", "EV", "api_availability", "freshness"],
  W_base: {},
  delta_axis: {},
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
});

describe("parseWeightConfig", () => {
  it("accepts the v0.1 weight config shape", () => {
    const parsed = parseWeightConfig(validPayload());
    expect(parsed.score_ordinals.actionability.high).toBe(0.85);
    expect(parsed.gate_ordinals.sensitivity_risk.high).toBe(0.9);
  });

  it("throws when score ordinals are missing", () => {
    const payload: Record<string, JsonValue> = { ...validPayload() };
    delete payload.score_ordinals;
    expect(() => parseWeightConfig(payload)).toThrow();
  });
});
