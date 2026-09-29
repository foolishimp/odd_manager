#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, resolve } from 'node:path';
import { StringDecoder } from 'node:string_decoder';
import { fileURLToPath, pathToFileURL } from 'node:url';

const CORE_FIELDS = [
  'kind',
  'eventId',
  'eventTime',
  'eventTimeUnixMs',
  'eventAdmissionOrdinal',
];
const MAX_DIAGNOSTIC_ROWS = 12;
const MAX_SAMPLE_VALUES = 12;
const DEFAULT_PROOF_MAX_BYTES = 32 * 1024 * 1024;
const DEFAULT_IDENTITY_MAX_BYTES = 4 * 1024 * 1024;

function statOf(path) {
  try {
    return statSync(path);
  } catch {
    return null;
  }
}

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function compactSample(value) {
  if (value.length <= 512) return value;
  return `${value.slice(0, 96)}...:${sha256Text(value)}:chars=${value.length}`;
}

function addSample(set, value) {
  if (typeof value === 'string' && value && set.size < MAX_SAMPLE_VALUES) {
    set.add(compactSample(value));
  }
}

function eventPathCandidate(inputPath) {
  const resolved = resolve(inputPath);
  const stats = statOf(resolved);
  if (stats?.isFile()) {
    return resolved.endsWith('.jsonl') ? { eventPath: resolved, runRoot: findRunRoot(resolved) } : null;
  }
  if (!stats?.isDirectory()) return null;
  for (const candidate of [
    join(resolved, 'instance', '.ai-workspace', 'events', 'events.jsonl'),
    join(resolved, '.ai-workspace', 'events', 'events.jsonl'),
    join(resolved, 'events', 'events.jsonl'),
  ]) {
    if (statOf(candidate)?.isFile()) {
      return { eventPath: candidate, runRoot: findRunRoot(candidate, resolved) };
    }
  }
  return null;
}

function proofCandidates(root) {
  if (!statOf(root)?.isDirectory()) return [];
  try {
    return readdirSync(root)
      .filter((name) => name.endsWith('-proof.json'))
      .sort()
      .map((name) => join(root, name));
  } catch {
    return [];
  }
}

function findRunRoot(eventPath, preferredRoot = null) {
  if (preferredRoot && proofCandidates(preferredRoot).length > 0) return preferredRoot;
  const workspaceRoot = dirname(dirname(dirname(eventPath)));
  if (basename(workspaceRoot) === 'instance') return dirname(workspaceRoot);
  let cursor = dirname(eventPath);
  for (let depth = 0; depth < 8; depth += 1) {
    if (proofCandidates(cursor).length > 0 || existsSync(join(cursor, 'sandbox-identity.json'))) {
      return cursor;
    }
    const parent = dirname(cursor);
    if (parent === cursor) break;
    cursor = parent;
  }
  if (preferredRoot) return preferredRoot;
  return dirname(dirname(dirname(dirname(eventPath))));
}

