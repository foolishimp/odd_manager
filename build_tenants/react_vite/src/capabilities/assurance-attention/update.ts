import { assuranceAttentionIdentity } from "@odd-manager/developer-control-contracts";
import type {
  AssuranceSnapshot,
  ProjectRef,
  ProjectRevision,
} from "@odd-manager/developer-control-contracts";
import type { CapabilityUpdate } from "../../contracts/developer-control";
import type { AssuranceAttentionMessage } from "./messages";
import type {
  AssuranceAttentionCommand,
  AssuranceInspectorFocusBasis,
  AssuranceAttentionState,
} from "./state";

const INSPECT_REACTION = "reaction://odd_manager/open-run-inspector";

function sameBasis(left: ProjectRevision | null, right: ProjectRevision | null) {
  return Boolean(
    left
    && right
    && left.kind === right.kind
    && left.revision === right.revision
    && left.dirty === right.dirty
    && left.sourceDigest === right.sourceDigest
    && left.specificationDigest === right.specificationDigest,
  );
}

function sameProject(left: ProjectRef | null, right: ProjectRef | null) {
  return Boolean(
    left
    && right
    && left.id === right.id
    && left.root === right.root
    && left.label === right.label
    && left.publishedProductRef === right.publishedProductRef,
  );
}

function statusCount(
  rows: Array<{ status: string }>,
  status: string,
) {
  return rows.filter((entry) => entry.status === status).length;
}

function blockingAttentionCount(snapshot: AssuranceSnapshot) {
  return snapshot.attentionItems.filter((entry) => entry.severity === "blocking").length;
}

function sameStringList(left: string[], right: string[]) {
  return (
    left.length === right.length
    && left.every((entry, index) => entry === right[index])
  );
}

function summaryMatches(snapshot: AssuranceSnapshot) {
  const gateCounts = {
    total: snapshot.gateAssessments.length,
    satisfied: statusCount(snapshot.gateAssessments, "satisfied"),
    failed: statusCount(snapshot.gateAssessments, "failed"),
    missing: statusCount(snapshot.gateAssessments, "missing")
      + statusCount(snapshot.gateAssessments, "required"),
    stale: statusCount(snapshot.gateAssessments, "stale"),
    waitingHuman: statusCount(snapshot.gateAssessments, "waiting_human"),
  };
  const assetCounts = {
    total: snapshot.assetDeliveries.length,
    delivered: statusCount(snapshot.assetDeliveries, "delivered"),
    failed: statusCount(snapshot.assetDeliveries, "failed"),
    missing: statusCount(snapshot.assetDeliveries, "missing")
      + statusCount(snapshot.assetDeliveries, "expected"),
    stale: statusCount(snapshot.assetDeliveries, "stale"),
  };
  let posture: AssuranceSnapshot["summary"]["posture"] = "partial";
  if (snapshot.catalogAdmission.status !== "ready") posture = "unsupported";
  else if (!snapshot.execution) posture = "unassessed";
  else if (gateCounts.failed > 0 || assetCounts.failed > 0) posture = "failed";
  else if (gateCounts.stale > 0 || assetCounts.stale > 0) posture = "stale";
  else if (gateCounts.waitingHuman > 0) posture = "waiting_human";
  else if (gateCounts.missing > 0 || assetCounts.missing > 0) posture = "partial";
  else if (
    gateCounts.total + assetCounts.total > 0
    && gateCounts.satisfied === gateCounts.total
    && assetCounts.delivered === assetCounts.total
  ) posture = "verified";
  const summary = snapshot.summary;
  return summary.posture === posture
    && summary.gateCounts.total === gateCounts.total
    && summary.gateCounts.satisfied === gateCounts.satisfied
    && summary.gateCounts.failed === gateCounts.failed
    && summary.gateCounts.missing === gateCounts.missing
    && summary.gateCounts.stale === gateCounts.stale
    && summary.gateCounts.waitingHuman === gateCounts.waitingHuman
    && summary.assetCounts.total === assetCounts.total
    && summary.assetCounts.delivered === assetCounts.delivered
    && summary.assetCounts.failed === assetCounts.failed
    && summary.assetCounts.missing === assetCounts.missing
    && summary.assetCounts.stale === assetCounts.stale
    && summary.blockingAttentionCount === blockingAttentionCount(snapshot);
}

