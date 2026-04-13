import type { AmbiguityEntryView, PageId, Selection, Tone } from "./types";

export type VocabularyPack = {
  id: string;
  label: string;
  pageLabels: Record<PageId, string>;
  selectionKindLabels: Record<Selection["kind"], string>;
  termLabels: Record<string, string>;
  ambiguityClassLabels: Record<string, string>;
};

const AGILE_SOFTWARE_VOCABULARY_PACK: VocabularyPack = {
  id: "agile_software",
  label: "Agile Software Delivery",
  pageLabels: {
    requirements: "Requirements View",
    process: "Process View",
    home: "Overview",
    graphs: "Project Map",
    runtime: "Delivery Activity",
    continuations: "Open Threads",
    evidence: "Policy & Evidence",
    builder: "Model Catalog",
    provenance: "History",
  },
  selectionKindLabels: {
    requirement: "Requirement",
    surface: "Surface",
    asset: "Artifact",
    asset_family: "Artifact Family",
    binding: "Workflow Binding",
    collection: "Artifact Collection",
    ambiguity: "Blocker",
    edge_contract: "Workflow Handoff",
    function: "Internal Function",
    program: "Delivery Program",
    workorder: "Work Item",
    work_act_type: "Work Pattern",
    graph_function: "Workflow Program",
    run: "Run",
    graph_call: "Workflow Call",
    continuation: "Open Thread",
    frame: "Execution Frame",
    event: "Activity Event",
    graph: "Project Map",
  },
  termLabels: {
    requirement_surface: "Backlog / Requirements",
    feature_decomp_surface: "Epics / Feature Breakdown",
    ambiguity_register_surface: "Blockers / Open Decisions",
    test_execution_contract: "Test Automation Capability",
    deployment_contract: "Release / Deployment Capability",
    runtime_observation_contract: "Monitoring Capability",
    release_surface: "Release Readiness",
    testcase_authority_surface: "Acceptance Tests",
    partially_realized: "In Progress",
    pending_capability: "Blocked by Missing Capability",
    realized: "Ready",
    planned: "Planned",
    specified: "Specified",
    not_started: "Not Started",
    converged: "Ready",
    pending: "Pending",
    active: "Active",
    gated: "Awaiting Review",
    blocked: "Blocked",
    attention: "Needs Attention",
  },
  ambiguityClassLabels: {
    execution_stage_without_declared_capability: "Delivery Stage Missing Required Capability",
    declared_capability_absent_but_side_effect_observed: "Observed Delivery Evidence Without Capability Declaration",
  },
};

export const ACTIVE_VOCABULARY_PACK = AGILE_SOFTWARE_VOCABULARY_PACK;

export type PresentedAmbiguity = {
  classificationLabel: string;
  headline: string;
  summary: string;
  statusLabel: string;
  capabilityLabel: string | null;
};

export function labelPage(pageId: PageId) {
  return ACTIVE_VOCABULARY_PACK.pageLabels[pageId];
}

export function labelSelectionKind(kind: Selection["kind"]) {
  return ACTIVE_VOCABULARY_PACK.selectionKindLabels[kind];
}

export function labelTone(tone: Tone) {
  return ACTIVE_VOCABULARY_PACK.termLabels[tone] ?? tone;
}

export function labelDeliveryStatus(status: string | null | undefined) {
  return labelCanonicalTerm(status, "Unknown");
}

export function labelCanonicalTerm(value: string | null | undefined, fallback = "None") {
  const canonical = value?.trim();
  if (!canonical) {
    return fallback;
  }
  return (
    ACTIVE_VOCABULARY_PACK.termLabels[canonical] ??
    ACTIVE_VOCABULARY_PACK.ambiguityClassLabels[canonical] ??
    humanizeCanonicalIdentifier(canonical)
  );
}

export function describeCanonicalTerm(value: string | null | undefined, fallback = "None") {
  const canonical = value?.trim();
  if (!canonical) {
    return fallback;
  }
  const label = labelCanonicalTerm(canonical, fallback);
  return label === canonical ? label : `${label} (${canonical})`;
}

export function resolveAmbiguityCapabilitySurface(entry: AmbiguityEntryView) {
  const observed = entry.observed_state?.field_name;
  if (typeof observed === "string" && observed.trim()) {
    return observed.trim();
  }
  const capability = entry.capability_surface?.trim();
  return capability ? capability : null;
}

export function presentAmbiguity(entry: AmbiguityEntryView): PresentedAmbiguity {
  const capabilitySurface = resolveAmbiguityCapabilitySurface(entry);
  const capabilityLabel = capabilitySurface ? describeCanonicalTerm(capabilitySurface) : null;

  if (
    entry.decision_status === "pending_capability" ||
    entry.status === "pending_capability" ||
    entry.policy_action === "pending_capability"
  ) {
    return {
      classificationLabel: "Blocked by Missing Capability",
      headline: "Blocked by missing capability",
      summary: capabilityLabel
        ? `${capabilityLabel} is not declared for the current delivery lane.`
        : entry.operator_headline,
      statusLabel: labelDeliveryStatus("pending_capability"),
      capabilityLabel,
    };
  }

  if (entry.blocking || entry.hard_stop) {
    return {
      classificationLabel: "Active blocker",
      headline: "Active blocker",
      summary: entry.operator_headline,
      statusLabel: labelDeliveryStatus(entry.decision_status || entry.status),
      capabilityLabel,
    };
  }

  return {
    classificationLabel:
      ACTIVE_VOCABULARY_PACK.ambiguityClassLabels[entry.class] ?? humanizeCanonicalIdentifier(entry.class),
    headline: "Open decision",
    summary: entry.operator_headline,
    statusLabel: labelDeliveryStatus(entry.decision_status || entry.status),
    capabilityLabel,
  };
}

function humanizeCanonicalIdentifier(value: string) {
  if (looksLikeReference(value) || value.includes("/") || /\s/.test(value)) {
    return value;
  }
  const segments = value.split(".");
  const lastSegment = segments[segments.length - 1] ?? value;
  if (looksLikeReference(lastSegment)) {
    return lastSegment;
  }
  return lastSegment
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => {
      if (/^[A-Z0-9]+$/.test(part)) {
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(" ");
}

function looksLikeReference(value: string) {
  return /^(REQ|RIC|SCN|INT)-/.test(value) || /^[A-Z0-9-]+$/.test(value);
}
