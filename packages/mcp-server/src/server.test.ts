import { describe, expect, it } from "vitest";
import { getAdapterDiscovery } from "@mcp-gen-ui-gateway/core";
import { AdapterDiscoveryResponseSchema, BenefitSearchResponseSchema, type BenefitSearchResponse } from "@mcp-gen-ui-gateway/schema";
import { jsonResourceContents, jsonToolResult } from "./server.js";

describe("MCP JSON tool result", () => {
  it("serializes the Daejeon Yuseong scenario with benefit candidates and regional sections", async () => {
    const response: BenefitSearchResponse = {
      query: "신혼부부 프리랜서 대전 유성구 이사",
      profile: {
        region: "daejeon_yuseong",
        ageRange: "thirties",
        studentStatus: "unknown",
        employmentStatus: "self_employed",
        householdType: "couple",
        interests: ["housing", "employment", "local"]
      },
      results: [
        {
          id: "daejeon-newlywed-housing-loan",
          title: "대전 신혼부부 주거비 지원",
          provider: "대전광역시",
          category: "housing",
          summary: "대전 거주 신혼부부의 주거비 후보 지원입니다.",
          status: "candidate",
          reasons: ["daejeon_yuseong 지역 조건과 일치합니다."],
          missingInfo: []
        },
        {
          id: "self-employed-employment-stability",
          title: "자영업자 고용안정 지원",
          provider: "고용노동부",
          category: "employment",
          summary: "프리랜서와 자영업자가 확인할 수 있는 후보 지원입니다.",
          status: "candidate",
          reasons: ["고용 상태 조건과 일치합니다."],
          missingInfo: []
        }
      ],
      dataSections: [
        {
          id: "apt-rent-price-kr",
          title: "Apartment rent transaction snapshot",
          region: "daejeon_yuseong",
          source: { id: "apt-rent-price-kr", name: "MOLIT apartment rent transactions", status: "fixture" },
          metrics: [{ label: "LAWD_CD", value: "30200" }],
          rows: [],
          generatedAt: "2026-05-29T00:00:00.000Z"
        },
        {
          id: "population-stats-kr",
          title: "Resident population snapshot",
          region: "daejeon_yuseong",
          source: { id: "population-stats-kr", name: "MOIS resident population status", status: "fixture" },
          metrics: [{ label: "signguNm", value: "유성구" }],
          rows: [],
          generatedAt: "2026-05-29T00:00:00.000Z"
        },
        {
          id: "ev-chargers-kr",
          title: "EV charger availability",
          region: "daejeon_yuseong",
          source: { id: "ev-chargers-kr", name: "Korea Environment Corporation EV charger status", status: "unavailable" },
          metrics: [{ label: "zscode", value: "30200" }],
          rows: [],
          generatedAt: "2026-05-29T00:00:00.000Z"
        }
      ],
      generatedAt: "2026-05-29T00:00:00.000Z"
    };

    const result = jsonToolResult(response);
    const payload = BenefitSearchResponseSchema.parse(JSON.parse(result.content[0].text));

    expect(payload.results.map((item) => item.id)).toEqual(
      expect.arrayContaining(["daejeon-newlywed-housing-loan", "self-employed-employment-stability"])
    );
    expect(payload.dataSections.map((section) => section.id)).toEqual(
      expect.arrayContaining(["apt-rent-price-kr", "population-stats-kr", "ev-chargers-kr"])
    );
  });

  it("serializes adapter discovery as the resource://adapters/v1 MCP resource", () => {
    const result = jsonResourceContents("resource://adapters/v1", getAdapterDiscovery());
    const content = result.contents[0];

    expect(content.uri).toBe("resource://adapters/v1");
    expect(content.mimeType).toBe("application/json");

    const payload = AdapterDiscoveryResponseSchema.parse(JSON.parse(content.text));
    expect(payload.resource_uri).toBe("resource://adapters/v1");
    expect(payload.adapters.map((adapter) => adapter.adapter_id)).toEqual(
      expect.arrayContaining(["apt-rent-price-kr", "ev-chargers-kr", "korean-law-evidence"])
    );
    expect(payload.adapters.find((adapter) => adapter.adapter_id === "korean-law-evidence")?.availability).toBe("parked");
  });
});
