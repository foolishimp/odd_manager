// Runtime validation for traversal payloads (UX_METHOD §10).
//
// External HTTP payloads are validated before entering reducer state.
// Event kinds are deliberately NOT validated against a closed enum: the
// runtime event-kind set is open, and unknown kinds must surface (via
// `unknownEventKinds` and `eventCounts`), never be dropped or rejected.

import type {
  TraversalDiagnostic,
  TraversalFrame,
  TraversalProjection,
  TraversalProjectionState,
  TraversalRequirementLineageRow,
  TraversalVectorDetail,
  TraversalVectorVariant,
  TraversalVectorRow,
} from '../../contracts/traversal';

const PROJECTION_STATES: readonly TraversalProjectionState[] = ['ready', 'unsupported', 'error'];
const PROJECTION_STATE_SET = new Set<string>(PROJECTION_STATES);
const VARIANT_SET = new Set<string>(['primary', 'evaluator']);
const DIAGNOSTIC_SEVERITY_SET = new Set<string>(['info', 'warning', 'error']);

export function asTraversalProjection(value: unknown): TraversalProjection {
  const payload = asRecord(value, 'traversal projection');
  if (payload.kind !== 'traversal_projection') {
    throw new Error('traversal projection kind is unsupported');
  }
  if (payload.version !== 1) {
    throw new Error('traversal projection version is unsupported');
  }
  const state = requiredLiteral(payload.state, PROJECTION_STATE_SET, 'traversal projection state') as TraversalProjectionState;
  return {
    kind: 'traversal_projection',
    version: 1,
    state,
    runId: nullableString(payload.runId, 'traversal projection runId'),
    runRoot: nullableString(payload.runRoot, 'traversal projection runRoot'),
    workspaceRoot: requiredString(payload.workspaceRoot, 'traversal projection workspaceRoot'),
    graphRef: nullableString(payload.graphRef, 'traversal projection graphRef'),
    graphFunctionRef: nullableString(payload.graphFunctionRef, 'traversal projection graphFunctionRef'),
    overlayRef: nullableString(payload.overlayRef, 'traversal projection overlayRef'),
    startupConfigRef: nullableString(payload.startupConfigRef, 'traversal projection startupConfigRef'),
    eventLogDigest: nullableString(payload.eventLogDigest, 'traversal projection eventLogDigest'),
    frameLineageState: requiredLiteral(payload.frameLineageState, new Set(['published', 'unavailable']), 'traversal projection frameLineageState') as TraversalProjection['frameLineageState'],
    scenario: asScenario(payload.scenario),
    substrate: payload.substrate === null ? null : asSubstrate(payload.substrate),
    eventCounts: asEventCounts(payload.eventCounts),
    unknownEventKinds: stringArray(payload.unknownEventKinds, 'traversal projection unknownEventKinds'),
    frames: requiredArray(payload.frames, 'traversal projection frames').map((frame, index) => asFrame(frame, index)),
    vectors: requiredArray(payload.vectors, 'traversal projection vectors').map((vector, index) => asVectorRow(vector, index)),
    currentVectorIndex: nullableNumber(payload.currentVectorIndex, 'traversal projection currentVectorIndex'),
    requirementLineage: requiredArray(payload.requirementLineage, 'traversal projection requirementLineage')
      .map((row, index) => asLineageRow(row, index)),
    diagnostics: asDiagnostics(payload.diagnostics, 'traversal projection diagnostics'),
  };
}

export function asTraversalVectorDetail(value: unknown): TraversalVectorDetail {
  const payload = asRecord(value, 'traversal vector detail');
  if (payload.kind !== 'traversal_vector_detail') {
    throw new Error('traversal vector detail kind is unsupported');
  }
  if (payload.version !== 1) {
    throw new Error('traversal vector detail version is unsupported');
  }
  return {
    kind: 'traversal_vector_detail',
    version: 1,
    vectorIndex: nonNegativeNumber(payload.vectorIndex, 'traversal vector detail vectorIndex'),
    variant: requiredLiteral(payload.variant, VARIANT_SET, 'traversal vector detail variant') as TraversalVectorVariant,
    attempt: nonNegativeNumber(payload.attempt, 'traversal vector detail attempt'),
    edge: nullableString(payload.edge, 'traversal vector detail edge'),
    stage: nullableString(payload.stage, 'traversal vector detail stage'),
    stagePlan: payload.stagePlan === null ? null : asStagePlan(payload.stagePlan),
    assessment: payload.assessment === null ? null : asAssessment(payload.assessment),
    materializedFiles: requiredArray(payload.materializedFiles, 'traversal vector detail materializedFiles')
      .map((row, index) => asFileRow(row, index)),
    contentPreviews: requiredArray(payload.contentPreviews, 'traversal vector detail contentPreviews')
      .map((row, index) => asContentPreview(row, index)),
    timing: payload.timing === null ? null : asTiming(payload.timing),
    availableVariants: requiredArray(payload.availableVariants, 'traversal vector detail availableVariants')
      .map((row, index) => asVariantRef(row, index)),
    sourcePath: requiredString(payload.sourcePath, 'traversal vector detail sourcePath'),
  };
}

