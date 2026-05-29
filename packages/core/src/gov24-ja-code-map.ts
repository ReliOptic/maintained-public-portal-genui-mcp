import {
  BenefitCategorySchema,
  UserProfileSchema,
  type BenefitCategory,
  type UserProfile
} from "@mcp-gen-ui-gateway/schema";

type UserProfilePatch = {
  readonly employmentStatus?: UserProfile["employmentStatus"];
  readonly householdType?: UserProfile["householdType"];
  readonly interests?: readonly BenefitCategory[];
};

export type Gov24JaCodeMapping = {
  readonly code: string;
  readonly label: string;
  readonly profilePatch?: UserProfilePatch;
  readonly gap?: string;
};

export type Gov24JaCodeResolution =
  | {
      readonly status: "mapped";
      readonly mapping: Gov24JaCodeMapping & { readonly profilePatch: UserProfilePatch };
    }
  | {
      readonly status: "gap";
      readonly mapping: Gov24JaCodeMapping & { readonly gap: string };
    }
  | {
      readonly status: "unknown";
      readonly code: string;
      readonly gap: string;
    };

export const gov24JaCodeMappings = [
  {
    code: "JA0101",
    label: "male",
    gap: "Upstream profile intentionally has no gender field."
  },
  {
    code: "JA0102",
    label: "female",
    gap: "Upstream profile intentionally has no gender field."
  },
  {
    code: "JA0326",
    label: "worker or employee",
    profilePatch: { employmentStatus: "employed" }
  },
  {
    code: "JA0327",
    label: "job seeker or unemployed",
    profilePatch: { employmentStatus: "unemployed" }
  },
  {
    code: "JA0401",
    label: "multicultural family",
    gap: "No exact non-identifying upstream profile value exists for multicultural family status."
  },
  {
    code: "JA0403",
    label: "single-parent or grandparent family",
    profilePatch: { householdType: "single_parent" }
  },
  {
    code: "JA0404",
    label: "single-person household",
    profilePatch: { householdType: "single" }
  },
  {
    code: "JA0411",
    label: "multi-child household",
    gap: "Upstream profile has family household type but no multi-child signal."
  },
  {
    code: "JA0412",
    label: "household without home ownership",
    profilePatch: { interests: ["housing"] }
  },
  {
    code: "JA0413",
    label: "new move-in",
    gap: "Upstream profile has no relocation life-event field."
  },
  {
    code: "JA1101",
    label: "prospective founder",
    gap: "Upstream profile has no startup or founder intent field."
  },
  {
    code: "JA1102",
    label: "operating business or freelancer",
    profilePatch: { employmentStatus: "self_employed" }
  }
] as const satisfies readonly Gov24JaCodeMapping[];

const mappingsByCode = new Map<string, Gov24JaCodeMapping>(
  gov24JaCodeMappings.map((mapping) => [mapping.code, mapping])
);

export function resolveGov24JaCode(code: string): Gov24JaCodeResolution {
  const mapping = mappingsByCode.get(code);
  if (!mapping) {
    return {
      status: "unknown",
      code,
      gap: "Unknown gov24 JA code; do not infer profile values from undocumented codes."
    };
  }

  if ("profilePatch" in mapping && mapping.profilePatch) {
    validateProfilePatch(mapping.profilePatch);
    return { status: "mapped", mapping: mapping as Gov24JaCodeMapping & { readonly profilePatch: UserProfilePatch } };
  }

  return { status: "gap", mapping: mapping as Gov24JaCodeMapping & { readonly gap: string } };
}

function validateProfilePatch(profilePatch: UserProfilePatch): void {
  if (profilePatch.employmentStatus) {
    UserProfileSchema.shape.employmentStatus.parse(profilePatch.employmentStatus);
  }
  if (profilePatch.householdType) {
    UserProfileSchema.shape.householdType.parse(profilePatch.householdType);
  }
  if (profilePatch.interests) {
    for (const interest of profilePatch.interests) {
      BenefitCategorySchema.parse(interest);
    }
  }
}
