import { describe, expect, it } from "vitest";
import { scheduledRegionalDataSections } from "./regional-data-providers.js";
import { regionalEvidenceForRegion } from "./regional-evidence.js";

describe("scheduled regional data providers", () => {
  it("filters fixture-backed provider output by the validated native region lookup", () => {
    expect(scheduledRegionalDataSections("unknown_region")).toEqual([]);
    expect(regionalEvidenceForRegion("unknown_region")).toEqual([]);

    const sections = scheduledRegionalDataSections("daejeon_yuseong");

    expect(sections.map((section) => section.id)).toEqual([
      "apt-rent-price-kr",
      "population-stats-kr",
      "parking-info-kr",
      "cctv-status-kr",
      "population-by-dong-kr",
      "ev-chargers-kr"
    ]);
    expect(sections.every((section) => section.region === "daejeon_yuseong")).toBe(true);
  });

  it("aggregates apartment rent fixture rows into a DataSection summary", () => {
    const [aptRentSection] = scheduledRegionalDataSections("daejeon_yuseong");

    expect(aptRentSection).toMatchObject({
      id: "apt-rent-price-kr",
      source: { status: "fixture" }
    });
    expect(aptRentSection?.metrics).toEqual(
      expect.arrayContaining([
        { label: "LAWD_CD", value: "30200" },
        { label: "Average jeonse deposit", value: 30000, unit: "10k KRW" },
        { label: "Average monthly rent", value: 65, unit: "10k KRW" },
        { label: "Transaction count", value: 3, unit: "rows" }
      ])
    );
    expect(aptRentSection?.rows).toHaveLength(3);
  });

  it("uses ctpvNm and signguNm for the population DataSection", () => {
    const populationSection = scheduledRegionalDataSections("대전광역시 유성구").find(
      (section) => section.id === "population-stats-kr"
    );

    expect(populationSection?.metrics).toEqual(
      expect.arrayContaining([
        { label: "ctpvNm", value: "대전광역시" },
        { label: "signguNm", value: "유성구" },
        { label: "Total population", value: 342000, unit: "people" },
        { label: "Total households", value: 142000, unit: "households" },
        { label: "Average household size", value: 2.4, unit: "people" }
      ])
    );
  });

  it("adds the remaining scheduled providers and discloses the disabled EV path", () => {
    const sections = scheduledRegionalDataSections("daejeon_yuseong");

    expect(sections.find((section) => section.id === "parking-info-kr")?.metrics).toEqual(
      expect.arrayContaining([
        { label: "Parking lots", value: 2, unit: "lots" },
        { label: "Total spaces", value: 184, unit: "spaces" }
      ])
    );
    expect(sections.find((section) => section.id === "cctv-status-kr")?.metrics).toEqual(
      expect.arrayContaining([{ label: "Total cameras", value: 5, unit: "cameras" }])
    );
    expect(sections.find((section) => section.id === "population-by-dong-kr")?.metrics).toEqual(
      expect.arrayContaining([{ label: "Dong count", value: 2, unit: "dongs" }])
    );
    expect(sections.find((section) => section.id === "ev-chargers-kr")).toMatchObject({
      source: { status: "unavailable" },
      rows: []
    });
  });

  it("feeds all regional providers into regional evidence output", () => {
    expect(regionalEvidenceForRegion("daejeon_yuseong").map((section) => section.id)).toEqual([
      "apt-rent-price-kr",
      "population-stats-kr",
      "parking-info-kr",
      "cctv-status-kr",
      "population-by-dong-kr",
      "ev-chargers-kr"
    ]);
  });
});
