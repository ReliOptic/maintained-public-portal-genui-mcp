import { createHash } from "node:crypto";
import { FEATURE_KEYS } from "../types/ranking.js";
import type { RankCacheKeyParts, RankCacheResult, WeightHashInput } from "../types/rank-cache.types.js";

const cache = new Map<string, unknown>();

const sorted = (values: readonly string[] | undefined): string[] => [...(values ?? [])].sort();

const digest = (value: unknown): string => createHash("sha256").update(JSON.stringify(value)).digest("hex");

export const hashResolvedWeights = ({ weights }: WeightHashInput): string =>
  digest(FEATURE_KEYS.map((key) => [key, Number(weights[key].toFixed(12))]));

export const createRankCacheKey = (parts: RankCacheKeyParts): string => digest({
  catalog_version: parts.catalog_version,
  weights_version: parts.weights_version,
  taxonomy_version: parts.taxonomy_version,
  persona: sorted(parts.persona),
  intent: sorted(parts.intent),
  life_event: sorted(parts.life_event),
  region: sorted(parts.region),
  season: parts.season ?? "",
  access_mode: parts.access_mode ?? "",
  top_k: parts.top_k ?? 10,
  weight_override_hash: parts.weight_override_hash,
});

export const clearRankCache = (): void => {
  cache.clear();
};

export const getCachedRank = <T>(key: string, capacity: number, computeFn: () => T): RankCacheResult<T> => {
  if (cache.has(key)) {
    const value = cache.get(key) as T;
    cache.delete(key);
    cache.set(key, value);
    return { value, cache: "hit" };
  }
  const value = computeFn();
  cache.set(key, value);
  while (cache.size > capacity) {
    const first = cache.keys().next().value;
    if (typeof first !== "string") break;
    cache.delete(first);
  }
  return { value, cache: "miss" };
};
