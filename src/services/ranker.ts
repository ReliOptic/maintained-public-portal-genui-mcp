import type { CatalogEntry, JsonObject, JsonValue } from "../types/catalog.js";
import { FEATURE_KEYS, type FeatureKey, type FeatureVector, type RankedEntry, type RankRequest, type WeightSnapshot } from "../types/ranking.js";
import type { GateOrdinals, OrdinalScale, ScoreOrdinals, WeightConfig } from "../types/weights.types.js";

const SEASON_MONTHS: Readonly<Record<string, number>> = {
  jan: 1,
  january: 1,
  mar: 3,
  march: 3,
  may: 5,
  scholarship_mar: 3,
  vat_jan: 1,
  comprehensive_income_tax_may: 5,
  year_end_settlement: 1,
};

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: JsonValue | undefined): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asNumber = (value: JsonValue | undefined): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const asStringArray = (value: JsonValue | undefined): string[] => {
  if (typeof value === "string" && value.length > 0) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
};

const emptyWeights = (): WeightSnapshot => Object.fromEntries(FEATURE_KEYS.map((key) => [key, 0])) as WeightSnapshot;

const isPublished = (entry: CatalogEntry): boolean => asString(entry.status) === "published";

export const passesRankGate = (entry: CatalogEntry): boolean => {
  const score = asNumber(entry.confidence_score) ?? 0;
  return isPublished(entry) && score >= 0.85 && entry.merged_into === null && Boolean(asString(entry.menu_path));
};

const overlapScore = (entryValues: readonly string[], requestValues: readonly string[] = []): number => {
  if (requestValues.length === 0) return 0;
  const source = new Set(entryValues);
  const overlap = requestValues.filter((value) => source.has(value)).length;
  return overlap / Math.max(requestValues.length, 1);
};

const monthForSeason = (season: string | undefined): number | undefined => {
  if (!season) return undefined;
  if (SEASON_MONTHS[season]) return SEASON_MONTHS[season];
  const match = season.match(/(?:^|_)(\d{1,2})(?:_|$)/u);
  const month = match ? Number(match[1]) : undefined;
  return month && month >= 1 && month <= 12 ? month : undefined;
};

const seasonScore = (hint: string | undefined, target: string | undefined, now: Date): number => {
  const hintMonth = monthForSeason(hint);
  const targetMonth = monthForSeason(target) ?? now.getUTCMonth() + 1;
  if (!hintMonth) return 0;
  if (hintMonth === targetMonth) return 1;
  const diff = Math.abs(hintMonth - targetMonth);
  return diff === 1 || diff === 11 ? 0.3 : 0;
};

const urgencyScore = (hint: string | undefined, now: Date): number => {
  const month = monthForSeason(hint);
  if (!month) return 0;
  const year = now.getUTCFullYear() + (month < now.getUTCMonth() + 1 ? 1 : 0);
  const days = Math.ceil((Date.UTC(year, month - 1, 28) - now.getTime()) / 86_400_000);
  if (days < 0 || days > 90) return 0.1;
  if (days <= 7) return 1;
  if (days <= 30) return 0.75;
  return 0.4;
};

const ordinalValue = (scale: OrdinalScale, value: string | undefined): number => {
  if (value === "low" || value === "medium" || value === "high") return scale[value];
  return 0;
};

type ScoreOrdinalKey = "actionability" | "evidence_value";

const ordinalScale = (ordinals: ScoreOrdinals, key: ScoreOrdinalKey): OrdinalScale =>
  key === "actionability" ? ordinals.actionability : ordinals.evidence_value;

const ordinalScore = (entry: CatalogEntry, key: ScoreOrdinalKey, ordinals: ScoreOrdinals): number => {
  const values = isObject(entry.intrinsic_ordinals) ? entry.intrinsic_ordinals : {};
  return ordinalValue(ordinalScale(ordinals, key), asString(values[key]));
};

const sensitivityScore = (entry: CatalogEntry, ordinals: GateOrdinals): number => {
  const values = isObject(entry.intrinsic_ordinals) ? entry.intrinsic_ordinals : {};
  return ordinalValue(ordinals.sensitivity_risk, asString(values.sensitivity_risk));
};

const freshnessScore = (entry: CatalogEntry, now: Date): number => {
  const stamp = asString(entry.last_sync_at) ?? asString(entry.last_verified_at);
  if (!stamp) return 0.1;
  const days = Math.max(0, Math.floor((now.getTime() - Date.parse(stamp)) / 86_400_000));
  if (days <= 7) return 1;
  if (days <= 30) return 1 - ((days - 7) / 23) * 0.5;
  if (days >= 180) return 0.1;
  return 0.5 - ((days - 30) / 150) * 0.4;
};

