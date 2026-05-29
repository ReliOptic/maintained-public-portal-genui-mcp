import { z } from "zod";

export const BenefitCategorySchema = z.enum([
  "housing",
  "education",
  "employment",
  "health",
  "family",
  "youth",
  "local",
  "other"
]);

export const RecommendationStatusSchema = z.enum([
  "candidate",
  "needs_more_info",
  "not_applicable"
]);

export const UserProfileSchema = z.object({
  region: z.string().min(1).optional(),
  ageRange: z.enum(["teen", "twenties", "thirties", "forties", "fifties", "sixties_plus"]).optional(),
  studentStatus: z.enum(["student", "not_student", "unknown"]).default("unknown"),
  employmentStatus: z.enum(["employed", "self_employed", "unemployed", "unknown"]).default("unknown"),
  householdType: z.enum(["single", "couple", "family", "single_parent", "unknown"]).default("unknown"),
  interests: z.array(BenefitCategorySchema).default([])
});

export const EvidenceSchema = z.object({
  field: z.string(),
  matched: z.boolean(),
  explanation: z.string()
});

export const DataSectionSourceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  status: z.enum(["fixture", "unavailable"]),
  url: z.string().url().optional()
});

export const DataMetricSchema = z.object({
  label: z.string().min(1),
  value: z.union([z.string(), z.number()]),
  unit: z.string().optional()
});

export const DataSectionSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  region: z.string().min(1),
  source: DataSectionSourceSchema,
  metrics: z.array(DataMetricSchema).default([]),
  rows: z.array(z.record(z.union([z.string(), z.number(), z.boolean(), z.null()]))).default([]),
  generatedAt: z.string().datetime()
});

export const AdapterRefreshModeSchema = z.enum(["scheduled", "on_demand"]);
export const AdapterAvailabilitySchema = z.enum(["available", "unavailable", "parked"]);
export const AdapterCredentialBoundarySchema = z.enum(["none", "server_proxy_required", "decision_required"]);
export const AdapterTriggerIntentSchema = z.enum([
  "housing",
  "local",
  "mobility",
  "safety",
  "policy_information",
  "legal_reference"
]);

export const AdapterFetchParamsSchema = z.object({
  region: z.object({ type: z.literal("taxonomy_region_enum") }).optional(),
  period: z.object({ type: z.string().min(1) }).optional(),
  domain_filter: z.object({ type: z.literal("enum"), values: z.array(z.string().min(1)) }).optional(),
  limit: z.object({ type: z.literal("integer"), default: z.number().int().positive() }).optional()
});

export const AdapterSourceSchema = z.object({
  agency: z.string().min(1),
  api_name: z.string().min(1),
  auth_type: z.enum(["public", "key_required"]),
  status: z.enum(["fixture", "unavailable"]).optional(),
  url: z.string().url().optional()
});

const AdapterDescriptorBaseSchema = z.object({
  adapter_id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  refresh_mode: AdapterRefreshModeSchema,
  trigger_intents: z.array(AdapterTriggerIntentSchema).default([]),
  data_sections: z.array(z.string().min(1)).default([]),
  supported_regions: z.array(z.string().min(1)).default([]),
  fetch_params: AdapterFetchParamsSchema.default({}),
  source: AdapterSourceSchema
});

export const AvailableAdapterDescriptorSchema = AdapterDescriptorBaseSchema.extend({
  availability: z.literal("available"),
  output_section_id: z.string().min(1),
  credential_boundary: z.literal("none")
});

export const UnavailableAdapterDescriptorSchema = AdapterDescriptorBaseSchema.extend({
  availability: z.literal("unavailable"),
  output_section_id: z.string().min(1).optional(),
  credential_boundary: z.literal("server_proxy_required"),
  status_reason: z.string().min(1)
});

export const ParkedAdapterDescriptorSchema = AdapterDescriptorBaseSchema.extend({
  availability: z.literal("parked"),
  credential_boundary: z.literal("decision_required"),
  status_reason: z.string().min(1).optional(),
  adr_reference: z.string().min(1)
}).extend({
  status_reason: z.string().min(1),
  data_sections: z.array(z.string().min(1)).length(0).default([]),
  supported_regions: z.array(z.string().min(1)).length(0).default([])
});

export const AdapterDescriptorSchema = z.discriminatedUnion("availability", [
  AvailableAdapterDescriptorSchema,
  UnavailableAdapterDescriptorSchema,
  ParkedAdapterDescriptorSchema
]);

export const AdapterDiscoveryResponseSchema = z.object({
  resource_uri: z.literal("resource://adapters/v1").default("resource://adapters/v1"),
  adapters_version: z.string().min(1),
  adapters: z.array(AdapterDescriptorSchema),
  generated_at: z.string().datetime().optional()
});

