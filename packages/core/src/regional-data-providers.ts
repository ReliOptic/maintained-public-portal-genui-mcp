import { DataSectionSchema, type DataSection } from "@mcp-gen-ui-gateway/schema";
import { resolveRegionNativeCodes, type RegionNativeCodes } from "./region-code-lookup.js";

const GENERATED_AT = "2026-05-29T00:00:00.000Z";

type AptRentTransaction = {
  readonly regionKey: string;
  readonly lawdCd: string;
  readonly dealYm: string;
  readonly apartment: string;
  readonly rentType: "jeonse" | "monthly";
  readonly depositManwon: number;
  readonly monthlyRentManwon: number;
  readonly legalDong: string;
};

type PopulationStat = {
  readonly regionKey: string;
  readonly ctpvNm: string;
  readonly signguNm: string;
  readonly statYm: string;
  readonly totalPopulation: number;
  readonly totalHouseholds: number;
};

type ParkingLot = {
  readonly regionKey: string;
  readonly name: string;
  readonly kind: "public" | "private";
  readonly spaces: number;
};

type CctvInstallation = {
  readonly regionKey: string;
  readonly location: string;
  readonly cameraCount: number;
  readonly purpose: string;
};

type DongPopulation = {
  readonly regionKey: string;
  readonly dong: string;
  readonly population: number;
  readonly households: number;
};

const aptRentFixtureRows: readonly AptRentTransaction[] = [
  {
    regionKey: "daejeon_yuseong",
    lawdCd: "30200",
    dealYm: "202604",
    apartment: "Doan Xi",
    rentType: "jeonse",
    depositManwon: 32000,
    monthlyRentManwon: 0,
    legalDong: "Doan-dong"
  },
  {
    regionKey: "daejeon_yuseong",
    lawdCd: "30200",
    dealYm: "202604",
    apartment: "Yuseong Prugio",
    rentType: "jeonse",
    depositManwon: 28000,
    monthlyRentManwon: 0,
    legalDong: "Bongmyeong-dong"
  },
  {
    regionKey: "daejeon_yuseong",
    lawdCd: "30200",
    dealYm: "202604",
    apartment: "Noeun Hanshin",
    rentType: "monthly",
    depositManwon: 10000,
    monthlyRentManwon: 65,
    legalDong: "Noeun-dong"
  }
];

const populationFixtureRows: readonly PopulationStat[] = [
  {
    regionKey: "daejeon_yuseong",
    ctpvNm: "대전광역시",
    signguNm: "유성구",
    statYm: "202603",
    totalPopulation: 342000,
    totalHouseholds: 142000
  }
];

const parkingFixtureRows: readonly ParkingLot[] = [
  { regionKey: "daejeon_yuseong", name: "Yuseong Hot Spring Public Parking", kind: "public", spaces: 120 },
  { regionKey: "daejeon_yuseong", name: "Bongmyeong Private Parking", kind: "private", spaces: 64 }
];

const cctvFixtureRows: readonly CctvInstallation[] = [
  { regionKey: "daejeon_yuseong", location: "Gung-dong 123", cameraCount: 2, purpose: "crime prevention" },
  { regionKey: "daejeon_yuseong", location: "Bongmyeong-dong 20", cameraCount: 3, purpose: "traffic safety" }
];

const dongPopulationFixtureRows: readonly DongPopulation[] = [
  { regionKey: "daejeon_yuseong", dong: "Oncheon 1-dong", population: 27800, households: 13500 },
  { regionKey: "daejeon_yuseong", dong: "Noeun 1-dong", population: 31500, households: 12100 }
];

export function scheduledRegionalDataSections(region: string): DataSection[] {
  const resolution = resolveRegionNativeCodes(region);
  if (resolution.status === "gap") return [];

  return [
    buildAptRentPriceSection(resolution.codes),
    buildPopulationStatsSection(resolution.codes),
    buildParkingInfoSection(resolution.codes),
    buildCctvStatusSection(resolution.codes),
    buildPopulationByDongSection(resolution.codes),
    buildDisabledEvChargersSection(resolution.codes)
  ];
}

function buildAptRentPriceSection(codes: RegionNativeCodes): DataSection {
  const rows = aptRentFixtureRows.filter((row) => row.regionKey === codes.regionKey && row.lawdCd === codes.lawdCd);
  const jeonseRows = rows.filter((row) => row.rentType === "jeonse");
  const monthlyRows = rows.filter((row) => row.rentType === "monthly");
  const avgJeonse = average(jeonseRows.map((row) => row.depositManwon));
  const avgMonthlyRent = average(monthlyRows.map((row) => row.monthlyRentManwon));

  return DataSectionSchema.parse({
    id: "apt-rent-price-kr",
    title: "Apartment rent transaction snapshot",
    region: codes.regionKey,
    source: {
      id: "apt-rent-price-kr",
      name: "MOLIT apartment rent transactions",
      status: "fixture",
      url: "https://www.data.go.kr/data/15126474/openapi.do"
    },
    metrics: [
      { label: "LAWD_CD", value: codes.lawdCd },
      { label: "Average jeonse deposit", value: avgJeonse, unit: "10k KRW" },
      { label: "Average monthly rent", value: avgMonthlyRent, unit: "10k KRW" },
      { label: "Transaction count", value: rows.length, unit: "rows" }
    ],
    rows: rows.map((row) => ({
      dealYm: row.dealYm,
      apartment: row.apartment,
      rentType: row.rentType,
      depositManwon: row.depositManwon,
      monthlyRentManwon: row.monthlyRentManwon,
      legalDong: row.legalDong
    })),
    generatedAt: GENERATED_AT
  });
}

