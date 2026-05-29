import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FixtureBenefitRepository } from "./repository.js";
import { SnapshotStore } from "./sqlite-store.js";
import { BenefitToolService } from "./tool-service.js";

describe("BenefitToolService", () => {
  it("groups fixture-backed benefit results by recommendation status", async () => {
    const service = new BenefitToolService(new FixtureBenefitRepository());

    const response = await service.searchBenefits({
      query: "서울 대학생 주거 지원",
      profile: {
        region: "서울",
        ageRange: "twenties",
        studentStatus: "student",
        interests: ["housing", "education"]
      }
    });

    expect(response.results[0]?.status).toBe("candidate");
    expect(response.results.map((result) => result.id)).toContain("seoul-youth-rent-support");
  });

  it("returns regional data sections without ranking them as benefits", async () => {
    const service = new BenefitToolService(new FixtureBenefitRepository());

    const response = await service.searchBenefits({
      query: "대전 유성구 지역 데이터와 주거 지원",
      profile: {
        region: "daejeon_yuseong",
        interests: ["housing"]
      }
    });

    expect(response.dataSections.map((section) => section.id)).toEqual([
      "apt-rent-price-kr",
      "population-stats-kr",
      "parking-info-kr",
      "cctv-status-kr",
      "population-by-dong-kr",
      "ev-chargers-kr"
    ]);
    expect(response.dataSections[0]).toMatchObject({
      id: "apt-rent-price-kr",
      region: "daejeon_yuseong",
      source: { status: "fixture" }
    });
    expect(response.results.map((result) => result.id)).not.toContain("apt-rent-price-kr");
  });

  it("does not fabricate regional evidence for unsupported regions", async () => {
    const service = new BenefitToolService(new FixtureBenefitRepository());

    const response = await service.searchBenefits({
      query: "지원과 지역 데이터",
      profile: {
        region: "unknown_region",
        interests: ["housing"]
      }
    });

    expect(response.dataSections).toEqual([]);
  });

  it("locks the Daejeon Yuseong newlywed freelancer move scenario", async () => {
    const service = new BenefitToolService(new FixtureBenefitRepository());

    const response = await service.searchBenefits({
      query: "신혼부부 프리랜서가 대전 유성구로 이사할 때 확인할 주거와 고용 지원",
      profile: {
        region: "daejeon_yuseong",
        ageRange: "thirties",
        employmentStatus: "self_employed",
        householdType: "couple",
        interests: ["housing", "employment", "local"]
      }
    });

    expect(response.results.slice(0, 2).map((result) => result.id)).toEqual([
      "daejeon-newlywed-housing-loan",
      "self-employed-employment-stability"
    ]);
    expect(response.results[0]).toMatchObject({
      status: "candidate",
      reasons: expect.arrayContaining(["daejeon_yuseong 지역 조건과 일치합니다.", "나이대 조건과 일치합니다."])
    });
    expect(response.results[1]).toMatchObject({
      status: "candidate",
      reasons: expect.arrayContaining(["고용 상태 조건과 일치합니다."])
    });
    expect(response.dataSections.map((section) => section.id)).toEqual([
      "apt-rent-price-kr",
      "population-stats-kr",
      "parking-info-kr",
      "cctv-status-kr",
      "population-by-dong-kr",
      "ev-chargers-kr"
    ]);
    expect(response.dataSections.find((section) => section.id === "ev-chargers-kr")?.source.status).toBe(
      "unavailable"
    );
  });

  it("records SQLite change logs while serving tool calls", async () => {
    const dir = mkdtempSync(join(tmpdir(), "mcp-gen-ui-gateway-"));
    const store = new SnapshotStore(join(dir, "test.db"));
    const service = new BenefitToolService(new FixtureBenefitRepository(), store);

    await service.searchBenefits({ query: "장학금", profile: { studentStatus: "student" } });
    const log = await service.getChangeLog();

    expect(log.entries.length).toBeGreaterThan(0);
    store.close();
  });
});
