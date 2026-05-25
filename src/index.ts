#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { CatalogStore } from "./services/catalog.js";
import { logJson } from "./utils/logger.js";

const warnIfCatalogIsStale = (store: CatalogStore): void => {
  const freshness = store.getFreshness();
  if (!freshness.stale) return;
  logJson({
    level: "warn",
    event: "catalog_stale",
    message: "bundled catalog snapshot may be stale",
    details: {
      latest_entry_date: freshness.latest_entry_date,
      age_days: freshness.age_days,
      threshold_days: freshness.threshold_days,
    },
  });
};

const main = async (): Promise<void> => {
  const started = performance.now();
  const store = new CatalogStore();
  warnIfCatalogIsStale(store);
  const server = createServer(store);
  await server.connect(new StdioServerTransport());
  logJson({ level: "info", event: "server_ready", message: "portal genui mcp ready", details: { elapsed_ms: Math.round(performance.now() - started) } });
};

main().catch((error: unknown) => {
  logJson({ level: "error", event: "server_failed", message: "failed to start", details: { error: String(error) } });
  process.exit(1);
});