function asScenario(value: unknown): TraversalProjection['scenario'] {
  const payload = asRecord(value, 'traversal projection scenario');
  return {
    scenarioId: nullableString(payload.scenarioId, 'traversal scenario scenarioId'),
    scenarioKind: nullableString(payload.scenarioKind, 'traversal scenario scenarioKind'),
    proofClass: nullableString(payload.proofClass, 'traversal scenario proofClass'),
    durationMs: nullableNumber(payload.durationMs, 'traversal scenario durationMs'),
  };
}

function asSubstrate(value: unknown): NonNullable<TraversalProjection['substrate']> {
  const payload = asRecord(value, 'traversal projection substrate');
  return {
    productId: nullableString(payload.productId, 'traversal substrate productId'),
    packageName: nullableString(payload.packageName, 'traversal substrate packageName'),
    packageVersion: nullableString(payload.packageVersion, 'traversal substrate packageVersion'),
    releaseTag: nullableString(payload.releaseTag, 'traversal substrate releaseTag'),
    sourceCommit: nullableString(payload.sourceCommit, 'traversal substrate sourceCommit'),
  };
}

function asEventCounts(value: unknown): Record<string, number> {
  const payload = asRecord(value, 'traversal projection eventCounts');
  const counts: Record<string, number> = {};
  for (const [kind, count] of Object.entries(payload)) {
    counts[kind] = nonNegativeNumber(count, `traversal eventCounts[${kind}]`);
  }
  return counts;
}

function asFrame(value: unknown, index: number): TraversalFrame {
  const source = `traversal frames[${index}]`;
  const payload = asRecord(value, source);
  return {
    frameOrdinal: nonNegativeNumber(payload.frameOrdinal, `${source}.frameOrdinal`),
    graphFunctionRef: nullableString(payload.graphFunctionRef, `${source}.graphFunctionRef`),
    edge: nullableString(payload.edge, `${source}.edge`),
    vectorIndex: nullableNumber(payload.vectorIndex, `${source}.vectorIndex`),
    openedAt: nullableString(payload.openedAt, `${source}.openedAt`),
  };
}

function asVectorRow(value: unknown, index: number): TraversalVectorRow {
  const source = `traversal vectors[${index}]`;
  const payload = asRecord(value, source);
  return {
    vectorIndex: nonNegativeNumber(payload.vectorIndex, `${source}.vectorIndex`),
    edge: nullableString(payload.edge, `${source}.edge`),
    stage: nullableString(payload.stage, `${source}.stage`),
    attemptCount: nonNegativeNumber(payload.attemptCount, `${source}.attemptCount`),
    hasEvaluator: requiredBoolean(payload.hasEvaluator, `${source}.hasEvaluator`),
    accepted: nullableBoolean(payload.accepted, `${source}.accepted`),
    durationMs: nullableNumber(payload.durationMs, `${source}.durationMs`),
    plannedAt: nullableString(payload.plannedAt, `${source}.plannedAt`),
    evaluatedAt: nullableString(payload.evaluatedAt, `${source}.evaluatedAt`),
    frameOrdinal: nullableNumber(payload.frameOrdinal, `${source}.frameOrdinal`),
  };
}

function asLineageRow(value: unknown, index: number): TraversalRequirementLineageRow {
  const source = `traversal requirementLineage[${index}]`;
  const payload = asRecord(value, source);
  return {
    requirementId: requiredString(payload.requirementId, `${source}.requirementId`),
    spanIds: stringArray(payload.spanIds, `${source}.spanIds`),
    vectorIndexes: numberArray(payload.vectorIndexes, `${source}.vectorIndexes`),
    reachedVectorIndexes: numberArray(payload.reachedVectorIndexes, `${source}.reachedVectorIndexes`),
    enteringPromptRefCounts: numberArray(payload.enteringPromptRefCounts, `${source}.enteringPromptRefCounts`),
    coverageStatuses: stringArray(payload.coverageStatuses, `${source}.coverageStatuses`),
    foldStates: stringArray(payload.foldStates, `${source}.foldStates`),
    residualPressureRefs: stringArray(payload.residualPressureRefs, `${source}.residualPressureRefs`),
  };
}

