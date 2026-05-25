import path from "node:path";

export interface RuntimeConfig {
  readonly catalogPath: string;
}

export const getRuntimeConfig = (): RuntimeConfig => ({
  catalogPath: process.env.PORTAL_CATALOG_DB ?? path.resolve("catalog", "compiled.sqlite"),
});
