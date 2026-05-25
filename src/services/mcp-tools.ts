import type { CatalogEntry, JsonObject, JsonValue } from "../types/catalog.js";
import type { RankedEntry, RankRequest } from "../types/ranking.js";
import { CatalogStore } from "./catalog.js";
import { composeGenUiArtifact } from "./composer.js";
import { passesRankGate, rankEntries } from "./ranker.js";
import { resolveWeights } from "./weight-resolver.js";
import { createRankCacheKey, getCachedRank, hashResolvedWeights } from "./rank-cache.js";
import { logJson } from "../utils/logger.js";
import type { WeightConfig } from "../types/weights.types.js";
import type { CacheState } from "../types/rank-cache.types.js";

export interface SearchInput {
  readonly query?: string;
  readonly access_mode?: string;
  readonly canonical_intent?: string;
  readonly limit?: number;
  readonly include_debug?: boolean;
}

export interface DetailInput { readonly entry_id: string }
export type RankInput = RankRequest & { readonly include_debug?: boolean };
export type ComposeInput = RankInput & { readonly entry_ids?: readonly string[]; readonly frame_segment?: string };

interface RankRun {
  readonly ranked: RankedEntry[];
  readonly catalog_version: string;
  readonly weights_version: string;
  readonly processing_ms: number;
  readonly candidates_in: number;
  readonly candidates_out: number;
  readonly weight_source: string;
  readonly cache: CacheState;
}

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: JsonValue | undefined): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const frameRows = (payload: JsonObject): { readonly copy: JsonObject; readonly segments: JsonObject } => {
  const rows = Array.isArray(payload.rows) ? payload.rows.filter(isObject) : [];
  return { copy: rows[0] ?? {}, segments: rows[1] ?? {} };
};

const publicEntry = (entry: CatalogEntry, includeDebug = false): JsonObject => ({
  ...(includeDebug ? { entry_id: asString(entry.entry_id) ?? "" } : {}),
  title: asString(entry.card_title) ?? asString(entry.title) ?? "공공서비스",
  menu_path: asString(entry.menu_path) ?? "",
  access_mode: asString(entry.access_mode) ?? "portal_handoff",
  canonical_intent: asString(entry.canonical_intent) ?? "",
  cta_label: asString(entry.cta_label) ?? "공식 포털에서 확인",
});

const publicRanked = (ranked: ReturnType<typeof rankEntries>, includeDebug = false): JsonObject[] => ranked.map((item) => ({
  ...publicEntry(item.entry, includeDebug),
  score: Number(item.score.toFixed(6)),
  ui_slot: item.ui_slot,
  safe_copy_rule: item.safe_copy_rule,
}));


const taxonomyVersion = (store: CatalogStore): string => asString(store.getTaxonomy().taxonomy_version) ?? "unknown";

const runRank = (store: CatalogStore, config: WeightConfig, request: RankRequest, candidates: readonly CatalogEntry[], cacheable = true): RankRun => {
  const started = performance.now();
  const resolution = resolveWeights(config, request);
  const catalogVersion = store.getCatalogVersion();
  const key = createRankCacheKey({
    catalog_version: catalogVersion,
    weights_version: config.weights_version,
    taxonomy_version: taxonomyVersion(store),
    ...(request.persona ? { persona: request.persona } : {}),
    ...(request.intent ? { intent: request.intent } : {}),
    ...(request.life_event ? { life_event: request.life_event } : {}),
    ...(request.region ? { region: request.region } : {}),
    ...(request.season ? { season: request.season } : {}),
    ...(request.access_mode ? { access_mode: request.access_mode } : {}),
    ...(request.top_k ? { top_k: request.top_k } : {}),
    weight_override_hash: hashResolvedWeights({ weights: resolution.weights }),
  });
  const result = cacheable ? getCachedRank(key, config.cache_lru_size, () => rankEntries(candidates, config, request, new Date(), resolution)) :
    { value: rankEntries(candidates, config, request, new Date(), resolution), cache: "miss" as const };
  const ms = Math.round(performance.now() - started);
  const candidatesOut = candidates.filter(passesRankGate).length;
  logJson({ level: "info", event: "rank_done", message: "rank completed", details: { ms, candidates_in: candidates.length, candidates_out: candidatesOut, weight_source: resolution.weight_source, cache: result.cache } });
  return { ranked: result.value, catalog_version: catalogVersion, weights_version: config.weights_version, processing_ms: ms, candidates_in: candidates.length, candidates_out: candidatesOut, weight_source: resolution.weight_source, cache: result.cache };
};

