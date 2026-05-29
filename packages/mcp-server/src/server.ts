import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getAdapterDiscovery, type BenefitToolService } from "@mcp-gen-ui-gateway/core";
import { AdapterDiscoveryResponseSchema, BenefitSearchRequestSchema } from "@mcp-gen-ui-gateway/schema";

const ADAPTER_DISCOVERY_URI = "resource://adapters/v1";

export function createGatewayServer(tools: BenefitToolService): McpServer {
  const server = new McpServer({
    name: "mcp-gen-ui-gateway",
    version: "0.2.0"
  });

  server.registerResource(
    "adapter-discovery",
    ADAPTER_DISCOVERY_URI,
    {
      title: "Adapter discovery",
      description: "Discovery document for available, unavailable, and parked public-data adapters.",
      mimeType: "application/json"
    },
    () => jsonResourceContents(ADAPTER_DISCOVERY_URI, AdapterDiscoveryResponseSchema.parse(getAdapterDiscovery()))
  );

  server.tool(
    "searchBenefits",
    "Find public-benefit candidates from non-identifying user profile conditions.",
    BenefitSearchRequestSchema.shape,
    async (input) => jsonToolResult(await tools.searchBenefits(input))
  );

  server.tool(
    "getBenefitDetail",
    "Return structured detail for a benefit candidate.",
    { id: z.string().min(1) },
    async ({ id }) => jsonToolResult(await tools.getBenefitDetail(id))
  );

  server.tool(
    "buildChecklist",
    "Build a preparation checklist for a benefit application.",
    { benefitId: z.string().min(1) },
    async ({ benefitId }) => jsonToolResult(await tools.buildChecklist(benefitId))
  );

  server.tool(
    "getApplicationGuide",
    "Return user-action-only application guidance for a benefit.",
    { benefitId: z.string().min(1) },
    async ({ benefitId }) => jsonToolResult(await tools.getApplicationGuide(benefitId))
  );

  server.tool(
    "getChangeLog",
    "Return snapshot and change-log entries for all benefits or one benefit.",
    { entityId: z.string().optional() },
    async ({ entityId }) => jsonToolResult(await tools.getChangeLog(entityId))
  );

  return server;
}

export function jsonToolResult(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}

export function jsonResourceContents(uri: string, value: unknown) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text: JSON.stringify(value, null, 2)
      }
    ]
  };
}
