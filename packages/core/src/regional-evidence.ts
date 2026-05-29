import type { DataSection } from "@mcp-gen-ui-gateway/schema";
import { scheduledRegionalDataSections } from "./regional-data-providers.js";

export function regionalEvidenceForRegion(region?: string): DataSection[] {
  if (!region) return [];
  return scheduledRegionalDataSections(region);
}
