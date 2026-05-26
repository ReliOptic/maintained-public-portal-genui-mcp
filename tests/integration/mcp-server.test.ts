import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { getDefaultEnvironment, StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const payload = (result: unknown): Record<string, unknown> => {
  if (!isRecord(result) || !isRecord(result.structuredContent)) return {};
  return result.structuredContent;
};

describe("MCP stdio server", () => {
  const client = new Client({ name: "portal-genui-test", version: "0.1.0" });
  const transport = new StdioClientTransport({
    command: "node",
    args: ["dist/index.js"],
    cwd: process.cwd(),
    env: { ...getDefaultEnvironment(), PORTAL_CATALOG_DB: "catalog/compiled.sqlite" },
    stderr: "pipe",
  });

  beforeAll(async () => {
    await client.connect(transport);
  });

  afterAll(async () => {
    await client.close();
  });

  it("lists the four v0.1 tools and taxonomy/adapters resources", async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name).sort()).toEqual([
      "compose_genui_artifact",
      "get_entry_detail",
      "rank_portal_entries",
      "search_portal_entries",
    ]);
    const resources = await client.listResources();
    const resourceUris = resources.resources.map((resource) => resource.uri).sort();
    expect(resourceUris).toContain("resource://evidence/v1.0");
    expect(resourceUris).toContain("resource://adapters/v1");
    const resource = await client.readResource({ uri: "resource://taxonomy/v1.0" });
    expect(resource.contents[0]?.mimeType).toBe("application/json");
  });

  it("answers search, rank, detail, and compose calls", async () => {
    const search = payload(await client.callTool({ name: "search_portal_entries", arguments: { query: "신고", limit: 1, include_debug: true } }));
    const entries = search.entries as readonly Record<string, unknown>[];
    const entryId = String(entries[0]?.entry_id);
    expect(entryId).toBeTruthy();
    expect(payload(await client.callTool({ name: "rank_portal_entries", arguments: { intent: ["certificate_issue"], top_k: 2 } })).count).toBe(2);
    expect(payload(await client.callTool({ name: "get_entry_detail", arguments: { entry_id: entryId } })).entry).toBeDefined();
    const compose = payload(await client.callTool({ name: "compose_genui_artifact", arguments: { entry_ids: [entryId], frame_segment: "general" } }));
    expect(compose.artifact).toBeDefined();
    expect((compose.artifact as Record<string, unknown>).data_sections).toEqual([]);
  });
});
