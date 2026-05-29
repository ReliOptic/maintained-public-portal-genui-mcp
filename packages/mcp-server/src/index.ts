#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { BenefitToolService, FixtureBenefitRepository, SnapshotStore } from "@mcp-gen-ui-gateway/core";
import { createGatewayServer } from "./server.js";

const repository = new FixtureBenefitRepository();
const snapshots = new SnapshotStore(process.env.MCP_GEN_UI_DB_PATH ?? "mcp-gen-ui-gateway.db");
const tools = new BenefitToolService(repository, snapshots);
const server = createGatewayServer(tools);
const transport = new StdioServerTransport();
await server.connect(transport);
