import Database from "better-sqlite3";
import { getRuntimeConfig } from "../config/runtime.js";
import type { CatalogEntry, CatalogEvidence, CatalogFreshness, EntryFilter, JsonObject, JsonValue, Stage0Filter } from "../types/catalog.js";
import type { WeightConfig } from "../types/weights.types.js";
import { parseWeightConfig } from "./weights-loader.js";
import { logJson } from "../utils/logger.js";

interface DbRow {
  readonly payload_json: string;
}

interface FreshnessRow {
  readonly latest_date: string | null;
}

export class CatalogError extends Error {
  public constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "CatalogError";
  }
}

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const parsePayload = <T extends JsonObject>(row: DbRow | undefined, label: string): T => {
  if (!row) throw new CatalogError(`${label} not found`);
  const value: unknown = JSON.parse(row.payload_json);
  if (!isObject(value)) throw new CatalogError(`${label} payload is not an object`);
  return value as T;
};

const limitValue = (limit: number | undefined): number => {
  if (limit === undefined || !Number.isInteger(limit) || limit < 1) return 20;
  return Math.min(limit, 100);
};


const cleanValues = (values: readonly string[] | undefined): string[] =>
  [...new Set((values ?? []).filter((value) => value.length > 0))];

const addValueParams = (params: Record<string, string | number>, prefix: string, values: readonly string[]): string => {
  const names = values.map((value, index) => {
    const name = `${prefix}_${index}`;
    params[name] = value;
    return `@${name}`;
  });
  return names.join(", ");
};

const termClause = (axis: string, prefix: string, values: readonly string[], params: Record<string, string | number>): string | undefined => {
  if (values.length === 0) return undefined;
  return `entry_id IN (SELECT entry_id FROM entry_terms WHERE axis = '${axis}' AND value IN (${addValueParams(params, prefix, values)}))`;
};

const MILLIS_PER_DAY = 86_400_000;

const dateAgeDays = (stamp: string | null, now: Date): number | null => {
  if (!stamp) return null;
  const parsed = Date.parse(stamp);
  if (!Number.isFinite(parsed)) return null;
  return Math.floor((now.getTime() - parsed) / MILLIS_PER_DAY);
};

export class CatalogStore {
  private db: Database.Database | undefined;

  public constructor(private readonly dbPath = getRuntimeConfig().catalogPath) {}

  public get database(): Database.Database {
    if (!this.db) this.db = this.open();
    return this.db;
  }

  public queryEntries(filter: EntryFilter = {}): CatalogEntry[] {
    const clauses: string[] = [];
    const params: Record<string, string | number> = { limit: limitValue(filter.limit) };
    if (filter.status) clauses.push("status = @status");
    if (filter.status) params.status = filter.status;
    if (filter.access_mode) clauses.push("access_mode = @access_mode");
    if (filter.access_mode) params.access_mode = filter.access_mode;
    if (filter.canonical_intent) clauses.push("canonical_intent = @canonical_intent");
    if (filter.canonical_intent) params.canonical_intent = filter.canonical_intent;
    if (filter.query) clauses.push("(title LIKE @query OR menu_path LIKE @query)");
    if (filter.query) params.query = `%${filter.query}%`;
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const sql = `SELECT payload_json FROM entries ${where} ORDER BY confidence_score DESC, entry_id LIMIT @limit`;
    const rows = this.database.prepare(sql).all(params) as DbRow[];
    return rows.map((row) => parsePayload<CatalogEntry>(row, "entry"));
  }


  public queryStage0Admitted(filter: Stage0Filter = {}, emptyContextLimit = 500): CatalogEntry[] {
    const params: Record<string, string | number> = { limit: Math.max(1, Math.floor(emptyContextLimit)) };
    const persona = cleanValues(filter.persona);
    const intent = cleanValues(filter.intent);
    const lifeEvent = cleanValues(filter.life_event);
    const region = cleanValues(filter.region);
    const overlap = [
      termClause("persona", "persona", persona, params),
      termClause("intent", "intent", intent, params),
      termClause("life_event", "life_event", lifeEvent, params),
    ].filter((clause): clause is string => clause !== undefined);
    const clauses = overlap.length > 0 ? [`(${overlap.join(" OR ")})`] : [];
    const regionClause = termClause("region", "region", ["nationwide", ...region], params);
    if (region.length > 0 && regionClause) clauses.push(regionClause);
    const where = clauses.length > 0 ? `WHERE ${clauses.join(" AND ")}` : "";
    const limit = overlap.length === 0 ? "LIMIT @limit" : "";
    const sql = `SELECT payload_json FROM entries ${where} ORDER BY confidence_score DESC, entry_id ${limit}`;
    const rows = this.database.prepare(sql).all(params) as DbRow[];
    return rows.map((row) => parsePayload<CatalogEntry>(row, "entry"));
  }