type AssuranceCatalogGate = NonNullable<
  AssuranceSnapshot["catalogAdmission"]["catalog"]
>["gates"][number];

function satisfiedDecisionMatchesCatalog(
  assessment: AssuranceSnapshot["gateAssessments"][number],
  definition: AssuranceCatalogGate,
) {
  if (assessment.status !== "satisfied" || assessment.regime === "F_D") return true;
  const requirement = definition.positiveDecisionRequirement;
  const decision = assessment.decision;
  if (
    !requirement
    || !decision
    || requirement.kind !== decision.kind
    || requirement.authorityRef !== decision.authorityRef
    || !sameStringList(requirement.basisRefs, decision.basisRefs)
  ) return false;

  if (
    assessment.regime === "F_P"
    && requirement.kind === "probabilistic"
    && decision.kind === "probabilistic"
  ) {
    return (
      decision.evaluatorRef === requirement.evaluatorRef
      && decision.outcome === "satisfied"
      && decision.facts.length === requirement.requiredFactRefs.length
      && decision.facts.every((fact, index) => (
        fact.factRef === requirement.requiredFactRefs[index]
        && fact.outcome === "satisfied"
      ))
    );
  }

  if (
    assessment.regime === "F_H"
    && requirement.kind === "human"
    && decision.kind === "human"
  ) {
    return (
      requirement.requiredOutcome === "approved"
      && decision.decisionRef === requirement.decisionRef
      && decision.outcome === requirement.requiredOutcome
      && decision.actorRef.trim().length > 0
    );
  }

  return false;
}

function catalogMatchesSnapshot(
  snapshot: AssuranceSnapshot,
  project: ProjectRef,
) {
  const admission = snapshot.catalogAdmission;
  const catalog = admission.catalog;
  if (
    (admission.status === "ready" && (!catalog || admission.reason !== null))
    || (admission.status !== "ready" && admission.reason === null)
  ) return false;
  if (admission.status !== "ready") {
    return (
      snapshot.gateAssessments.length === 0
      && snapshot.assetDeliveries.length === 0
      && snapshot.evidenceBundleRef === null
    );
  }
  if (!catalog) return false;
  if (
    catalog.productRef !== project.publishedProductRef
    || catalog.gates.length + catalog.assets.length === 0
    || new Set(catalog.gates.map((entry) => entry.gateRef)).size !== catalog.gates.length
    || new Set(catalog.gates.map((entry) => entry.evidenceKey)).size !== catalog.gates.length
    || new Set(catalog.assets.map((entry) => entry.requirementRef)).size !== catalog.assets.length
    || new Set(catalog.assets.map((entry) => entry.evidenceKey)).size !== catalog.assets.length
    || snapshot.gateAssessments.length !== catalog.gates.length
    || snapshot.assetDeliveries.length !== catalog.assets.length
    || new Set(snapshot.gateAssessments.map((entry) => entry.gateRef)).size
      !== snapshot.gateAssessments.length
    || new Set(snapshot.assetDeliveries.map((entry) => entry.requirementRef)).size
      !== snapshot.assetDeliveries.length
  ) return false;
  const gatesMatch = snapshot.gateAssessments.every((assessment) => {
    const definition = catalog.gates.find((entry) => entry.gateRef === assessment.gateRef);
    if (!definition) return false;
    return (
      assessment.label === definition.label
      && assessment.requirementRef === definition.requirementRef
      && assessment.regime === definition.regime
      && satisfiedDecisionMatchesCatalog(assessment, definition)
    );
  });
  const assetsMatch = snapshot.assetDeliveries.every((delivery) => {
    const definition = catalog.assets.find(
      (entry) => entry.requirementRef === delivery.requirementRef,
    );
    return Boolean(definition && delivery.label === definition.label);
  });
  return gatesMatch && assetsMatch;
}

