import { describe, expect, it } from "vitest";
import {
  AdapterDiscoveryResponseSchema,
  BenefitSearchRequestSchema,
  BenefitSearchResponseSchema,
  DataSectionSourceSchema
} from "./index.js";

describe("BenefitSearchRequestSchema", () => {
  it("parses non-identifying profile conditions", () => {
    const parsed = BenefitSearchRequestSchema.parse({
      query: "서울 거주 대학생 지원",
      profile: {
        region: "서울",
        ageRange: "twenties",
        studentStatus: "student",
        interests: ["education"]
      }
    });

    expect(parsed.profile.studentStatus).toBe("student");
    expect(parsed.profile.employmentStatus).toBe("unknown");
  });

  it("parses fixture-backed regional data sections beside benefit results", () => {
    const parsed = BenefitSearchResponseSchema.parse({
      query: "서울 주거 데이터",
      profile: { region: "서울", interests: ["housing"] },
      results: [],
      dataSections: [
        {
          id: "regional-evidence-seoul",
          title: "Regional evidence snapshot",
          region: "서울",
          source: {
            id: "regional-evidence-fixture",
            name: "Fixture regional evidence",
            status: "fixture"
          },
          metrics: [{ label: "Fixture records", value: 1, unit: "rows" }],
          rows: [{ region: "서울", note: "not ranked as benefit" }],
          generatedAt: "2026-05-29T00:00:00.000Z"
        }
      ],
      generatedAt: "2026-05-29T00:00:00.000Z"
    });

    expect(parsed.dataSections[0]?.source.status).toBe("fixture");
  });

  it("limits data section source statuses to fixture or unavailable", () => {
    expect(DataSectionSourceSchema.parse({ id: "fixture-source", name: "Fixture source", status: "fixture" }).status).toBe(
      "fixture"
    );
    expect(
      DataSectionSourceSchema.parse({ id: "deferred-source", name: "Deferred source", status: "unavailable" }).status
    ).toBe("unavailable");
    expect(() => DataSectionSourceSchema.parse({ id: "mock-source", name: "Mock source", status: "mock" })).toThrow();
  });

  it("parses adapter discovery with available, unavailable, and parked states", () => {
    const parsed = AdapterDiscoveryResponseSchema.parse({
      resource_uri: "resource://adapters/v1",
      adapters_version: "v1",
      adapters: [
        {
          adapter_id: "apt-rent-price-kr",
          name: "Apartment rent transaction adapter",
          description: "Fixture-backed scheduled rent section.",
          refresh_mode: "scheduled",
          availability: "available",
          output_section_id: "apt-rent-price-kr",
          trigger_intents: ["housing"],
          data_sections: ["apt-rent-price-kr"],
          supported_regions: ["daejeon_yuseong"],
          fetch_params: { region: { type: "taxonomy_region_enum" }, limit: { type: "integer", default: 20 } },
          source: {
            agency: "Ministry of Land, Infrastructure and Transport",
            api_name: "Apartment rent transactions",
            auth_type: "key_required",
            status: "fixture"
          },
          credential_boundary: "none"
        },
        {
          adapter_id: "korean-law-evidence",
          name: "Korean law evidence adapter",
          description: "Parked until the legal-evidence role is accepted.",
          refresh_mode: "on_demand",
          availability: "parked",
          trigger_intents: ["policy_information"],
          data_sections: [],
          supported_regions: [],
          fetch_params: {},
          source: {
            agency: "Korean law MCP",
            api_name: "Legal evidence lookup",
            auth_type: "key_required",
            status: "unavailable"
          },
          credential_boundary: "decision_required",
          status_reason: "ADR-0022 Option A/B/C decision required.",
          adr_reference: "ADR-0022"
        }
      ],
      generated_at: "2026-05-29T00:00:00.000Z"
    });

    expect(parsed.adapters.map((adapter) => adapter.availability)).toEqual(["available", "parked"]);
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resource_uri: "resource://adapters/v1",
        adapters_version: "v1",
        adapters: [
          {
            adapter_id: "invalid",
            name: "Invalid",
            description: "Invalid state.",
            refresh_mode: "scheduled",
            availability: "maybe",
            source: { agency: "Invalid", api_name: "Invalid", auth_type: "public", status: "fixture" },
            credential_boundary: "none"
          }
        ],
        generated_at: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resource_uri: "resource://adapters/v1",
        adapters_version: "v1",
        adapters: [
          {
            adapter_id: "missing-output",
            name: "Missing output",
            description: "Available adapters must expose an output section.",
            refresh_mode: "scheduled",
            availability: "available",
            source: { agency: "Missing output", api_name: "Missing output", auth_type: "public", status: "fixture" },
            credential_boundary: "none"
          }
        ],
        generated_at: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resource_uri: "resource://adapters/v1",
        adapters_version: "v1",
        adapters: [
          {
            adapter_id: "missing-reason",
            name: "Missing reason",
            description: "Unavailable adapters must explain the gate.",
            refresh_mode: "on_demand",
            availability: "unavailable",
            source: { agency: "Missing reason", api_name: "Missing reason", auth_type: "key_required", status: "unavailable" },
            credential_boundary: "server_proxy_required"
          }
        ],
        generated_at: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resource_uri: "resource://adapters/v1",
        adapters_version: "v1",
        adapters: [
          {
            adapter_id: "invalid-intent",
            name: "Invalid intent",
            description: "Invalid intent should fail.",
            refresh_mode: "scheduled",
            availability: "available",
            trigger_intents: ["free_text_intent"],
            source: { agency: "Invalid intent", api_name: "Invalid intent", auth_type: "public", status: "fixture" },
            credential_boundary: "none"
          }
        ],
        generated_at: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
  });

  it("parses the ADR-0019 adapter manifest field names", () => {
    const parsed = AdapterDiscoveryResponseSchema.parse({
      adapters_version: "v1",
      adapters: [
        {
          adapter_id: "customs_trade_statistics",
          name: "Customs trade statistics",
          description: "Scheduled customs trade statistics adapter.",
          refresh_mode: "scheduled",
          availability: "available",
          output_section_id: "customs_trade_statistics",
          trigger_intents: ["policy_information"],
          data_sections: ["customs_trade_statistics"],
          supported_regions: ["nationwide"],
          fetch_params: {
            region: { type: "taxonomy_region_enum" },
            period: { type: "YYYY-MM" },
            domain_filter: { type: "enum", values: ["export", "import"] },
            limit: { type: "integer", default: 50 }
          },
          source: {
            agency: "관세청",
            api_name: "수출입 통계",
            auth_type: "key_required"
          },
          credential_boundary: "none"
        }
      ]
    });

    expect(parsed.resource_uri).toBe("resource://adapters/v1");
    expect(parsed.adapters[0]).toMatchObject({
      adapter_id: "customs_trade_statistics",
      refresh_mode: "scheduled",
      trigger_intents: ["policy_information"]
    });
  });
});
