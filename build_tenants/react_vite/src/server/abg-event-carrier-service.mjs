import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseStrictJson } from './strict-json-service.mjs';
import {
  ABI5_ROOT_EVENT_CONTRACT_DIGEST,
  validateAbi5RootKindContract,
  ABI5_RC1_EVENT_CONTRACT_DIGEST, ABI5_RC1_PROFILE, validateAbi5Rc1KindContract,
} from './abi5-root-event-contract.mjs';

export { ABI5_ROOT_EVENT_CONTRACT_DIGEST } from './abi5-root-event-contract.mjs';

export const ABI5_WORKFLOW_VERSION = '5.0.0';

export const ABI5_ROOT_EVENT_KINDS = Object.freeze([
  'public_operation_artifact_admitted', 'public_operation_admitted',
  'invocation_admitted', 'invocation_refused', 'implementation_admitted',
  'basis_admitted', 'declaration_reprice_admitted', 'replay_log_attested',
  'workspace_hygiene_stamped', 'defect_intake_admitted', 'run_resumed',
  'run_segment_opened', 'graph_call_opened', 'frame_opened',
  'traversal_cursor_entered', 'c_call_opened', 'c_call_fibre_selected',
  'actor_transport_binding_admitted', 'actor_invocation_started',
  'actor_process_started', 'actor_process_spawn_failed',
  'actor_process_stdout_observed', 'actor_process_stderr_observed',
  'actor_process_timeout_observed', 'actor_process_signal_requested',
  'actor_process_exited', 'actor_process_termination_unconfirmed',
  'actor_result_artifact_observed', 'actor_invocation_closed',
  'actor_invocation_failed', 'c_call_evidenced', 'c_call_result_admitted',
  'c_call_judged', 'assessed', 'retry_attempt_opened',
  'retry_progress_recorded', 'child_foldback_admitted',
  'child_preparation_refused', 'fan_out_completion_admitted',
  'traversal_route_admitted', 'construction_intent_selected',
  'construction_delta_observed', 'fh_interaction_opened',
  'fh_interaction_responded', 'fh_interaction_resume_admitted',
  'continuation_abandoned', 'continuation_superseded',
  'continuation_reentry_link_admitted', 'runtime_failure_observed',
  'run_stopped', 'terminal_reached', 'frame_closed', 'graph_call_closed',
  'run_closed',
]);

const ABI5_ROOT_EVENT_KIND_SET = new Set(ABI5_ROOT_EVENT_KINDS);
const ABI5_AGGREGATE_TYPES = new Set([
  'actor_invocation', 'c_call', 'continuation', 'frame', 'graph_call',
  'process', 'run', 'transport_binding', 'workspace',
]);
const ABI5_REQUIRED_KEYS = Object.freeze([
  'admissionOrdinal', 'aggregateId', 'aggregateType', 'basisId',
  'causationEventRefs', 'correlationId', 'eventId', 'eventTime', 'kind',
  'parentAggregateId', 'payload', 'payloadDigest', 'scopeClass',
  'workflowVersion',
]);
const ABI5_OPTIONAL_KEYS = Object.freeze([
  'frameId', 'frameLineageId', 'graphCallId', 'graphFunctionRef',
  'materializationRef', 'runId', 'eventContractDigest',
]);
const ABI5_ALLOWED_KEYS = new Set([...ABI5_REQUIRED_KEYS, ...ABI5_OPTIONAL_KEYS]);
const REQUIRED_IDENTITIES_BY_AGGREGATE = Object.freeze({
  workspace: [],
  run: ['runId'],
  graph_call: ['runId', 'graphCallId'],
  frame: ['runId', 'graphCallId', 'frameId'],
  c_call: ['runId', 'graphCallId', 'frameId'],
  actor_invocation: ['runId', 'graphCallId', 'frameId'],
  process: ['runId', 'graphCallId', 'frameId'],
  transport_binding: ['runId', 'graphCallId', 'frameId'],
  continuation: ['runId', 'graphCallId', 'frameId'],
});

const DEFAULT_MAX_CARRIER_BYTES = 512 * 1024 * 1024;
const DEFAULT_MAX_LINE_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_EVENTS = 250000;
const DEFAULT_MAX_INDEX_BYTES = 64 * 1024 * 1024;
const DEFAULT_PAGE_SIZE = 80;
const MAX_PAGE_SIZE = 240;
const MAX_DETAIL_BYTES = 1024 * 1024;
const READ_CHUNK_BYTES = 1024 * 1024;
const MAX_COMPACT_STRING_BYTES = 128 * 1024;
const MAX_GRAPH_FUNCTION_REF_BYTES = 1024 * 1024;
const MAX_VISUAL_PROJECTION_CAUSATION_REFS = 200;
const MAX_VISUAL_PROJECTION_REF_BYTES = 4096;
const MAX_VISUAL_PROJECTION_KIND_BYTES = 160;
const MAX_VISUAL_PROJECTION_STATUS_BYTES = 80;
const MAX_CACHED_INDEXES = 16;
const UTF8_DECODER = new TextDecoder('utf-8', { fatal: true });
const indexCache = new Map();

const COMPACT_FIELD_KEYS = Object.freeze([
  'aggregateType', 'aggregateId', 'parentAggregateId', 'scopeClass', 'basisId',
  'runId', 'graphCallId', 'frameId', 'frameLineageId', 'parentFrameId',
  'graphFunctionRef', 'graphRef', 'overlayRef', 'materializationRef',
  'causationEventRefs', 'correlationId',
  'edge', 'edgeRef', 'vectorIndex', 'attempt', 'attemptRef', 'retryPath',
  'retryBoundaryRef', 'continuationRef', 'continuationContractRef',
  'continuationEventRef', 'predecessorProgressRef', 'progressRef',
  'progressClass', 'remainingBudget', 'budget', 'completedAttempts',
  'cCallRef', 'parentCCallRef', 'callClass', 'stageRole', 'taskOrdinal',
  'batchRef', 'armId', 'regime', 'programRef', 'programLocusRef',
  'implementationRef', 'implementationBindingRef', 'actorRef',
  'actorInvocationRef', 'processRef', 'transportBindingRef', 'workerBindingRef',
  'disposition', 'failureClass', 'terminalKind', 'reason', 'reasonKind',
  'stopReason', 'resultRef', 'resultDigest', 'outputDigest', 'inputDigest',
  'evidenceRef', 'evidenceDigest', 'evidenceClass', 'contractRef',
  'judgmentRef', 'routeRef', 'routeKind', 'cursorRef', 'sourceCursorRef',
  'targetCursorRef', 'entryKind', 'entryRef', 'declarationRef',
  'rejectionReason', 'conflictingEntryRefs', 'catalogRef', 'episodeId',
  'hookResolutionRef', 'fallbackConfigDigest', 'traversalPublicationRefs',
  'payloadRef', 'payloadKind', 'payloadContractRef', 'payloadSchemaRef',
  'payloadValidationRef', 'rejectionClass', 'issues', 'policyRef',
  'requirementId', 'requirementRef', 'routePayloadKind', 'propertyRef',
  'formulaRef', 'status', 'evaluationPoint', 'gatePoint', 'vacuity',
  'valueKind', 'valueDigest', 'state', 'byteLength', 'fileDigest', 'observationRef',
  'observationDigest', 'subjectRef', 'subjectDigest',
  'workspaceBindingIdentity', 'receiptRef', 'receiptDigest',
  'authorizationRef', 'authorizationDigest', 'beforeObservationRef',
  'beforeObservationDigest', 'afterObservationRef', 'afterObservationDigest',
  'writtenDigest', 'committed', 'interactiveSessionCapabilityRef',
  'interactiveSessionOperationRef', 'outputObservationCapabilityRef',
  'outputObservationOperationRef', 'archiveRef',
]);