function attentionMatchesSnapshot(
  snapshot: AssuranceSnapshot,
  project: ProjectRef,
) {
  const catalog = snapshot.catalogAdmission.catalog;
  const execution = snapshot.execution;
  const expected = new Map<string, {
    correlationId: string;
    executionId: string | null;
    sourceKind: string;
    sourceRef: string;
    severity: "warning" | "blocking";
    reason: string;
    reactionRefs: string[];
  }>();
  const correlationId = execution?.correlationId ?? `project:${project.id}:assurance`;
  const executionId = execution?.executionId ?? null;
  const inspectorReactions = execution?.runRefs.length ? [INSPECT_REACTION] : [];

  if (snapshot.catalogAdmission.status !== "ready") {
    const sourceRef = snapshot.catalogAdmission.sourceRefs[0];
    const reason = snapshot.catalogAdmission.reason;
    if (!sourceRef || !reason) return false;
    expected.set(`assurance-catalog:${project.id}`, {
      correlationId,
      executionId,
      sourceKind: "assurance-catalog",
      sourceRef,
      severity: "blocking",
      reason,
      reactionRefs: [],
    });
  }

  for (const assessment of snapshot.gateAssessments) {
    if (assessment.status === "satisfied") continue;
    const definition = catalog?.gates.find(
      (entry) => entry.gateRef === assessment.gateRef,
    );
    if (!definition) return false;
    expected.set(assuranceAttentionIdentity({
      projectId: project.id,
      executionId,
      sourceKind: "gate",
      sourceIdentity: assessment.gateRef,
    }), {
      correlationId,
      executionId,
      sourceKind: "gate",
      sourceRef: definition.sourceRefs[0] ?? assessment.gateRef,
      severity: ["failed", "stale", "missing"].includes(assessment.status)
        ? "blocking"
        : "warning",
      reason: `${assessment.label}: ${assessment.detail}`,
      reactionRefs: [...new Set([
        ...definition.reactionRefs,
        ...inspectorReactions,
      ])],
    });
  }

  for (const delivery of snapshot.assetDeliveries) {
    if (delivery.status === "delivered") continue;
    const definition = catalog?.assets.find(
      (entry) => entry.requirementRef === delivery.requirementRef,
    );
    if (!definition) return false;
    expected.set(assuranceAttentionIdentity({
      projectId: project.id,
      executionId,
      sourceKind: "asset",
      sourceIdentity: delivery.requirementRef,
    }), {
      correlationId,
      executionId,
      sourceKind: "asset",
      sourceRef: definition.sourceRefs[0] ?? delivery.requirementRef,
      severity: ["failed", "stale", "missing"].includes(delivery.status)
        ? "blocking"
        : "warning",
      reason: `${delivery.label}: ${delivery.detail}`,
      reactionRefs: [...new Set([
        ...definition.reactionRefs,
        ...inspectorReactions,
      ])],
    });
  }

  if (
    expected.size !== snapshot.attentionItems.length
    || new Set(snapshot.attentionItems.map((entry) => entry.attentionId)).size
      !== snapshot.attentionItems.length
  ) return false;
  return snapshot.attentionItems.every((item) => {
    const relation = expected.get(item.attentionId);
    return Boolean(
      relation
      && sameProject(item.project, project)
      && item.correlationId === relation.correlationId
      && item.executionId === relation.executionId
      && item.sourceKind === relation.sourceKind
      && item.sourceRef === relation.sourceRef
      && item.severity === relation.severity
      && item.reason === relation.reason
      && item.observedAt === snapshot.observedAt
      && sameStringList(item.reactionRefs, relation.reactionRefs),
    );
  });
}

