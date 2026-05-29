import { describe, expect, it } from "vitest";
import { dataGoRegionalAdapters } from "../../src/services/adapters/data-go-regional-fixtures.js";

describe("data.go.kr regional fixture adapters", () => {
  it("exposes the five scheduled v0.2 fixture adapters", () => {
    expect(dataGoRegionalAdapters.map((adapter) => adapter.registration.adapter_id).sort()).toEqual([
      "apt-rent-price-kr",
      "cctv-status-kr",
      "parking-info-kr",
      "population-by-dong-kr",
      "population-stats-kr",
    ]);
  });

  it("returns Daejeon records with native upstream codes", async () => {
    const adapter = dataGoRegionalAdapters.find((item) => item.registration.adapter_id === "apt-rent-price-kr");
    expect(adapter).toBeDefined();
    const rows = await adapter!.fetch({ region: "daejeon", limit: 2 });
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      adapter_id: "apt-rent-price-kr",
      region: "daejeon",
      payload: { lawd_cd: "30200", zscode: "30200", signgu_nm: "유성구", call_status: "mock" },
    });
  });

  it("does not fabricate rows for unmapped taxonomy regions", async () => {
    const adapter = dataGoRegionalAdapters.find((item) => item.registration.adapter_id === "parking-info-kr");
    expect(await adapter!.fetch({ region: "seoul", limit: 20 })).toEqual([]);
  });
});
