import { describe, expect, it, beforeEach } from "vitest";
import { clearRankCache, createRankCacheKey, getCachedRank, hashResolvedWeights } from "../../src/services/rank-cache.js";
import type { WeightSnapshot } from "../../src/types/ranking.js";

const weights: WeightSnapshot = {
  IF: 0.4,
  PF: 0.15,
  LF: 0.14,
  SE: 0.08,
  UR: 0.1,
  AC: 0.05,
  EV: 0.03,
  api_availability: 0.03,
  freshness: 0.02,
};

const key = (region: readonly string[] = ["seoul", "busan"]): string => createRankCacheKey({
  catalog_version: "1.0.0",
  weights_version: "1.0.0",
  taxonomy_version: "v1.0",
  persona: ["student"],
  intent: ["employment_support"],
  life_event: ["job_search"],
  region,
  top_k: 5,
  weight_override_hash: hashResolvedWeights({ weights }),
});

describe("rank cache", () => {
  beforeEach(() => clearRankCache());

  it("hits identical requests", () => {
    expect(getCachedRank(key(), 4, () => ["first"]).cache).toBe("miss");
    const second = getCachedRank(key(), 4, () => ["second"]);
    expect(second.cache).toBe("hit");
    expect(second.value).toEqual(["first"]);
  });

  it("uses resolved weights, not rationale, in the key", () => {
    const first = key();
    const second = createRankCacheKey({
      catalog_version: "1.0.0",
      weights_version: "1.0.0",
      taxonomy_version: "v1.0",
      persona: ["student"],
      intent: ["employment_support"],
      life_event: ["job_search"],
      region: ["seoul", "busan"],
      top_k: 5,
      weight_override_hash: hashResolvedWeights({ weights }),
    });
    expect(first).toBe(second);
  });

  it("sorts region arrays before hashing", () => {
    expect(key(["seoul", "busan"])).toBe(key(["busan", "seoul"]));
  });

  it("evicts least recently used entries at capacity", () => {
    expect(getCachedRank("a", 2, () => "a").cache).toBe("miss");
    expect(getCachedRank("b", 2, () => "b").cache).toBe("miss");
    expect(getCachedRank("a", 2, () => "new-a").cache).toBe("hit");
    expect(getCachedRank("c", 2, () => "c").cache).toBe("miss");
    expect(getCachedRank("b", 2, () => "new-b").cache).toBe("miss");
  });
});
