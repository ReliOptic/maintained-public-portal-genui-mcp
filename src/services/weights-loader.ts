import { z } from "zod";
import type { JsonObject } from "../types/catalog.js";
import { FEATURE_KEYS } from "../types/ranking.js";
import type { WeightConfig } from "../types/weights.types.js";

const ordinalSchema = z.object({
  low: z.number().finite(),
  medium: z.number().finite(),
  high: z.number().finite(),
});

const scoreOrdinalsSchema = z.object({
  actionability: ordinalSchema,
  evidence_value: ordinalSchema,
});

const gateOrdinalsSchema = z.object({
  sensitivity_risk: ordinalSchema,
});

const featureOrderSchema = z.array(z.enum(FEATURE_KEYS)).refine(
  (keys) => FEATURE_KEYS.every((key) => keys.includes(key)),
  "feature_order must include every ranking feature",
);

const weightConfigSchema = z.object({
  weights_version: z.string().min(1),
  feature_order: featureOrderSchema,
  W_base: z.object({}).passthrough(),
  delta_axis: z.object({}).passthrough(),
  score_ordinals: scoreOrdinalsSchema,
  gate_ordinals: gateOrdinalsSchema,
  clip_cap: z.number().positive(),
  stage0_empty_context_top_n: z.number().int().positive(),
  cache_lru_size: z.number().int().positive(),
  insight_intent_set: z.array(z.string().min(1)),
  insight_portal_set: z.array(z.string().min(1)),
  handoff_allowlist: z.array(z.string().min(1)),
}).passthrough();

export const parseWeightConfig = (payload: JsonObject): WeightConfig =>
  weightConfigSchema.parse(payload) as WeightConfig;