function proofObservation(runRoot, eventDigest, eventCount, stableSnapshot) {
  const candidate = proofCandidates(runRoot)[0] ?? null;
  if (!candidate) {
    return {
      state: 'absent',
      path: null,
      sha256: null,
      declaredEventLogSha256: null,
      eventLogDigestMatches: null,
      eventSequenceCount: null,
      eventSequenceCountMatches: null,
      substrate: null,
    };
  }
  const stats = statOf(candidate);
  if (!stats?.isFile() || stats.size > DEFAULT_PROOF_MAX_BYTES) {
    return {
      state: 'unreadable',
      path: candidate,
      sha256: null,
      declaredEventLogSha256: null,
      eventLogDigestMatches: null,
      eventSequenceCount: null,
      eventSequenceCountMatches: null,
      substrate: null,
    };
  }
  try {
    const bytes = readFileSync(candidate);
    const proof = JSON.parse(bytes.toString('utf8'));
    const declared = typeof proof.eventLogSha256 === 'string'
      ? proof.eventLogSha256
      : typeof proof.eventLogDigest === 'string'
        ? proof.eventLogDigest
        : null;
    const normalizedDeclared = declared && declared.startsWith('sha256:')
      ? declared
      : declared
        ? `sha256:${declared}`
        : null;
    const sequenceCount = Array.isArray(proof.eventSequence) ? proof.eventSequence.length : null;
    return {
      state: 'present',
      path: candidate,
      sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      declaredEventLogSha256: normalizedDeclared,
      eventLogDigestMatches: stableSnapshot && normalizedDeclared
        ? normalizedDeclared === eventDigest
        : null,
      eventSequenceCount: sequenceCount,
      eventSequenceCountMatches: stableSnapshot && sequenceCount !== null
        ? sequenceCount === eventCount
        : null,
      substrate: proof && typeof proof.substrate === 'object' && !Array.isArray(proof.substrate)
        ? {
            productId: typeof proof.substrate.productId === 'string' ? proof.substrate.productId : null,
            packageName: typeof proof.substrate.packageName === 'string' ? proof.substrate.packageName : null,
            packageVersion: typeof proof.substrate.packageVersion === 'string' ? proof.substrate.packageVersion : null,
            releaseTag: typeof proof.substrate.releaseTag === 'string' ? proof.substrate.releaseTag : null,
            sourceCommit: typeof proof.substrate.sourceCommit === 'string' ? proof.substrate.sourceCommit : null,
          }
        : null,
    };
  } catch {
    return {
      state: 'unreadable',
      path: candidate,
      sha256: null,
      declaredEventLogSha256: null,
      eventLogDigestMatches: null,
      eventSequenceCount: null,
      eventSequenceCountMatches: null,
      substrate: null,
    };
  }
}

function identityObservation(runRoot) {
  const candidate = [
    join(runRoot, 'sandbox-identity.json'),
    join(runRoot, 'instance', '.ai-workspace', 'sandbox-identity.json'),
  ].find((path) => statOf(path)?.isFile()) ?? null;
  if (!candidate) return { state: 'absent', path: null, sha256: null };
  const stats = statOf(candidate);
  if (!stats?.isFile() || stats.size > DEFAULT_IDENTITY_MAX_BYTES) {
    return { state: 'unreadable', path: candidate, sha256: null };
  }
  try {
    const bytes = readFileSync(candidate);
    const identity = JSON.parse(bytes.toString('utf8'));
    const substrate = identity && typeof identity.substrate === 'object' && !Array.isArray(identity.substrate)
      ? identity.substrate
      : null;
    return {
      state: 'present',
      path: candidate,
      sha256: `sha256:${createHash('sha256').update(bytes).digest('hex')}`,
      kind: typeof identity.kind === 'string' ? identity.kind : null,
      schemaVersion: typeof identity.schemaVersion === 'string' ? identity.schemaVersion : null,
      scenarioId: typeof identity.scenarioId === 'string' ? identity.scenarioId : null,
      scenarioKind: typeof identity.scenarioKind === 'string' ? identity.scenarioKind : null,
      proofClass: typeof identity.proofClass === 'string' ? identity.proofClass : null,
      scenarioProofClass: typeof identity.scenarioProofClass === 'string' ? identity.scenarioProofClass : null,
      graphRef: typeof identity.graphRef === 'string' ? identity.graphRef : null,
      graphFunctionRef: typeof identity.graphFunctionRef === 'string' ? identity.graphFunctionRef : null,
      overlayRef: typeof identity.overlayRef === 'string' ? identity.overlayRef : null,
      startupConfigRef: typeof identity.startupConfigRef === 'string' ? identity.startupConfigRef : null,
      requestedExecutorProfile: typeof identity.requestedExecutorProfile === 'string'
        ? identity.requestedExecutorProfile
        : null,
      terminalProofRequired: typeof identity.terminalProofRequired === 'boolean'
        ? identity.terminalProofRequired
        : null,
      substrate: substrate
        ? {
            productId: typeof substrate.productId === 'string' ? substrate.productId : null,
            packageName: typeof substrate.packageName === 'string' ? substrate.packageName : null,
            packageVersion: typeof substrate.packageVersion === 'string' ? substrate.packageVersion : null,
            releaseTag: typeof substrate.releaseTag === 'string' ? substrate.releaseTag : null,
            sourceCommit: typeof substrate.sourceCommit === 'string' ? substrate.sourceCommit : null,
            snapshotCommit: typeof substrate.snapshotCommit === 'string' ? substrate.snapshotCommit : null,
            tarballSha256: typeof substrate.tarballSha256 === 'string' ? substrate.tarballSha256 : null,
            productToolchainManifestDigest: typeof substrate.productToolchainManifestDigest === 'string'
              ? substrate.productToolchainManifestDigest
              : null,
            releaseSnapshotManifestSha256: typeof substrate.releaseSnapshotManifestSha256 === 'string'
              ? substrate.releaseSnapshotManifestSha256
              : null,
          }
        : null,
      observedProduct: {
        packageName: typeof identity.oddGlcPackageName === 'string' ? identity.oddGlcPackageName : null,
        packageVersion: typeof identity.oddGlcPackageVersion === 'string' ? identity.oddGlcPackageVersion : null,
        installMode: typeof identity.oddGlcInstallMode === 'string' ? identity.oddGlcInstallMode : null,
        tarballSha256: typeof identity.oddGlcPackageTarballSha256 === 'string'
          ? identity.oddGlcPackageTarballSha256
          : null,
      },
    };
  } catch {
    return { state: 'unreadable', path: candidate, sha256: null };
  }
}