const normalizeWeights = (weights: Partial<Record<FeatureKey, number>>): WeightSnapshot => {
  const next = emptyWeights();
  for (const key of FEATURE_KEYS) next[key] = Math.max(0, weights[key] ?? 0);
  const total = FEATURE_KEYS.reduce((sum, key) => sum + next[key], 0);
  if (total <= 0) return Object.fromEntries(FEATURE_KEYS.map((key) => [key, 1 / FEATURE_KEYS.length])) as WeightSnapshot;
  for (const key of FEATURE_KEYS) next[key] /= total;
  return next;
};

const isOverrideVector = (value: RankRequest["weight_override"]): value is readonly number[] => Array.isArray(value);

const weightsFromOverride = (override: RankRequest["weight_override"]): WeightSnapshot | undefined => {
  if (!override) return undefined;
  if (isOverrideVector(override)) return normalizeWeights(Object.fromEntries(FEATURE_KEYS.map((key, index) => [key, override[index] ?? 0])));
  return normalizeWeights(override);
};

const baseWeights = (config: WeightConfig): WeightSnapshot => {
  const raw = isObject(config.W_base) ? config.W_base : {};
  const values: Partial<Record<FeatureKey, number>> = {};
  for (const key of FEATURE_KEYS) values[key] = isObject(raw[key]) ? asNumber(raw[key].weight) ?? 0 : 0;
  return normalizeWeights(values);
};

const addDelta = (weights: WeightSnapshot, delta: JsonObject | undefined): void => {
  if (!delta) return;
  for (const key of FEATURE_KEYS) weights[key] += asNumber(delta[key]) ?? 0;
};

const requestAxisValues = (request: RankRequest): Readonly<Record<string, readonly string[]>> => ({
  persona: request.persona ?? [],
  intent: request.intent ?? [],
  life_event: request.life_event ?? [],
  season: request.season ? [request.season] : [],
  region: request.region ?? [],
  access_mode: request.access_mode ? [request.access_mode] : [],
});

export const resolveWeights = (config: WeightConfig, request: RankRequest = {}): WeightSnapshot => {
  const override = weightsFromOverride(request.weight_override);
  if (override) return override;
  const weights = baseWeights(config);
  const deltaAxis = isObject(config.delta_axis) ? config.delta_axis : {};
  for (const [axis, values] of Object.entries(requestAxisValues(request))) {
    const bucket = isObject(deltaAxis[axis]) ? deltaAxis[axis] : {};
    for (const value of values) addDelta(weights, isObject(bucket[value]) && isObject(bucket[value].delta) ? bucket[value].delta : undefined);
  }
  return normalizeWeights(weights);
};

const featureVector = (entry: CatalogEntry, config: WeightConfig, request: RankRequest, now: Date): FeatureVector => ({
  IF: overlapScore([...asStringArray(entry.task_intent), asString(entry.canonical_intent) ?? ""], request.intent),
  PF: overlapScore(asStringArray(entry.persona_tags), request.persona),
  LF: overlapScore(asStringArray(entry.life_event_tags), request.life_event),
  SE: seasonScore(asString(entry.seasonality_hint), request.season, now),
  UR: urgencyScore(asString(entry.seasonality_hint), now),
  AC: ordinalScore(entry, "actionability", config.score_ordinals),
  EV: ordinalScore(entry, "evidence_value", config.score_ordinals),
  api_availability: asString(entry.access_mode) === "api_cached" ? 1 : 0,
  freshness: freshnessScore(entry, now),
});

export const scoreEntry = (entry: CatalogEntry, config: WeightConfig, weights: WeightSnapshot, request: RankRequest = {}, now = new Date()): number => {
  const vector = featureVector(entry, config, request, now);
  return FEATURE_KEYS.reduce((sum, key) => sum + weights[key] * vector[key], 0);
};

const rankedEntry = (entry: CatalogEntry, score: number, weights: WeightSnapshot, config: WeightConfig): RankedEntry => {
  const sensitive = sensitivityScore(entry, config.gate_ordinals) >= 0.85;
  return { entry, score, ui_slot: sensitive ? "secondary_card" : "primary_card", safe_copy_rule: sensitive ? "confirm_not_assert" : "standard", weight_snapshot: weights };
};

const assignSlots = (ranked: readonly RankedEntry[]): RankedEntry[] => {
  let primaryAssigned = false;
  return ranked.map((item) => {
    if (item.ui_slot === "secondary_card" || primaryAssigned) return { ...item, ui_slot: "secondary_card" };
    primaryAssigned = true;
    return item;
  });
};

export const rankEntries = (entries: readonly CatalogEntry[], config: WeightConfig, request: RankRequest = {}, now = new Date()): RankedEntry[] => {
  const weights = resolveWeights(config, request);
  const limit = Math.max(1, Math.min(request.top_k ?? 10, 50));
  const ranked = entries.filter(passesRankGate).map((entry) => rankedEntry(entry, scoreEntry(entry, config, weights, request, now), weights, config));
  ranked.sort((left, right) => right.score - left.score || String(left.entry.entry_id).localeCompare(String(right.entry.entry_id)));
  return assignSlots(ranked.slice(0, limit));
};