const VISUAL_PROJECTION_REF_FIELDS = Object.freeze([
  'aggregateId', 'parentAggregateId', 'runId', 'graphCallId', 'frameId',
  'graphRef', 'graphFunctionRef', 'overlayRef', 'materializationRef',
  'actorInvocationRef', 'processRef', 'actorRef', 'resultRef',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function sameFileObservation(left, right) {
  return Boolean(left && right)
    && left.dev === right.dev
    && left.ino === right.ino
    && left.size === right.size
    && left.mtimeMs === right.mtimeMs;
}

function fileObservation(stats) {
  return {
    device: stats.dev,
    inode: stats.ino,
    sizeBytes: stats.size,
    modifiedAt: stats.mtime.toISOString(),
    modifiedMs: stats.mtimeMs,
  };
}

function diagnostic(severity, code, message, sourceRef, ordinal = undefined) {
  return {
    severity,
    code,
    message,
    sourceRef,
    ...(Number.isInteger(ordinal) ? { eventOrdinal: ordinal } : {}),
  };
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON does not admit non-finite numbers');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  if (!isRecord(value)) throw new TypeError('canonical JSON value is unsupported');
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function sha256Canonical(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function eventField(event, key) {
  if (Object.hasOwn(event, key)) return event[key];
  return isRecord(event.payload) && Object.hasOwn(event.payload, key) ? event.payload[key] : undefined;
}

function stringValue(value) {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function sha256Digest(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value) ? value : null;
}

function validStringArray(value) {
  return Array.isArray(value) && value.every((entry) => typeof entry === 'string' && entry.length > 0);
}

function canonicalVisualProjectionRef(value) {
  return typeof value === 'string'
    && value.length > 0
    && Buffer.byteLength(value) <= MAX_VISUAL_PROJECTION_REF_BYTES
    && /^(?:[a-z][a-z0-9+.-]*:(?:\/\/)?[^\s]+|[a-z][a-z0-9._-]+@[0-9]+)$/iu.test(value)
    && !value.startsWith('/')
    && !/^file:/iu.test(value)
    && !/[\u0000-\u001f\u007f]/u.test(value);
}

function validateVisualProjectionBounds(event, exactBuiltInContractRequired) {
  if (Buffer.byteLength(event.kind) > MAX_VISUAL_PROJECTION_KIND_BYTES) {
    return 'ABIogenesis 5.0 event kind exceeds the bounded visual projection limit';
  }
  if (event.causationEventRefs.length > MAX_VISUAL_PROJECTION_CAUSATION_REFS) {
    return `ABIogenesis 5.0 causationEventRefs exceed the bounded visual projection limit of ${MAX_VISUAL_PROJECTION_CAUSATION_REFS}`;
  }
  if (event.causationEventRefs.some((ref) => !canonicalVisualProjectionRef(ref))) {
    return 'ABIogenesis 5.0 causationEventRefs contain a non-canonical bounded visual projection identity';
  }
  for (const key of VISUAL_PROJECTION_REF_FIELDS) {
    const value = eventField(event, key);
    if (value === undefined || value === null) continue;
    if (!canonicalVisualProjectionRef(value)) {
      return `ABIogenesis 5.0 ${key} is not a canonical bounded visual projection identity`;
    }
  }
  const valueKind = eventField(event, 'valueKind');
  if (
    valueKind !== undefined
    && (
      typeof valueKind !== 'string'
      || Buffer.byteLength(valueKind) > MAX_VISUAL_PROJECTION_STATUS_BYTES
      || !/^[a-z][a-z0-9_]*$/u.test(valueKind)
    )
  ) {
    return 'ABIogenesis 5.0 valueKind is not a bounded visual projection status';
  }
  const valueDigest = eventField(event, 'valueDigest');
  if (valueDigest !== undefined && sha256Digest(valueDigest) === null) {
    return 'ABIogenesis 5.0 valueDigest is not a canonical visual projection digest';
  }
  const payloadHasValue = isRecord(event.payload) && Object.hasOwn(event.payload, 'value');
  const payloadHasValueDigest = isRecord(event.payload) && Object.hasOwn(event.payload, 'valueDigest');
  if (
    exactBuiltInContractRequired
    && payloadHasValue
    && payloadHasValueDigest
    && valueDigest !== sha256Canonical(event.payload.value)
  ) {
    return 'ABIogenesis 5.0 valueDigest does not certify the compacted payload value';
  }
  return null;
}

function abi5Candidate(event) {
  const { eventId, admissionOrdinal, payloadDigest, ...candidate } = event;
  return candidate;
}

function validateAbi5Event(event, line, history, exactBuiltInContractRequired) {
  const stamped = Object.hasOwn(event, 'eventContractDigest');
  if (stamped && event.eventContractDigest !== ABI5_RC1_EVENT_CONTRACT_DIGEST) return 'ABIogenesis eventContractDigest is not an admitted stamped profile';
  for (const key of ABI5_REQUIRED_KEYS) {
    if (!Object.hasOwn(event, key)) return `ABIogenesis 5.0 event is missing ${key}`;
  }
  for (const key of Object.keys(event)) {
    if (!ABI5_ALLOWED_KEYS.has(key)) return `ABIogenesis 5.0 event has unsupported envelope key ${key}`;
  }
  if (event.workflowVersion !== ABI5_WORKFLOW_VERSION) return 'ABIogenesis event workflowVersion is unsupported';
  if (!Number.isSafeInteger(event.admissionOrdinal) || event.admissionOrdinal !== history.count + 1) {
    return `ABIogenesis 5.0 admissionOrdinal must be ${history.count + 1}`;
  }
  if (!stringValue(event.kind) || !/^[a-z][a-z0-9_]*$/u.test(event.kind)) {
    return 'ABIogenesis 5.0 event kind is invalid';
  }
  if (!ABI5_AGGREGATE_TYPES.has(event.aggregateType)) return 'ABIogenesis 5.0 aggregateType is invalid';
  if (!stringValue(event.aggregateId)) return 'ABIogenesis 5.0 aggregateId is invalid';
  if (event.parentAggregateId !== null && !stringValue(event.parentAggregateId)) return 'ABIogenesis 5.0 parentAggregateId is invalid';
  if (!validStringArray(event.causationEventRefs)) return 'ABIogenesis 5.0 causationEventRefs are invalid';
  if (new Set(event.causationEventRefs).size !== event.causationEventRefs.length) return 'ABIogenesis 5.0 causationEventRefs repeat an identity';
  if (event.causationEventRefs.some((ref) => !history.eventsById.has(ref))) return 'ABIogenesis 5.0 causationEventRefs cite an unadmitted event';
  if (!stringValue(event.correlationId) || !stringValue(event.basisId)) return 'ABIogenesis 5.0 correlationId or basisId is invalid';
  if (event.scopeClass !== 'run' && event.scopeClass !== 'workspace') return 'ABIogenesis 5.0 scopeClass is invalid';
  if (!stringValue(event.eventId) || !stringValue(event.eventTime) || Number.isNaN(Date.parse(event.eventTime))) return 'ABIogenesis 5.0 event identity or time is invalid';
  if (!/^sha256:[0-9a-f]{64}$/u.test(event.payloadDigest)) return 'ABIogenesis 5.0 payloadDigest is invalid';
  for (const key of ABI5_OPTIONAL_KEYS) {
    if (Object.hasOwn(event, key) && !stringValue(event[key])) return `ABIogenesis 5.0 optional identity ${key} is invalid`;
  }
  for (const key of REQUIRED_IDENTITIES_BY_AGGREGATE[event.aggregateType]) {
    if (!stringValue(event[key])) return `ABIogenesis 5.0 ${event.aggregateType} event requires ${key}`;
  }
  if (event.scopeClass === 'workspace' && event.aggregateType !== 'workspace') return 'ABIogenesis 5.0 workspace scope requires workspace aggregateType';
  if (event.scopeClass === 'run' && event.aggregateType === 'workspace') return 'ABIogenesis 5.0 run scope cannot use workspace aggregateType';
  if (sha256Canonical(event.payload) !== event.payloadDigest) return 'ABIogenesis 5.0 payloadDigest does not match payload bytes';
  const expectedEventId = `event://abiogenesis/${sha256Canonical({
    ...abi5Candidate(event),
    payloadDigest: event.payloadDigest,
    admissionOrdinal: event.admissionOrdinal,
  }).slice('sha256:'.length)}`;
  if (event.eventId !== expectedEventId) return 'ABIogenesis 5.0 eventId does not match the canonical event history projection';
  if (canonicalJson(event) !== line) return 'ABIogenesis 5.0 event line is not canonical JSON';
  for (const ref of event.causationEventRefs) {
    const cause = history.eventsById.get(ref);
    if (event.runId === undefined ? cause.runId !== undefined : cause.runId !== undefined && cause.runId !== event.runId) {
      return 'ABIogenesis 5.0 causation crosses run scope';
    }
  }
  const projectionBoundsError = validateVisualProjectionBounds(event, exactBuiltInContractRequired);
  if (projectionBoundsError) return projectionBoundsError;
  if (exactBuiltInContractRequired) {
    const contractError = stamped ? validateAbi5Rc1KindContract(event) : validateAbi5RootKindContract(event);
    if (contractError) return contractError;
  }
  return null;
}

function validateLegacyEvent(event, expectedOrdinal) {
  if (!stringValue(event.kind)) return 'legacy ABG event kind is missing';
  if (!stringValue(event.eventId)) return 'legacy ABG eventId is missing';
  if (!stringValue(event.eventTime) || Number.isNaN(Date.parse(event.eventTime))) return 'legacy ABG eventTime is invalid';
  if (!Number.isFinite(event.eventTimeUnixMs)) return 'legacy ABG eventTimeUnixMs is missing';
  if (!Number.isSafeInteger(event.eventAdmissionOrdinal) || event.eventAdmissionOrdinal !== expectedOrdinal) {
    return `legacy ABG eventAdmissionOrdinal must be ${expectedOrdinal}`;
  }
  return null;
}

function detectedProfile(event) {
  if (event?.workflowVersion === ABI5_WORKFLOW_VERSION || Object.hasOwn(event ?? {}, 'admissionOrdinal')) return 'abiogenesis_5_root';
  if (Object.hasOwn(event ?? {}, 'eventAdmissionOrdinal')) return 'abiogenesis_4_6_flat';
  return 'unknown';
}

function compactValue(value, key) {
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return value;
  if (typeof value === 'string') {
    const limit = key === 'graphFunctionRef' ? MAX_GRAPH_FUNCTION_REF_BYTES : MAX_COMPACT_STRING_BYTES;
    return Buffer.byteLength(value) <= limit ? value : undefined;
  }
  if (Array.isArray(value) && value.length <= 200 && value.every((entry) => (
    entry === null || ['string', 'number', 'boolean'].includes(typeof entry)
  ))) {
    return value.map((entry) => typeof entry === 'string' && Buffer.byteLength(entry) > MAX_COMPACT_STRING_BYTES
      ? `${entry.slice(0, 512)}…`
      : entry);
  }
  return undefined;
}

function compactEvent(event, profile, ordinal, offset, byteLength) {
  const compact = {
    index: ordinal,
    sourceOrdinal: ordinal,
    kind: event.kind,
    eventId: event.eventId,
    payloadDigest: event.payloadDigest,
    eventContractDigest: event.eventContractDigest,
    eventTime: event.eventTime,
    eventTimeUnixMs: profile === 'abiogenesis_4_6_flat' ? event.eventTimeUnixMs : Date.parse(event.eventTime),
    eventAdmissionOrdinal: profile === 'abiogenesis_4_6_flat' ? event.eventAdmissionOrdinal : undefined,
    admissionOrdinal: profile === 'abiogenesis_5_root' ? event.admissionOrdinal : undefined,
    workflowVersion: profile === 'abiogenesis_5_root' ? event.workflowVersion : undefined,
    sourceByteOffset: offset,
    sourceByteLength: byteLength,
    envelopeProfile: profile,
  };
  for (const key of COMPACT_FIELD_KEYS) {
    const value = compactValue(eventField(event, key), key);
    if (value !== undefined) compact[key] = value;
  }
  const detailSource = isRecord(event.payload) ? event.payload : event;
  compact.detailFields = Object.entries(detailSource)
    .filter(([key, value]) => !COMPACT_FIELD_KEYS.includes(key) && ['string', 'number', 'boolean'].includes(typeof value))
    .filter(([, value]) => typeof value !== 'string' || Buffer.byteLength(value) <= 512)
    .slice(0, 6)
    .map(([key, value]) => [key, value]);
  return compact;
}

function legacyTerminalPosture(terminal) {
  if (!terminal) return 'non_terminal';
  const terminalKind = stringValue(eventField(terminal, 'terminalKind'))
    ?? stringValue(eventField(terminal, 'disposition'));
  if (terminalKind && /(fail|refus|abort|error)/iu.test(terminalKind)) return 'terminal_failed';
  if (!terminalKind || /(converg|complete|success|closed)/iu.test(terminalKind)) return 'terminal_converged';
  return 'terminal_other';
}

function terminalPosture(events, profile) {
  if (profile === 'abiogenesis_5_root') {
    if (events.some((event) => event.kind === 'run_closed')) return events.some((event) => event.eventContractDigest === ABI5_RC1_EVENT_CONTRACT_DIGEST) ? 'run_closed' : 'terminal_converged';
    if (events.some((event) => event.kind === 'terminal_reached') && !events.some((event) => event.eventContractDigest === ABI5_RC1_EVENT_CONTRACT_DIGEST)) return 'terminal_observed';
    return 'non_terminal';
  }
  const terminal = [...events].reverse().find((event) => event.kind === 'terminal_reached') ?? null;
  return legacyTerminalPosture(terminal);
}

function publicSnapshot(index) {
  return {
    state: index.state,
    sourceRef: index.sourceRef,
    generation: index.generation,
    envelopeProfile: index.envelopeProfile,
    workflowVersion: index.workflowVersion,
    eventContractDigest: index.eventContractDigest,
    builtInEventContractDigest: index.builtInEventContractDigest,
    builtInRootContractValidated: index.builtInRootContractValidated,
    contractPosture: index.contractPosture,
    contractBindingPosture: index.contractBindingPosture,
    observedSizeBytes: index.observedSizeBytes,
    completePrefixBytes: index.completePrefixBytes,
    pendingBytes: index.pendingBytes,
    eventCount: index.eventCount,
    physicalRecordCount: index.physicalRecordCount ?? index.eventCount,
    storageReferenceCount: index.storageReferenceCount ?? 0,
    selectedRunId: index.selectedRunId ?? null,
    ledgerEventCount: index.ledgerEventCount ?? index.eventCount,
    dependencyEventCount: index.dependencyEventCount ?? 0,
    firstOrdinal: index.firstOrdinal,
    lastOrdinal: index.lastOrdinal,
    firstEventAt: index.firstEventAt,
    lastEventAt: index.lastEventAt,
    maxLineBytes: index.maxLineBytes,
    completePrefixDigest: index.completePrefixDigest,
    stable: index.stable,
    eventPosture: index.eventPosture,
    terminalEvent: index.terminalEvent,
    limits: index.limits,
  };
}

function invalidIndex(path, before, limits, diagnostics, partial = {}) {
  const generation = `sha256:${createHash('sha256').update(`${resolve(path)}:${before?.dev ?? 0}:${before?.ino ?? 0}:${before?.size ?? 0}:${before?.mtimeMs ?? 0}:invalid`).digest('hex')}`;
  return {
    state: 'invalid', sourceRef: resolve(path), generation,
    envelopeProfile: partial.envelopeProfile ?? 'unknown', workflowVersion: partial.workflowVersion ?? null,
    eventContractDigest: partial.eventContractDigest ?? null, contractPosture: 'invalid',
    builtInEventContractDigest: partial.builtInEventContractDigest ?? null,
    builtInRootContractValidated: false,
    contractBindingPosture: partial.contractBindingPosture ?? null,
    observedSizeBytes: before?.size ?? 0, completePrefixBytes: partial.completePrefixBytes ?? 0,
    pendingBytes: partial.pendingBytes ?? 0, eventCount: partial.events?.length ?? 0,
    firstOrdinal: partial.events?.[0]?.sourceOrdinal ?? null,
    lastOrdinal: partial.events?.at(-1)?.sourceOrdinal ?? null,
    firstEventAt: partial.events?.[0]?.eventTime ?? null,
    lastEventAt: partial.events?.at(-1)?.eventTime ?? null,
    maxLineBytes: partial.maxLineBytes ?? 0, completePrefixDigest: partial.completePrefixDigest ?? null,
    stable: false, eventPosture: 'invalid', terminalEvent: null, limits,
    counts: partial.counts ?? {}, compactEvents: partial.events ?? [], entries: partial.entries ?? [],
    diagnostics, before: before ? fileObservation(before) : null, after: null,
  };
}

export function indexAbgEventCarrier(pathInput, inputOptions = {}) {
  const path = resolve(pathInput);
  const limits = {
    maxCarrierBytes: Number.isFinite(inputOptions.maxCarrierBytes) ? Math.floor(inputOptions.maxCarrierBytes) : DEFAULT_MAX_CARRIER_BYTES,
    maxLineBytes: Number.isFinite(inputOptions.maxLineBytes) ? Math.floor(inputOptions.maxLineBytes) : DEFAULT_MAX_LINE_BYTES,
    maxEvents: Number.isFinite(inputOptions.maxEvents) ? Math.floor(inputOptions.maxEvents) : DEFAULT_MAX_EVENTS,
    maxIndexBytes: Number.isFinite(inputOptions.maxIndexBytes) ? Math.floor(inputOptions.maxIndexBytes) : DEFAULT_MAX_INDEX_BYTES,
  };
  const externalBefore = statOf(path);
  if (!externalBefore?.isFile()) {
    return invalidIndex(path, externalBefore, limits, [diagnostic('error', 'event_carrier_missing', 'ABG event carrier is not a readable file.', path)]);
  }
  if (externalBefore.size > limits.maxCarrierBytes) {
    return invalidIndex(path, externalBefore, limits, [diagnostic('error', 'event_carrier_limit_exceeded', `ABG event carrier exceeds ${limits.maxCarrierBytes} bytes.`, path)]);
  }
  const publishedDigestInput = Object.hasOwn(inputOptions, 'publishedEventContractDigest')
    ? inputOptions.publishedEventContractDigest
    : null;
  const publishedEventContractDigest = publishedDigestInput === null
    ? null
    : sha256Digest(publishedDigestInput);
  if (publishedDigestInput !== null && publishedEventContractDigest === null) {
    return invalidIndex(path, externalBefore, limits, [diagnostic(
      'error',
      'event_contract_digest_invalid',
      'Published ABG event-contract identity is not a canonical SHA-256 digest.',
      path,
    )]);
  }
  const contractBindingPosture = stringValue(inputOptions.contractBindingPosture);
  if (contractBindingPosture && Buffer.byteLength(contractBindingPosture) > 160) {
    return invalidIndex(path, externalBefore, limits, [diagnostic(
      'error',
      'event_contract_binding_posture_invalid',
      'Published ABG event-contract binding posture exceeds the bounded identity limit.',
      path,
    )]);
  }
  const exactBuiltInContractRequired = publishedEventContractDigest === null
    || publishedEventContractDigest === ABI5_ROOT_EVENT_CONTRACT_DIGEST
    || publishedEventContractDigest === ABI5_RC1_EVENT_CONTRACT_DIGEST;
  const cacheKey = [
    path, externalBefore.dev, externalBefore.ino, externalBefore.size, externalBefore.mtimeMs,
    publishedEventContractDigest ?? 'unpublished', contractBindingPosture ?? 'unbound',
  ].join(':');
  if (!inputOptions.refresh && indexCache.has(cacheKey)) {
    const cached = indexCache.get(cacheKey);
    indexCache.delete(cacheKey);
    indexCache.set(cacheKey, cached);
    return cached;
  }

  const diagnostics = [];
  const events = [];
  const entries = [];
  const counts = {};
  const eventIds = new Set();
  const history = { count: 0, eventsById: new Map() };
  let profile = null;
  let profileStamp;
  let storageReferenceCount = 0;
  const inlineBodies = new Map();
  let lastTime = null;
  let maxLineBytes = 0;
  let completePrefixBytes = 0;
  let indexBytes = 0;
  let pending = Buffer.alloc(0);
  let invalid = null;
  const prefixHash = createHash('sha256');
  const fd = openSync(path, 'r');
  let descriptorBefore;
  let descriptorAfter;
  try {
    descriptorBefore = fstatSync(fd);
    const buffer = Buffer.allocUnsafe(READ_CHUNK_BYTES);
    let readPosition = 0;
    while (!invalid) {
      const bytesRead = readSync(fd, buffer, 0, buffer.length, readPosition);
      if (bytesRead === 0) break;
      readPosition += bytesRead;
      pending = pending.length === 0
        ? Buffer.from(buffer.subarray(0, bytesRead))
        : Buffer.concat([pending, buffer.subarray(0, bytesRead)]);
      if (pending.length > limits.maxLineBytes && pending.indexOf(0x0a) === -1) {
        invalid = diagnostic('error', 'event_line_limit_exceeded', `ABG event line exceeds ${limits.maxLineBytes} bytes.`, path, events.length);
        break;
      }
      let newline;
      while (!invalid && (newline = pending.indexOf(0x0a)) !== -1) {
        const framed = pending.subarray(0, newline + 1);
        const lineBytes = pending.subarray(0, newline);
        const lineOffset = completePrefixBytes;
        pending = pending.subarray(newline + 1);
        completePrefixBytes += framed.length;
        prefixHash.update(framed);
        maxLineBytes = Math.max(maxLineBytes, lineBytes.length);
        if (lineBytes.length === 0) {
          invalid = diagnostic('error', 'event_record_blank', 'ABG event carrier contains a blank record.', path, events.length);
          break;
        }
        if (lineBytes.length > limits.maxLineBytes) {
          invalid = diagnostic('error', 'event_line_limit_exceeded', `ABG event line exceeds ${limits.maxLineBytes} bytes.`, path, events.length);
          break;
        }
        if (events.length >= limits.maxEvents) {
          invalid = diagnostic('error', 'event_count_limit_exceeded', `ABG event carrier exceeds ${limits.maxEvents} events.`, path, events.length);
          break;
        }
        let line;
        try {
          line = UTF8_DECODER.decode(lineBytes);
        } catch {
          invalid = diagnostic('error', 'event_utf8_invalid', 'ABG event record is not valid UTF-8.', path, events.length);
          break;
        }
        let event;
        try {
          event = parseStrictJson(line);
        } catch (error) {
          invalid = diagnostic(
            'error',
            error?.code === 'duplicate_json_key' ? 'event_duplicate_json_key' : 'event_json_invalid',
            error instanceof Error ? error.message : 'ABG event record is invalid JSON.',
            path,
            events.length,
          );
          break;
        }
        if (!isRecord(event)) {
          invalid = diagnostic('error', 'event_envelope_invalid', 'ABG event record must be an object.', path, events.length);
          break;
        }
        const storageRecord = event;
        let storageReference = null;
        try {
          if (canonicalJson(storageRecord) !== line && storageRecord.kind === 'abg_admitted_body_reference_record') throw new Error('body-reference storage record is not canonical JSON');
          if (storageRecord.kind === 'abg_admitted_body_reference_record') {
            const restored = restoreBodyReference(storageRecord, inlineBodies, (entry) => readIndexedRecord(fd, entry));
            event = restored.event;
            storageReference = restored.reference;
            storageReferenceCount += 1;
          }
        } catch (error) {
          invalid = diagnostic('error', 'event_body_reference_invalid', error.message, path, events.length + 1);
          break;
        }
        const stamp = event.eventContractDigest ?? null;
        if (profileStamp !== undefined && stamp !== profileStamp) {
          invalid = diagnostic('error', 'event_profile_mixed', 'ABG carrier mixes event contract stamps.', path, events.length + 1);
          break;
        }
        profileStamp = stamp;
        if ((stamp || publishedEventContractDigest === ABI5_RC1_EVENT_CONTRACT_DIGEST) && publishedEventContractDigest && stamp !== publishedEventContractDigest) {
          invalid = diagnostic('error', 'event_contract_stamp_conflict', 'Event stamp differs from the published prefix contract.', path, events.length + 1);
          break;
        }
        const eventProfile = detectedProfile(event);
        if (eventProfile === 'unknown') {
          invalid = diagnostic('error', 'event_envelope_unknown', 'ABG event envelope does not match a supported profile.', path, events.length);
          break;
        }
        if (profile && profile !== eventProfile) {
          invalid = diagnostic('error', 'event_envelope_mixed', `ABG event carrier mixes ${profile} and ${eventProfile} envelopes.`, path, events.length);
          break;
        }
        profile = eventProfile;
        const ordinal = eventProfile === 'abiogenesis_5_root' ? event.admissionOrdinal : event.eventAdmissionOrdinal;
        const validationError = eventProfile === 'abiogenesis_5_root'
          ? validateAbi5Event(event, storageReference ? canonicalJson(event) : line, history, exactBuiltInContractRequired || Boolean(stamp))
          : validateLegacyEvent(event, events.length);
        if (validationError) {
          invalid = diagnostic('error', 'event_envelope_invalid', validationError, path, Number.isInteger(ordinal) ? ordinal : events.length);
          break;
        }
        if (eventIds.has(event.eventId)) {
          invalid = diagnostic('error', 'event_identity_duplicate', `ABG event identity ${event.eventId} is duplicated.`, path, ordinal);
          break;
        }
        const eventTime = Date.parse(event.eventTime);
        if (lastTime !== null && eventTime < lastTime) {
          invalid = diagnostic('error', 'event_time_regressed', 'ABG event time regresses within the admitted prefix.', path, ordinal);
          break;
        }
        lastTime = eventTime;
        eventIds.add(event.eventId);
        const compact = compactEvent(event, eventProfile, ordinal, lineOffset, framed.length);
        const compactBytes = Buffer.byteLength(JSON.stringify(compact)) + 256;
        if (indexBytes + compactBytes > limits.maxIndexBytes) {
          invalid = diagnostic('error', 'event_index_limit_exceeded', `ABG event index exceeds ${limits.maxIndexBytes} bytes.`, path, ordinal);
          break;
        }
        indexBytes += compactBytes;
        events.push(compact);
        const entry = {
          ordinal,
          offset: lineOffset,
          byteLength: framed.length,
          exactDigest: `sha256:${createHash('sha256').update(framed).digest('hex')}`,
          eventId: event.eventId,
          kind: event.kind,
          logicalByteLength: Buffer.byteLength(canonicalJson(event)),
          ...(storageReference ? { storageReference } : {}),
        };
        entries.push(entry);
        if (!storageReference) {
          const slot = inlineBodySlot(event);
          if (slot) inlineBodies.set(event.eventId, { ...entry, payloadDigest: event.payloadDigest, slot: slot.name, field: slot.field, bodyDigest: sha256Canonical(event.payload[slot.field]) });
        }
        counts[event.kind] = (counts[event.kind] ?? 0) + 1;
        history.count += 1;
        history.eventsById.set(event.eventId, { runId: event.runId });
      }
      if (pending.length > limits.maxLineBytes) {
        invalid = diagnostic('error', 'event_line_limit_exceeded', `ABG event line exceeds ${limits.maxLineBytes} bytes.`, path, events.length);
      }
    }
    descriptorAfter = fstatSync(fd);
  } finally {
    closeSync(fd);
  }
  const externalAfter = statOf(path);
  const prefixDigest = `sha256:${prefixHash.digest('hex')}`;
  if (invalid) {
    diagnostics.push(invalid);
    return invalidIndex(path, externalBefore, limits, diagnostics, {
      envelopeProfile: profile ?? 'unknown', workflowVersion: profile === 'abiogenesis_5_root' ? ABI5_WORKFLOW_VERSION : null,
      eventContractDigest: profile === 'abiogenesis_5_root' ? publishedEventContractDigest : null,
      builtInEventContractDigest: profile === 'abiogenesis_5_root' ? ABI5_ROOT_EVENT_CONTRACT_DIGEST : null,
      builtInRootContractValidated: false,
      contractBindingPosture,
      completePrefixBytes, pendingBytes: pending.length, events, entries, counts, maxLineBytes,
      completePrefixDigest: prefixDigest,
    });
  }
  const stable = sameFileObservation(externalBefore, externalAfter)
    && sameFileObservation(descriptorBefore, descriptorAfter)
    && sameFileObservation(externalBefore, descriptorBefore);
  if (!stable) diagnostics.push(diagnostic('error', 'event_carrier_changed_during_read', 'ABG event carrier changed while its snapshot was being indexed.', path));
  if (pending.length > 0) diagnostics.push(diagnostic('info', 'event_record_pending', `${pending.length} trailing byte(s) do not yet form an admitted newline-terminated event.`, path));
  const stampedProfile = profileStamp === ABI5_RC1_EVENT_CONTRACT_DIGEST;
  const selectedRegistry = stampedProfile ? new Set(ABI5_RC1_PROFILE.eventKinds) : ABI5_ROOT_EVENT_KIND_SET;
  const selectedContractDigest = stampedProfile ? ABI5_RC1_EVENT_CONTRACT_DIGEST : ABI5_ROOT_EVENT_CONTRACT_DIGEST;
  const unknownAbi5Kinds = profile === 'abiogenesis_5_root'
    ? Object.keys(counts).filter((kind) => !selectedRegistry.has(kind)).sort()
    : [];
  if (unknownAbi5Kinds.length > 0) diagnostics.push(diagnostic('warning', 'abi5_root_kind_unknown', `ABIogenesis 5.0 carrier contains ${unknownAbi5Kinds.length} kind(s) outside the pinned root registry.`, path));
  const builtInRootContractValidated = profile === 'abiogenesis_5_root'
    && (exactBuiltInContractRequired || stampedProfile)
    && unknownAbi5Kinds.length === 0;
  let contractPosture = 'unknown';
  if (profile === 'abiogenesis_5_root') {
    if (stampedProfile) {
      contractPosture = 'stamped_profile_validated';
    } else if (publishedEventContractDigest === null) {
      contractPosture = 'built_in_registry_envelope_validated_unpublished';
    } else if (publishedEventContractDigest !== ABI5_ROOT_EVENT_CONTRACT_DIGEST) {
      contractPosture = 'published_contract_distinct_from_builtin_registry';
    } else if (unknownAbi5Kinds.length > 0) {
      contractPosture = 'published_contract_registry_kind_conflict';
    } else {
      contractPosture = 'published_contract_matches_builtin_registry';
    }
  } else if (profile === 'abiogenesis_4_6_flat') {
    contractPosture = 'legacy_envelope_verified';
  }
  if (profile === 'abiogenesis_5_root' && !builtInRootContractValidated) {
    diagnostics.push(diagnostic(
      'warning',
      'external_event_contract_semantics_uninterpreted',
      'The published ABIogenesis 5 event contract differs from the built-in root registry; kind-derived lifecycle semantics were withheld.',
      path,
    ));
  }
  const lifecycleSemanticsAdmitted = profile !== 'abiogenesis_5_root' || builtInRootContractValidated;
  const terminal = lifecycleSemanticsAdmitted
    ? [...events].reverse().find((event) => event.kind === 'terminal_reached') ?? null
    : null;
  const generation = `sha256:${createHash('sha256').update(`${path}:${externalBefore.dev}:${externalBefore.ino}:${externalBefore.size}:${externalBefore.mtimeMs}:${prefixDigest}:${events.length}`).digest('hex')}`;
  const index = {
    state: stable ? 'ready' : 'invalid',
    sourceRef: path,
    generation,
    envelopeProfile: profile ?? 'unknown',
    workflowVersion: profile === 'abiogenesis_5_root' ? ABI5_WORKFLOW_VERSION : null,
    eventContractDigest: profile === 'abiogenesis_5_root' ? (profileStamp ?? publishedEventContractDigest) : null,
    builtInEventContractDigest: profile === 'abiogenesis_5_root' ? selectedContractDigest : null,
    builtInRootContractValidated,
    contractPosture,
    contractBindingPosture: profile === 'abiogenesis_5_root' ? contractBindingPosture : null,
    observedSizeBytes: externalBefore.size,
    completePrefixBytes,
    pendingBytes: pending.length,
    eventCount: events.length,
    physicalRecordCount: entries.length, storageReferenceCount, inlineBodies,
    firstOrdinal: events[0]?.sourceOrdinal ?? null,
    lastOrdinal: events.at(-1)?.sourceOrdinal ?? null,
    firstEventAt: events[0]?.eventTime ?? null,
    lastEventAt: events.at(-1)?.eventTime ?? null,
    maxLineBytes,
    completePrefixDigest: prefixDigest,
    stable,
    eventPosture: stable
      ? lifecycleSemanticsAdmitted ? terminalPosture(events, profile) : 'external_contract_uninterpreted'
      : 'invalid',
    terminalEvent: terminal ? {
      eventId: terminal.eventId,
      ordinal: terminal.sourceOrdinal,
      eventTime: terminal.eventTime,
      terminalKind: stringValue(terminal.terminalKind) ?? stringValue(terminal.disposition),
      reason: stringValue(terminal.reason) ?? stringValue(terminal.reasonKind),
      basisId: stringValue(terminal.basisId),
    } : null,
    limits,
    counts,
    compactEvents: events,
    entries,
    diagnostics,
    before: fileObservation(externalBefore),
    after: externalAfter ? fileObservation(externalAfter) : null,
  };
  if (index.state === 'ready') {
    for (const [key, cached] of indexCache) {
      if (cached.sourceRef === path) indexCache.delete(key);
    }
    indexCache.set(cacheKey, index);
    while (indexCache.size > MAX_CACHED_INDEXES) indexCache.delete(indexCache.keys().next().value);
  }
  return index;
}

export function abgEventCarrierSnapshot(index) {
  return publicSnapshot(index);
}

export function abgEventSequence(index) {
  return Array.isArray(index?.compactEvents) ? index.compactEvents : [];
}

function eventRow(event) {
  const boundedRef = (value) => {
    const ref = stringValue(value);
    return ref && Buffer.byteLength(ref) <= 2048 ? ref : null;
  };
  return {
    index: event.sourceOrdinal,
    ordinal: event.sourceOrdinal,
    eventId: event.eventId,
    kind: event.kind,
    eventTime: event.eventTime ?? null,
    vectorIndex: Number.isFinite(event.vectorIndex) ? event.vectorIndex : null,
    edge: boundedRef(event.edge) ?? boundedRef(event.edgeRef),
    graphCallId: boundedRef(event.graphCallId),
    frameId: boundedRef(event.frameId),
    cCallRef: boundedRef(event.cCallRef),
    actorInvocationRef: boundedRef(event.actorInvocationRef),
    graphFunctionRef: boundedRef(event.graphFunctionRef),
    causationEventRefs: Array.isArray(event.causationEventRefs) ? event.causationEventRefs : [],
    detail: Array.isArray(event.detailFields) && event.detailFields.length > 0
      ? event.detailFields.map(([key, value]) => `${key}=${String(value)}`).join(' · ')
      : null,
  };
}

export function pageAbgEventCarrier(index, input = {}) {
  const limit = Number.isInteger(input.limit) ? Math.min(Math.max(input.limit, 1), MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE;
  if (input.generation && input.generation !== index.generation) {
    return { ok: false, code: 'stale_event_generation', error: 'event cursor names a stale carrier generation' };
  }
  const start = Number.isInteger(input.start) ? Math.max(input.start, 0) : 0;
  const selected = index.compactEvents.slice(start, start + limit);
  return {
    ok: true,
    page: {
      kind: 'abg_event_page', version: 1, generation: index.generation,
      start, limit, total: index.eventCount, rows: selected.map(eventRow),
      nextStart: start + selected.length < index.eventCount ? start + selected.length : null,
      previousStart: start > 0 ? Math.max(0, start - limit) : null,
    },
  };
}

export function detailAbgEventCarrier(index, input = {}) {
  if (input.generation && input.generation !== index.generation) {
    return { ok: false, code: 'stale_event_generation', error: 'event detail names a stale carrier generation' };
  }
  const ordinal = Number(input.ordinal);
  const position = index.entries.findIndex((entry) => entry.ordinal === ordinal);
  if (position < 0) return { ok: false, code: 'event_missing', error: `event ordinal ${String(input.ordinal)} is not admitted` };
  const entry = index.entries[position];
  const current = statOf(index.sourceRef);
  if (!current || current.dev !== index.before.device || current.ino !== index.before.inode || current.size !== index.before.sizeBytes || current.mtimeMs !== index.before.modifiedMs) {
    return { ok: false, code: 'stale_event_generation', error: 'event carrier changed after the selected generation was indexed' };
  }
  const fd = openSync(index.sourceRef, 'r');
  let bytes;
  try {
    bytes = Buffer.allocUnsafe(entry.byteLength);
    const read = readSync(fd, bytes, 0, bytes.length, entry.offset);
    if (read !== bytes.length) return { ok: false, code: 'event_read_incomplete', error: 'event bytes could not be read completely' };
  } finally {
    closeSync(fd);
  }
  const lineBytes = bytes.at(-1) === 0x0a ? bytes.subarray(0, -1) : bytes;
  if (lineBytes.length > MAX_DETAIL_BYTES || (entry.logicalByteLength ?? 0) > MAX_DETAIL_BYTES) {
    return {
      ok: true,
      detail: {
        kind: 'abg_event_detail', version: 1, generation: index.generation,
        ordinal, eventId: entry.eventId, eventKind: entry.kind,
        sourceRef: index.sourceRef, sourceByteOffset: entry.offset,
        sourceByteLength: entry.byteLength, logicalByteLength: entry.logicalByteLength, storageReference: entry.storageReference ?? null, value: null, truncated: true,
        refusal: `event detail exceeds the ${MAX_DETAIL_BYTES}-byte response limit`,
      },
    };
  }
  try {
    if (`sha256:${createHash('sha256').update(bytes).digest('hex')}` !== entry.exactDigest) {
      throw new Error('event bytes changed');
    }
    let value = parseStrictJson(UTF8_DECODER.decode(lineBytes));
    if (entry.storageReference) {
      const sourceFd = openSync(index.sourceRef, 'r');
      try { value = restoreBodyReference(value, index.inlineBodies, (source) => readIndexedRecord(sourceFd, source)).event; }
      finally { closeSync(sourceFd); }
    }
    if (value.eventId !== entry.eventId || value.kind !== entry.kind) throw new Error('event identity changed');
    return {
      ok: true,
      detail: {
        kind: 'abg_event_detail', version: 1, generation: index.generation,
        ordinal, eventId: entry.eventId, eventKind: entry.kind,
        sourceRef: index.sourceRef, sourceByteOffset: entry.offset,
        sourceByteLength: entry.byteLength, logicalByteLength: entry.logicalByteLength, storageReference: entry.storageReference ?? null, value, truncated: false, refusal: null,
      },
    };
  } catch {
    return { ok: false, code: 'event_detail_conflict', error: 'event bytes no longer match the indexed event identity' };
  }
}

export function reconcileAbgProof(index, proof, identity = null, proofPath = null) {
  if (!isRecord(proof)) {
    return { state: 'absent', sourceRef: proofPath, conflicts: [], eventCount: null, eventDigest: null };
  }
  const conflicts = [];
  const sequence = Array.isArray(proof.eventSequence) ? proof.eventSequence : null;
  const proofCount = sequence?.length ?? (isRecord(proof.eventCounts)
    ? Object.values(proof.eventCounts).reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0)
    : null);
  if (proofCount !== null && proofCount !== index.eventCount) conflicts.push(`proof event count ${proofCount} does not equal carrier event count ${index.eventCount}`);
  const proofDigest = stringValue(proof.eventLogSha256) ?? stringValue(proof.eventLogDigest);
  if (proofDigest && proofDigest !== index.completePrefixDigest) conflicts.push('proof event digest does not equal the exact complete carrier prefix digest');
  if (index.pendingBytes > 0) conflicts.push('carrier has a pending non-newline-terminated suffix');
  if (sequence) {
    for (let position = 0; position < Math.min(sequence.length, index.compactEvents.length); position += 1) {
      const proofEvent = sequence[position];
      const carrierEvent = index.compactEvents[position];
      if (!isRecord(proofEvent)) {
        conflicts.push(`proof event ${position} is not an object`);
        break;
      }
      const proofOrdinal = Number.isSafeInteger(proofEvent.admissionOrdinal)
        ? proofEvent.admissionOrdinal
        : Number.isSafeInteger(proofEvent.eventAdmissionOrdinal) ? proofEvent.eventAdmissionOrdinal : proofEvent.index;
      if (Number.isSafeInteger(proofOrdinal) && proofOrdinal !== carrierEvent.sourceOrdinal) {
        conflicts.push(`proof ordinal ${proofOrdinal} differs from carrier ordinal ${carrierEvent.sourceOrdinal}`);
        break;
      }
      if (stringValue(proofEvent.kind) && proofEvent.kind !== carrierEvent.kind) {
        conflicts.push(`proof kind ${proofEvent.kind} differs from carrier kind ${carrierEvent.kind} at ordinal ${carrierEvent.sourceOrdinal}`);
        break;
      }
      if (stringValue(proofEvent.eventId) && proofEvent.eventId !== carrierEvent.eventId) {
        conflicts.push(`proof event identity differs at ordinal ${carrierEvent.sourceOrdinal}`);
        break;
      }
    }
  }
  const identitySubstrate = isRecord(identity?.substrate) ? identity.substrate : null;
  const proofSubstrate = isRecord(proof.substrate) ? proof.substrate : null;
  for (const key of ['productId', 'packageName', 'packageVersion', 'releaseTag', 'sourceCommit', 'snapshotCommit']) {
    if (stringValue(identitySubstrate?.[key]) && stringValue(proofSubstrate?.[key]) && identitySubstrate[key] !== proofSubstrate[key]) {
      conflicts.push(`proof substrate ${key} conflicts with run identity`);
    }
  }
  return {
    state: conflicts.length > 0 ? 'conflict' : proofDigest && proofCount !== null ? 'reconciled' : 'unsupported',
    sourceRef: proofPath,
    conflicts,
    eventCount: proofCount,
    eventDigest: proofDigest,
  };
}

function inlineBodySlot(event) {
  if (event.kind === 'basis_admitted' && isRecord(event.payload) && Object.hasOwn(event.payload, 'rawInputValue')) return { name: 'basis_input', field: 'rawInputValue' };
  if (event.kind === 'c_call_result_admitted' && isRecord(event.payload) && Object.hasOwn(event.payload, 'value')) return { name: 'c_call_result_value', field: 'value' };
  return null;
}
function exactKeys(value, keys) {
  return isRecord(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
}
function readIndexedRecord(fd, entry) {
  const bytes = Buffer.allocUnsafe(entry.byteLength);
  if (readSync(fd, bytes, 0, bytes.length, entry.offset) !== bytes.length || `sha256:${createHash('sha256').update(bytes).digest('hex')}` !== entry.exactDigest) throw new Error('body-reference source bytes changed');
  return parseStrictJson(UTF8_DECODER.decode(bytes.subarray(0, -1)));
}
function restoreBodyReference(record, bodies, readSource) {
  if (!exactKeys(record, ['kind', 'codecVersion', 'event', 'bodyReference']) || record.codecVersion !== 1 || !isRecord(record.event)) throw new Error('unsupported admitted-body-reference record');
  const ref = record.bodyReference;
  if (!exactKeys(ref, ['sourceEventRef', 'sourcePayloadDigest', 'sourceSlot', 'bodyDigest'])) throw new Error('invalid body reference shape');
  const source = bodies.get(ref.sourceEventRef);
  if (!source || source.slot !== ref.sourceSlot || source.payloadDigest !== ref.sourcePayloadDigest || source.bodyDigest !== ref.bodyDigest) throw new Error('body reference does not match a prior validated inline source');
  const event = record.event;
  const field = event.kind === 'basis_admitted' ? 'rawInputValue' : event.kind === 'c_call_result_admitted' ? 'value' : null;
  if (!field || !isRecord(event.payload) || Object.hasOwn(event.payload, field)) throw new Error('body reference target is not a body-elided admitted event');
  const sourceEvent = readSource(source);
  const body = sourceEvent.payload[source.field];
  if (sha256Canonical(body) !== ref.bodyDigest) throw new Error('body reference digest mismatch');
  return { event: { ...event, payload: { ...event.payload, [field]: body } }, reference: ref };
}

// Validation and decoding always precede Run filtering. Source ordinals are retained;
// page starts are offsets in this selected slice, not admission ordinals.
export function scopeAbgEventCarrier(index, runId) {
  if (!runId || index.envelopeProfile !== 'abiogenesis_5_root') return index;
  const selected = index.compactEvents.filter((event) => event.runId === runId);
  const ids = new Set(selected.map((event) => event.eventId));
  const entries = index.entries.filter((entry) => ids.has(entry.eventId));
  const byId = new Map(index.compactEvents.map((event) => [event.eventId, event]));
  const dependencies = new Set();
  const frontier = selected.flatMap((event) => event.causationEventRefs ?? []);
  for (const entry of entries) if (entry.storageReference) frontier.push(entry.storageReference.sourceEventRef);
  for (let i = 0; i < frontier.length; i += 1) {
    const ref = frontier[i];
    if (ids.has(ref) || dependencies.has(ref)) continue;
    const dependency = byId.get(ref);
    if (!dependency) continue;
    dependencies.add(ref);
    frontier.push(...(dependency.causationEventRefs ?? []));
  }
  const dependencyEvents = index.compactEvents.filter((event) => dependencies.has(event.eventId));
  const counts = {};
  for (const event of selected) counts[event.kind] = (counts[event.kind] ?? 0) + 1;
  const terminal = [...selected].reverse().find((event) => event.kind === 'run_closed') ?? null;
  return { ...index, selectedRunId: runId,
    generation: sha256Canonical({ ledgerGeneration: index.generation, runId }),
    ledgerEventCount: index.eventCount, dependencyEventCount: dependencyEvents.length, dependencyEvents,
    compactEvents: selected, entries, counts, eventCount: selected.length,
    firstOrdinal: selected[0]?.sourceOrdinal ?? null, lastOrdinal: selected.at(-1)?.sourceOrdinal ?? null,
    firstEventAt: selected[0]?.eventTime ?? null, lastEventAt: selected.at(-1)?.eventTime ?? null,
    eventPosture: index.builtInRootContractValidated ? terminalPosture(selected, index.envelopeProfile) : index.eventPosture,
    terminalEvent: terminal ? { eventId: terminal.eventId, ordinal: terminal.sourceOrdinal, eventTime: terminal.eventTime, terminalKind: 'closed', reason: terminal.reason ?? null, basisId: terminal.basisId ?? null } : null,
  };
}
