import type { CatalogEntry } from "./catalog.js";

export const FEATURE_KEYS = [
  "IF",
  "PF",
  "LF",
  "SE",
  "UR",
  "AC",
  "EV",
  "api_availability",
  "freshness",
] as const;

export type FeatureKey = (typeof FEATURE_KEYS)[number];
export type WeightSnapshot = Record<FeatureKey, number>;
export type UiSlot = "primary_card" | "secondary_card";
export type SafeCopyRule = "standard" | "confirm_not_assert";

export interface RankRequest {
  readonly intent?: readonly string[];
  readonly persona?: readonly string[];
  readonly life_event?: readonly string[];
  readonly region?: readonly string[];
  readonly season?: string;
  readonly access_mode?: string;
  readonly top_k?: number;
  readonly weight_override?: Partial<Record<FeatureKey, number>> | readonly number[];
}

export interface RankedEntry {
  readonly entry: CatalogEntry;
  readonly score: number;
  readonly ui_slot: UiSlot;
  readonly safe_copy_rule: SafeCopyRule;
  readonly weight_snapshot: WeightSnapshot;
}

export type FeatureVector = Record<FeatureKey, number>;
