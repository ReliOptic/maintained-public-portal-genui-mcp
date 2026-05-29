import { describe, expect, it } from "vitest";
import { AdapterDiscoveryResponseSchema } from "@mcp-gen-ui-gateway/schema";
import { getAdapterDiscovery } from "./adapter-discovery.js";

describe("adapter discovery catalog", () => {
  it("publishes fixture-backed regional adapters and explicit gated states", () => {
    const discovery = AdapterDiscoveryResponseSchema.parse(getAdapterDiscovery());

    expect(discovery.resourceUri).toBe("resource://adapters/v1");
    expect(discovery.adapters.map((adapter) => adapter.id)).toEqual([
      "apt-rent-price-kr",
      "population-stats-kr",
      "parking-info-kr",
      "cctv-status-kr",
      "population-by-dong-kr",
      "ev-chargers-kr",
      "korean-law-evidence"
    ]);
    expect(discovery.adapters.filter((adapter) => adapter.availability === "available")).toHaveLength(5);
    expect(discovery.adapters.find((adapter) => adapter.id === "ev-chargers-kr")).toMatchObject({
      availability: "unavailable",
      credentialBoundary: "server_proxy_required",
      source: { status: "unavailable" }
    });
    expect(discovery.adapters.find((adapter) => adapter.id === "korean-law-evidence")).toMatchObject({
      availability: "parked",
      credentialBoundary: "decision_required",
      dataSections: [],
      adrReference: "ADR-0022"
    });
  });

  it("keeps available adapters aligned with emitted data section ids", () => {
    const discovery = getAdapterDiscovery();
    const availableAdapters = discovery.adapters.filter((adapter) => adapter.availability === "available");

    expect(availableAdapters.every((adapter) => adapter.outputSectionId && adapter.dataSections.includes(adapter.outputSectionId))).toBe(
      true
    );
    expect(availableAdapters.flatMap((adapter) => adapter.supportedRegions)).toEqual(
      expect.arrayContaining(["daejeon_yuseong"])
    );
  });
});
