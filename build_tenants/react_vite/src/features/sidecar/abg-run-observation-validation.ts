import type { AbgRunObservation } from '../../contracts/abg-run-observation';

function record(value: unknown, source: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${source} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, source: string) {
  if (typeof value !== 'string') throw new Error(`${source} must be a string`);
}

function nullableString(value: unknown, source: string) {
  if (value !== null && typeof value !== 'string') throw new Error(`${source} must be a string or null`);
}

function number(value: unknown, source: string) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${source} must be a finite number`);
}

function nullableNumber(value: unknown, source: string) {
  if (value !== null) number(value, source);
}

function literal(value: unknown, values: readonly string[], source: string) {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(`${source} has an unsupported value`);
}

function array(value: unknown, source: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${source} must be an array`);
  return value;
}

function stringArray(value: unknown, source: string) {
  array(value, source).forEach((entry, index) => string(entry, `${source}[${index}]`));
}

function validateDiagnostic(value: unknown, source: string) {
  const item = record(value, source);
  literal(item.severity, ['info', 'warning', 'error'], `${source}.severity`);
  string(item.code, `${source}.code`);
  string(item.message, `${source}.message`);
  if (item.sourceRef !== undefined) string(item.sourceRef, `${source}.sourceRef`);
  if (item.vectorIndex !== undefined) number(item.vectorIndex, `${source}.vectorIndex`);
}

function validateRun(value: unknown, source: string) {
  const item = record(value, source);
  string(item.runId, `${source}.runId`);
  string(item.runRoot, `${source}.runRoot`);
  string(item.workspaceRoot, `${source}.workspaceRoot`);
  nullableString(item.scenarioId, `${source}.scenarioId`);
  nullableString(item.scenarioKind, `${source}.scenarioKind`);
  nullableString(item.proofClass, `${source}.proofClass`);
  nullableString(item.graphFunctionRef, `${source}.graphFunctionRef`);
  literal(item.status, ['active', 'converged', 'failed', 'unknown'], `${source}.status`);
  string(item.modifiedAt, `${source}.modifiedAt`);
  nullableString(item.lastEventAt, `${source}.lastEventAt`);
  number(item.eventCount, `${source}.eventCount`);
}

function validateActivity(value: unknown, source: string) {
  const item = record(value, source);
  literal(item.status, ['active', 'converged', 'failed', 'unknown'], `${source}.status`);
  for (const key of ['eventCount', 'eventKindCount', 'vectorPlannedCount', 'vectorEvaluatedCount', 'vectorClosedCount', 'retryCount', 'continuationCount', 'terminalCount']) {
    number(item[key], `${source}.${key}`);
  }
  nullableNumber(item.currentVectorIndex, `${source}.currentVectorIndex`);
  nullableString(item.startedAt, `${source}.startedAt`);
  nullableString(item.lastEventAt, `${source}.lastEventAt`);
  nullableNumber(item.durationMs, `${source}.durationMs`);
}

function validateRows(value: unknown, source: string, validate: (item: Record<string, unknown>, source: string) => void) {
  array(value, source).forEach((entry, index) => validate(record(entry, `${source}[${index}]`), `${source}[${index}]`));
}

