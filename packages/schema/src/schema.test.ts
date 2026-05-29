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
      resourceUri: "resource://adapters/v1",
      adapters: [
        {
          id: "apt-rent-price-kr",
          title: "Apartment rent transaction adapter",
          description: "Fixture-backed scheduled rent section.",
          refreshMode: "scheduled",
          availability: "available",
          outputSectionId: "apt-rent-price-kr",
          triggerIntents: ["housing"],
          dataSections: ["apt-rent-price-kr"],
          supportedRegions: ["daejeon_yuseong"],
          source: { id: "apt-rent-price-kr", name: "MOLIT apartment rent transactions", status: "fixture" },
          credentialBoundary: "none"
        },
        {
          id: "korean-law-evidence",
          title: "Korean law evidence adapter",
          description: "Parked until the legal-evidence role is accepted.",
          refreshMode: "on_demand",
          availability: "parked",
          triggerIntents: ["policy_information"],
          dataSections: [],
          supportedRegions: [],
          source: { id: "korean-law-evidence", name: "Korean law MCP", status: "unavailable" },
          credentialBoundary: "decision_required",
          statusReason: "ADR-0022 Option A/B/C decision required.",
          adrReference: "ADR-0022"
        }
      ],
      generatedAt: "2026-05-29T00:00:00.000Z"
    });

    expect(parsed.adapters.map((adapter) => adapter.availability)).toEqual(["available", "parked"]);
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resourceUri: "resource://adapters/v1",
        adapters: [
          {
            id: "invalid",
            title: "Invalid",
            description: "Invalid state.",
            refreshMode: "scheduled",
            availability: "maybe",
            source: { id: "invalid", name: "Invalid", status: "fixture" },
            credentialBoundary: "none"
          }
        ],
        generatedAt: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resourceUri: "resource://adapters/v1",
        adapters: [
          {
            id: "missing-output",
            title: "Missing output",
            description: "Available adapters must expose an output section.",
            refreshMode: "scheduled",
            availability: "available",
            source: { id: "missing-output", name: "Missing output", status: "fixture" },
            credentialBoundary: "none"
          }
        ],
        generatedAt: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resourceUri: "resource://adapters/v1",
        adapters: [
          {
            id: "missing-reason",
            title: "Missing reason",
            description: "Unavailable adapters must explain the gate.",
            refreshMode: "on_demand",
            availability: "unavailable",
            source: { id: "missing-reason", name: "Missing reason", status: "unavailable" },
            credentialBoundary: "server_proxy_required"
          }
        ],
        generatedAt: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
    expect(() =>
      AdapterDiscoveryResponseSchema.parse({
        resourceUri: "resource://adapters/v1",
        adapters: [
          {
            id: "invalid-intent",
            title: "Invalid intent",
            description: "Invalid intent should fail.",
            refreshMode: "scheduled",
            availability: "available",
            triggerIntents: ["free_text_intent"],
            source: { id: "invalid-intent", name: "Invalid intent", status: "fixture" },
            credentialBoundary: "none"
          }
        ],
        generatedAt: "2026-05-29T00:00:00.000Z"
      })
    ).toThrow();
  });
});
