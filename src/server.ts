import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { CatalogStore } from "./services/catalog.js";
import { composeGenuiArtifact, getEntryDetail, rankPortalEntries, searchPortalEntries } from "./services/mcp-tools.js";
import type { JsonObject } from "./types/catalog.js";
import type { ComposeInput, RankInput, SearchInput } from "./services/mcp-tools.js";
import type { FeatureKey } from "./types/ranking.js";

const stringArray = z.array(z.string()).optional();
const weightOverride = z.union([z.array(z.number()), z.record(z.string(), z.number())]).optional();

const rankSchema = {
  intent: stringArray,
  persona: stringArray,
  life_event: stringArray,
  region: stringArray,
  season: z.string().optional(),
  access_mode: z.string().optional(),
  top_k: z.number().int().min(1).max(50).optional(),
  weight_override: weightOverride,
  weight_rationale: z.string().optional(),
  include_debug: z.boolean().optional(),
};

const composeSchema = {
  ...rankSchema,
  entry_ids: z.array(z.string()).optional(),
  frame_segment: z.string().optional(),
};

const asWeightOverride = (value: z.infer<typeof weightOverride>) => {
  if (!value) return undefined;
  if (Array.isArray(value)) return value;
  return value as Partial<Record<FeatureKey, number>>;
};

type MutableRankInput = { -readonly [K in keyof RankInput]?: RankInput[K] };
type MutableSearchInput = { -readonly [K in keyof SearchInput]?: SearchInput[K] };
type MutableComposeInput = { -readonly [K in keyof ComposeInput]?: ComposeInput[K] };

const toRankInput = (input: z.infer<z.ZodObject<typeof rankSchema>>): RankInput => {
  const result: MutableRankInput = {};
  if (input.intent) result.intent = input.intent;
  if (input.persona) result.persona = input.persona;
  if (input.life_event) result.life_event = input.life_event;
  if (input.region) result.region = input.region;
  if (input.season) result.season = input.season;
  if (input.access_mode) result.access_mode = input.access_mode;
  if (input.top_k) result.top_k = input.top_k;
  if (input.include_debug) result.include_debug = input.include_debug;
  const override = asWeightOverride(input.weight_override);
  if (override !== undefined) result.weight_override = override;
  if (input.weight_rationale !== undefined) result.weight_rationale = input.weight_rationale;
  return result as RankInput;
};

interface SearchShape {
  readonly query?: string | undefined;
  readonly access_mode?: string | undefined;
  readonly canonical_intent?: string | undefined;
  readonly limit?: number | undefined;
  readonly include_debug?: boolean | undefined;
}

const toSearchInput = (input: SearchShape): SearchInput => {
  const result: MutableSearchInput = {};
  if (input.query) result.query = input.query;
  if (input.access_mode) result.access_mode = input.access_mode;
  if (input.canonical_intent) result.canonical_intent = input.canonical_intent;
  if (input.limit) result.limit = input.limit;
  if (input.include_debug) result.include_debug = input.include_debug;
  return result;
};


const toComposeInput = (input: z.infer<z.ZodObject<typeof composeSchema>>): ComposeInput => {
  const result: MutableComposeInput = { ...toRankInput(input) };
  if (input.entry_ids) result.entry_ids = input.entry_ids;
  if (input.frame_segment) result.frame_segment = input.frame_segment;
  return result;
};

const toolResult = (payload: JsonObject) => ({
  structuredContent: payload,
  content: [{ type: "text" as const, text: JSON.stringify(payload) }],
});

export const createServer = (store = new CatalogStore()): McpServer => {
  store.getEvidenceRegistry();
  store.getAdapterRegistry();
  const server = new McpServer({ name: "portal-genui-mcp", version: "0.1.0" });
  server.registerResource("taxonomy", "resource://taxonomy/v1.0", { mimeType: "application/json" }, () => ({
    contents: [{ uri: "resource://taxonomy/v1.0", mimeType: "application/json", text: JSON.stringify(store.getTaxonomy()) }],
  }));
  server.registerResource("evidence", "resource://evidence/v1.0", { mimeType: "application/json" }, () => ({
    contents: [{ uri: "resource://evidence/v1.0", mimeType: "application/json", text: JSON.stringify(store.getEvidenceRegistry()) }],
  }));
  server.registerResource("adapters", "resource://adapters/v1", { mimeType: "application/json" }, () => ({
    contents: [{ uri: "resource://adapters/v1", mimeType: "application/json", text: JSON.stringify(store.getAdapterRegistry()) }],
  }));
  server.registerTool("search_portal_entries", {
    description: "Search published public portal entries without running ranking.",
    inputSchema: {
      query: z.string().optional(),
      access_mode: z.string().optional(),
      canonical_intent: z.string().optional(),
      limit: z.number().int().min(1).max(100).optional(),
      include_debug: z.boolean().optional(),
    },
  }, (input) => toolResult(searchPortalEntries(store, toSearchInput(input))));
  server.registerTool("rank_portal_entries", { description: "Rank entries from structured taxonomy context.", inputSchema: rankSchema }, (input) =>
    toolResult(rankPortalEntries(store, toRankInput(input))));
  server.registerTool("get_entry_detail", {
    description: "Return one explicit entry record by entry_id.",
    inputSchema: { entry_id: z.string() },
  }, (input) => toolResult(getEntryDetail(store, input)));
  server.registerTool("compose_genui_artifact", { description: "Assemble reviewed GenUI copy, cards, handoff, and evidence rail.", inputSchema: composeSchema }, (input) =>
    toolResult(composeGenuiArtifact(store, toComposeInput(input))));
  return server;
};