export const BenefitSummarySchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  provider: z.string().min(1),
  category: BenefitCategorySchema,
  summary: z.string().min(1),
  status: RecommendationStatusSchema,
  reasons: z.array(z.string()).default([]),
  missingInfo: z.array(z.string()).default([])
});

export const ChecklistItemSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  required: z.boolean(),
  source: z.string().optional()
});

export const ApplicationStepSchema = z.object({
  order: z.number().int().positive(),
  title: z.string().min(1),
  description: z.string().min(1),
  requiresUserAction: z.boolean().default(true)
});

export const BenefitDetailSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  provider: z.string().min(1),
  category: BenefitCategorySchema,
  summary: z.string().min(1),
  target: z.string().min(1),
  eligibility: z.array(z.string()).default([]),
  applicationPeriod: z.string().optional(),
  fee: z.string().optional(),
  processingTime: z.string().optional(),
  documents: z.array(ChecklistItemSchema).default([]),
  applicationMethods: z.array(z.string()).default([]),
  applicationUrl: z.string().url().optional(),
  sourceUrl: z.string().url(),
  lastFetchedAt: z.string().datetime(),
  evidence: z.array(EvidenceSchema).default([])
});

export const BenefitRecordSchema = BenefitDetailSchema.extend({
  searchableText: z.string().default(""),
  regionTags: z.array(z.string()).default([]),
  ageRanges: z.array(UserProfileSchema.shape.ageRange.unwrap()).default([]),
  studentOnly: z.boolean().default(false),
  employmentStatuses: z.array(UserProfileSchema.shape.employmentStatus.removeDefault()).default([])
});

export const BenefitSearchRequestSchema = z.object({
  query: z.string().min(1),
  profile: UserProfileSchema.default({})
});

export const BenefitSearchResponseSchema = z.object({
  query: z.string(),
  profile: UserProfileSchema,
  results: z.array(BenefitSummarySchema),
  dataSections: z.array(DataSectionSchema).default([]),
  generatedAt: z.string().datetime()
});

export const ChecklistResponseSchema = z.object({
  benefitId: z.string(),
  items: z.array(ChecklistItemSchema),
  caveats: z.array(z.string()).default([])
});

export const ApplicationGuideResponseSchema = z.object({
  benefitId: z.string(),
  steps: z.array(ApplicationStepSchema),
  safetyNotice: z.string()
});

export const ChangeLogEntrySchema = z.object({
  id: z.string(),
  entityId: z.string(),
  entityType: z.literal("benefit"),
  changeType: z.enum(["created", "updated", "unchanged"]),
  summary: z.string(),
  createdAt: z.string().datetime()
});

export const ChangeLogResponseSchema = z.object({
  entityId: z.string().optional(),
  entries: z.array(ChangeLogEntrySchema)
});

export type BenefitCategory = z.infer<typeof BenefitCategorySchema>;
export type RecommendationStatus = z.infer<typeof RecommendationStatusSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
export type DataSectionSource = z.infer<typeof DataSectionSourceSchema>;
export type DataMetric = z.infer<typeof DataMetricSchema>;
export type DataSection = z.infer<typeof DataSectionSchema>;
export type AdapterRefreshMode = z.infer<typeof AdapterRefreshModeSchema>;
export type AdapterAvailability = z.infer<typeof AdapterAvailabilitySchema>;
export type AdapterCredentialBoundary = z.infer<typeof AdapterCredentialBoundarySchema>;
export type AdapterTriggerIntent = z.infer<typeof AdapterTriggerIntentSchema>;
export type AdapterFetchParams = z.infer<typeof AdapterFetchParamsSchema>;
export type AdapterSource = z.infer<typeof AdapterSourceSchema>;
export type AdapterDescriptor = z.infer<typeof AdapterDescriptorSchema>;
export type AdapterDiscoveryResponse = z.infer<typeof AdapterDiscoveryResponseSchema>;
export type BenefitSummary = z.infer<typeof BenefitSummarySchema>;
export type BenefitDetail = z.infer<typeof BenefitDetailSchema>;
export type BenefitRecord = z.infer<typeof BenefitRecordSchema>;
export type BenefitSearchRequest = z.infer<typeof BenefitSearchRequestSchema>;
export type BenefitSearchResponse = z.infer<typeof BenefitSearchResponseSchema>;
export type ChecklistResponse = z.infer<typeof ChecklistResponseSchema>;
export type ApplicationGuideResponse = z.infer<typeof ApplicationGuideResponseSchema>;
export type ChangeLogEntry = z.infer<typeof ChangeLogEntrySchema>;
export type ChangeLogResponse = z.infer<typeof ChangeLogResponseSchema>;
