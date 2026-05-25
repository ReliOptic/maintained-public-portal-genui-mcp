import { afterAll, describe, expect, it } from "vitest";
import { CatalogStore } from "../../src/services/catalog.js";

const store = new CatalogStore("catalog/compiled.sqlite");

afterAll(() => {
  store.close();
});

describe("CatalogStore", () => {
  it("opens lazily and queries compiled entries", () => {
    const entries = store.queryEntries({ status: "published", limit: 3 });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.entry_id).toBeTruthy();
  });

  it("loads singleton catalog payloads", () => {
    expect(store.getTaxonomy().taxonomy_version).toBe("v1.0");
    expect(store.getWeights().weights_version).toBe("1.0.0");
    expect(store.getFrameCopy().rows).toHaveLength(2);
  });

  it("gets evidence and entry details", () => {
    const evidence = store.getEvidence();
    expect(evidence).toHaveLength(6);
    const [entry] = store.queryEntries({ query: "신고", limit: 1 });
    expect(entry).toBeDefined();
    expect(store.getEntry(String(entry?.entry_id))?.menu_path).toBeTruthy();
  });

  it("reports bundled catalog freshness for startup warnings", () => {
    const baseline = store.getFreshness(new Date("2026-05-24T00:00:00Z"));
    const latest = baseline.latest_entry_date;
    expect(latest).toMatch(/^\d{4}-\d{2}-\d{2}/u);
    const latestTime = Date.parse(String(latest));
    expect(Number.isFinite(latestTime)).toBe(true);
    const freshNow = new Date(latestTime);
    const staleNow = new Date(freshNow.getTime() + 31 * 86_400_000);
    const fresh = store.getFreshness(freshNow);
    expect(fresh.age_days).toBe(0);
    expect(fresh.stale).toBe(false);
    expect(store.getFreshness(staleNow).stale).toBe(true);
  });
});
