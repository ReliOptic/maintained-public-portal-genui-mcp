import Database from "better-sqlite3";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { evaluateCoverage } from "../../scripts/coverage-gate.js";
import type { JsonObject } from "../../src/types/catalog.js";

const taxonomy = (regionValues: readonly string[] = ["nationwide"]): JsonObject => ({
  axes: {
    persona: { values: { student: {} } },
    intent: { values: { tax: {} } },
    life_event: { values: { birth: {} } },
    region: { values: Object.fromEntries(regionValues.map((value) => [value, {}])) },
  },
});

const openDb = (filePath: string, payload: JsonObject): Database.Database => {
  const db = new Database(filePath);
  db.exec("CREATE TABLE taxonomy (payload_json TEXT)");
  db.exec("CREATE TABLE entries (entry_id TEXT, status TEXT, payload_json TEXT)");
  db.exec("CREATE TABLE entry_terms (entry_id TEXT, axis TEXT, value TEXT)");
  db.prepare("INSERT INTO taxonomy VALUES (?)").run(JSON.stringify(payload));
  return db;
};

const insertEntry = (db: Database.Database, index: number, terms: readonly string[], approved = true): void => {
  const entryId = `entry-${index}`;
  db.prepare("INSERT INTO entries VALUES (?, 'published', ?)").run(entryId, JSON.stringify({ maintainer_approved: approved }));
  const insert = db.prepare("INSERT INTO entry_terms VALUES (?, ?, ?)");
  insert.run(entryId, "persona", "student");
  insert.run(entryId, "intent", "tax");
  insert.run(entryId, "life_event", "birth");
  for (const region of terms) insert.run(entryId, "region", region);
};

const seed = (db: Database.Database, count: number, regions: readonly string[] = ["nationwide"], approvals = count): void => {
  for (let index = 0; index < count; index += 1) insertEntry(db, index, regions, index < approvals);
};

describe("coverage gate", () => {
  let dbPath = "";
  let db: Database.Database;

  beforeEach(() => {
    dbPath = path.join(os.tmpdir(), `coverage-${process.pid}-${Date.now()}.sqlite`);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(dbPath, { force: true });
  });

  it("fails thin axis coverage", () => {
    db = openDb(dbPath, taxonomy());
    seed(db, 19);
    const report = evaluateCoverage(db);
    expect(report.verdict).toBe("NOT READY");
    expect(report.first_failure).toBe("persona/student");
  });

  it("fails sensitive values without full maintainer approval", () => {
    db = openDb(dbPath, taxonomy());
    seed(db, 20, ["nationwide"], 19);
    const tax = evaluateCoverage(db).rows.find((row) => row.axis === "intent" && row.value === "tax");
    expect(tax?.published_count).toBe(20);
    expect(tax?.approval_ratio).toBe(0.95);
    expect(tax?.ready).toBe(false);
  });

  it("passes when every gated value meets threshold", () => {
    db = openDb(dbPath, taxonomy(["nationwide", "seoul"]));
    seed(db, 20, ["nationwide", "seoul"]);
    expect(evaluateCoverage(db).verdict).toBe("READY");
  });

  it("ignores thin sub-region values", () => {
    db = openDb(dbPath, taxonomy(["nationwide", "seoul", "seoul_gangnam"]));
    seed(db, 20, ["nationwide", "seoul"]);
    expect(evaluateCoverage(db).verdict).toBe("READY");
  });
});
