import type { JsonObject } from "./catalog.js";
import type { FeatureKey } from "./ranking.js";

export interface OrdinalScale extends JsonObject {
  readonly low: number;
  readonly medium: number;
  readonly high: number;
}

export interface ScoreOrdinals extends JsonObject {
  readonly actionability: OrdinalScale;
  readonly evidence_value: OrdinalScale;
}

export interface GateOrdinals extends JsonObject {
  readonly sensitivity_risk: OrdinalScale;
}

export interface WeightConfig extends JsonObject {
  readonly weights_version: string;
  readonly feature_order: FeatureKey[];
  readonly W_base: JsonObject;
  readonly delta_axis: JsonObject;
  readonly score_ordinals: ScoreOrdinals;
  readonly gate_ordinals: GateOrdinals;
  readonly clip_cap: number;
  readonly stage0_empty_context_top_n: number;
  readonly cache_lru_size: number;
  readonly insight_intent_set: string[];
  readonly insight_portal_set: string[];
  readonly handoff_allowlist: string[];
}
