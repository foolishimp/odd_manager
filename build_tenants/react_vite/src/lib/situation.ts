import { presentAmbiguity, resolveAmbiguityCapabilitySurface, describeCanonicalTerm } from "./presentation";
import type { AssetView, ManagerWorld, RequirementView, Tone } from "./types";

export type SituationBlocker = {
  id: string;
  headline: string;
  summary: string;
  tone: Tone;
  capabilityLabel: string | null;
  nextStep: string | null;
};

export type SituationCapabilityGap = {
  canonicalName: string;
  label: string;
  count: number;
  blockerIds: string[];
};

export type SituationRequirement = {
  id: string;
  title: string;
  summary: string;
  priority: string | null;
  status: string | null;
  tone: Tone;
  codeRefCount: number;
  testRefCount: number;
  acceptanceCount: number;
};

export type SituationModel = {
  headline: string;
  summary: string;
  blockerCount: number;
  openDecisionCount: number;
  missingCapabilityCount: number;
  blockers: SituationBlocker[];
  capabilityGaps: SituationCapabilityGap[];
  priorityRequirements: SituationRequirement[];
  requirementStatusSummary: Array<{
    id: string;
    label: string;
    count: number;
    tone: Tone;
  }>;
  planningSurfaces: Array<{
    id: "requirements" | "goals" | "epics" | "acceptance" | "release";
    label: string;
    count: number;
    assetIds: string[];
  }>;
};

export function buildSituationModel(world: ManagerWorld): SituationModel {
  const activeAmbiguities = world.domain.ambiguity_register.ambiguities;
  const blockingEntries = activeAmbiguities.filter(
    (entry) =>
      entry.blocking ||
      entry.hard_stop ||
      entry.decision_status === "pending_capability" ||
      entry.status === "pending_capability",
  );

  const blockers = blockingEntries.map((entry) => {
    const presented = presentAmbiguity(entry);
    return {
      id: entry.ambiguity_id,
      headline: presented.headline,
      summary: presented.summary,
      tone:
        entry.blocking || entry.hard_stop
          ? "blocked"
          : entry.decision_status === "pending_capability"
            ? "attention"
            : "gated",
      capabilityLabel: presented.capabilityLabel,
      nextStep: entry.expected_resolving_edge ? describeCanonicalTerm(entry.expected_resolving_edge) : null,
    } satisfies SituationBlocker;
  });

  const capabilityBuckets = new Map<string, SituationCapabilityGap>();
  for (const entry of activeAmbiguities) {
    const canonicalName = resolveAmbiguityCapabilitySurface(entry);
    if (!canonicalName) {
      continue;
    }
    const bucket = capabilityBuckets.get(canonicalName) ?? {
      canonicalName,
      label: describeCanonicalTerm(canonicalName),
      count: 0,
      blockerIds: [],
    };
    bucket.count += 1;
    bucket.blockerIds.push(entry.ambiguity_id);
    capabilityBuckets.set(canonicalName, bucket);
  }

  return {
    headline: world.overview.headline,
    summary: world.overview.summary,
    blockerCount: blockingEntries.length,
    openDecisionCount: activeAmbiguities.length,
    missingCapabilityCount:
      world.domain.ambiguity_register.summary.pending_capability ??
      activeAmbiguities.filter((entry) => entry.decision_status === "pending_capability").length,
    blockers,
    capabilityGaps: [...capabilityBuckets.values()].sort((left, right) => right.count - left.count),
    priorityRequirements: buildPriorityRequirements(world.domain.requirements),
    requirementStatusSummary: buildRequirementStatusSummary(world.domain.requirements),
    planningSurfaces: buildPlanningSurfaces(world.domain.assets),
  };
}