function buildPopulationStatsSection(codes: RegionNativeCodes): DataSection {
  const rows = populationFixtureRows.filter(
    (row) => row.regionKey === codes.regionKey && row.ctpvNm === codes.ctpvNm && row.signguNm === codes.signguNm
  );
  const totalPopulation = sum(rows.map((row) => row.totalPopulation));
  const totalHouseholds = sum(rows.map((row) => row.totalHouseholds));
  const avgHouseholdSize = totalHouseholds === 0 ? 0 : Number((totalPopulation / totalHouseholds).toFixed(1));

  return DataSectionSchema.parse({
    id: "population-stats-kr",
    title: "Resident population snapshot",
    region: codes.regionKey,
    source: {
      id: "population-stats-kr",
      name: "MOIS resident population status",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108071/openapi.do"
    },
    metrics: [
      { label: "ctpvNm", value: codes.ctpvNm },
      { label: "signguNm", value: codes.signguNm },
      { label: "Total population", value: totalPopulation, unit: "people" },
      { label: "Total households", value: totalHouseholds, unit: "households" },
      { label: "Average household size", value: avgHouseholdSize, unit: "people" }
    ],
    rows: rows.map((row) => ({
      statYm: row.statYm,
      ctpvNm: row.ctpvNm,
      signguNm: row.signguNm,
      totalPopulation: row.totalPopulation,
      totalHouseholds: row.totalHouseholds
    })),
    generatedAt: GENERATED_AT
  });
}

function buildParkingInfoSection(codes: RegionNativeCodes): DataSection {
  const rows = parkingFixtureRows.filter((row) => row.regionKey === codes.regionKey);
  const publicCount = rows.filter((row) => row.kind === "public").length;
  const privateCount = rows.filter((row) => row.kind === "private").length;

  return DataSectionSchema.parse({
    id: "parking-info-kr",
    title: "Parking lot snapshot",
    region: codes.regionKey,
    source: {
      id: "parking-info-kr",
      name: "Yuseong-gu parking lot information",
      status: "fixture",
      url: "https://www.data.go.kr/data/15110051/fileData.do"
    },
    metrics: [
      { label: "Parking lots", value: rows.length, unit: "lots" },
      { label: "Public lots", value: publicCount, unit: "lots" },
      { label: "Private lots", value: privateCount, unit: "lots" },
      { label: "Total spaces", value: sum(rows.map((row) => row.spaces)), unit: "spaces" }
    ],
    rows,
    generatedAt: GENERATED_AT
  });
}

function buildCctvStatusSection(codes: RegionNativeCodes): DataSection {
  const rows = cctvFixtureRows.filter((row) => row.regionKey === codes.regionKey);

  return DataSectionSchema.parse({
    id: "cctv-status-kr",
    title: "CCTV installation snapshot",
    region: codes.regionKey,
    source: {
      id: "cctv-status-kr",
      name: "Yuseong-gu CCTV installation status",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108837/fileData.do"
    },
    metrics: [
      { label: "Installation points", value: rows.length, unit: "points" },
      { label: "Total cameras", value: sum(rows.map((row) => row.cameraCount)), unit: "cameras" }
    ],
    rows,
    generatedAt: GENERATED_AT
  });
}

function buildPopulationByDongSection(codes: RegionNativeCodes): DataSection {
  const rows = dongPopulationFixtureRows.filter((row) => row.regionKey === codes.regionKey);

  return DataSectionSchema.parse({
    id: "population-by-dong-kr",
    title: "Population by administrative dong",
    region: codes.regionKey,
    source: {
      id: "population-by-dong-kr",
      name: "MOIS population by administrative dong",
      status: "fixture",
      url: "https://www.data.go.kr/data/15108071/openapi.do"
    },
    metrics: [
      { label: "Dong count", value: rows.length, unit: "dongs" },
      { label: "Fixture population", value: sum(rows.map((row) => row.population)), unit: "people" },
      { label: "Fixture households", value: sum(rows.map((row) => row.households)), unit: "households" }
    ],
    rows,
    generatedAt: GENERATED_AT
  });
}

function buildDisabledEvChargersSection(codes: RegionNativeCodes): DataSection {
  return DataSectionSchema.parse({
    id: "ev-chargers-kr",
    title: "EV charger availability",
    region: codes.regionKey,
    source: {
      id: "ev-chargers-kr",
      name: "Korea Environment Corporation EV charger status",
      status: "unavailable",
      url: "https://www.data.go.kr/data/15076352/openapi.do"
    },
    metrics: [
      { label: "zscode", value: codes.zscode },
      { label: "Activation status", value: "disabled until on-demand proxy and failure disclosure exist" }
    ],
    rows: [],
    generatedAt: GENERATED_AT
  });
}

function average(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return Math.round(sum(values) / values.length);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}
