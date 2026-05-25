import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CatalogStore } from "../../src/services/catalog.js";
import type { EntryRecord } from "../../src/types/catalog.js";

const rows: readonly EntryRecord[] = [
  { entry_id: "persona-hit", confidence_score: 0.91, persona_tags: ["student"], task_intent: [], life_event_tags: [], region_tags: ["seoul"] },
  { entry_id: "intent-hit", confidence_score: 0.94, persona_tags: [], task_intent: ["tax_payment"], life_event_tags: [], region_tags: ["busan"] },
  { entry_id: "life-hit", confidence_score: 0.93, persona_tags: [], task_intent: [], life_event_tags: ["birth"], region_tags: ["nationwide"] },
  { entry_id: "miss", confidence_score: 0.99, persona_tags: ["driver"], task_intent: ["license"], life_event_tags: [], region_tags: ["daegu"] },
];

const values = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const insertTerms = (db: Database.Database, entry: EntryRecord): void => {
  const insert = db.prepare("INSERT INTO entry_terms VALUES (?, ?, ?)");
  for (const value of values(entry.persona_tags)) insert.run(entry.entry_id, "persona", value);
  for (const value of values(entry.task_intent)) insert.run(entry.entry_id, "intent", value);
  for (const value of values(entry.life_event_tags)) insert.run(entry.entry_id, "life_event", value);
  for (const value of values(entry.region_tags)) insert.run(entry.entry_id, "region", value);
};

const createStage0Db = (filePath: string): void => {
  const db = new Database(filePath);
  db.exec("CREATE TABLE entries (entry_id TEXT, confidence_score REAL, payload_json TEXT)");
  db.exec("CREATE TABLE entry_terms (entry_id TEXT, axis TEXT, value TEXT)");
  const insert = db.prepare("INSERT INTO entries VALUES (?, ?, ?)");
  for (const entry of rows) {
    insert.run(entry.entry_id, entry.confidence_score, JSON.stringify(entry));
    insertTerms(db, entry);
  }
  db.close();
};

describe("CatalogStore queryStage0Admitted", () => {
  let dbPath = "";
  let store: CatalogStore;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `stage0-${process.pid}-${Date.now()}.sqlite`);
    createStage0Db(dbPath);
    store = new CatalogStore(dbPath);
  });

  afterEach(() => {
    store.close();
    fs.rmSync(dbPath, { force: true });
  });

  it("admits entries by persona intent or life-event overlap", () => {
    const found = store.queryStage0Admitted({ persona: ["student"], intent: ["tax_payment"], life_event: ["birth"] }, 2);
    expect(found.map((entry) => entry.entry_id).sort()).toEqual(["intent-hit", "life-hit", "persona-hit"]);
  });

  it("uses confidence sorted top-N for empty context", () => {
    expect(store.queryStage0Admitted({}, 2).map((entry) => entry.entry_id)).toEqual(["miss", "intent-hit"]);
  });

  it("drops region mismatches", () => {
    const found = store.queryStage0Admitted({ persona: ["student"], region: ["busan"] }, 10);
    expect(found).toHaveLength(0);
  });

  it("keeps nationwide entries for region-specific requests", () => {
    const found = store.queryStage0Admitted({ life_event: ["birth"], region: ["busan"] }, 10);
    expect(found.map((entry) => entry.entry_id)).toEqual(["life-hit"]);
  });
});