function asDiagnostics(value: unknown, source: string): TraversalDiagnostic[] {
  return requiredArray(value, source).map((entry, index) => {
    const payload = asRecord(entry, `${source}[${index}]`);
    return {
      severity: requiredLiteral(payload.severity, DIAGNOSTIC_SEVERITY_SET, `${source}[${index}].severity`) as TraversalDiagnostic['severity'],
      code: requiredString(payload.code, `${source}[${index}].code`),
      message: requiredString(payload.message, `${source}[${index}].message`),
      ...(payload.sourceRef === undefined ? {} : { sourceRef: requiredString(payload.sourceRef, `${source}[${index}].sourceRef`) }),
    };
  });
}

function asStagePlan(value: unknown): NonNullable<TraversalVectorDetail['stagePlan']> {
  const payload = asRecord(value, 'traversal vector detail stagePlan');
  return {
    sourceTypeRef: nullableString(payload.sourceTypeRef, 'traversal stagePlan sourceTypeRef'),
    targetTypeRef: nullableString(payload.targetTypeRef, 'traversal stagePlan targetTypeRef'),
    vectorId: nullableString(payload.vectorId, 'traversal stagePlan vectorId'),
    filesToProduce: stringArray(payload.filesToProduce, 'traversal stagePlan filesToProduce'),
    executeBeforeAssessment: nullableBoolean(payload.executeBeforeAssessment, 'traversal stagePlan executeBeforeAssessment'),
  };
}

function asAssessment(value: unknown): NonNullable<TraversalVectorDetail['assessment']> {
  const payload = asRecord(value, 'traversal vector detail assessment');
  return {
    accepted: nullableBoolean(payload.accepted, 'traversal assessment accepted'),
    reason: nullableString(payload.reason, 'traversal assessment reason'),
    nodeTypesUsed: stringArray(payload.nodeTypesUsed, 'traversal assessment nodeTypesUsed'),
  };
}

function asFileRow(value: unknown, index: number): TraversalVectorDetail['materializedFiles'][number] {
  const source = `traversal vector detail materializedFiles[${index}]`;
  const payload = asRecord(value, source);
  return {
    path: requiredString(payload.path, `${source}.path`),
    sha256: nullableString(payload.sha256, `${source}.sha256`),
    byteLength: nullableNumber(payload.byteLength, `${source}.byteLength`),
    lineCount: nullableNumber(payload.lineCount, `${source}.lineCount`),
  };
}

function asContentPreview(value: unknown, index: number): TraversalVectorDetail['contentPreviews'][number] {
  const source = `traversal vector detail contentPreviews[${index}]`;
  const payload = asRecord(value, source);
  return {
    path: requiredString(payload.path, `${source}.path`),
    contentPreview: requiredString(payload.contentPreview, `${source}.contentPreview`),
  };
}

function asTiming(value: unknown): NonNullable<TraversalVectorDetail['timing']> {
  const payload = asRecord(value, 'traversal vector detail timing');
  return {
    startedAt: nullableString(payload.startedAt, 'traversal timing startedAt'),
    endedAt: nullableString(payload.endedAt, 'traversal timing endedAt'),
    durationMs: nullableNumber(payload.durationMs, 'traversal timing durationMs'),
  };
}

function asVariantRef(value: unknown, index: number): TraversalVectorDetail['availableVariants'][number] {
  const source = `traversal vector detail availableVariants[${index}]`;
  const payload = asRecord(value, source);
  return {
    variant: requiredLiteral(payload.variant, VARIANT_SET, `${source}.variant`) as TraversalVectorVariant,
    attempt: nonNegativeNumber(payload.attempt, `${source}.attempt`),
  };
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} payload is not an object`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is not an array`);
  }
  return value;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string') {
    throw new Error(`${label} is not a string`);
  }
  return value;
}

function nullableString(value: unknown, label: string) {
  if (value === null) return null;
  return requiredString(value, label);
}

function requiredBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} is not a boolean`);
  }
  return value;
}

function nullableBoolean(value: unknown, label: string) {
  if (value === null) return null;
  return requiredBoolean(value, label);
}

function nonNegativeNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} is not a non-negative number`);
  }
  return value;
}

function nullableNumber(value: unknown, label: string) {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${label} is not a finite number`);
  }
  return value;
}

function stringArray(value: unknown, label: string) {
  return requiredArray(value, label).map((entry, index) => requiredString(entry, `${label}[${index}]`));
}

function numberArray(value: unknown, label: string) {
  return requiredArray(value, label).map((entry, index) => {
    if (typeof entry !== 'number' || !Number.isFinite(entry)) {
      throw new Error(`${label}[${index}] is not a finite number`);
    }
    return entry;
  });
}

function requiredLiteral(value: unknown, allowed: ReadonlySet<string>, label: string) {
  const text = requiredString(value, label);
  if (!allowed.has(text)) {
    throw new Error(`${label} is unsupported: ${text}`);
  }
  return text;
}
