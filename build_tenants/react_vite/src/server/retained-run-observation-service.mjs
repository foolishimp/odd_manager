import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { parseStrictJson } from './strict-json-service.mjs';
import { indexAbgEventCarrier, scopeAbgEventCarrier } from './abg-event-carrier-service.mjs';
import { ABI5_RC1_EVENT_CONTRACT_DIGEST } from './abi5-root-event-contract.mjs';

const MAX_JSON_BYTES = 32 * 1024 * 1024;
const MAX_CANDIDATE_FILES = 160;
const record = (value) => value && typeof value === 'object' && !Array.isArray(value);
const digest = (value) => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value);
const nonblank = (value) => typeof value === 'string' && /\S/u.test(value);
const refPair = (value) => exactKeys(value, ['ref', 'digest']) && nonblank(value.ref) && digest(value.digest);
const canonical = (value) => Array.isArray(value) ? `[${value.map(canonical).join(',')}]` : record(value) ? `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}` : JSON.stringify(value);
const hash = (bytes) => `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
const exactKeys = (value, keys) => record(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const RUNTIME_STATUSES = ['active', 'blocked', 'closed', 'failed', 'gap_stopped', 'held', 'refused', 'stopped', 'workspace'];
const jsonValue = (value) => value === null || typeof value === 'string' || typeof value === 'boolean'
  || (typeof value === 'number' && Number.isFinite(value))
  || (Array.isArray(value) ? value.every(jsonValue) : record(value) && Object.values(value).every(jsonValue));
function validTerminalResult(value) {
  if (value === null) return true;
  if (!exactKeys(value, ['kind', 'schemaVersion', 'result', 'contract', 'valueKind', 'valueDigest', 'value', 'producer', 'projectionBasis'])
    || value.kind !== 'abg_typed_terminal_result' || value.schemaVersion !== '5.0.0'
    || !refPair(value.result) || !refPair(value.contract) || !refPair(value.projectionBasis)
    || !nonblank(value.valueKind) || !digest(value.valueDigest) || !jsonValue(value.value)) return false;
  const producer = value.producer;
  const refs = ['runRef', 'graphCallRef', 'invocationAdmissionRef', 'cCallRef', 'resultAdmissionEventRef', 'judgmentRef', 'judgmentAdmissionEventRef'];
  const pairs = ['program', 'graphFunction', 'executionBasis', 'terminalRoute'];
  return exactKeys(producer, [...refs, ...pairs]) && refs.every((key) => nonblank(producer[key])) && pairs.every((key) => refPair(producer[key]));
}

// Frozen project/read/result.schema.json, run_replay base branch (SHA aef039…7a60c).
// The separate nativeLiveness branch is recognized but remains unqualified.
// Returning unsupported never admits its contents or a process-liveness claim.
export function classifyRetainedRunReplayResult(value) {
  if (!exactKeys(value, ['caseKey', 'source', 'projectionBasis', 'projection']) || value.caseKey !== 'run_replay'
    || !refPair(value.source) || !refPair(value.projectionBasis)) return 'invalid';
  const p = value.projection;
  const native = record(p) && Object.hasOwn(p, 'nativeLiveness');
  if (!exactKeys(p, ['kind', 'subject', 'replay', 'fromOrdinal', 'limit', 'status', 'terminalResult', ...(native ? ['nativeLiveness'] : [])])
    || p.kind !== 'run_replay_projection' || !refPair(p.subject) || !refPair(p.replay)
    || !Number.isSafeInteger(p.fromOrdinal) || p.fromOrdinal < 0 || !Number.isSafeInteger(p.limit) || p.limit < 1
    || !RUNTIME_STATUSES.includes(p.status) || !validTerminalResult(p.terminalResult)) return 'invalid';
  return native ? 'unsupported' : 'validated';
}

function unavailableRuntimeState(reason) {
  return { state: 'unavailable', status: null, reason, sourceRef: null, sourceDigest: null, prefix: null, asOfOrdinal: null,
    replayRef: null, replayDigest: null, replayFromOrdinal: null, replayLimit: null, terminalResultRef: null, coverage: 'unavailable' };
}
function within(root, path) {
  try { const rel = relative(realpathSync(root), realpathSync(path)); return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel)); } catch { return false; }
}
function readJson(path, root) {
  if (!within(root, path)) return null;
  try {
    const before = statSync(path);
    if (!before.isFile() || before.size > MAX_JSON_BYTES) return null;
    const bytes = readFileSync(path);
    const after = statSync(path);
    if (before.ino !== after.ino || before.size !== after.size || before.mtimeMs !== after.mtimeMs) return null;
    return { path, digest: hash(bytes), value: parseStrictJson(bytes.toString('utf8')), stats: after };
  } catch { return null; }
}
function receiptOf(value) {
  const transport = value?.output ?? value;
  if (transport?.kind !== 'installed_definition_call_transport_result' || transport.schemaVersion !== '5.0.0') return null;
  const receipt = transport.receipt;
  if (receipt?.kind !== 'definition_host_receipt' || receipt.schemaVersion !== '5.0.0' || receipt.exitCode !== 0 || receipt.failure !== null || receipt.ownerOutput?.outcomeKind !== 'result') return null;
  return receipt;
}
export function validRetainedPrefix(prefix) {
  if (!exactKeys(prefix, ['kind', 'schemaVersion', 'eventLogRef', 'prefixLength', 'prefixDigest', 'storeIdentity', 'coordinateDigest']) || prefix.kind !== 'durable_prefix_coordinate' || prefix.schemaVersion !== '5.0.0') return false;
  if (!exactKeys(prefix.storeIdentity, ['device', 'inode', 'eventContractDigest']) || prefix.storeIdentity.eventContractDigest !== ABI5_RC1_EVENT_CONTRACT_DIGEST) return false;
  if (![prefix.storeIdentity.device, prefix.storeIdentity.inode, prefix.prefixLength].every((n) => Number.isSafeInteger(n) && n >= 0) || !digest(prefix.prefixDigest) || !digest(prefix.coordinateDigest)) return false;
  try { const url = new URL(prefix.eventLogRef); if (url.protocol !== 'file:' || url.hostname !== '' || url.href !== prefix.eventLogRef) return false; } catch { return false; }
  const { coordinateDigest, ...body } = prefix;
  return hash(canonical(body)) === coordinateDigest;
}
function validEventResource(resource) {
  if (resource?.kind !== 'abg_event_resource_receipt' || resource.schemaVersion !== '5.0.0' || !validRetainedPrefix(resource.closeHandoff?.prefix) || !validRetainedPrefix(resource.entryPrefix)) return false;
  const { receiptDigest, ...body } = resource;
  return hash(canonical(body)) === receiptDigest;
}
function runtimeState(reads, run, prefix, ledger) {
  const rows = reads.filter(({ receipt }) => {
    const v = receipt.ownerOutput.value;
    return receipt.resources?.kind === 'abg_project_read_resource_receipt'
      && receipt.definitionKey?.operationId === 'abg.operation.project.read'
      && receipt.definitionKey?.memberKey === 'run_replay'
      && v?.caseKey === 'run_replay';
  });
  if (rows.length === 0) return unavailableRuntimeState('No published Run replay read is retained.');
  const bound = rows.filter(({ receipt }) => receipt.ownerOutput.value?.source?.ref === run.ref);
  if (bound.length !== 1) throw new Error('retained Run replay read selection is missing or ambiguous');
  const { receipt, file } = bound[0];
  const v = receipt.ownerOutput.value;
  const p = v.projection;
  const classification = classifyRetainedRunReplayResult(v);
  const readPrefix = receipt.resources?.eventResource?.closeHandoff?.prefix;
  if (classification === 'invalid' || !validEventResource(receipt.resources.eventResource) || canonical(readPrefix) !== canonical(prefix)
    || v.source.digest !== run.digest || canonical(p.subject) !== canonical(run)
    || v.projectionBasis.ref !== prefix.eventLogRef || v.projectionBasis.digest !== prefix.coordinateDigest
    || (p.terminalResult !== null && (p.terminalResult.producer.runRef !== run.ref || canonical(p.terminalResult.projectionBasis) !== canonical(v.projectionBasis)))) throw new Error('retained Run replay source, subject, prefix or status binding conflicts');
  if (classification === 'unsupported') return unavailableRuntimeState('Published Run replay uses the nativeLiveness branch, outside I01 qualification; identity and events remain observable.');
  if ((p.status === 'closed') !== Boolean(ledger.compactEvents.some((event) => event.runId === run.ref && event.kind === 'run_closed'))) throw new Error('published Run closure conflicts with the selected Run event history');
  return { state: 'published', status: p.status, reason: 'Published Run replay at the retained prefix; process liveness is separate.', sourceRef: file.path, sourceDigest: file.digest, prefix, asOfOrdinal: ledger.lastOrdinal, replayRef: p.replay.ref, replayDigest: p.replay.digest, replayFromOrdinal: p.fromOrdinal, replayLimit: p.limit, terminalResultRef: p.terminalResult?.result?.ref ?? null, coverage: 'exact_retained_prefix' };
}

// Names locate candidate files only. Typed published receipts, coordinates and
// exact archived bytes decide admission; no archived Product code is executed.
export function probeRetainedRunRoot(projectRoot, runRoot, options, diagnostics) {
  if (!within(projectRoot, runRoot)) return null;
  let entries;
  try { entries = readdirSync(runRoot, { withFileTypes: true }).filter((e) => e.isFile()); } catch { return null; }
  const eventCandidates = entries.filter((e) => e.name.endsWith('.jsonl'));
  if (!eventCandidates.length) return null;
  const files = entries.filter((e) => e.name.endsWith('.json')).sort((a, b) => (a.name === 'execution.json' ? -1 : b.name === 'execution.json' ? 1 : a.name.localeCompare(b.name))).slice(0, MAX_CANDIDATE_FILES).map((e) => readJson(join(runRoot, e.name), runRoot)).filter(Boolean);
  const receipts = files.map((file) => ({ file, receipt: receiptOf(file.value) })).filter((row) => row.receipt);
  const invocations = receipts.filter(({ receipt }) => receipt.resources?.kind === 'run_invocation_resource_receipt');
  if (!invocations.length) return null;
  try {
    if (invocations.length !== 1) throw new Error('retained invocation receipt is ambiguous');
    const { file, receipt } = invocations[0];
    const resources = receipt.resources;
    const run = resources.run;
    const prefix = resources.eventResource?.closeHandoff?.prefix;
    if (receipt.definitionKey?.operationId !== 'abg.operation.run.invoke' || !refPair(run) || !run.ref.startsWith('run://') || !validEventResource(resources.eventResource)) throw new Error('retained invocation lacks an admitted Run or durable prefix');
    const matchingFiles = eventCandidates.map((entry) => join(runRoot, entry.name)).filter((path) => within(runRoot, path) && statSync(path).size === prefix.prefixLength);
    if (matchingFiles.length !== 1) throw new Error('retained prefix must resolve to one in-bound archived event file');
    const eventPath = matchingFiles[0];
    const ledger = indexAbgEventCarrier(eventPath, { refresh: options.refresh === true, publishedEventContractDigest: prefix.storeIdentity.eventContractDigest, contractBindingPosture: 'retained_prefix_resolution' });
    if (ledger.state !== 'ready' || ledger.pendingBytes !== 0 || ledger.completePrefixBytes !== prefix.prefixLength || ledger.completePrefixDigest !== prefix.prefixDigest) throw new Error(`retained event prefix did not validate: ${ledger.diagnostics.at(-1)?.message ?? 'byte identity mismatch'}`);
    const opening = ledger.compactEvents.find((event) => event.kind === 'run_segment_opened' && event.runId === run.ref);
    if (!opening || opening.payloadDigest !== run.digest) throw new Error('published Run source digest differs from its opening semantic payload');
    const scoped = scopeAbgEventCarrier(ledger, run.ref);
    const status = runtimeState(receipts, run, prefix, ledger);
    const request = readJson(join(runRoot, 'start-request.jsonl'), runRoot)?.value;
    const catalog = request?.invocation?.invocation?.contractCatalog;
    const substrate = catalog ? { productId: catalog.productId, packageName: '@abiogenesis/typescript-tenant', packageVersion: '5.0.0-rc.1', productContentDigest: catalog.productContentDigest } : null;
    const modifiedMs = Math.max(file.stats.mtimeMs, statSync(eventPath).mtimeMs);
    const key = hash(canonical({ projectRoot: resolve(projectRoot), run, prefix: prefix.coordinateDigest, receiptDigest: file.digest, eventPath }));
    const admitted = {
      runId: run.ref, runDigest: run.digest, runKey: `run-observation:${key}`, legacyRunId: null,
      runRoot, relativeRunRoot: relative(projectRoot, runRoot), workspaceRoot: runRoot,
      identityPath: file.path, workspaceIdentityPath: null, identity: { kind: 'retained_published_run_observation', runRef: run.ref, runDigest: run.digest, substrate },
      proofPath: null, proofState: 'absent', proofError: null, eventPath,
      carrierKind: 'retained_published_run_observation', requiresExplicitSelection: true,
      scenarioId: null, scenarioKind: 'retained_observation', proofClass: null,
      observationLabel: basename(runRoot), graphRef: opening.graphRef ?? null,
      graphFunctionRef: opening.graphFunctionRef ?? null, overlayRef: null, startupConfigRef: null,
      substrate, eventContractDigest: prefix.storeIdentity.eventContractDigest, eventContractBindingPosture: 'retained_prefix_resolution',
      eventPrefixLength: prefix.prefixLength, eventPrefixDigest: prefix.prefixDigest, eventCoordinateDigest: prefix.coordinateDigest,
      retainedObservation: { kind: 'retained_prefix_resolution', originalCoordinate: prefix, archiveSourceRef: eventPath, receiptSourceRef: file.path, receiptDigest: file.digest },
      runtimeState: status, status: status.status ?? 'unknown', eventPosture: scoped.eventPosture,
      eventProfile: ledger.envelopeProfile, eventGeneration: scoped.generation,
      modifiedAt: new Date(modifiedMs).toISOString(), modifiedMs, eventCount: scoped.eventCount, lastEventAt: scoped.lastEventAt,
      artifactPaths: [file.path, eventPath, ...receipts.filter((row) => row.receipt.resources?.kind === 'abg_project_read_resource_receipt').map((row) => row.file.path)],
      proofMtimeMs: 0, identityMtimeMs: file.stats.mtimeMs,
    };
    admitted.relatedRuns = ledger.compactEvents.filter((event) => event.kind === 'run_segment_opened' && event.runId !== run.ref).map((event) => {
      const related = scopeAbgEventCarrier(ledger, event.runId);
      return { ...admitted, relatedRuns: undefined, discoveryAuthority: 'event_opening',
        runId: event.runId, runDigest: event.payloadDigest, runKey: `run-observation:${hash(canonical({ key, runId: event.runId }))}`,
        identity: { ...admitted.identity, runRef: event.runId, runDigest: event.payloadDigest },
        observationLabel: `${basename(runRoot)} · source Run`, graphFunctionRef: event.graphFunctionRef ?? null,
        status: 'unknown', runtimeState: unavailableRuntimeState('This shared prefix has no published replay read for the source Run.'),
        eventPosture: related.eventPosture, eventGeneration: related.generation, eventCount: related.eventCount, lastEventAt: related.lastEventAt,
      };
    });
    return admitted;
  } catch (error) {
    diagnostics.push({ severity: 'error', code: 'retained_run_binding_invalid', message: error.message, sourceRef: runRoot });
    return null;
  }
}
