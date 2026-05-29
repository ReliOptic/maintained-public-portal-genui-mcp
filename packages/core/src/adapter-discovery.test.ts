import { describe, expect, it } from "vitest";
import { AdapterDiscoveryResponseSchema } from "@mcp-gen-ui-gateway/schema";
import { getAdapterDiscovery } from "./adapter-discovery.js";

describe("adapter discovery catalog", () => {
  it("publishes fixture-backed regional adapters and explicit gated states", () => {
    const discovery = AdapterDiscoveryResponseSchema.parse(getAdapterDiscovery());

    expect(discovery.resource_uri).toBe("resource://adapters/v1");
    expect(discovery.adapters_version).toBe("v1");
    expect(discovery.adapters.map((adapter) => adapter.adapter_id)).toEqual([
      "apt-rent-price-kr",
      "population-stats-kr",
      "parking-info-kr",
      "cctv-status-kr",
      "population-by-dong-kr",
      "ev-chargers-kr",
      "korean-law-evidence"
    ]);
    expect(discovery.adapters.filter((adapter) => adapter.availability === "available")).toHaveLength(5);
    expect(discovery.adapters.find((adapter) => adapter.adapter_id === "ev-chargers-kr")).toMatchObject({
      availability: "unavailable",
      credential_boundary: "server_proxy_required",
      source: { agency: "Korea Environment Corporation", status: "unavailable" }
    });
    expect(discovery.adapters.find((adapter) => adapter.adapter_id === "korean-law-evidence")).toMatchObject({
      availability: "parked",
      credential_boundary: "decision_required",
      data_sections: [],
      adr_reference: "ADR-0022"
    });
  });

  it("keeps available adapters aligned with emitted data section ids", () => {
    const discovery = getAdapterDiscovery();
    const availableAdapters = discovery.adapters.filter((adapter) => adapter.availability === "available");

    expect(availableAdapters.every((adapter) => adapter.output_section_id && adapter.data_sections.includes(adapter.output_section_id))).toBe(
      true
    );
    expect(availableAdapters.flatMap((adapter) => adapter.supported_regions)).toEqual(
      expect.arrayContaining(["daejeon_yuseong"])
    );
  });
});
