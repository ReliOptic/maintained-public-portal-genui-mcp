import path from "node:path";

export interface RuntimeConfig {
  readonly catalogPath: string;
  readonly welfareApiKey?: string;
}

export const getRuntimeConfig = (): RuntimeConfig => ({
  catalogPath: process.env.PORTAL_CATALOG_DB ?? path.resolve("catalog", "compiled.sqlite"),
  ...(process.env.WELFARE_API_KEY ? { welfareApiKey: process.env.WELFARE_API_KEY } : {}),
});
