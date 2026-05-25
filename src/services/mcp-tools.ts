import type { CatalogEntry, JsonObject, JsonValue } from "../types/catalog.js";
import type { RankRequest } from "../types/ranking.js";
import { CatalogStore } from "./catalog.js";
import { composeGenUiArtifact } from "./composer.js";
import { rankEntries } from "./ranker.js";

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

const rankRequest = (input: RankInput): RankRequest => ({
  ...(input.intent ? { intent: input.intent } : {}),
  ...(input.persona ? { persona: input.persona } : {}),
  ...(input.life_event ? { life_event: input.life_event } : {}),
  ...(input.region ? { region: input.region } : {}),
  ...(input.season ? { season: input.season } : {}),
  ...(input.access_mode ? { access_mode: input.access_mode } : {}),
  ...(input.top_k ? { top_k: input.top_k } : {}),
  ...(input.weight_override ? { weight_override: input.weight_override } : {}),
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
  const ranked = rankEntries(candidates, config, request);
  return { entries: publicRanked(ranked, input.include_debug), count: ranked.length };
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
  const ranked = rankEntries(entries, config, { ...request, ...(top_k ? { top_k } : {}) });
  const frame = frameRows(store.getFrameCopy());
  return { artifact: composeGenUiArtifact(ranked, request, frame.copy, frame.segments, store.getEvidence(), input.frame_segment) as unknown as JsonObject };
};
