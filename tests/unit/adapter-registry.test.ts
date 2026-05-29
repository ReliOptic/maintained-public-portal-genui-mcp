import { describe, expect, it } from "vitest";
import { matchingAdapters, parseAdapterRegistry, validateAdapterRegistration } from "../../src/services/adapter-registry.js";
import type { AdapterRegistration } from "../../src/types/adapter.types.js";

const welfare: AdapterRegistration = {
  adapter_id: "welfare-facility-kr",
  name: "복지시설 현황",
  refresh_mode: "scheduled",
  trigger_intents: ["benefit_check", "benefit_application"],
  fetch_params: { region: { type: "taxonomy_region_enum" } },
};

describe("adapter registry", () => {
  it("rejects on_demand registrations without proxy_url", () => {
    expect(() => validateAdapterRegistration({ ...welfare, adapter_id: "live", refresh_mode: "on_demand" })).toThrow(/proxy_url/u);
  });

  it("allows gated on_demand registrations without proxy_url", () => {
    const unavailable = validateAdapterRegistration({ ...welfare, adapter_id: "ev", refresh_mode: "on_demand", availability: "unavailable" });
    const parked = validateAdapterRegistration({ ...welfare, adapter_id: "law", refresh_mode: "on_demand", availability: "parked" });
    expect(unavailable.availability).toBe("unavailable");
    expect(parked.availability).toBe("parked");
  });

  it("rejects invalid refresh_mode instead of defaulting execution path", () => {
    expect(() => validateAdapterRegistration({ ...welfare, refresh_mode: "scheduld" })).toThrow(/refresh_mode/u);
  });

  it("rejects invalid availability instead of failing open", () => {
    expect(() => validateAdapterRegistration({ ...welfare, availability: "unavaliable" })).toThrow(/availability/u);
  });

  it("matches adapters by taxonomy trigger_intents", () => {
    expect(matchingAdapters([welfare], ["benefit_check"])).toEqual([welfare]);
  });

  it("does not route unavailable or parked registrations", () => {
    const unavailable: AdapterRegistration = { ...welfare, adapter_id: "ev", availability: "unavailable" };
    const parked: AdapterRegistration = { ...welfare, adapter_id: "law", availability: "parked" };
    expect(matchingAdapters([welfare, unavailable, parked], ["benefit_check"])).toEqual([welfare]);
  });

  it("does not match empty or unrelated intent", () => {
    expect(matchingAdapters([welfare])).toEqual([]);
    expect(matchingAdapters([welfare], ["tax_filing"])).toEqual([]);
  });

  it("preserves public discovery metadata", () => {
    const registry = parseAdapterRegistry({
      adapters_version: "1.0.0",
      adapters: [{
        ...welfare,
        data_sections: ["welfare-facility-kr"],
        supported_regions: ["daejeon"],
        source: { agency: "보건복지부", api_name: "사회복지시설 현황", auth_type: "key_required", status: "live" },
        credential_boundary: "none",
      }],
    });
    expect(registry.adapters[0]).toMatchObject({
      availability: "available",
      data_sections: ["welfare-facility-kr"],
      supported_regions: ["daejeon"],
      credential_boundary: "none",
    });
  });
});
