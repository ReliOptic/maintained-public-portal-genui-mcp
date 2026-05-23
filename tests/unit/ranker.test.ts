import { describe, expect, it } from "vitest";
import { passesRankGate, rankEntries, resolveWeights, scoreEntry } from "../../src/services/ranker.js";
import type { EntryRecord, JsonObject } from "../../src/types/catalog.js";
import type { RankRequest } from "../../src/types/ranking.js";

const weights: JsonObject = {
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
};

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
    const override = resolveWeights(weights, { weight_override: { IF: 1 } });
    expect(scoreEntry(entry, override, request, new Date("2026-05-20T00:00:00Z"))).toBe(1);
  });

  it("caps high sensitivity entries into secondary cards", () => {
    const [ranked] = rankEntries([{ ...entry, intrinsic_ordinals: { actionability: "high", evidence_value: "high", sensitivity_risk: "high" } }], weights, request);
    expect(ranked?.ui_slot).toBe("secondary_card");
    expect(ranked?.safe_copy_rule).toBe("confirm_not_assert");
  });

  it("clips and normalizes override weights", () => {
    const resolved = resolveWeights(weights, { weight_override: { IF: -1, PF: 3, LF: 1 } });
    const sum = Object.values(resolved).reduce((total, value) => total + value, 0);
    expect(resolved.IF).toBe(0);
    expect(resolved.PF).toBeCloseTo(0.75);
    expect(resolved.LF).toBeCloseTo(0.25);
    expect(sum).toBeCloseTo(1);
  });
});