function snapshotMatches(
  state: AssuranceAttentionState,
  command: Extract<AssuranceAttentionCommand, { type: "assurance.load" }>,
  snapshot: AssuranceSnapshot,
) {
  const project = state.project;
  const revision = state.basisRevision;
  if (
    !project
    || !revision
    || !sameProject(command.project, project)
    || command.projectRoot !== project.root
    || !sameBasis(command.basisRevision, revision)
    || command.executionId !== state.executionId
    || snapshot.projectRoot !== project.root
    || snapshot.catalogAdmission.projectRoot !== project.root
    || !sameBasis(snapshot.revision, revision)
    || !catalogMatchesSnapshot(snapshot, project)
  ) return false;

  const executionId = snapshot.execution?.executionId ?? null;
  if (command.executionId !== null && executionId !== command.executionId) return false;
  if (snapshot.execution && (
    !sameProject(snapshot.execution.project, project)
    || !sameBasis(snapshot.execution.revision, revision)
  )) return false;
  if (!snapshot.execution && snapshot.evidenceBundleRef !== null) return false;

  if (!snapshot.gateAssessments.every((entry) => (
    sameProject(entry.project, project)
    && sameBasis(entry.revision, revision)
    && entry.executionId === executionId
    && (
      entry.status !== "satisfied"
      || Boolean(
        snapshot.evidenceBundleRef
        && entry.producerRef
        && entry.evidenceDigest
        && entry.evidenceRefs.length > 0,
      )
    )
  ))) return false;
  if (!snapshot.assetDeliveries.every((entry) => (
    sameProject(entry.project, project)
    && sameBasis(entry.revision, revision)
    && entry.executionId === executionId
    && (
      entry.status !== "delivered"
      || Boolean(
        snapshot.evidenceBundleRef
        && entry.artifactRef
        && entry.producerRef
        && entry.digest
        && entry.evidenceRefs.length > 0,
      )
    )
  ))) return false;
  return attentionMatchesSnapshot(snapshot, project) && summaryMatches(snapshot);
}

function pendingCommand(
  state: AssuranceAttentionState,
  commandId: string,
  correlationId: string,
) {
  return state.pendingCommands.find((entry) => (
    entry.commandId === commandId && entry.correlationId === correlationId
  )) ?? null;
}

function withoutCommand(state: AssuranceAttentionState, commandId: string) {
  return state.pendingCommands.filter((entry) => entry.commandId !== commandId);
}

function enqueueLoad(state: AssuranceAttentionState) {
  if (!state.project || !state.basisRevision) return { state, commands: [] };
  if (state.pendingCommands.some((entry) => entry.type === "assurance.load")) {
    return { state: { ...state, refreshQueued: true }, commands: [] };
  }
  const commandSequence = state.commandSequence + 1;
  const command: AssuranceAttentionCommand = {
    type: "assurance.load",
    commandId: `assurance-load-${commandSequence}`,
    correlationId: `assurance:${state.project.root}:${state.executionId ?? "latest"}:${commandSequence}`,
    projectRoot: state.project.root,
    basisRevision: state.basisRevision,
    project: state.project,
    executionId: state.executionId,
  };
  return {
    state: {
      ...state,
      status: state.snapshot ? state.status : "loading" as const,
      commandSequence,
      refreshQueued: false,
      pendingCommands: [...state.pendingCommands, command],
      error: null,
    },
    commands: [command],
  };
}

