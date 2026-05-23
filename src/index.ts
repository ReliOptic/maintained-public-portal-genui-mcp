#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { logJson } from "./utils/logger.js";

const main = async (): Promise<void> => {
  const started = performance.now();
  const server = createServer();
  await server.connect(new StdioServerTransport());
  logJson({ level: "info", event: "server_ready", message: "portal genui mcp ready", details: { elapsed_ms: Math.round(performance.now() - started) } });
};

main().catch((error: unknown) => {
  logJson({ level: "error", event: "server_failed", message: "failed to start", details: { error: String(error) } });
  process.exit(1);
});