export function asAbgRunObservation(value: unknown): AbgRunObservation {
  const payload = record(value, 'ABG run observation');
  if (payload.kind !== 'abg_run_observation' || payload.version !== 2) throw new Error('ABG run observation contract version is unsupported');
  literal(payload.state, ['ready', 'unsupported', 'error'], 'ABG run observation.state');
  string(payload.generatedAt, 'ABG run observation.generatedAt');
  string(payload.projectRoot, 'ABG run observation.projectRoot');

  const identity = record(payload.identity, 'ABG run observation.identity');
  string(identity.id, 'ABG run observation.identity.id');
  string(identity.label, 'ABG run observation.identity.label');
  string(identity.kind, 'ABG run observation.identity.kind');
  nullableString(identity.version, 'ABG run observation.identity.version');
  nullableString(identity.sourceRef, 'ABG run observation.identity.sourceRef');
  string(identity.confidence, 'ABG run observation.identity.confidence');
  stringArray(identity.governancePackages, 'ABG run observation.identity.governancePackages');

  array(payload.runs, 'ABG run observation.runs').forEach((entry, index) => validateRun(entry, `ABG run observation.runs[${index}]`));
  nullableString(payload.selectedRunId, 'ABG run observation.selectedRunId');
  nullableString(payload.selectedRunRoot, 'ABG run observation.selectedRunRoot');
  nullableString(payload.selectedWorkspaceRoot, 'ABG run observation.selectedWorkspaceRoot');

  validateRows(payload.systemReferences, 'ABG run observation.systemReferences', (item, source) => {
    literal(item.kind, ['graph', 'graph_function', 'overlay', 'startup', 'event_digest', 'runtime_binding'], `${source}.kind`);
    string(item.ref, `${source}.ref`);
    string(item.sourceRef, `${source}.sourceRef`);
  });
  if (payload.substrate !== null) {
    const substrate = record(payload.substrate, 'ABG run observation.substrate');
    for (const key of ['productId', 'packageName', 'packageVersion', 'releaseTag', 'sourceCommit']) nullableString(substrate[key], `ABG run observation.substrate.${key}`);
  }
  if (payload.activity !== null) validateActivity(payload.activity, 'ABG run observation.activity');

  validateRows(payload.functions, 'ABG run observation.functions', (item, source) => {
    string(item.graphFunctionRef, `${source}.graphFunctionRef`);
    for (const key of ['selectedCount', 'callCount', 'frameCount']) number(item[key], `${source}.${key}`);
    array(item.vectorIndexes, `${source}.vectorIndexes`).forEach((entry, index) => number(entry, `${source}.vectorIndexes[${index}]`));
    string(item.sourceRef, `${source}.sourceRef`);
  });
  const catalog = record(payload.catalog, 'ABG run observation.catalog');
  literal(catalog.state, ['ready', 'missing'], 'ABG run observation.catalog.state');
  literal(catalog.sourceKind, ['abg_runtime_events'], 'ABG run observation.catalog.sourceKind');
  nullableString(catalog.sourceRef, 'ABG run observation.catalog.sourceRef');
  for (const key of ['admissionEventCount', 'unparsedAdmissionCount', 'rejectedEventCount', 'constructionCatalogEventCount', 'entryCount']) {
    number(catalog[key], `ABG run observation.catalog.${key}`);
  }
  if (typeof catalog.truncated !== 'boolean') throw new Error('ABG run observation.catalog.truncated must be a boolean');
  validateRows(catalog.entryKindCounts, 'ABG run observation.catalog.entryKindCounts', (item, source) => {
    string(item.kind, `${source}.kind`);
    number(item.count, `${source}.count`);
  });
  validateRows(catalog.entries, 'ABG run observation.catalog.entries', (item, source) => {
    string(item.projectionKey, `${source}.projectionKey`);
    string(item.entryKind, `${source}.entryKind`);
    string(item.name, `${source}.name`);
    nullableString(item.entryRef, `${source}.entryRef`);
    nullableString(item.declarationRef, `${source}.declarationRef`);
    nullableString(item.graphFunctionRef, `${source}.graphFunctionRef`);
    nullableString(item.templateRef, `${source}.templateRef`);
    stringArray(item.tags, `${source}.tags`);
    stringArray(item.inputTypeRefs, `${source}.inputTypeRefs`);
    stringArray(item.outputTypeRefs, `${source}.outputTypeRefs`);
    stringArray(item.declarationKeys, `${source}.declarationKeys`);
    number(item.admissionCount, `${source}.admissionCount`);
    number(item.variantCount, `${source}.variantCount`);
    array(item.sourceEventIndexes, `${source}.sourceEventIndexes`).forEach((entry, index) => number(entry, `${source}.sourceEventIndexes[${index}]`));
    string(item.sourceRef, `${source}.sourceRef`);
  });
  validateRows(catalog.rejectedEntries, 'ABG run observation.catalog.rejectedEntries', (item, source) => {
    string(item.entryKind, `${source}.entryKind`);
    nullableString(item.entryRef, `${source}.entryRef`);
    nullableString(item.declarationRef, `${source}.declarationRef`);
    nullableString(item.rejectionReason, `${source}.rejectionReason`);
    stringArray(item.conflictingEntryRefs, `${source}.conflictingEntryRefs`);
    nullableNumber(item.sourceEventIndex, `${source}.sourceEventIndex`);
    string(item.sourceRef, `${source}.sourceRef`);
  });
  validateRows(catalog.constructionCatalogs, 'ABG run observation.catalog.constructionCatalogs', (item, source) => {
    string(item.catalogRef, `${source}.catalogRef`);
    nullableString(item.episodeId, `${source}.episodeId`);
    nullableString(item.hookResolutionRef, `${source}.hookResolutionRef`);
    nullableString(item.fallbackConfigDigest, `${source}.fallbackConfigDigest`);
    stringArray(item.traversalPublicationRefs, `${source}.traversalPublicationRefs`);
    number(item.admissionCount, `${source}.admissionCount`);
    array(item.sourceEventIndexes, `${source}.sourceEventIndexes`).forEach((entry, index) => number(entry, `${source}.sourceEventIndexes[${index}]`));
    string(item.sourceRef, `${source}.sourceRef`);
  });
  validateRows(payload.assets, 'ABG run observation.assets', (item, source) => {
    string(item.path, `${source}.path`);
    number(item.producerVectorIndex, `${source}.producerVectorIndex`);
    nullableString(item.producerStage, `${source}.producerStage`);
    nullableString(item.targetTypeRef, `${source}.targetTypeRef`);
    nullableString(item.sha256, `${source}.sha256`);
    nullableNumber(item.byteLength, `${source}.byteLength`);
    nullableNumber(item.lineCount, `${source}.lineCount`);
    string(item.sourceRef, `${source}.sourceRef`);
  });

  if (payload.assurance !== null) {
    const assurance = record(payload.assurance, 'ABG run observation.assurance');
    for (const key of ['evidenceAdmittedCount', 'payloadObservedCount', 'payloadValidatedCount', 'judgedCallCount', 'requirementCount', 'requirementReachedCount', 'depthProofRowCount', 'mutationCount', 'mutationKillCount', 'mutationRestoreMismatchCount']) number(assurance[key], `ABG run observation.assurance.${key}`);
    nullableNumber(assurance.testStatus, 'ABG run observation.assurance.testStatus');
    nullableNumber(assurance.testPassCount, 'ABG run observation.assurance.testPassCount');
    stringArray(assurance.depthClasses, 'ABG run observation.assurance.depthClasses');
    validateRows(assurance.testReports, 'ABG run observation.assurance.testReports', (item, source) => {
      string(item.path, `${source}.path`);
      for (const key of ['tests', 'failures', 'errors', 'skipped']) number(item[key], `${source}.${key}`);
    });
  }

  validateRows(payload.eventKinds, 'ABG run observation.eventKinds', (item, source) => {
    string(item.kind, `${source}.kind`);
    number(item.count, `${source}.count`);
  });
  validateRows(payload.events, 'ABG run observation.events', (item, source) => {
    number(item.index, `${source}.index`);
    string(item.kind, `${source}.kind`);
    nullableString(item.eventTime, `${source}.eventTime`);
    nullableNumber(item.vectorIndex, `${source}.vectorIndex`);
    nullableString(item.edge, `${source}.edge`);
    nullableString(item.graphFunctionRef, `${source}.graphFunctionRef`);
    nullableString(item.detail, `${source}.detail`);
  });
  validateRows(payload.stages, 'ABG run observation.stages', (item, source) => {
    number(item.vectorIndex, `${source}.vectorIndex`);
    nullableString(item.edge, `${source}.edge`);
    nullableString(item.stage, `${source}.stage`);
    nullableString(item.sourceTypeRef, `${source}.sourceTypeRef`);
    nullableString(item.targetTypeRef, `${source}.targetTypeRef`);
    literal(item.status, ['accepted', 'rejected', 'pending'], `${source}.status`);
    number(item.attemptCount, `${source}.attemptCount`);
    if (typeof item.hasEvaluator !== 'boolean') throw new Error(`${source}.hasEvaluator must be a boolean`);
    nullableString(item.startedAt, `${source}.startedAt`);
    nullableString(item.endedAt, `${source}.endedAt`);
    nullableNumber(item.durationMs, `${source}.durationMs`);
    nullableString(item.processEventRef, `${source}.processEventRef`);
    nullableString(item.sourceRef, `${source}.sourceRef`);
  });
  validateRows(payload.transcripts, 'ABG run observation.transcripts', (item, source) => {
    string(item.transcriptId, `${source}.transcriptId`);
    literal(item.kind, ['startup', 'stdout', 'process_trace'], `${source}.kind`);
    string(item.label, `${source}.label`);
    string(item.contentPreview, `${source}.contentPreview`);
    string(item.sourceRef, `${source}.sourceRef`);
    nullableNumber(item.vectorIndex, `${source}.vectorIndex`);
    if (typeof item.truncated !== 'boolean') throw new Error(`${source}.truncated must be a boolean`);
  });
  validateRows(payload.artifacts, 'ABG run observation.artifacts', (item, source) => {
    literal(item.role, ['proof', 'identity', 'event_log', 'test_result', 'depth_proof', 'mutation_outcomes', 'vector_artifacts', 'other'], `${source}.role`);
    string(item.label, `${source}.label`);
    string(item.path, `${source}.path`);
    literal(item.state, ['present', 'missing'], `${source}.state`);
    nullableNumber(item.sizeBytes, `${source}.sizeBytes`);
    nullableString(item.modifiedAt, `${source}.modifiedAt`);
    nullableString(item.digest, `${source}.digest`);
    nullableString(item.observedDigest, `${source}.observedDigest`);
    literal(item.digestState, ['verified', 'mismatch', 'not_declared', 'unavailable', 'not_applicable'], `${source}.digestState`);
  });
  array(payload.diagnostics, 'ABG run observation.diagnostics').forEach((entry, index) => validateDiagnostic(entry, `ABG run observation.diagnostics[${index}]`));
  return payload as unknown as AbgRunObservation;
}
