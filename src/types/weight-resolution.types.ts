import type { WeightSnapshot } from "./ranking.js";

export type WeightSource = "host_proposed" | "compositional_no_rationale" | "compositional_no_override" | "compositional_total_zero";

export interface WeightResolution {
  readonly weights: WeightSnapshot;
  readonly weight_source: WeightSource;
}
