import type { WeightSnapshot } from "./ranking.js";

export type CacheState = "hit" | "miss";

export interface RankCacheKeyParts {
  readonly catalog_version: string;
  readonly weights_version: string;
  readonly taxonomy_version: string;
  readonly persona?: readonly string[];
  readonly intent?: readonly string[];
  readonly life_event?: readonly string[];
  readonly region?: readonly string[];
  readonly season?: string;
  readonly access_mode?: string;
  readonly top_k?: number;
  readonly weight_override_hash: string;
}

export interface RankCacheResult<T> {
  readonly value: T;
  readonly cache: CacheState;
}

export interface WeightHashInput {
  readonly weights: WeightSnapshot;
}