function parseEventLine(line, lineNumber, state) {
  if (!line.trim()) return;
  state.nonEmptyLineCount += 1;
  state.maxLineBytes = Math.max(state.maxLineBytes, Buffer.byteLength(line));
  let event;
  try {
    event = JSON.parse(line);
  } catch (error) {
    state.invalidJsonCount += 1;
    if (state.invalidJson.length < MAX_DIAGNOSTIC_ROWS) {
      state.invalidJson.push({ line: lineNumber, message: error.message });
    }
    return;
  }
  if (!event || typeof event !== 'object' || Array.isArray(event)) {
    state.invalidEventCount += 1;
    return;
  }

  const index = state.eventCount;
  state.eventCount += 1;
  const kind = typeof event.kind === 'string' && event.kind ? event.kind : '<missing>';
  state.kindCounts.set(kind, (state.kindCounts.get(kind) ?? 0) + 1);
  const schema = state.schemas.get(kind) ?? new Set();
  for (const key of Object.keys(event)) schema.add(key);
  state.schemas.set(kind, schema);

  const missing = CORE_FIELDS.filter((field) => {
    const value = event[field];
    if (field === 'eventAdmissionOrdinal' || field === 'eventTimeUnixMs') {
      return !Number.isFinite(value);
    }
    return typeof value !== 'string' || !value;
  });
  if (missing.length > 0) {
    state.missingCoreFieldCount += 1;
    if (state.missingCoreFields.length < MAX_DIAGNOSTIC_ROWS) {
      state.missingCoreFields.push({ index, line: lineNumber, kind, fields: missing });
    }
  }

  const ordinal = Number.isInteger(event.eventAdmissionOrdinal)
    ? event.eventAdmissionOrdinal
    : null;
  if (ordinal !== null) {
    if (state.firstOrdinal === null) state.firstOrdinal = ordinal;
    if (state.previousOrdinal !== null && ordinal !== state.previousOrdinal + 1) {
      state.ordinalDiscontinuityCount += 1;
      if (state.ordinalDiscontinuities.length < MAX_DIAGNOSTIC_ROWS) {
        state.ordinalDiscontinuities.push({
          line: lineNumber,
          previous: state.previousOrdinal,
          observed: ordinal,
        });
      }
    }
    state.previousOrdinal = ordinal;
    state.lastOrdinal = ordinal;
  }

  if (typeof event.eventId === 'string') {
    if (state.eventIds.has(event.eventId)) state.duplicateEventIdCount += 1;
    state.eventIds.add(event.eventId);
  }
  if (Number.isFinite(event.eventTimeUnixMs)) {
    if (state.previousEventTimeUnixMs !== null && event.eventTimeUnixMs < state.previousEventTimeUnixMs) {
      state.timeRegressionCount += 1;
    }
    state.previousEventTimeUnixMs = event.eventTimeUnixMs;
  }

  if (typeof event.basisId === 'string') state.basisDigests.add(sha256Text(event.basisId));
  addSample(state.runIds, event.runId);
  addSample(state.workKeys, event.workKey);
  addSample(state.graphCallIds, event.graphCallId);
  addSample(state.frameIds, event.frameId);
  if (Number.isInteger(event.vectorIndex)) state.vectorIndexes.add(event.vectorIndex);
  if (kind === 'terminal_reached') {
    state.terminalCount += 1;
    state.lastTerminal = {
      ordinal,
      terminalKind: typeof event.terminalKind === 'string' ? event.terminalKind : null,
      reason: typeof event.reason === 'string' ? event.reason : null,
      eventTime: typeof event.eventTime === 'string' ? event.eventTime : null,
    };
  }

  const compact = {
    kind,
    eventAdmissionOrdinal: ordinal,
    eventId: typeof event.eventId === 'string' ? event.eventId : null,
    eventTime: typeof event.eventTime === 'string' ? event.eventTime : null,
    vectorIndex: Number.isInteger(event.vectorIndex) ? event.vectorIndex : null,
    graphCallId: typeof event.graphCallId === 'string' ? compactSample(event.graphCallId) : null,
    frameId: typeof event.frameId === 'string' ? compactSample(event.frameId) : null,
  };
  if (!state.firstEvent) state.firstEvent = compact;
  state.lastEvent = compact;
}

