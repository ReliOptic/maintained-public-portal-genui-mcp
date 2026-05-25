import { describe, expect, it } from "vitest";
import { parseWeightConfig } from "../../src/services/weights-loader.js";
import { resolveWeights } from "../../src/services/weight-resolver.js";
import type { JsonObject } from "../../src/types/catalog.js";

const payload: JsonObject = {
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
};

const config = parseWeightConfig(payload);

describe("resolveWeights", () => {
  it("caps an IF monopoly at clip_cap", () => {
    const resolved = resolveWeights(config, { weight_override: [0.99, 0, 0, 0, 0, 0, 0, 0, 0], weight_rationale: "테스트사유입니다" });
    expect(resolved.weight_source).toBe("host_proposed");
    expect(resolved.weights.IF).toBeCloseTo(0.4);
  });

  it("accepts the Korean handoff rationale example", () => {
    const resolved = resolveWeights(config, { weight_override: [0.99, 0, 0, 0, 0, 0, 0, 0, 0], weight_rationale: "테스트 사유" });
    expect(resolved.weight_source).toBe("host_proposed");
    expect(resolved.weights.IF).toBeCloseTo(0.4);
  });

  it("routes missing rationale to compositional fallback", () => {
    const resolved = resolveWeights(config, { weight_override: { IF: 0.99 }, weight_rationale: "" });
    expect(resolved.weight_source).toBe("compositional_no_rationale");
    expect(resolved.weights.IF).toBeCloseTo(0.2);
  });

  it("routes all-zero host proposal to compositional fallback", () => {
    const resolved = resolveWeights(config, { weight_override: { IF: 0 }, weight_rationale: "테스트사유입니다" });
    expect(resolved.weight_source).toBe("compositional_total_zero");
    expect(resolved.weights.IF).toBeCloseTo(0.2);
  });

  it("keeps resolved W identical across rationale variants", () => {
    const left = resolveWeights(config, { weight_override: { IF: 0.4, PF: 0.2 }, weight_rationale: "첫번째사유입니다" });
    const right = resolveWeights(config, { weight_override: { IF: 0.4, PF: 0.2 }, weight_rationale: "두번째사유입니다" });
    expect(left.weights).toEqual(right.weights);
  });
});
