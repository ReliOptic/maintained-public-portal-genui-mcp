import { FEATURE_KEYS, type FeatureKey, type RankRequest, type WeightSnapshot } from "../types/ranking.js";
import type { WeightResolution, WeightSource } from "../types/weight-resolution.types.js";
import type { WeightConfig } from "../types/weights.types.js";
import type { JsonObject, JsonValue } from "../types/catalog.js";

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asNumber = (value: JsonValue | undefined): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const emptyWeights = (): WeightSnapshot => Object.fromEntries(FEATURE_KEYS.map((key) => [key, 0])) as WeightSnapshot;

const rationaleLength = (value: string | undefined): number =>
  (value ?? "").replace(/\s/gu, "").normalize("NFD").length;

const rationaleValid = (value: string | undefined): boolean => rationaleLength(value) >= 8;

const isOverrideVector = (override: RankRequest["weight_override"]): override is readonly number[] => Array.isArray(override);

const rawOverride = (override: RankRequest["weight_override"]): Partial<Record<FeatureKey, number>> => {
  if (!override) return {};
  if (!isOverrideVector(override)) return override;
  return Object.fromEntries(FEATURE_KEYS.map((key, index) => [key, override[index] ?? 0]));
};

const baseRawWeights = (config: WeightConfig): Partial<Record<FeatureKey, number>> => {
  const raw = isObject(config.W_base) ? config.W_base : {};
  const values: Partial<Record<FeatureKey, number>> = {};
  for (const key of FEATURE_KEYS) values[key] = isObject(raw[key]) ? asNumber(raw[key].weight) ?? 0 : 0;
  return values;
};

const addDelta = (weights: Partial<Record<FeatureKey, number>>, delta: JsonObject | undefined): void => {
  if (!delta) return;
  for (const key of FEATURE_KEYS) weights[key] = (weights[key] ?? 0) + (asNumber(delta[key]) ?? 0);
};

const requestAxisValues = (request: RankRequest): Readonly<Record<string, readonly string[]>> => ({
  persona: request.persona ?? [],
  intent: request.intent ?? [],
  life_event: request.life_event ?? [],
  season: request.season ? [request.season] : [],
  region: request.region ?? [],
  access_mode: request.access_mode ? [request.access_mode] : [],
});

const compositionalRaw = (config: WeightConfig, request: RankRequest): Partial<Record<FeatureKey, number>> => {
  const weights = baseRawWeights(config);
  const deltaAxis = isObject(config.delta_axis) ? config.delta_axis : {};
  for (const [axis, values] of Object.entries(requestAxisValues(request))) {
    const bucket = isObject(deltaAxis[axis]) ? deltaAxis[axis] : {};
    for (const value of values) addDelta(weights, isObject(bucket[value]) && isObject(bucket[value].delta) ? bucket[value].delta : undefined);
  }
  return weights;
};

const initialClip = (weights: Partial<Record<FeatureKey, number>>, cap: number): WeightSnapshot => {
  const next = emptyWeights();
  for (const key of FEATURE_KEYS) next[key] = Math.min(Math.max(0, weights[key] ?? 0), cap);
  return next;
};

const fillResidual = (weights: WeightSnapshot, fill: WeightSnapshot, residual: number, cap: number): void => {
  let remaining = residual;
  for (let pass = 0; pass < FEATURE_KEYS.length && remaining > 0.000001; pass += 1) {
    const open = FEATURE_KEYS.filter((key) => weights[key] < cap);
    const fillTotal = open.reduce((sum, key) => sum + Math.max(0, fill[key]), 0);
    if (open.length === 0 || fillTotal <= 0) return;
    for (const key of open) {
      const room = cap - weights[key];
      const share = remaining * (Math.max(0, fill[key]) / fillTotal);
      const added = Math.min(room, share);
      weights[key] += added;
      remaining -= added;
    }
  }
};

const normalizeWithCap = (weights: Partial<Record<FeatureKey, number>>, cap: number, fill: WeightSnapshot): WeightSnapshot | undefined => {
  const next = initialClip(weights, cap);
  const total = FEATURE_KEYS.reduce((sum, key) => sum + next[key], 0);
  if (total <= 0) return undefined;
  if (total >= 1) {
    for (const key of FEATURE_KEYS) next[key] /= total;
    return next;
  }
  fillResidual(next, fill, 1 - total, cap);
  return next;
};

const compositional = (config: WeightConfig, request: RankRequest, source: WeightSource): WeightResolution => {
  const fill = initialClip(baseRawWeights(config), config.clip_cap);
  const weights = normalizeWithCap(compositionalRaw(config, request), config.clip_cap, fill);
  if (!weights) throw new Error("compositional weights resolved to zero");
  return { weights, weight_source: source };
};

export const resolveWeights = (config: WeightConfig, request: RankRequest = {}): WeightResolution => {
  if (!request.weight_override) return compositional(config, request, "compositional_no_override");
  if (!rationaleValid(request.weight_rationale)) return compositional(config, request, "compositional_no_rationale");
  const fill = compositional(config, request, "host_proposed").weights;
  const weights = normalizeWithCap(rawOverride(request.weight_override), config.clip_cap, fill);
  if (!weights) return compositional(config, request, "compositional_total_zero");
  return { weights, weight_source: "host_proposed" };
};
