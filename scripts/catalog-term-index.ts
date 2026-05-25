import type Database from "better-sqlite3";
import type { EntryRecord, JsonObject, JsonValue } from "../src/types/catalog.js";

const isObject = (value: JsonValue | undefined): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const asString = (value: JsonValue | undefined): string | undefined =>
  typeof value === "string" && value.length > 0 ? value : undefined;

const asStringArray = (value: JsonValue | undefined): string[] => {
  if (typeof value === "string" && value.length > 0) return [value];
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.length > 0);
};

const unique = (values: readonly string[]): string[] => [...new Set(values.filter((value) => value.length > 0))];

const regionValues = (entry: EntryRecord): string[] => {
  const region = isObject(entry.region) ? [] : asStringArray(entry.region);
  return unique([...asStringArray(entry.region_tags), ...region]);
};

const termRows = (entry: EntryRecord): Array<readonly [string, string]> => [
  ...unique(asStringArray(entry.persona_tags)).map((value) => ["persona", value] as const),
  ...unique([...asStringArray(entry.task_intent), asString(entry.canonical_intent) ?? ""]).map((value) => ["intent", value] as const),
  ...unique(asStringArray(entry.life_event_tags)).map((value) => ["life_event", value] as const),
  ...regionValues(entry).map((value) => ["region", value] as const),
];

export const createTermIndexSchema = (db: Database.Database): void => {
  db.exec(`
    CREATE TABLE entry_terms (entry_id TEXT NOT NULL, axis TEXT NOT NULL, value TEXT NOT NULL);
    CREATE INDEX idx_entry_terms_axis_value_entry ON entry_terms(axis, value, entry_id);
  `);
};

export const insertEntryTerms = (db: Database.Database, entry: EntryRecord): void => {
  const entryId = asString(entry.entry_id);
  if (!entryId) return;
  const insert = db.prepare("INSERT INTO entry_terms VALUES (?, ?, ?)");
  for (const [axis, value] of termRows(entry)) insert.run(entryId, axis, value);
};