  public getEntry(entryId: string): CatalogEntry | undefined {
    const row = this.database.prepare("SELECT payload_json FROM entries WHERE entry_id = ?").get(entryId) as DbRow | undefined;
    return row ? parsePayload<CatalogEntry>(row, "entry") : undefined;
  }

  public getEvidence(evidenceId?: string): CatalogEvidence[] {
    if (!evidenceId) return this.database.prepare("SELECT payload_json FROM evidence ORDER BY evidence_id")
      .all().map((row) => parsePayload<CatalogEvidence>(row as DbRow, "evidence"));
    const row = this.database.prepare("SELECT payload_json FROM evidence WHERE evidence_id = ?").get(evidenceId) as DbRow | undefined;
    return row ? [parsePayload<CatalogEvidence>(row, "evidence")] : [];
  }

  public getTaxonomy(): JsonObject {
    return this.singleton("taxonomy", "taxonomy_id", "v1.0");
  }

  public getWeights(): WeightConfig {
    return parseWeightConfig(this.singleton("weights", "weights_id", "v1.0.0"));
  }

  public getFrameCopy(): JsonObject {
    const rows = this.database.prepare("SELECT payload_json FROM frame_copy ORDER BY frame_key").all() as DbRow[];
    return { rows: rows.map((row) => JSON.parse(row.payload_json) as JsonValue) };
  }

  public getFreshness(now = new Date(), thresholdDays = 30): CatalogFreshness {
    const row = this.database.prepare("SELECT MAX(COALESCE(last_sync_at, last_verified_at)) AS latest_date FROM entries")
      .get() as FreshnessRow | undefined;
    const latest = typeof row?.latest_date === "string" ? row.latest_date : null;
    const age = dateAgeDays(latest, now);
    return { latest_entry_date: latest, age_days: age, stale: age === null || age > thresholdDays, threshold_days: thresholdDays };
  }

  public close(): void {
    this.db?.close();
    this.db = undefined;
  }

  private singleton(table: string, idColumn: string, id: string): JsonObject {
    const row = this.database.prepare(`SELECT payload_json FROM ${table} WHERE ${idColumn} = ?`).get(id) as DbRow | undefined;
    return parsePayload<JsonObject>(row, table);
  }

  private open(): Database.Database {
    try {
      const started = performance.now();
      const opened = new Database(this.dbPath, { readonly: true, fileMustExist: true });
      logJson({
        level: "info",
        event: "catalog_open",
        message: "opened compiled catalog",
        details: { path: this.dbPath, elapsed_ms: Math.round(performance.now() - started) },
      });
      return opened;
    } catch (error) {
      throw new CatalogError("failed to open compiled catalog", error);
    }
  }
}

let singletonStore: CatalogStore | undefined;

export const getCatalog = (): CatalogStore => {
  singletonStore ??= new CatalogStore();
  return singletonStore;
};

export const queryEntries = (filter?: EntryFilter): CatalogEntry[] => getCatalog().queryEntries(filter);
export const getEntry = (entryId: string): CatalogEntry | undefined => getCatalog().getEntry(entryId);
export const getEvidence = (evidenceId?: string): CatalogEvidence[] => getCatalog().getEvidence(evidenceId);
export const getTaxonomy = (): JsonObject => getCatalog().getTaxonomy();
export const getWeights = (): WeightConfig => getCatalog().getWeights();
export const getFrameCopy = (): JsonObject => getCatalog().getFrameCopy();
export const getCatalogFreshness = (): CatalogFreshness => getCatalog().getFreshness();
