import { describe, expect, it } from "vitest";
import { matchingAdapters, validateAdapterRegistration } from "../../src/services/adapter-registry.js";
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

  it("matches adapters by taxonomy trigger_intents", () => {
    expect(matchingAdapters([welfare], ["benefit_check"])).toEqual([welfare]);
  });

  it("does not match empty or unrelated intent", () => {
    expect(matchingAdapters([welfare])).toEqual([]);
    expect(matchingAdapters([welfare], ["tax_filing"])).toEqual([]);
  });
});