const debugMeta = (run: RankRun, includeDebug = false): JsonObject => includeDebug ? {
  processing_ms: run.processing_ms,
  candidates_in: run.candidates_in,
  candidates_out: run.candidates_out,
  weight_source: run.weight_source,
  cache: run.cache,
} : {};

const rankRequest = (input: RankInput): RankRequest => ({
  ...(input.intent ? { intent: input.intent } : {}),
  ...(input.persona ? { persona: input.persona } : {}),
  ...(input.life_event ? { life_event: input.life_event } : {}),
  ...(input.region ? { region: input.region } : {}),
  ...(input.season ? { season: input.season } : {}),
  ...(input.access_mode ? { access_mode: input.access_mode } : {}),
  ...(input.top_k ? { top_k: input.top_k } : {}),
  ...(input.weight_override ? { weight_override: input.weight_override } : {}),
  ...(input.weight_rationale !== undefined ? { weight_rationale: input.weight_rationale } : {}),
});

export const searchPortalEntries = (store: CatalogStore, input: SearchInput = {}): JsonObject => {
  const entries = store.queryEntries({
    status: "published",
    limit: input.limit ?? 20,
    ...(input.query ? { query: input.query } : {}),
    ...(input.access_mode ? { access_mode: input.access_mode } : {}),
    ...(input.canonical_intent ? { canonical_intent: input.canonical_intent } : {}),
  });
  return { entries: entries.map((entry) => publicEntry(entry, input.include_debug)), count: entries.length };
};

export const rankPortalEntries = (store: CatalogStore, input: RankInput = {}): JsonObject => {
  const config = store.getWeights();
  const request = rankRequest(input);
  const candidates = store.queryStage0Admitted(request, config.stage0_empty_context_top_n);
  const run = runRank(store, config, request, candidates);
  return {
    catalog_version: run.catalog_version,
    weights_version: run.weights_version,
    entries: publicRanked(run.ranked, input.include_debug),
    count: run.ranked.length,
    ...debugMeta(run, input.include_debug),
  };
};

export const getEntryDetail = (store: CatalogStore, input: DetailInput): JsonObject => {
  const entry = store.getEntry(input.entry_id);
  if (!entry) return { error: "entry_not_found", entry_id: input.entry_id };
  return { entry };
};

const composeEntries = (store: CatalogStore, input: ComposeInput, request: RankRequest, fallbackLimit: number): CatalogEntry[] => {
  if (!input.entry_ids || input.entry_ids.length === 0) return store.queryStage0Admitted(request, fallbackLimit);
  return input.entry_ids.map((entryId) => store.getEntry(entryId)).filter((entry): entry is CatalogEntry => entry !== undefined);
};

export const composeGenuiArtifact = (store: CatalogStore, input: ComposeInput = {}): JsonObject => {
  const config = store.getWeights();
  const request = rankRequest(input);
  const top_k = input.entry_ids?.length ?? request.top_k;
  const entries = composeEntries(store, input, request, config.stage0_empty_context_top_n);
  const nextRequest = { ...request, ...(top_k ? { top_k } : {}) };
  const run = runRank(store, config, nextRequest, entries, !input.entry_ids || input.entry_ids.length === 0);
  const frame = frameRows(store.getFrameCopy());
  return {
    catalog_version: run.catalog_version,
    weights_version: run.weights_version,
    artifact: composeGenUiArtifact(run.ranked, request, frame.copy, frame.segments, store.getEvidence(), input.frame_segment) as unknown as JsonObject,
    ...debugMeta(run, input.include_debug),
  };
};
