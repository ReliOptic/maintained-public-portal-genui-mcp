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
});