export async function analyzeEventCarrier(inputPath, options = {}) {
  const resolved = eventPathCandidate(inputPath);
  if (!resolved) throw new Error(`no events.jsonl carrier found for ${inputPath}`);
  const before = statOf(resolved.eventPath);
  if (!before?.isFile()) throw new Error(`event carrier is not a file: ${resolved.eventPath}`);

  const state = {
    eventCount: 0,
    nonEmptyLineCount: 0,
    maxLineBytes: 0,
    invalidJsonCount: 0,
    invalidJson: [],
    invalidEventCount: 0,
    missingCoreFieldCount: 0,
    missingCoreFields: [],
    firstOrdinal: null,
    lastOrdinal: null,
    previousOrdinal: null,
    ordinalDiscontinuityCount: 0,
    ordinalDiscontinuities: [],
    duplicateEventIdCount: 0,
    timeRegressionCount: 0,
    previousEventTimeUnixMs: null,
    terminalCount: 0,
    lastTerminal: null,
    firstEvent: null,
    lastEvent: null,
    eventIds: new Set(),
    kindCounts: new Map(),
    schemas: new Map(),
    basisDigests: new Set(),
    runIds: new Set(),
    workKeys: new Set(),
    graphCallIds: new Set(),
    frameIds: new Set(),
    vectorIndexes: new Set(),
  };
  const hash = createHash('sha256');
  const decoder = new StringDecoder('utf8');
  let carry = '';
  let lineNumber = 0;
  let bytesRead = 0;
  for await (const chunk of createReadStream(resolved.eventPath)) {
    bytesRead += chunk.length;
    hash.update(chunk);
    const text = carry + decoder.write(chunk);
    const lines = text.split('\n');
    carry = lines.pop() ?? '';
    for (const line of lines) {
      lineNumber += 1;
      parseEventLine(line.endsWith('\r') ? line.slice(0, -1) : line, lineNumber, state);
    }
  }
  carry += decoder.end();
  if (carry.length > 0) {
    lineNumber += 1;
    parseEventLine(carry.endsWith('\r') ? carry.slice(0, -1) : carry, lineNumber, state);
  }

  const after = statOf(resolved.eventPath);
  const stableSnapshot = Boolean(
    after
    && before.size === after.size
    && before.mtimeMs === after.mtimeMs
    && after.size === bytesRead
  );
  const eventDigest = `sha256:${hash.digest('hex')}`;
  const schemaObject = Object.fromEntries([...state.schemas.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([kind, keys]) => [kind, [...keys].sort()]));
  const proof = proofObservation(
    resolved.runRoot,
    eventDigest,
    state.eventCount,
    stableSnapshot,
  );
  const identity = identityObservation(resolved.runRoot);
  const structuralValid = state.invalidJsonCount === 0
    && state.invalidEventCount === 0
    && state.missingCoreFieldCount === 0
    && state.ordinalDiscontinuityCount === 0
    && state.duplicateEventIdCount === 0
    && state.timeRegressionCount === 0
    && proof.eventLogDigestMatches !== false
    && proof.eventSequenceCountMatches !== false;

  return {
    kind: 'odd_manager.abg_event_stream_census',
    version: 1,
    observedAt: new Date().toISOString(),
    input: isAbsolute(inputPath) ? inputPath : resolve(inputPath),
    runRoot: resolved.runRoot,
    eventPath: resolved.eventPath,
    fileModifiedAt: after ? after.mtime.toISOString() : null,
    stableSnapshot,
    structuralValid,
    bytes: bytesRead,
    sha256: eventDigest,
    eventCount: state.eventCount,
    nonEmptyLineCount: state.nonEmptyLineCount,
    maxLineBytes: state.maxLineBytes,
    eventKindCount: state.kindCounts.size,
    eventKindCounts: Object.fromEntries([...state.kindCounts.entries()].sort(([left], [right]) => left.localeCompare(right))),
    schemaFingerprint: sha256Text(JSON.stringify(schemaObject)),
    ...(options.includeSchemas ? { schemas: schemaObject } : {}),
    firstOrdinal: state.firstOrdinal,
    lastOrdinal: state.lastOrdinal,
    ordinalDiscontinuityCount: state.ordinalDiscontinuityCount,
    ordinalDiscontinuities: state.ordinalDiscontinuities,
    invalidJsonCount: state.invalidJsonCount,
    invalidJson: state.invalidJson,
    invalidEventCount: state.invalidEventCount,
    missingCoreFieldCount: state.missingCoreFieldCount,
    missingCoreFields: state.missingCoreFields,
    duplicateEventIdCount: state.duplicateEventIdCount,
    timeRegressionCount: state.timeRegressionCount,
    basisDigests: [...state.basisDigests].sort(),
    runIds: [...state.runIds].sort(),
    workKeys: [...state.workKeys].sort(),
    graphCallCount: state.graphCallIds.size,
    frameCount: state.frameIds.size,
    vectorIndexes: [...state.vectorIndexes].sort((left, right) => left - right),
    terminalCount: state.terminalCount,
    disposition: state.lastEvent?.kind === 'terminal_reached'
      ? state.lastTerminal?.terminalKind ?? 'terminal_unknown'
      : 'non_terminal',
    firstEvent: state.firstEvent,
    lastEvent: state.lastEvent,
    lastTerminal: state.lastTerminal,
    identity,
    proof,
  };
}

async function main(argv) {
  const includeSchemas = argv.includes('--schemas');
  const pretty = argv.includes('--pretty');
  const inputs = argv.filter((value) => !value.startsWith('--'));
  if (inputs.length === 0) {
    console.error('usage: analyze_abg_event_stream.mjs [--pretty] [--schemas] <run-root-or-events.jsonl>...');
    return 2;
  }
  const results = [];
  let failed = false;
  for (const input of inputs) {
    try {
      const result = await analyzeEventCarrier(input, { includeSchemas });
      results.push(result);
      if (!result.structuralValid) failed = true;
    } catch (error) {
      failed = true;
      results.push({
        kind: 'odd_manager.abg_event_stream_census_error',
        version: 1,
        input: isAbsolute(input) ? input : resolve(input),
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
  console.log(JSON.stringify(results, null, pretty ? 2 : 0));
  return failed ? 1 : 0;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : null;
if (invokedPath && pathToFileURL(invokedPath).href === import.meta.url) {
  process.exitCode = await main(process.argv.slice(2));
}

export const scriptPath = fileURLToPath(import.meta.url);
