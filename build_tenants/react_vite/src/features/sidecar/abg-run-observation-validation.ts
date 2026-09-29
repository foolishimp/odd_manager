import type { AbgEventDetail, AbgEventPage, AbgRunObservation } from '../../contracts/abg-run-observation';

const PUBLISHED_RUN_STATUSES = ['active', 'blocked', 'closed', 'failed', 'gap_stopped', 'held', 'refused', 'stopped', 'workspace'];
const RUN_STATUSES = [...PUBLISHED_RUN_STATUSES, 'converged', 'unknown'];

function record(value: unknown, source: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${source} must be an object`);
  return value as Record<string, unknown>;
}

function string(value: unknown, source: string) {
  if (typeof value !== 'string') throw new Error(`${source} must be a string`);
}

function nonblank(value: unknown, source: string) {
  if (typeof value !== 'string' || !/\S/u.test(value)) throw new Error(`${source} must be a nonblank string`);
}

function digest(value: unknown, source: string) {
  if (typeof value !== 'string' || !/^sha256:[a-f0-9]{64}$/u.test(value)) throw new Error(`${source} must be a SHA-256 digest`);
}

function safeInteger(value: unknown, source: string, minimum = 0) {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error(`${source} must be a safe integer >= ${minimum}`);
}

function exactKeys(value: Record<string, unknown>, keys: string[], source: string) {
  if (Object.keys(value).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) throw new Error(`${source} has missing or unsupported fields`);
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

function boolean(value: unknown, source: string) {
  if (typeof value !== 'boolean') throw new Error(`${source} must be a boolean`);
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
  if (item.observationLabel !== undefined) nullableString(item.observationLabel, `${source}.observationLabel`);
  string(item.runKey, `${source}.runKey`);
  string(item.runRoot, `${source}.runRoot`);
  string(item.workspaceRoot, `${source}.workspaceRoot`);
  nullableString(item.scenarioId, `${source}.scenarioId`);
  nullableString(item.scenarioKind, `${source}.scenarioKind`);
  nullableString(item.proofClass, `${source}.proofClass`);
  nullableString(item.graphFunctionRef, `${source}.graphFunctionRef`);
  literal(item.status, RUN_STATUSES, `${source}.status`);
  string(item.modifiedAt, `${source}.modifiedAt`);
  nullableString(item.lastEventAt, `${source}.lastEventAt`);
  number(item.eventCount, `${source}.eventCount`);
  literal(item.eventPosture, ['non_terminal', 'terminal_converged', 'terminal_failed', 'terminal_observed', 'run_closed', 'terminal_other', 'external_contract_uninterpreted', 'invalid'], `${source}.eventPosture`);
  literal(item.eventProfile, ['abiogenesis_4_6_flat', 'abiogenesis_5_root', 'unknown'], `${source}.eventProfile`);
}

function validateActivity(value: unknown, source: string) {
  const item = record(value, source);
  literal(item.status, RUN_STATUSES, `${source}.status`);
  for (const key of ['eventCount', 'eventKindCount', 'terminalCount']) {
    number(item[key], `${source}.${key}`);
  }
  for (const key of ['vectorPlannedCount', 'vectorEvaluatedCount', 'vectorClosedCount', 'semanticVectorCount', 'vectorAttemptCount', 'openSemanticVectorCount', 'retryCount', 'continuationCount']) nullableNumber(item[key], `${source}.${key}`);
  nullableNumber(item.currentVectorIndex, `${source}.currentVectorIndex`);
  nullableString(item.startedAt, `${source}.startedAt`);
  nullableString(item.lastEventAt, `${source}.lastEventAt`);
  nullableNumber(item.durationMs, `${source}.durationMs`);
}

function validateRows(value: unknown, source: string, validate: (item: Record<string, unknown>, source: string) => void) {
  array(value, source).forEach((entry, index) => validate(record(entry, `${source}[${index}]`), `${source}[${index}]`));
}

function validateEventPage(value: unknown, source: string): AbgEventPage {
  const page = record(value, source);
  if (page.kind !== 'abg_event_page' || page.version !== 1) throw new Error(`${source} contract version is unsupported`);
  string(page.generation, `${source}.generation`);
  for (const key of ['start', 'limit', 'total']) number(page[key], `${source}.${key}`);
  nullableNumber(page.nextStart, `${source}.nextStart`);
  nullableNumber(page.previousStart, `${source}.previousStart`);
  validateRows(page.rows, `${source}.rows`, (item, rowSource) => {
    for (const key of ['index', 'ordinal']) number(item[key], `${rowSource}.${key}`);
    string(item.eventId, `${rowSource}.eventId`);
    string(item.kind, `${rowSource}.kind`);
    nullableString(item.eventTime, `${rowSource}.eventTime`);
    nullableNumber(item.vectorIndex, `${rowSource}.vectorIndex`);
    for (const key of ['edge', 'graphCallId', 'frameId', 'cCallRef', 'actorInvocationRef', 'graphFunctionRef', 'detail']) nullableString(item[key], `${rowSource}.${key}`);
    stringArray(item.causationEventRefs, `${rowSource}.causationEventRefs`);
  });
  return page as unknown as AbgEventPage;
}

export function asAbgEventPage(value: unknown): AbgEventPage {
  return validateEventPage(value, 'ABG event page');
}

export function asAbgEventDetail(value: unknown): AbgEventDetail {
  const detail = record(value, 'ABG event detail');
  if (detail.kind !== 'abg_event_detail' || detail.version !== 1) throw new Error('ABG event detail contract version is unsupported');
  string(detail.generation, 'ABG event detail.generation');
  number(detail.ordinal, 'ABG event detail.ordinal');
  string(detail.eventId, 'ABG event detail.eventId');
  string(detail.eventKind, 'ABG event detail.eventKind');
  string(detail.sourceRef, 'ABG event detail.sourceRef');
  number(detail.sourceByteOffset, 'ABG event detail.sourceByteOffset');
  number(detail.sourceByteLength, 'ABG event detail.sourceByteLength');
  if (detail.value !== null) record(detail.value, 'ABG event detail.value');
  if (detail.logicalByteLength !== undefined) number(detail.logicalByteLength, 'ABG event detail.logicalByteLength');
  if (detail.storageReference !== undefined && detail.storageReference !== null) {
    const ref = record(detail.storageReference, 'ABG event detail.storageReference');
    for (const key of ['sourceEventRef', 'sourcePayloadDigest', 'bodyDigest']) string(ref[key], `ABG event detail.storageReference.${key}`);
    literal(ref.sourceSlot, ['basis_input', 'c_call_result_value'], 'ABG event detail.storageReference.sourceSlot');
  }
  boolean(detail.truncated, 'ABG event detail.truncated');
  nullableString(detail.refusal, 'ABG event detail.refusal');
  return detail as unknown as AbgEventDetail;
}

export function asAbgRunObservation(value: unknown): AbgRunObservation {
  const payload = record(value, 'ABG run observation');
  if (payload.kind !== 'abg_run_observation' || payload.version !== 3) throw new Error('ABG run observation contract version is unsupported');
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
  nullableString(payload.selectedRunKey, 'ABG run observation.selectedRunKey');
  nullableString(payload.selectedRunRoot, 'ABG run observation.selectedRunRoot');
  nullableString(payload.selectedWorkspaceRoot, 'ABG run observation.selectedWorkspaceRoot');

  literal(payload.eventPosture, ['non_terminal', 'terminal_converged', 'terminal_failed', 'terminal_observed', 'run_closed', 'terminal_other', 'external_contract_uninterpreted', 'invalid'], 'ABG run observation.eventPosture');
  literal(payload.processPosture, ['unavailable', 'queued', 'starting', 'running', 'waiting_human', 'exited', 'cancelled', 'disconnected'], 'ABG run observation.processPosture');
  const validatePrefix = (value: unknown, source: string) => {
    const prefix = record(value, source);
    exactKeys(prefix, ['kind', 'schemaVersion', 'eventLogRef', 'prefixLength', 'prefixDigest', 'coordinateDigest', 'storeIdentity'], source);
    literal(prefix.kind, ['durable_prefix_coordinate'], `${source}.kind`);
    literal(prefix.schemaVersion, ['5.0.0'], `${source}.schemaVersion`);
    nonblank(prefix.eventLogRef, `${source}.eventLogRef`);
    const uri = new URL(String(prefix.eventLogRef));
    if (uri.protocol !== 'file:' || uri.hostname !== '' || uri.href !== prefix.eventLogRef) throw new Error(`${source}.eventLogRef must be a canonical local file URI`);
    for (const key of ['prefixDigest', 'coordinateDigest']) digest(prefix[key], `${source}.${key}`);
    safeInteger(prefix.prefixLength, `${source}.prefixLength`);
    const store = record(prefix.storeIdentity, `${source}.storeIdentity`);
    exactKeys(store, ['device', 'inode', 'eventContractDigest'], `${source}.storeIdentity`);
    safeInteger(store.device, `${source}.storeIdentity.device`);
    safeInteger(store.inode, `${source}.storeIdentity.inode`);
    digest(store.eventContractDigest, `${source}.storeIdentity.eventContractDigest`);
  };
  if (payload.runtimeState !== undefined && payload.runtimeState !== null) {
    const runtime = record(payload.runtimeState, 'ABG runtime state');
    const evidenceKeys = ['status', 'sourceRef', 'sourceDigest', 'prefix', 'asOfOrdinal', 'replayRef', 'replayDigest', 'replayFromOrdinal', 'replayLimit', 'terminalResultRef'];
    exactKeys(runtime, ['state', 'reason', 'coverage', ...evidenceKeys], 'ABG runtime state');
    literal(runtime.state, ['published', 'unavailable'], 'ABG runtime state.state');
    if (runtime.status !== null) literal(runtime.status, PUBLISHED_RUN_STATUSES, 'ABG runtime state.status');
    nonblank(runtime.reason, 'ABG runtime state.reason');
    for (const key of ['sourceRef', 'replayRef', 'terminalResultRef']) if (runtime[key] !== null) nonblank(runtime[key], `ABG runtime state.${key}`);
    for (const key of ['sourceDigest', 'replayDigest']) if (runtime[key] !== null) digest(runtime[key], `ABG runtime state.${key}`);
    for (const key of ['asOfOrdinal', 'replayFromOrdinal', 'replayLimit']) if (runtime[key] !== null) safeInteger(runtime[key], `ABG runtime state.${key}`, key === 'replayLimit' ? 1 : 0);
    literal(runtime.coverage, ['exact_retained_prefix', 'unavailable'], 'ABG runtime state.coverage');
    if (runtime.prefix !== null) validatePrefix(runtime.prefix, 'ABG runtime state.prefix');
    if (runtime.state === 'published' && (runtime.coverage !== 'exact_retained_prefix' || evidenceKeys.some((key) => key !== 'terminalResultRef' && runtime[key] === null))) throw new Error('Published runtime state lacks its evidence basis');
    if (runtime.state === 'unavailable' && (runtime.coverage !== 'unavailable' || evidenceKeys.some((key) => runtime[key] !== null))) throw new Error('Unavailable runtime state cannot assert published evidence');
  }
  if (payload.retainedObservation !== undefined && payload.retainedObservation !== null) {
    const retained = record(payload.retainedObservation, 'ABG retained observation');
    exactKeys(retained, ['kind', 'originalCoordinate', 'archiveSourceRef', 'receiptSourceRef', 'receiptDigest'], 'ABG retained observation');
    literal(retained.kind, ['retained_prefix_resolution'], 'ABG retained observation.kind');
    for (const key of ['archiveSourceRef', 'receiptSourceRef']) nonblank(retained[key], `ABG retained observation.${key}`);
    digest(retained.receiptDigest, 'ABG retained observation.receiptDigest');
    validatePrefix(retained.originalCoordinate, 'ABG retained observation.originalCoordinate');
  }
  const proofReconciliation = record(payload.proofReconciliation, 'ABG run observation.proofReconciliation');
  literal(proofReconciliation.state, ['absent', 'pending', 'reconciled', 'conflict', 'unreadable', 'unsupported'], 'ABG run observation.proofReconciliation.state');
  nullableString(proofReconciliation.sourceRef, 'ABG run observation.proofReconciliation.sourceRef');
  stringArray(proofReconciliation.conflicts, 'ABG run observation.proofReconciliation.conflicts');
  nullableNumber(proofReconciliation.eventCount, 'ABG run observation.proofReconciliation.eventCount');
  nullableString(proofReconciliation.eventDigest, 'ABG run observation.proofReconciliation.eventDigest');
  const compatibility = record(payload.compatibility, 'ABG run observation.compatibility');
  string(compatibility.posture, 'ABG run observation.compatibility.posture');
  string(compatibility.reason, 'ABG run observation.compatibility.reason');

  if (payload.carrierSnapshot !== null) {
    const carrier = record(payload.carrierSnapshot, 'ABG run observation.carrierSnapshot');
    literal(carrier.state, ['ready', 'invalid'], 'ABG run observation.carrierSnapshot.state');
    string(carrier.sourceRef, 'ABG run observation.carrierSnapshot.sourceRef');
    string(carrier.generation, 'ABG run observation.carrierSnapshot.generation');
    literal(carrier.envelopeProfile, ['abiogenesis_4_6_flat', 'abiogenesis_5_root', 'unknown'], 'ABG run observation.carrierSnapshot.envelopeProfile');
    nullableString(carrier.workflowVersion, 'ABG run observation.carrierSnapshot.workflowVersion');
    nullableString(carrier.eventContractDigest, 'ABG run observation.carrierSnapshot.eventContractDigest');
    string(carrier.contractPosture, 'ABG run observation.carrierSnapshot.contractPosture');
    for (const key of ['observedSizeBytes', 'completePrefixBytes', 'pendingBytes', 'eventCount', 'maxLineBytes']) number(carrier[key], `ABG run observation.carrierSnapshot.${key}`);
    nullableNumber(carrier.firstOrdinal, 'ABG run observation.carrierSnapshot.firstOrdinal');
    nullableNumber(carrier.lastOrdinal, 'ABG run observation.carrierSnapshot.lastOrdinal');
    nullableString(carrier.firstEventAt, 'ABG run observation.carrierSnapshot.firstEventAt');
    nullableString(carrier.lastEventAt, 'ABG run observation.carrierSnapshot.lastEventAt');
    nullableString(carrier.completePrefixDigest, 'ABG run observation.carrierSnapshot.completePrefixDigest');
    for (const key of ['physicalRecordCount', 'storageReferenceCount', 'ledgerEventCount', 'dependencyEventCount']) if (carrier[key] !== undefined) number(carrier[key], `ABG carrier.${key}`);
    if (carrier.selectedRunId !== undefined) nullableString(carrier.selectedRunId, 'ABG carrier.selectedRunId');
    if (carrier.selectedRunId && carrier.selectedRunId !== payload.selectedRunId) throw new Error('Carrier selected Run identity conflicts');
    boolean(carrier.stable, 'ABG run observation.carrierSnapshot.stable');
    literal(carrier.eventPosture, ['non_terminal', 'terminal_converged', 'terminal_failed', 'terminal_observed', 'run_closed', 'terminal_other', 'external_contract_uninterpreted', 'invalid'], 'ABG run observation.carrierSnapshot.eventPosture');
    const limits = record(carrier.limits, 'ABG run observation.carrierSnapshot.limits');
    for (const key of ['maxCarrierBytes', 'maxLineBytes', 'maxEvents', 'maxIndexBytes']) number(limits[key], `ABG run observation.carrierSnapshot.limits.${key}`);
  }

  validateRows(payload.systemReferences, 'ABG run observation.systemReferences', (item, source) => {
    literal(item.kind, ['graph', 'graph_function', 'overlay', 'startup', 'event_digest', 'runtime_binding'], `${source}.kind`);
    string(item.ref, `${source}.ref`);
    string(item.sourceRef, `${source}.sourceRef`);
  });
  if (payload.substrate !== null) {
    const substrate = record(payload.substrate, 'ABG run observation.substrate');
    for (const key of ['productId', 'packageName', 'packageVersion', 'releaseTag', 'sourceCommit', 'snapshotCommit', 'tarballSha256', 'productToolchainManifestDigest', 'releaseSnapshotManifestSha256']) nullableString(substrate[key], `ABG run observation.substrate.${key}`);
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
  if (payload.eventPage !== null) {
    validateEventPage(payload.eventPage, 'ABG run observation.eventPage');
  }
  const families = record(payload.eventFamilies, 'ABG run observation.eventFamilies');
  for (const familyName of ['run', 'retryContinuation', 'actor', 'cCall', 'payloadIntegrity', 'assurance']) {
    const family = record(families[familyName], `ABG run observation.eventFamilies.${familyName}`);
    number(family.eventCount, `ABG run observation.eventFamilies.${familyName}.eventCount`);
    boolean(family.truncated, `ABG run observation.eventFamilies.${familyName}.truncated`);
    validateRows(family.kindCounts, `ABG run observation.eventFamilies.${familyName}.kindCounts`, (item, source) => {
      string(item.kind, `${source}.kind`);
      number(item.count, `${source}.count`);
    });
    validateRows(family.rows, `ABG run observation.eventFamilies.${familyName}.rows`, (item, source) => {
      number(item.ordinal, `${source}.ordinal`);
      string(item.eventId, `${source}.eventId`);
      string(item.kind, `${source}.kind`);
      nullableString(item.eventTime, `${source}.eventTime`);
      nullableString(item.graphCallId, `${source}.graphCallId`);
      nullableString(item.frameId, `${source}.frameId`);
      nullableNumber(item.vectorIndex, `${source}.vectorIndex`);
      nullableString(item.cCallRef, `${source}.cCallRef`);
      nullableString(item.actorInvocationRef, `${source}.actorInvocationRef`);
      stringArray(item.causationEventRefs, `${source}.causationEventRefs`);
    });
  }
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