function buildPlanningSurfaces(assets: AssetView[]) {
  const buckets: Array<{
    id: "requirements" | "goals" | "epics" | "acceptance" | "release";
    label: string;
    matches: (asset: AssetView) => boolean;
  }> = [
    {
      id: "requirements",
      label: "Backlog / Requirements",
      matches: (asset) => matchesAsset(asset, ["requirement_surface"], ["specification/requirements"]),
    },
    {
      id: "goals",
      label: "Goals",
      matches: (asset) => matchesAsset(asset, ["goal_surface"], ["specification/goals.md"]),
    },
    {
      id: "epics",
      label: "Epics / Feature Breakdown",
      matches: (asset) =>
        matchesAsset(asset, ["feature_decomp_surface"], ["feature-decomp", "feature_decomp"]),
    },
    {
      id: "acceptance",
      label: "Acceptance Tests",
      matches: (asset) =>
        matchesAsset(asset, ["testcase_authority_surface"], ["testcase-authority", "testcase_authority"]),
    },
    {
      id: "release",
      label: "Release Readiness",
      matches: (asset) => matchesAsset(asset, ["release_surface"], ["release"]),
    },
  ];

  return buckets.map((bucket) => {
    const matched = assets.filter(bucket.matches);
    return {
      id: bucket.id,
      label: bucket.label,
      count: matched.length,
      assetIds: matched.map((asset) => asset.asset_id),
    };
  });
}

function matchesAsset(asset: AssetView, declaredTypeNeedles: string[], pathNeedles: string[]) {
  const declaredType = String(asset.declared_type ?? "").toLowerCase();
  const assetId = String(asset.asset_id ?? "").toLowerCase();
  const relativePath = String((asset.metadata ?? {}).relative_path ?? "").toLowerCase();
  return (
    declaredTypeNeedles.some((needle) => declaredType.includes(needle)) ||
    pathNeedles.some((needle) => relativePath.includes(needle)) ||
    pathNeedles.some((needle) => assetId.includes(needle))
  );
}

function buildPriorityRequirements(requirements: RequirementView[]): SituationRequirement[] {
  return [...requirements]
    .sort((left, right) => compareRequirementPriority(left, right))
    .slice(0, 8)
    .map((requirement) => ({
      id: requirement.requirement_id,
      title: requirement.title,
      summary: requirement.summary,
      priority: requirement.priority,
      status: requirement.status,
      tone: requirement.delivery_status,
      codeRefCount: requirement.code_refs.length,
      testRefCount:
        requirement.test_refs.length +
        requirement.test_claim_refs.length +
        requirement.testcase_authority_refs.length,
      acceptanceCount: requirement.acceptance_criteria.length,
    }));
}

function buildRequirementStatusSummary(requirements: RequirementView[]) {
  const counts = new Map<string, { id: string; label: string; count: number; tone: Tone }>();
  for (const requirement of requirements) {
    const status = requirement.status?.trim() || "unspecified";
    const existing = counts.get(status) ?? {
      id: status,
      label: describeCanonicalTerm(status, "Unspecified"),
      count: 0,
      tone: requirement.delivery_status,
    };
    existing.count += 1;
    counts.set(status, existing);
  }
  return [...counts.values()].sort((left, right) => right.count - left.count);
}

function compareRequirementPriority(left: RequirementView, right: RequirementView) {
  const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
  if (byPriority !== 0) {
    return byPriority;
  }
  const byTone = toneRank(left.delivery_status) - toneRank(right.delivery_status);
  if (byTone !== 0) {
    return byTone;
  }
  return left.requirement_id.localeCompare(right.requirement_id);
}

function priorityRank(priority: string | null | undefined) {
  const value = priority?.trim().toLowerCase();
  if (value === "critical") {
    return 4;
  }
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  if (value === "low") {
    return 1;
  }
  return 0;
}

function toneRank(tone: Tone) {
  if (tone === "blocked") {
    return 0;
  }
  if (tone === "attention") {
    return 1;
  }
  if (tone === "active") {
    return 2;
  }
  if (tone === "pending") {
    return 3;
  }
  if (tone === "gated") {
    return 4;
  }
  return 5;
}