function enqueueInspector(
  state: AssuranceAttentionState,
  focusBasis: AssuranceInspectorFocusBasis,
): CapabilityUpdate<AssuranceAttentionState, AssuranceAttentionCommand> {
  const executionId = state.snapshot?.execution?.executionId ?? null;
  if (!state.project || !state.basisRevision || !executionId) return { state, commands: [] };
  const commandSequence = state.commandSequence + 1;
  const command: AssuranceAttentionCommand = {
    type: "assurance.open-run-inspector",
    commandId: `assurance-inspect-${commandSequence}`,
    correlationId: `assurance:${state.project.root}:inspect:${commandSequence}`,
    projectRoot: state.project.root,
    basisRevision: state.basisRevision,
    executionId,
    focusBasis,
  };
  return {
    state: {
      ...state,
      commandSequence,
      pendingCommands: [...state.pendingCommands, command],
      error: null,
    },
    commands: [command],
  };
}

function defaultSelection(snapshot: AssuranceAttentionState["snapshot"]) {
  return snapshot?.gateAssessments[0]?.gateRef
    ?? snapshot?.assetDeliveries[0]?.requirementRef
    ?? null;
}

export function updateAssuranceAttention(
  state: AssuranceAttentionState,
  message: AssuranceAttentionMessage,
): CapabilityUpdate<AssuranceAttentionState, AssuranceAttentionCommand> {
  if (message.type === "assurance/context-changed") {
    const projectChanged = !sameProject(state.project, message.project);
    const basisChanged = !sameBasis(state.basisRevision, message.revision);
    const executionChanged = state.executionId !== message.executionId;
    const next: AssuranceAttentionState = {
      ...state,
      project: message.project,
      basisRevision: message.revision,
      executionId: message.executionId,
      status: message.revision ? "idle" : "error",
      snapshot: projectChanged ? null : state.snapshot,
      selectedAssessmentRef: projectChanged ? null : state.selectedAssessmentRef,
      selectedAttentionId: projectChanged ? null : state.selectedAttentionId,
      refreshQueued: false,
      pendingCommands: projectChanged || basisChanged || executionChanged ? [] : state.pendingCommands,
      error: message.revision ? null : "Assurance requires an admitted Project Revision.",
    };
    if (!message.revision) return { state: next, commands: [] };
    if (!projectChanged && !basisChanged && !executionChanged) {
      return {
        state: { ...next, status: state.status, refreshQueued: state.refreshQueued },
        commands: [],
      };
    }
    return enqueueLoad(next);
  }
  if (message.type === "assurance/refresh-requested") return enqueueLoad(state);
  if (message.type === "assurance/filter-selected") {
    return { state: { ...state, filter: message.filter }, commands: [] };
  }
  if (message.type === "assurance/assessment-selected") {
    const exists = state.snapshot?.gateAssessments.some((entry) => entry.gateRef === message.assessmentRef)
      || state.snapshot?.assetDeliveries.some((entry) => entry.requirementRef === message.assessmentRef);
    return exists
      ? { state: { ...state, selectedAssessmentRef: message.assessmentRef }, commands: [] }
      : { state, commands: [] };
  }
  if (message.type === "attention/item-selected") {
    const exists = state.snapshot?.attentionItems.some((entry) => entry.attentionId === message.attentionId);
    return exists
      ? { state: { ...state, selectedAttentionId: message.attentionId }, commands: [] }
      : { state, commands: [] };
  }
  if (message.type === "attention/reaction-requested") {
    const item = state.snapshot?.attentionItems.find((entry) => entry.attentionId === message.attentionId) ?? null;
    if (!item?.reactionRefs.includes(message.reactionRef)) return { state, commands: [] };
    if (message.reactionRef !== INSPECT_REACTION) {
      return {
        state: { ...state, error: `Reaction carrier is not installed: ${message.reactionRef}.` },
        commands: [],
      };
    }
    return enqueueInspector(state, {
      kind: "attention-reaction",
      attentionId: item.attentionId,
      reactionRef: message.reactionRef,
      sourceRef: item.sourceRef,
    });
  }
  if (message.type === "assurance/run-inspector-requested") {
    const sourceRef = state.snapshot?.evidenceBundleRef ?? null;
    return sourceRef
      ? enqueueInspector(state, { kind: "execution-evidence", sourceRef })
      : { state, commands: [] };
  }

  const command = pendingCommand(state, message.commandId, message.correlationId);
  if (!command) return { state, commands: [] };
  if (message.type === "assurance/inspector-focus-resolved") {
    if (
      command.type !== "assurance.open-run-inspector"
      || command.projectRoot !== state.project?.root
      || message.projectRoot !== command.projectRoot
      || message.executionId !== command.executionId
      || message.revision !== command.basisRevision.revision
      || message.sourceRef !== command.focusBasis.sourceRef
    ) return { state, commands: [] };
    return {
      state: {
        ...state,
        pendingCommands: withoutCommand(state, message.commandId),
        error: null,
      },
      commands: [],
    };
  }
  if (message.type === "assurance/load-succeeded") {
    if (
      command.type !== "assurance.load"
      || message.projectRoot !== command.projectRoot
    ) return { state, commands: [] };
    if (!snapshotMatches(state, command, message.snapshot)) {
      return {
        state: {
          ...state,
          status: "error",
          snapshot: null,
          selectedAssessmentRef: null,
          selectedAttentionId: null,
          refreshQueued: false,
          pendingCommands: withoutCommand(state, message.commandId),
          error: "Assurance load result failed semantic admission.",
        },
        commands: [],
      };
    }
    const executionId = message.snapshot.execution?.executionId ?? null;
    const next: AssuranceAttentionState = {
      ...state,
      status: "ready",
      executionId,
      snapshot: message.snapshot,
      selectedAssessmentRef: state.selectedAssessmentRef
        && (
          message.snapshot.gateAssessments.some((entry) => entry.gateRef === state.selectedAssessmentRef)
          || message.snapshot.assetDeliveries.some((entry) => entry.requirementRef === state.selectedAssessmentRef)
        )
        ? state.selectedAssessmentRef
        : defaultSelection(message.snapshot),
      selectedAttentionId: state.selectedAttentionId
        && message.snapshot.attentionItems.some((entry) => entry.attentionId === state.selectedAttentionId)
        ? state.selectedAttentionId
        : message.snapshot.attentionItems[0]?.attentionId ?? null,
      refreshQueued: false,
      pendingCommands: withoutCommand(state, message.commandId),
      error: null,
    };
    return state.refreshQueued ? enqueueLoad(next) : { state: next, commands: [] };
  }
  if (
    (message.type === "assurance/load-failed" && command.type !== "assurance.load")
    || (
      message.type === "assurance/command-failed"
      && command.type !== "assurance.load"
    )
    || (
      message.type === "assurance/inspector-focus-failed"
      && command.type !== "assurance.open-run-inspector"
    )
  ) return { state, commands: [] };
  const basisFailure = message.type === "assurance/command-failed"
    && message.failureKind === "stale_basis";
  const identityFailure = message.type === "assurance/command-failed"
    && message.failureKind === "identity_mismatch";
  const next: AssuranceAttentionState = {
    ...state,
    status: basisFailure ? "stale" : "error",
    snapshot: basisFailure || identityFailure ? null : state.snapshot,
    selectedAssessmentRef: basisFailure || identityFailure
      ? null
      : state.selectedAssessmentRef,
    selectedAttentionId: basisFailure || identityFailure
      ? null
      : state.selectedAttentionId,
    refreshQueued: false,
    pendingCommands: withoutCommand(state, message.commandId),
    error: message.error,
  };
  return state.refreshQueued && message.type !== "assurance/command-failed"
    ? enqueueLoad(next)
    : { state: next, commands: [] };
}

export function replayAssuranceAttentionMessages(
  state: AssuranceAttentionState,
  messages: AssuranceAttentionMessage[],
) {
  const commands: AssuranceAttentionCommand[] = [];
  let current = state;
  for (const message of messages) {
    const result = updateAssuranceAttention(current, message);
    current = result.state;
    commands.push(...result.commands);
  }
  return { state: current, commands };
}
