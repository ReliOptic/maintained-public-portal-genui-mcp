#!/usr/bin/env node
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import type { CompileCounts, EntryRecord, EvidenceRecord, JsonObject, JsonValue, SqlParams } from "../src/types/catalog.js";
import { createTermIndexSchema, insertEntryTerms } from "./catalog-term-index.js";
import { asStringArray, resolveEvidenceRefs, taxonomyEnumValues, warnUnknownEvidenceAppliesTo } from "./evidence-auto-match.js";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const CATALOG = path.join(ROOT, "catalog", "v1.0.0");
const OUT = path.join(ROOT, "catalog", "compiled.sqlite");

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: JsonValue | undefined): string =>
  typeof value === "string" ? value : "";

const asNumber = (value: JsonValue | undefined): number =>
  typeof value === "number" ? value : Number.NaN;

const jsonText = (value: JsonValue | undefined): string => JSON.stringify(value ?? null);

const ordinal = (entry: EntryRecord, key: string): string => {
  const ordinals = entry.intrinsic_ordinals;
  return isObject(ordinals) ? asString(ordinals[key]) : "";
};

const safeCopyRule = (entry: EntryRecord): string => {
  const audit = entry.safe_copy_audit;
  if (!isObject(audit)) return "";
  return asString(audit.safe_copy_rule) || asString(audit.rule);
};

export const readJson = (filePath: string): JsonValue => {
  const value: unknown = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (!isObject(value) && !Array.isArray(value)) throw new Error(`JSON root must be object or array: ${filePath}`);
  return value as JsonValue;
};

const readObject = (filePath: string, label: string): JsonObject => {
  const value = readJson(filePath);
  if (!isObject(value)) throw new Error(`${label} JSON must be object: ${filePath}`);
  return value;
};

export const shouldCompileEntry = (entry: EntryRecord): boolean => {
  const confidence = asNumber(entry.confidence_score);
  return entry.status === "published" && confidence >= 0.85 && !entry.merged_into && asString(entry.menu_path).length > 0;
};

export const validateEntry = (entry: EntryRecord, filePath: string): void => {
  if (!asString(entry.entry_id)) throw new Error(`entry missing entry_id: ${filePath}`);
  if (!asString(entry.menu_path)) throw new Error(`entry missing menu_path: ${filePath}`);
};

const entryParams = (entry: EntryRecord): SqlParams => ({
  entry_id: asString(entry.entry_id), status: asString(entry.status), confidence_score: asNumber(entry.confidence_score),
  merged_into: asString(entry.merged_into) || null, access_mode: asString(entry.access_mode),
  canonical_intent: asString(entry.canonical_intent), canonical_action_verb: asString(entry.canonical_action_verb),
  title: asString(entry.title), menu_path: asString(entry.menu_path), persona_tags_json: jsonText(entry.persona_tags),
  task_intent_json: jsonText(entry.task_intent), life_event_tags_json: jsonText(entry.life_event_tags),
  region_tags_json: jsonText(entry.region_tags), evidence_refs_json: jsonText(entry.evidence_refs),
  seasonality_hint: asString(entry.seasonality_hint), actionability: ordinal(entry, "actionability"),
  evidence_value: ordinal(entry, "evidence_value"), sensitivity_risk: ordinal(entry, "sensitivity_risk"),
  handoff_json: jsonText(entry.handoff), card_title: asString(entry.card_title), card_body: asString(entry.card_body),
  cta_label: asString(entry.cta_label), safe_copy_rule: safeCopyRule(entry),
  last_sync_at: asString(entry.last_sync_at) || null, last_verified_at: asString(entry.last_verified_at) || null,
  payload_json: JSON.stringify(entry),
});

const evidenceParams = (evidence: EvidenceRecord): SqlParams => ({
  evidence_id: asString(evidence.evidence_id), title: asString(evidence.title), role: asString(evidence.role),
  payload_json: JSON.stringify(evidence),
});

const createSchema = (db: Database.Database): void => {
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE entries (entry_id TEXT PRIMARY KEY, status TEXT NOT NULL, confidence_score REAL NOT NULL,
      merged_into TEXT, access_mode TEXT NOT NULL, canonical_intent TEXT NOT NULL, canonical_action_verb TEXT NOT NULL,
      title TEXT NOT NULL, menu_path TEXT NOT NULL, persona_tags_json TEXT NOT NULL, task_intent_json TEXT NOT NULL,
      life_event_tags_json TEXT NOT NULL, region_tags_json TEXT NOT NULL, evidence_refs_json TEXT NOT NULL,
      seasonality_hint TEXT NOT NULL, actionability TEXT NOT NULL, evidence_value TEXT NOT NULL, sensitivity_risk TEXT NOT NULL,
      handoff_json TEXT NOT NULL, card_title TEXT NOT NULL, card_body TEXT NOT NULL, cta_label TEXT NOT NULL,
      safe_copy_rule TEXT NOT NULL, last_sync_at TEXT, last_verified_at TEXT, payload_json TEXT NOT NULL);
    CREATE TABLE evidence (evidence_id TEXT PRIMARY KEY, title TEXT NOT NULL, role TEXT NOT NULL, payload_json TEXT NOT NULL);
    CREATE TABLE taxonomy (taxonomy_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL);
    CREATE TABLE weights (weights_id TEXT PRIMARY KEY, payload_json TEXT NOT NULL);
    CREATE TABLE frame_copy (frame_key TEXT PRIMARY KEY, payload_json TEXT NOT NULL);
    CREATE INDEX idx_entries_status_confidence ON entries(status, confidence_score);
    CREATE INDEX idx_entries_access_mode ON entries(access_mode);
    CREATE INDEX idx_entries_canonical_intent ON entries(canonical_intent);
  `);
  createTermIndexSchema(db);
};

const readEvidenceRecords = (): EvidenceRecord[] => fs.readdirSync(path.join(CATALOG, "evidence"))
  .filter((file) => file.endsWith(".json"))
  .sort()
  .map((file) => readObject(path.join(CATALOG, "evidence", file), "evidence") as EvidenceRecord);

const insertEntries = (
  db: Database.Database,
  evidenceRecords: readonly EvidenceRecord[],
  rolePriority: readonly string[],
): Pick<CompileCounts, "entries_seen" | "entries_inserted"> => {
  const sql = `INSERT INTO entries VALUES (@entry_id,@status,@confidence_score,@merged_into,@access_mode,@canonical_intent,
    @canonical_action_verb,@title,@menu_path,@persona_tags_json,@task_intent_json,@life_event_tags_json,
    @region_tags_json,@evidence_refs_json,@seasonality_hint,@actionability,@evidence_value,@sensitivity_risk,
    @handoff_json,@card_title,@card_body,@cta_label,@safe_copy_rule,@last_sync_at,@last_verified_at,@payload_json)`;
  const insert = db.prepare(sql);
  let seen = 0;
  let inserted = 0;
  const files = fs.readdirSync(path.join(CATALOG, "entries")).filter((v) => v.endsWith(".json") && !v.startsWith("_")).sort();
  for (const file of files) {
    const entry = readObject(path.join(CATALOG, "entries", file), "entry") as EntryRecord;
    seen += 1;
    validateEntry(entry, file);
    if (shouldCompileEntry(entry)) {
      const compiled = { ...entry, evidence_refs: resolveEvidenceRefs(entry, evidenceRecords, rolePriority) };
      insert.run(entryParams(compiled));
      insertEntryTerms(db, compiled);
      inserted += 1;
    }
  }
  return { entries_seen: seen, entries_inserted: inserted };
};

const insertEvidence = (db: Database.Database, records: readonly EvidenceRecord[]): number => {
  const insert = db.prepare("INSERT INTO evidence VALUES (@evidence_id,@title,@role,@payload_json)");
  for (const record of records) insert.run(evidenceParams(record));
  return records.length;
};

const insertPayload = (db: Database.Database, table: string, key: string, payload: JsonValue): number => {
  db.prepare(`INSERT INTO ${table} VALUES (@key,@payload_json)`).run({ key, payload_json: JSON.stringify(payload) });
  return 1;
};

export const compileCatalog = (outputPath = OUT): CompileCounts => {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  const tmp = `${outputPath}.tmp`;
  fs.rmSync(tmp, { force: true });
  const evidence = readEvidenceRecords();
  const taxonomy = readObject(path.join(CATALOG, "taxonomy", "v1.0.json"), "taxonomy");
  const weights = readObject(path.join(CATALOG, "weights", "v1.0.0.json"), "weights");
  warnUnknownEvidenceAppliesTo(evidence, taxonomyEnumValues(taxonomy));
  const db = new Database(tmp);
  createSchema(db);
  const tx = db.transaction(() => {
    const entries = insertEntries(db, evidence, asStringArray(weights.evidence_role_priority));
    return {
      ...entries,
      evidence_inserted: insertEvidence(db, evidence),
      taxonomy_inserted: insertPayload(db, "taxonomy", "v1.0", taxonomy),
      weights_inserted: insertPayload(db, "weights", "v1.0.0", weights),
      frame_copy_inserted: insertPayload(db, "frame_copy", "copy", readJson(path.join(CATALOG, "frame_copy.json"))) +
        insertPayload(db, "frame_copy", "segments", readJson(path.join(CATALOG, "frame_copy_segments.json"))),
    };
  });
  const counts = tx() as CompileCounts;
  db.pragma("wal_checkpoint(TRUNCATE)");
  db.close();
  fs.rmSync(outputPath, { force: true });
  fs.renameSync(tmp, outputPath);
  return counts;
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    console.log(JSON.stringify(compileCatalog(), null, 2));
  } catch (error) {
    console.error(JSON.stringify({ level: "error", message: error instanceof Error ? error.message : String(error) }));
    process.exit(1);
  }
}
