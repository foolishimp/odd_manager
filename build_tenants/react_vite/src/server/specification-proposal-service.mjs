import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  fsyncSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  projectRevisionSchema,
  specificationProposalDecisionRequestSchema,
  specificationProposalGenerateRequestSchema,
  specificationProposalHistorySchema,
  specificationProposalIdentityRequestSchema,
  specificationProposalProviderResponseSchema,
  specificationProposalSchema,
} from '@odd-manager/developer-control-contracts';
import {
  observeProjectRevision,
  sameProjectRevisionBasis,
} from './project-revision-service.mjs';

const DEFAULT_RETENTION_LIMIT = 50;
const DEFAULT_STALE_LOCK_MS = 30_000;
const LOCK_CLAIM_SCHEMA_VERSION = '2';
const ACCEPTANCE_JOURNAL_SCHEMA_VERSION = '1';
const MAX_ATTACHMENT_BYTES = 65536;
const MAX_TOTAL_ATTACHMENT_BYTES = 262144;
const projectCommitQueues = new Map();
const activeProjectLockTokens = new Map();
const projectLockOwnerInstanceId = randomUUID();

export class SpecificationProposalError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = 'SpecificationProposalError';
    this.statusCode = options.statusCode ?? 400;
    this.proposal = options.proposal ?? null;
  }
}

function isPathWithin(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === '' || (!rel.startsWith('..') && !isAbsolute(rel));
}

function sha256(value) {
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

function normalizeRoot(value) {
  const root = resolve(value);
  if (!existsSync(root) || !statSync(root).isDirectory()) {
    throw new SpecificationProposalError('proposal Project root must be an existing directory');
  }
  return root;
}

function proposalStoreId(projectRoot) {
  return createHash('sha256').update(resolve(projectRoot)).digest('hex').slice(0, 24);
}

function defaultProcessIsAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return !(error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH');
  }
}

function parseProjectLockRecord(raw) {
  try {
    const value = JSON.parse(raw);
    if (
      !value
      || typeof value !== 'object'
      || !Number.isSafeInteger(value.pid)
      || value.pid <= 0
      || typeof value.acquiredAt !== 'string'
      || !Number.isFinite(Date.parse(value.acquiredAt))
      || (value.token !== undefined && (typeof value.token !== 'string' || !value.token))
      || (
        value.ownerInstanceId !== undefined
        && (typeof value.ownerInstanceId !== 'string' || !value.ownerInstanceId)
      )
    ) {
      return null;
    }
    return {
      pid: value.pid,
      acquiredAt: value.acquiredAt,
      token: value.token ?? null,
      ownerInstanceId: value.ownerInstanceId ?? null,
      phase: value.phase ?? null,
      ticket: value.ticket ?? null,
    };
  } catch {
    return null;
  }
}

function parseProjectLockClaim(raw) {
  const record = parseProjectLockRecord(raw);
  if (
    !record
    || record.token === null
    || record.ownerInstanceId === null
    || !['choosing', 'held'].includes(record.phase)
    || (
      record.phase === 'choosing'
        ? record.ticket !== null
        : !Number.isSafeInteger(record.ticket) || record.ticket < 1
    )
  ) {
    return null;
  }
  try {
    if (JSON.parse(raw).schemaVersion !== LOCK_CLAIM_SCHEMA_VERSION) return null;
  } catch {
    return null;
  }
  return record;
}

function readProjectLockSnapshot(path, parser = parseProjectLockRecord) {
  let stat;
  try {
    stat = lstatSync(path);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    return { stat: null, raw: null, record: null, indeterminate: true };
  }
  if (!stat.isFile()) {
    return { stat, raw: null, record: null, indeterminate: true };
  }
  try {
    const raw = readFileSync(path, 'utf8');
    return { stat, raw, record: parser(raw), indeterminate: false };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    return { stat, raw: null, record: null, indeterminate: true };
  }
}

function growthAuthorityExhausted(status) {
  return status === 'accepted' || status === 'rejected' || status === 'superseded';
}

function assertRefinablePredecessor(proposal) {
  if (proposal && growthAuthorityExhausted(proposal.status)) {
    throw new SpecificationProposalError(
      `cannot refine a ${proposal.status} proposal because its growth authority is exhausted`,
      { statusCode: 409, proposal },
    );
  }
  return proposal;
}

function attachmentKind(sourceRef) {
  const normalized = sourceRef.toLowerCase();
  if (normalized.includes('requirement')) return 'requirement';
  if (normalized.includes('design')) return 'design';
  if (normalized.includes('ticket')) return 'ticket';
  if (normalized.includes('evidence') || normalized.includes('proof')) return 'evidence';
  if (normalized.includes('run')) return 'run';
  if (normalized.includes('gate')) return 'gate';
  if (normalized.includes('asset') || normalized.includes('artifact')) return 'asset';
  return sourceRef.includes('://') ? 'external' : 'file';
}

function resolveAttachments(projectRoot, sourceRefs) {
  let totalBytes = 0;
  return [...new Set(sourceRefs)].map((sourceRef) => {
    if (sourceRef.includes('://')) {
      return {
        record: {
          sourceRef,
          kind: attachmentKind(sourceRef),
          label: sourceRef,
          digest: sha256(sourceRef),
        },
        content: null,
      };
    }
    if (isAbsolute(sourceRef)) {
      throw new SpecificationProposalError('proposal context file refs must be Project-relative');
    }
    const absolutePath = resolve(projectRoot, sourceRef);
    if (!isPathWithin(projectRoot, absolutePath) || !existsSync(absolutePath)) {
      throw new SpecificationProposalError(`proposal context attachment is unavailable: ${sourceRef}`);
    }
    const realPath = realpathSync(absolutePath);
    if (!isPathWithin(realpathSync(projectRoot), realPath) || !statSync(realPath).isFile()) {
      throw new SpecificationProposalError(`proposal context attachment must be a file inside the Project: ${sourceRef}`);
    }
    const content = readFileSync(realPath);
    if (content.byteLength > MAX_ATTACHMENT_BYTES) {
      throw new SpecificationProposalError(`proposal context attachment exceeds ${MAX_ATTACHMENT_BYTES} bytes: ${sourceRef}`);
    }
    totalBytes += content.byteLength;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES) {
      throw new SpecificationProposalError(`proposal context exceeds ${MAX_TOTAL_ATTACHMENT_BYTES} bytes`);
    }
    return {
      record: {
        sourceRef: relative(projectRoot, realPath).split('\\').join('/'),
        kind: attachmentKind(sourceRef),
        label: basename(realPath),
        digest: sha256(content),
      },
      content: content.toString('utf8'),
    };
  });
}

function malformedPatch(detail) {
  throw new SpecificationProposalError(`proposal patch is malformed: ${detail}`);
}

function normalizePatchPath(value, expectedPrefix = null, allowNull = false) {
  const token = String(value ?? '');
  if (token === '/dev/null') {
    if (allowNull) return null;
    return malformedPatch('/dev/null is not valid in a diff --git path');
  }
  if (
    !token
    || /\s/.test(token)
    || token.includes('"')
    || token.includes("'")
    || token.includes('\\')
  ) {
    return malformedPatch('quoted, escaped, or whitespace-bearing paths are unsupported');
  }
  if (expectedPrefix !== null) {
    const prefix = `${expectedPrefix}/`;
    if (!token.startsWith(prefix)) {
      return malformedPatch(`expected a ${prefix} path`);
    }
    return normalizePatchPath(token.slice(prefix.length));
  }
  if (isAbsolute(token)) return malformedPatch('absolute paths are unsupported');
  const segments = token.split('/');
  if (segments.some((segment) => !segment || segment === '.' || segment === '..')) {
    return malformedPatch('non-canonical paths are unsupported');
  }
  return token;
}

function parseGitDiffHeader(line) {
  const match = /^diff --git (\S+) (\S+)$/.exec(line);
  if (!match) malformedPatch('invalid diff --git header');
  return {
    oldPath: normalizePatchPath(match[1], 'a'),
    newPath: normalizePatchPath(match[2], 'b'),
  };
}

function consumeUnifiedHunk(lines, start) {
  const match = /^@@ -\d+(?:,(\d+))? \+\d+(?:,(\d+))? @@(?: .*)?$/.exec(lines[start]);
  if (!match) malformedPatch('invalid unified hunk header');
  let oldRemaining = match[1] === undefined ? 1 : Number(match[1]);
  let newRemaining = match[2] === undefined ? 1 : Number(match[2]);
  let cursor = start + 1;
  let sawBodyLine = false;
  while (oldRemaining > 0 || newRemaining > 0) {
    const line = lines[cursor];
    if (line === undefined || line.startsWith('diff --git ')) {
      malformedPatch('unclosed unified hunk');
    }
    if (line === '\\ No newline at end of file') {
      if (!sawBodyLine) malformedPatch('orphaned no-newline marker');
      cursor += 1;
      continue;
    }
    if (line.startsWith(' ')) {
      oldRemaining -= 1;
      newRemaining -= 1;
    } else if (line.startsWith('-')) {
      oldRemaining -= 1;
    } else if (line.startsWith('+')) {
      newRemaining -= 1;
    } else {
      malformedPatch('unprefixed line inside unified hunk');
    }
    if (oldRemaining < 0 || newRemaining < 0) {
      malformedPatch('unified hunk contains more lines than declared');
    }
    sawBodyLine = true;
    cursor += 1;
  }
  while (lines[cursor] === '\\ No newline at end of file') cursor += 1;
  return cursor;
}

function parseGitDiffSection(lines, start) {
  const diffPaths = parseGitDiffHeader(lines[start]);
  let cursor = start + 1;
  let unifiedOld;
  let unifiedNew;
  let renameFrom;
  let renameTo;
  let newFile = false;
  let deletedFile = false;
  let sawHunk = false;

  while (cursor < lines.length && !lines[cursor].startsWith('diff --git ')) {
    const line = lines[cursor];
    if (line === '') {
      cursor += 1;
      continue;
    }
    if (line.startsWith('@@ ')) {
      if (unifiedOld === undefined || unifiedNew === undefined) {
        malformedPatch('unified hunks require one paired ---/+++ file header');
      }
      sawHunk = true;
      cursor = consumeUnifiedHunk(lines, cursor);
      continue;
    }
    if (sawHunk) {
      malformedPatch('file metadata or headers appear after unified hunks');
    }
    if (unifiedOld !== undefined && unifiedNew === undefined && !line.startsWith('+++ ')) {
      malformedPatch('--- and +++ file headers must be adjacent and paired');
    }
    if (line.startsWith('--- ')) {
      if (unifiedOld !== undefined || unifiedNew !== undefined) {
        malformedPatch('duplicate unified file header');
      }
      unifiedOld = normalizePatchPath(line.slice(4), 'a', true);
    } else if (line.startsWith('+++ ')) {
      if (unifiedOld === undefined || unifiedNew !== undefined) {
        malformedPatch('orphaned +++ file header');
      }
      unifiedNew = normalizePatchPath(line.slice(4), 'b', true);
    } else if (line.startsWith('rename from ')) {
      if (renameFrom !== undefined) malformedPatch('duplicate rename-from header');
      renameFrom = normalizePatchPath(line.slice('rename from '.length));
    } else if (line.startsWith('rename to ')) {
      if (renameFrom === undefined || renameTo !== undefined) {
        malformedPatch('rename-from and rename-to headers must be paired');
      }
      renameTo = normalizePatchPath(line.slice('rename to '.length));
    } else if (line.startsWith('copy from ') || line.startsWith('copy to ')) {
      malformedPatch('copy diffs are unsupported');
    } else if (line.startsWith('new file mode ')) {
      if (newFile) malformedPatch('duplicate new-file header');
      newFile = true;
    } else if (line.startsWith('deleted file mode ')) {
      if (deletedFile) malformedPatch('duplicate deleted-file header');
      deletedFile = true;
    } else if (
      line.startsWith('index ')
      || line.startsWith('old mode ')
      || line.startsWith('new mode ')
      || line.startsWith('similarity index ')
      || line.startsWith('dissimilarity index ')
    ) {
      // Non-path Git metadata is admitted; git apply performs its exact validation.
    } else if (line === 'GIT binary patch' || line.startsWith('Binary files ')) {
      malformedPatch('binary diffs are unsupported');
    } else {
      malformedPatch(`unsupported file-diff header: ${line}`);
    }
    cursor += 1;
  }

  if ((unifiedOld === undefined) !== (unifiedNew === undefined)) {
    malformedPatch('--- and +++ file headers must be paired');
  }
  if ((renameFrom === undefined) !== (renameTo === undefined)) {
    malformedPatch('rename-from and rename-to headers must be paired');
  }
  if (newFile && deletedFile) malformedPatch('a file cannot be both new and deleted');

  const renamed = renameFrom !== undefined;
  if (renamed) {
    if (
      newFile
      || deletedFile
      || renameFrom !== diffPaths.oldPath
      || renameTo !== diffPaths.newPath
      || renameFrom === renameTo
    ) {
      malformedPatch('rename metadata does not match the diff --git paths');
    }
  } else if (diffPaths.oldPath !== diffPaths.newPath) {
    malformedPatch('changed diff --git paths require exact rename metadata');
  }

  if (unifiedOld !== undefined) {
    if (newFile) {
      if (unifiedOld !== null || unifiedNew !== diffPaths.newPath || renamed) {
        malformedPatch('new-file headers do not match the diff --git path');
      }
    } else if (deletedFile) {
      if (unifiedOld !== diffPaths.oldPath || unifiedNew !== null || renamed) {
        malformedPatch('deleted-file headers do not match the diff --git path');
      }
    } else if (
      unifiedOld === null
      || unifiedNew === null
      || unifiedOld !== diffPaths.oldPath
      || unifiedNew !== diffPaths.newPath
    ) {
      malformedPatch('unified file headers do not match the diff --git paths');
    }
  } else if (sawHunk) {
    malformedPatch('unified hunks require file headers');
  }

  return {
    cursor,
    paths: renamed
      ? [diffPaths.oldPath, diffPaths.newPath]
      : [diffPaths.newPath],
  };
}

export function specificationProposalPatchPaths(patch) {
  const lines = String(patch ?? '').split('\n');
  const paths = [];
  let cursor = 0;
  while (cursor < lines.length) {
    if (lines[cursor] === '') {
      cursor += 1;
      continue;
    }
    if (!lines[cursor].startsWith('diff --git ')) {
      malformedPatch('every file section must begin with diff --git');
    }
    const section = parseGitDiffSection(lines, cursor);
    paths.push(...section.paths);
    cursor = section.cursor;
  }
  const unique = [...new Set(paths)];
  if (unique.length === 0) {
    throw new SpecificationProposalError('proposal patch contains no file diff');
  }
  return unique;
}

function validateSpecificationPaths(projectRoot, paths) {
  for (const path of paths) {
    if (!path.startsWith('specification/') || !isPathWithin(projectRoot, resolve(projectRoot, path))) {
      throw new SpecificationProposalError(`proposal patch path is outside specification/: ${path}`);
    }
  }
}

function patchFile(patch, callback) {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-proposal-patch-'));
  const path = join(root, 'proposal.patch');
  try {
    writeFileSync(path, patch, 'utf8');
    return callback(path);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

function gitApplyCheck(projectRoot, patch, whitespace = false) {
  return patchFile(patch, (path) => {
    const args = ['-C', projectRoot, 'apply', '--check'];
    if (whitespace) args.push('--whitespace=error-all');
    args.push(path);
    execFileSync('git', args, {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
  });
}

function gitApply(projectRoot, patch) {
  return patchFile(patch, (path) => {
    execFileSync('git', ['-C', projectRoot, 'apply', '--whitespace=nowarn', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
  });
}

function gitApplyReverseCheck(projectRoot, patch) {
  return patchFile(patch, (path) => {
    execFileSync('git', ['-C', projectRoot, 'apply', '--reverse', '--check', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
  });
}

function gitApplyReverse(projectRoot, patch) {
  return patchFile(patch, (path) => {
    execFileSync('git', ['-C', projectRoot, 'apply', '--reverse', '--whitespace=nowarn', path], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
  });
}

function errorDetail(error) {
  const stderr = error && typeof error === 'object' && 'stderr' in error
    ? String(error.stderr ?? '').trim()
    : '';
  return stderr || (error instanceof Error ? error.message : String(error));
}

class SimulatedAcceptanceCrash extends Error {
  constructor(phase) {
    super(`simulated acceptance crash at ${phase}`);
    this.name = 'SimulatedAcceptanceCrash';
  }
}

function proposalById(store, proposalId) {
  const proposal = store.proposals.find((entry) => entry.proposalId === proposalId) ?? null;
  if (!proposal) {
    throw new SpecificationProposalError(`specification proposal not found: ${proposalId}`, { statusCode: 404 });
  }
  return proposal;
}

export function createSpecificationProposalService(options) {
  if (!options?.managerStateRoot) throw new Error('managerStateRoot is required');
  if (!options?.provider?.participantRef || typeof options.provider.generate !== 'function') {
    throw new Error('specification proposal provider is required');
  }
  const managerStateRoot = resolve(options.managerStateRoot);
  const provider = options.provider;
  const retentionLimit = Number(options.retentionLimit ?? DEFAULT_RETENTION_LIMIT);
  const now = options.now ?? (() => new Date().toISOString());
  const idFactory = options.idFactory ?? (() => `proposal-${randomUUID()}`);
  const lockTokenFactory = options.lockTokenFactory ?? randomUUID;
  const processIsAlive = options.processIsAlive ?? defaultProcessIsAlive;
  const staleLockMs = Number(options.staleLockMs ?? DEFAULT_STALE_LOCK_MS);
  const beforeValidationCommit = options.beforeValidationCommit ?? (() => undefined);
  const acceptanceFaultInjector = options.acceptanceFaultInjector ?? (() => undefined);
  if (typeof lockTokenFactory !== 'function') {
    throw new Error('lockTokenFactory must be a function');
  }
  if (typeof processIsAlive !== 'function') {
    throw new Error('processIsAlive must be a function');
  }
  if (!Number.isFinite(staleLockMs) || staleLockMs < 0) {
    throw new Error('staleLockMs must be a non-negative finite number');
  }
  if (typeof beforeValidationCommit !== 'function') {
    throw new Error('beforeValidationCommit must be a function');
  }
  if (typeof acceptanceFaultInjector !== 'function') {
    throw new Error('acceptanceFaultInjector must be a function');
  }
  const storeRoot = join(
    managerStateRoot,
    '.ai-workspace',
    'runtime',
    'developer-control',
    'specification-proposals',
  );
  mkdirSync(storeRoot, { recursive: true });

  function storePath(projectRoot) {
    return join(storeRoot, `${proposalStoreId(projectRoot)}.json`);
  }

  function lockPath(projectRoot) {
    return join(storeRoot, `${proposalStoreId(projectRoot)}.lock`);
  }

  function acceptanceJournalPath(projectRoot) {
    return join(storeRoot, `${proposalStoreId(projectRoot)}.acceptance-journal.json`);
  }

  function fsyncDirectory(path) {
    const descriptor = openSync(path, 'r');
    try {
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
  }

  function writeDurableFileAtomic(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    let descriptor = null;
    try {
      descriptor = openSync(temporaryPath, 'wx');
      writeFileSync(descriptor, content, 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      renameSync(temporaryPath, path);
      fsyncDirectory(dirname(path));
    } catch (error) {
      if (descriptor !== null) {
        try { closeSync(descriptor); } catch { /* Descriptor cleanup is best effort. */ }
      }
      try { unlinkSync(temporaryPath); } catch { /* Temporary cleanup is best effort. */ }
      throw error;
    }
  }

  function publishDurableUniqueFile(path, content) {
    mkdirSync(dirname(path), { recursive: true });
    const ownerPath = `${path}.${process.pid}.${randomUUID()}.owner`;
    let descriptor = null;
    try {
      descriptor = openSync(ownerPath, 'wx');
      writeFileSync(descriptor, content, 'utf8');
      fsyncSync(descriptor);
      closeSync(descriptor);
      descriptor = null;
      linkSync(ownerPath, path);
      fsyncDirectory(dirname(path));
    } finally {
      if (descriptor !== null) {
        try { closeSync(descriptor); } catch { /* Descriptor cleanup is best effort. */ }
      }
      try { unlinkSync(ownerPath); } catch { /* Owner-file cleanup is best effort. */ }
    }
  }

  function removeDurableFile(path) {
    unlinkSync(path);
    fsyncDirectory(dirname(path));
  }

  function emptyStore(projectRoot) {
    return specificationProposalHistorySchema.parse({
      schemaVersion: '1',
      projectRoot,
      proposals: [],
      retentionLimit,
      truncated: false,
      sourceRefs: [`proposal-store://${proposalStoreId(projectRoot)}`],
    });
  }

  function loadStore(projectRootInput) {
    const projectRoot = normalizeRoot(projectRootInput);
    const path = storePath(projectRoot);
    if (!existsSync(path)) return emptyStore(projectRoot);
    let parsed;
    try {
      parsed = specificationProposalHistorySchema.parse(JSON.parse(readFileSync(path, 'utf8')));
    } catch (error) {
      throw new SpecificationProposalError(`proposal store is invalid: ${errorDetail(error)}`, { statusCode: 500 });
    }
    if (resolve(parsed.projectRoot) !== projectRoot || parsed.retentionLimit !== retentionLimit) {
      throw new SpecificationProposalError('proposal store identity or retention policy does not match', { statusCode: 500 });
    }
    return parsed;
  }

  function writeStore(store) {
    const admitted = specificationProposalHistorySchema.parse(store);
    const path = storePath(admitted.projectRoot);
    writeDurableFileAtomic(path, `${JSON.stringify(admitted, null, 2)}\n`);
    return admitted;
  }

  function lockSnapshotIsActive(path, snapshot, observedAt, ownToken = null) {
    if (!snapshot) return false;
    if (snapshot.indeterminate) return true;
    const acquiredAt = snapshot.record
      ? Date.parse(snapshot.record.acquiredAt)
      : snapshot.stat.mtimeMs;
    if (
      !Number.isFinite(observedAt)
      || !Number.isFinite(acquiredAt)
      || observedAt < acquiredAt
      || observedAt - acquiredAt < staleLockMs
    ) {
      return true;
    }
    if (!snapshot.record) return false;
    if (ownToken !== null && snapshot.record.token === ownToken) return true;
    if (
      snapshot.record.pid === process.pid
      && snapshot.record.ownerInstanceId === projectLockOwnerInstanceId
      && snapshot.record.token !== null
    ) {
      return activeProjectLockTokens.get(path) === snapshot.record.token;
    }
    try {
      return processIsAlive(snapshot.record.pid) !== false;
    } catch {
      return true;
    }
  }

  function currentLockClaims(claimRoot, observedAt, ownToken) {
    let names;
    try {
      names = readdirSync(claimRoot).filter((name) => name.endsWith('.claim')).sort();
    } catch (error) {
      throw new SpecificationProposalError(
        `proposal lock claims are unavailable: ${errorDetail(error)}`,
        { statusCode: 500 },
      );
    }
    return names
      .map((name) => {
        const path = join(claimRoot, name);
        const snapshot = readProjectLockSnapshot(path, parseProjectLockClaim);
        return {
          path,
          snapshot,
          active: lockSnapshotIsActive(path, snapshot, observedAt, ownToken),
        };
      })
      .filter((entry) => entry.active);
  }

  function releaseProjectLock(lock) {
    const snapshot = readProjectLockSnapshot(lock.claimPath, parseProjectLockClaim);
    if (
      snapshot?.record
      && snapshot.record.pid === lock.owner.pid
      && snapshot.record.acquiredAt === lock.owner.acquiredAt
      && snapshot.record.ownerInstanceId === lock.owner.ownerInstanceId
      && snapshot.record.token === lock.owner.token
    ) {
      try { removeDurableFile(lock.claimPath); } catch { /* Exact abandoned claim ages out safely. */ }
    }
    if (activeProjectLockTokens.get(lock.claimPath) === lock.owner.token) {
      activeProjectLockTokens.delete(lock.claimPath);
    }
  }

  function acquireProjectLock(path) {
    const token = String(lockTokenFactory());
    if (!token) throw new Error('lockTokenFactory returned an empty token');
    const acquiredAt = now();
    if (!Number.isFinite(Date.parse(acquiredAt))) {
      throw new Error('now returned an invalid lock acquisition timestamp');
    }
    const owner = {
      schemaVersion: LOCK_CLAIM_SCHEMA_VERSION,
      pid: process.pid,
      acquiredAt,
      ownerInstanceId: projectLockOwnerInstanceId,
      token,
      phase: 'choosing',
      ticket: null,
    };
    const claimRoot = `${path}.claims`;
    mkdirSync(claimRoot, { recursive: true });
    const claimId = createHash('sha256').update(token).digest('hex');
    const claimPath = join(claimRoot, `${claimId}.claim`);
    try {
      publishDurableUniqueFile(claimPath, `${JSON.stringify(owner)}\n`);
    } catch (error) {
      throw new SpecificationProposalError(
        `proposal lock claim is unavailable: ${errorDetail(error)}`,
        { statusCode: 500 },
      );
    }
    activeProjectLockTokens.set(claimPath, token);
    const lock = { claimPath, owner };
    try {
      const observedAt = Date.parse(now());
      const legacySnapshot = readProjectLockSnapshot(path);
      if (lockSnapshotIsActive(path, legacySnapshot, observedAt)) {
        throw new SpecificationProposalError(
          'another proposal decision is active for this Project',
          { statusCode: 409 },
        );
      }
      const choosingClaims = currentLockClaims(claimRoot, observedAt, token);
      const maxTicket = choosingClaims.reduce((maximum, entry) => (
        entry.snapshot?.record?.phase === 'held'
          ? Math.max(maximum, entry.snapshot.record.ticket)
          : maximum
      ), 0);
      if (!Number.isSafeInteger(maxTicket + 1)) {
        throw new SpecificationProposalError('proposal lock ticket space is exhausted', { statusCode: 500 });
      }
      lock.owner = { ...owner, phase: 'held', ticket: maxTicket + 1 };
      writeDurableFileAtomic(claimPath, `${JSON.stringify(lock.owner)}\n`);

      const electedAt = Date.parse(now());
      const election = currentLockClaims(claimRoot, electedAt, token);
      const choosingOther = election.some((entry) => (
        entry.path !== claimPath
        && (
          !entry.snapshot?.record
          || entry.snapshot.record.phase === 'choosing'
        )
      ));
      const held = election
        .filter((entry) => entry.snapshot?.record?.phase === 'held')
        .sort((left, right) => (
          left.snapshot.record.ticket - right.snapshot.record.ticket
          || left.snapshot.record.token.localeCompare(right.snapshot.record.token)
        ));
      if (choosingOther || held[0]?.path !== claimPath) {
        throw new SpecificationProposalError(
          'another proposal decision is active for this Project',
          { statusCode: 409 },
        );
      }
      return lock;
    } catch (error) {
      releaseProjectLock(lock);
      throw error;
    }
  }

  async function withProjectLock(projectRootInput, callback) {
    const projectRoot = normalizeRoot(projectRootInput);
    const path = lockPath(projectRoot);
    const precedingCommit = projectCommitQueues.get(path) ?? Promise.resolve();
    let releaseCommit;
    const queuedCommit = new Promise((resolveCommit) => {
      releaseCommit = resolveCommit;
    });
    projectCommitQueues.set(path, queuedCommit);
    await precedingCommit;

    let lock = null;
    try {
      lock = acquireProjectLock(path);
      try {
        reconcileAcceptanceJournalLocked(projectRoot);
        return await callback();
      } finally {
        releaseProjectLock(lock);
      }
    } finally {
      releaseCommit();
      if (projectCommitQueues.get(path) === queuedCommit) {
        projectCommitQueues.delete(path);
      }
    }
  }

  function replaceProposal(store, proposal) {
    const admitted = specificationProposalSchema.parse(proposal);
    const proposals = [
      admitted,
      ...store.proposals.filter((entry) => entry.proposalId !== admitted.proposalId),
    ];
    const truncated = store.truncated || proposals.length > retentionLimit;
    return writeStore({
      ...store,
      proposals: proposals.slice(0, retentionLimit),
      truncated,
    });
  }

  function parseAcceptanceJournal(value, projectRoot) {
    const phasesWithExpectedRevision = new Set([
      'probe_applied',
      'ready',
      'applying',
      'source_applied',
      'store_committed',
    ]);
    const phasesWithAcceptedProposal = new Set([
      'ready',
      'applying',
      'source_applied',
      'store_committed',
    ]);
    if (
      !value
      || typeof value !== 'object'
      || value.schemaVersion !== ACCEPTANCE_JOURNAL_SCHEMA_VERSION
      || resolve(value.projectRoot ?? '') !== projectRoot
      || typeof value.proposalId !== 'string'
      || !value.proposalId
      || typeof value.patch !== 'string'
      || !value.patch
      || value.patchDigest !== sha256(value.patch)
      || ![
        'preparing',
        'probing',
        'probe_applied',
        'ready',
        'applying',
        'source_applied',
        'store_committed',
        'reverting',
      ].includes(value.phase)
      || !value.basisRevision
      || typeof value.basisRevision !== 'object'
      || (value.expectedRevision !== null && typeof value.expectedRevision !== 'object')
      || (value.acceptedProposal !== null && typeof value.acceptedProposal !== 'object')
    ) {
      throw new SpecificationProposalError('proposal acceptance journal is invalid', { statusCode: 500 });
    }
    const basisRevision = projectRevisionSchema.parse(value.basisRevision);
    const expectedRevision = value.expectedRevision === null
      ? null
      : projectRevisionSchema.parse(value.expectedRevision);
    const acceptedProposal = value.acceptedProposal === null
      ? null
      : specificationProposalSchema.parse(value.acceptedProposal);
    if (
      (
        value.phase !== 'reverting'
        && phasesWithExpectedRevision.has(value.phase) !== Boolean(expectedRevision)
      )
      || (
        value.phase !== 'reverting'
        && phasesWithAcceptedProposal.has(value.phase) !== Boolean(acceptedProposal)
      )
      || (
        expectedRevision
        && sameProjectRevisionBasis(expectedRevision, basisRevision)
      )
      || (
        acceptedProposal
        && resolve(acceptedProposal.project.root) !== projectRoot
      )
      || (
        acceptedProposal
        && (
          acceptedProposal.proposalId !== value.proposalId
          || acceptedProposal.status !== 'accepted'
          || acceptedProposal.patch !== value.patch
          || !sameProjectRevisionBasis(acceptedProposal.basisRevision, basisRevision)
          || !sameProjectRevisionBasis(acceptedProposal.resultingRevision, expectedRevision)
        )
      )
    ) {
      throw new SpecificationProposalError('proposal acceptance journal identity is incoherent', {
        statusCode: 500,
      });
    }
    return {
      ...value,
      projectRoot,
      basisRevision,
      expectedRevision,
      acceptedProposal,
    };
  }

  function readAcceptanceJournal(projectRoot) {
    const path = acceptanceJournalPath(projectRoot);
    if (!existsSync(path)) return null;
    try {
      return parseAcceptanceJournal(JSON.parse(readFileSync(path, 'utf8')), projectRoot);
    } catch (error) {
      if (error instanceof SpecificationProposalError) throw error;
      throw new SpecificationProposalError(
        `proposal acceptance journal is invalid: ${errorDetail(error)}`,
        { statusCode: 500 },
      );
    }
  }

  function writeAcceptanceJournal(journal) {
    const admitted = parseAcceptanceJournal(journal, resolve(journal.projectRoot));
    writeDurableFileAtomic(
      acceptanceJournalPath(admitted.projectRoot),
      `${JSON.stringify(admitted, null, 2)}\n`,
    );
    return admitted;
  }

  function clearAcceptanceJournal(projectRoot) {
    const path = acceptanceJournalPath(projectRoot);
    if (!existsSync(path)) return;
    removeDurableFile(path);
  }

  function patchApplies(projectRoot, patch) {
    try {
      gitApplyCheck(projectRoot, patch);
      return true;
    } catch {
      return false;
    }
  }

  function patchReverses(projectRoot, patch) {
    try {
      gitApplyReverseCheck(projectRoot, patch);
      return true;
    } catch {
      return false;
    }
  }

  function sameProposal(left, right) {
    return JSON.stringify(left) === JSON.stringify(right);
  }

  function persistStaleIfBasisChanged(store, proposal, currentRevision) {
    if (
      sameProjectRevisionBasis(proposal.basisRevision, currentRevision)
      || growthAuthorityExhausted(proposal.status)
      || proposal.status === 'stale'
    ) {
      return proposal;
    }
    const basisCheckRef = 'validation://odd_manager/specification-proposal/basis';
    const hasBasisCheck = proposal.validation.some((entry) => entry.checkRef === basisCheckRef);
    const validation = (hasBasisCheck
      ? proposal.validation
      : [
        validationResult(
          basisCheckRef,
          'failed',
          'Project or specification basis changed.',
          [`project://${proposal.project.id}`, `proposal://${proposal.proposalId}`],
        ),
        ...proposal.validation,
      ]
    ).map((entry) => (
      entry.checkRef === basisCheckRef
        ? {
          ...entry,
          status: 'failed',
          detail: 'Project or specification basis changed.',
        }
        : entry
    ));
    const stale = specificationProposalSchema.parse({
      ...proposal,
      status: 'stale',
      validation,
    });
    replaceProposal(store, stale);
    return stale;
  }

  function reconcileAcceptanceJournalLocked(projectRoot) {
    let journal = readAcceptanceJournal(projectRoot);
    if (!journal) return null;
    const store = loadStore(projectRoot);
    const persisted = proposalById(store, journal.proposalId);
    if (
      persisted.status === 'accepted'
      && journal.acceptedProposal
      && sameProposal(persisted, journal.acceptedProposal)
    ) {
      clearAcceptanceJournal(projectRoot);
      return persisted;
    }

    const currentRevision = observeProjectRevision(projectRoot, now());
    if (!currentRevision) {
      throw new SpecificationProposalError(
        'proposal acceptance recovery cannot observe the current Project Revision',
        { statusCode: 500 },
      );
    }
    if (
      journal.acceptedProposal
      && journal.expectedRevision
      && ['source_applied', 'store_committed'].includes(journal.phase)
      && !growthAuthorityExhausted(persisted.status)
      && sameProjectRevisionBasis(currentRevision, journal.expectedRevision)
    ) {
      replaceProposal(store, journal.acceptedProposal);
      clearAcceptanceJournal(projectRoot);
      return journal.acceptedProposal;
    }
    if (sameProjectRevisionBasis(currentRevision, journal.basisRevision)) {
      clearAcceptanceJournal(projectRoot);
      return persisted;
    }
    if (journal.phase === 'preparing' || journal.phase === 'ready') {
      const stale = persistStaleIfBasisChanged(store, persisted, currentRevision);
      clearAcceptanceJournal(projectRoot);
      return stale;
    }
    if (
      journal.phase === 'probing'
      || journal.phase === 'applying'
      || journal.phase === 'reverting'
    ) {
      const stale = persistStaleIfBasisChanged(store, persisted, currentRevision);
      throw new SpecificationProposalError(
        `proposal acceptance recovery is blocked because ${journal.phase} records intent but not successful manager apply`,
        { statusCode: 500, proposal: stale },
      );
    }
    if (patchReverses(projectRoot, journal.patch)) {
      journal = writeAcceptanceJournal({ ...journal, phase: 'reverting' });
      try {
        gitApplyReverse(projectRoot, journal.patch);
      } catch (error) {
        throw new SpecificationProposalError(
          `proposal acceptance recovery could not roll back the candidate patch: ${errorDetail(error)}`,
          { statusCode: 500, proposal: persisted },
        );
      }
      if (!patchApplies(projectRoot, journal.patch)) {
        throw new SpecificationProposalError(
          'proposal acceptance recovery cannot prove that rollback restored candidate absence',
          { statusCode: 500, proposal: persisted },
        );
      }
      const restoredRevision = observeProjectRevision(projectRoot, now());
      if (!restoredRevision) {
        throw new SpecificationProposalError(
          'proposal acceptance recovery cannot observe the restored Project Revision',
          { statusCode: 500, proposal: persisted },
        );
      }
      const restoredProposal = persistStaleIfBasisChanged(store, persisted, restoredRevision);
      clearAcceptanceJournal(projectRoot);
      return restoredProposal;
    }
    if (patchApplies(projectRoot, journal.patch)) {
      const retainedProposal = persistStaleIfBasisChanged(store, persisted, currentRevision);
      clearAcceptanceJournal(projectRoot);
      return retainedProposal;
    }
    throw new SpecificationProposalError(
      'proposal acceptance recovery is blocked by an ambiguous concurrent source change',
      { statusCode: 500, proposal: persisted },
    );
  }

  function recoverPendingAcceptance(projectRoot) {
    if (!existsSync(acceptanceJournalPath(projectRoot))) return null;
    const lock = acquireProjectLock(lockPath(projectRoot));
    try {
      return reconcileAcceptanceJournalLocked(projectRoot);
    } finally {
      releaseProjectLock(lock);
    }
  }

  function injectAcceptanceFault(phase, context) {
    const directive = acceptanceFaultInjector({ phase, ...context });
    if (directive === 'crash') throw new SimulatedAcceptanceCrash(phase);
    if (directive instanceof Error) throw directive;
  }

  function validationResult(checkRef, status, detail, sourceRefs = []) {
    return { checkRef, status, detail, sourceRefs };
  }

  function evaluateProposal(projectRoot, proposal) {
    if (growthAuthorityExhausted(proposal.status)) {
      throw new SpecificationProposalError(`cannot validate a ${proposal.status} proposal`, {
        statusCode: 409,
        proposal,
      });
    }

    const currentRevision = observeProjectRevision(projectRoot, now());
    const basisMatches = sameProjectRevisionBasis(proposal.basisRevision, currentRevision);
    const validation = [validationResult(
      'validation://odd_manager/specification-proposal/basis',
      basisMatches ? 'passed' : 'failed',
      basisMatches ? 'Project and specification basis matches.' : 'Project or specification basis changed.',
      [`project://${proposal.project.id}`, `proposal://${proposal.proposalId}`],
    )];

    let paths = [];
    try {
      paths = specificationProposalPatchPaths(proposal.patch);
      validateSpecificationPaths(projectRoot, paths);
      validation.push(validationResult(
        'validation://odd_manager/specification-proposal/scope',
        'passed',
        `${paths.length} specification path${paths.length === 1 ? '' : 's'} admitted.`,
        paths,
      ));
    } catch (error) {
      validation.push(validationResult(
        'validation://odd_manager/specification-proposal/scope',
        'failed',
        errorDetail(error),
        [`proposal://${proposal.proposalId}`],
      ));
    }

    const canApply = basisMatches && validation.at(-1).status === 'passed';
    for (const [checkRef, whitespace] of [
      ['validation://odd_manager/specification-proposal/whitespace', true],
      ['validation://odd_manager/specification-proposal/apply', false],
    ]) {
      if (!canApply) {
        validation.push(validationResult(
          checkRef,
          'unavailable',
          'Check requires a matching basis and admitted specification paths.',
          [`proposal://${proposal.proposalId}`],
        ));
        continue;
      }
      try {
        gitApplyCheck(projectRoot, proposal.patch, whitespace);
        validation.push(validationResult(
          checkRef,
          'passed',
          whitespace ? 'Patch whitespace is admissible.' : 'Patch applies cleanly to the current basis.',
          paths,
        ));
      } catch (error) {
        validation.push(validationResult(
          checkRef,
          'failed',
          errorDetail(error),
          paths,
        ));
      }
    }

    const allPassed = validation.every((entry) => entry.status === 'passed');
    const next = specificationProposalSchema.parse({
      ...proposal,
      status: basisMatches ? (allPassed ? 'valid' : 'invalid') : 'stale',
      validation,
    });
    return next;
  }

  function acceptProposalAtomically(projectRoot, store, validated, actorRef) {
    let journal = writeAcceptanceJournal({
      schemaVersion: ACCEPTANCE_JOURNAL_SCHEMA_VERSION,
      projectRoot,
      proposalId: validated.proposalId,
      phase: 'preparing',
      basisRevision: validated.basisRevision,
      expectedRevision: null,
      acceptedProposal: null,
      patch: validated.patch,
      patchDigest: sha256(validated.patch),
    });
    let sourceMayContainPatch = false;
    let accepted = null;
    try {
      const probeBasis = observeProjectRevision(projectRoot, now());
      if (!sameProjectRevisionBasis(validated.basisRevision, probeBasis)) {
        throw new SpecificationProposalError(
          'proposal basis changed immediately before acceptance apply',
          { statusCode: 409, proposal: validated },
        );
      }
      gitApplyCheck(projectRoot, validated.patch, true);
      journal = writeAcceptanceJournal({ ...journal, phase: 'probing' });
      injectAcceptanceFault('before-probe-apply', { projectRoot, proposal: validated });
      try {
        gitApply(projectRoot, validated.patch);
      } catch (error) {
        throw new SpecificationProposalError(
          `proposal probe patch could not be applied: ${errorDetail(error)}`,
          { statusCode: 409, proposal: validated },
        );
      }
      sourceMayContainPatch = true;
      injectAcceptanceFault('after-probe-apply', { projectRoot, proposal: validated });
      const expectedRevision = observeProjectRevision(projectRoot, now());
      if (!expectedRevision) {
        throw new SpecificationProposalError(
          'expected proposal result revision could not be observed',
          { statusCode: 500, proposal: validated },
        );
      }
      journal = writeAcceptanceJournal({
        ...journal,
        phase: 'probe_applied',
        expectedRevision,
      });

      gitApplyReverseCheck(projectRoot, validated.patch);
      journal = writeAcceptanceJournal({ ...journal, phase: 'reverting' });
      gitApplyReverse(projectRoot, validated.patch);
      sourceMayContainPatch = false;
      const restoredBasis = observeProjectRevision(projectRoot, now());
      if (!sameProjectRevisionBasis(validated.basisRevision, restoredBasis)) {
        throw new SpecificationProposalError(
          'concurrent Project change invalidated proposal acceptance preparation',
          { statusCode: 409, proposal: validated },
        );
      }
      injectAcceptanceFault('after-probe-rollback', { projectRoot, proposal: validated });

      accepted = specificationProposalSchema.parse({
        ...validated,
        status: 'accepted',
        resultingRevision: expectedRevision,
        decision: {
          kind: 'accepted',
          actorRef,
          decidedAt: now(),
          basisRevision: validated.basisRevision,
          changedSurfaceRefs: validated.affectedSurfaceRefs,
        },
      });
      journal = writeAcceptanceJournal({
        ...journal,
        phase: 'ready',
        expectedRevision,
        acceptedProposal: accepted,
      });
      injectAcceptanceFault('after-ready-journal', { projectRoot, proposal: accepted });

      const commitBasis = observeProjectRevision(projectRoot, now());
      if (!sameProjectRevisionBasis(validated.basisRevision, commitBasis)) {
        throw new SpecificationProposalError(
          'concurrent Project change invalidated proposal acceptance before commit',
          { statusCode: 409, proposal: validated },
        );
      }
      journal = writeAcceptanceJournal({ ...journal, phase: 'applying' });
      gitApplyCheck(projectRoot, validated.patch, true);
      injectAcceptanceFault('before-final-apply', { projectRoot, proposal: accepted });
      try {
        gitApply(projectRoot, validated.patch);
      } catch (error) {
        throw new SpecificationProposalError(
          `proposal final patch could not be applied: ${errorDetail(error)}`,
          { statusCode: 409, proposal: validated },
        );
      }
      sourceMayContainPatch = true;
      injectAcceptanceFault('after-final-apply-before-observe', {
        projectRoot,
        proposal: accepted,
      });
      const resultingRevision = observeProjectRevision(projectRoot, now());
      if (!sameProjectRevisionBasis(expectedRevision, resultingRevision)) {
        throw new SpecificationProposalError(
          'concurrent Project change produced an unexpected proposal result',
          { statusCode: 409, proposal: validated },
        );
      }
      journal = writeAcceptanceJournal({ ...journal, phase: 'source_applied' });
      injectAcceptanceFault('after-source-apply', { projectRoot, proposal: accepted });
      injectAcceptanceFault('before-store-write', { projectRoot, proposal: accepted });
      replaceProposal(store, accepted);
      injectAcceptanceFault('before-store-commit-journal-write', {
        projectRoot,
        proposal: accepted,
      });
      writeAcceptanceJournal({ ...journal, phase: 'store_committed' });
      injectAcceptanceFault('before-acceptance-journal-clear', {
        projectRoot,
        proposal: accepted,
      });
      clearAcceptanceJournal(projectRoot);
      return accepted;
    } catch (error) {
      if (error instanceof SimulatedAcceptanceCrash) throw error;

      let persistedAccepted = null;
      if (accepted) {
        try {
          const persisted = proposalById(loadStore(projectRoot), accepted.proposalId);
          if (persisted.status === 'accepted' && sameProposal(persisted, accepted)) {
            persistedAccepted = persisted;
          }
        } catch {
          // Recovery below retains the journal if source/store state is ambiguous.
        }
      }
      if (persistedAccepted) {
        try {
          injectAcceptanceFault('before-committed-journal-recovery-clear', {
            projectRoot,
            proposal: persistedAccepted,
          });
          clearAcceptanceJournal(projectRoot);
        } catch (cleanupError) {
          throw new SpecificationProposalError(
            `proposal acceptance is durably committed but journal cleanup requires recovery: ${errorDetail(cleanupError)}`,
            { statusCode: 500, proposal: persistedAccepted },
          );
        }
        return persistedAccepted;
      }

      if (sourceMayContainPatch && patchReverses(projectRoot, validated.patch)) {
        try {
          journal = writeAcceptanceJournal({ ...journal, phase: 'reverting' });
          gitApplyReverse(projectRoot, validated.patch);
          if (patchApplies(projectRoot, validated.patch)) {
            sourceMayContainPatch = false;
            injectAcceptanceFault('after-acceptance-rollback', {
              projectRoot,
              proposal: accepted ?? validated,
            });
          }
        } catch (rollbackError) {
          if (rollbackError instanceof SimulatedAcceptanceCrash) throw rollbackError;
          // The journal remains authoritative for a later recovery attempt.
        }
      } else if (sourceMayContainPatch && patchApplies(projectRoot, validated.patch)) {
        sourceMayContainPatch = false;
      }

      if (!sourceMayContainPatch) {
        const currentRevision = observeProjectRevision(projectRoot, now());
        const failureProposal = currentRevision
          ? persistStaleIfBasisChanged(loadStore(projectRoot), validated, currentRevision)
          : validated;
        clearAcceptanceJournal(projectRoot);
        if (error instanceof SpecificationProposalError) {
          error.proposal = failureProposal;
          throw error;
        }
        throw new SpecificationProposalError(
          `proposal acceptance failed before durable decision: ${errorDetail(error)}`,
          {
            statusCode: failureProposal.status === 'stale' ? 409 : 500,
            proposal: failureProposal,
          },
        );
      }
      throw new SpecificationProposalError(
        `proposal acceptance requires journal recovery: ${errorDetail(error)}`,
        { statusCode: 500, proposal: validated },
      );
    }
  }

  return {
    participantRef: provider.participantRef,
    retentionLimit,

    list(projectRootInput) {
      const projectRoot = normalizeRoot(projectRootInput);
      recoverPendingAcceptance(projectRoot);
      return loadStore(projectRoot);
    },

    async generate(inputValue) {
      const input = specificationProposalGenerateRequestSchema.parse(inputValue);
      const projectRoot = normalizeRoot(input.project.root);
      if (projectRoot !== resolve(input.project.root)) {
        throw new SpecificationProposalError('proposal Project identity is invalid');
      }
      recoverPendingAcceptance(projectRoot);
      const currentRevision = observeProjectRevision(projectRoot, now());
      if (!currentRevision || !currentRevision.specificationDigest) {
        throw new SpecificationProposalError('proposal generation requires a Git Project with specification source');
      }
      if (!sameProjectRevisionBasis(input.basisRevision, currentRevision)) {
        throw new SpecificationProposalError('proposal basis is stale before generation', { statusCode: 409 });
      }

      const store = loadStore(projectRoot);
      const predecessor = input.predecessorProposalId
        ? assertRefinablePredecessor(proposalById(store, input.predecessorProposalId))
        : null;
      const attachments = resolveAttachments(projectRoot, input.contextAttachmentRefs);
      let providerOutput;
      try {
        providerOutput = specificationProposalProviderResponseSchema.parse(await provider.generate({
          project: input.project,
          basisRevision: input.basisRevision,
          prompt: input.prompt,
          attachments: attachments.map((entry) => ({ ...entry.record, content: entry.content })),
          predecessor,
        }));
      } catch (error) {
        throw new SpecificationProposalError(`proposal provider failed: ${errorDetail(error)}`, { statusCode: 502 });
      }

      const afterGeneration = observeProjectRevision(projectRoot, now());
      if (!sameProjectRevisionBasis(input.basisRevision, afterGeneration)) {
        throw new SpecificationProposalError('Project basis changed during proposal generation', { statusCode: 409 });
      }
      const paths = specificationProposalPatchPaths(providerOutput.patch);
      validateSpecificationPaths(projectRoot, paths);
      const declaredPaths = [...new Set(providerOutput.affectedSurfaceRefs)].sort();
      const actualPaths = [...paths].sort();
      if (JSON.stringify(declaredPaths) !== JSON.stringify(actualPaths)) {
        throw new SpecificationProposalError('provider affectedSurfaceRefs do not match the patch');
      }

      return withProjectLock(projectRoot, () => {
        const currentStore = loadStore(projectRoot);
        const currentPredecessor = input.predecessorProposalId
          ? assertRefinablePredecessor(proposalById(currentStore, input.predecessorProposalId))
          : null;
        const commitRevision = observeProjectRevision(projectRoot, now());
        if (!sameProjectRevisionBasis(input.basisRevision, commitRevision)) {
          throw new SpecificationProposalError('Project basis changed during proposal generation', { statusCode: 409 });
        }
        const proposalId = idFactory();
        if (currentStore.proposals.some((entry) => entry.proposalId === proposalId)) {
          throw new SpecificationProposalError(`specification proposal identity already exists: ${proposalId}`, {
            statusCode: 409,
          });
        }
        const proposal = specificationProposalSchema.parse({
          schemaVersion: '1',
          proposalId,
          project: { ...input.project, root: projectRoot },
          basisRevision: input.basisRevision,
          participantRef: provider.participantRef,
          createdAt: now(),
          status: 'draft',
          prompt: input.prompt,
          summary: providerOutput.summary,
          contextAttachments: attachments.map((entry) => entry.record),
          patch: providerOutput.patch,
          validation: [],
          affectedSurfaceRefs: actualPaths,
          predecessorProposalId: currentPredecessor?.proposalId ?? null,
          resultingRevision: null,
          decision: null,
          sourceRefs: [
            `proposal://${proposalId}`,
            `project://${input.project.id}`,
            provider.participantRef,
            ...attachments.map((entry) => entry.record.sourceRef),
          ],
        });

        let nextStore = currentStore;
        if (
          currentPredecessor
          && currentPredecessor.status !== 'stale'
          && !growthAuthorityExhausted(currentPredecessor.status)
        ) {
          nextStore = {
            ...currentStore,
            proposals: currentStore.proposals.map((entry) => (
              entry.proposalId === currentPredecessor.proposalId
                ? specificationProposalSchema.parse({ ...entry, status: 'superseded' })
                : entry
            )),
          };
        }
        replaceProposal(nextStore, proposal);
        return proposal;
      });
    },

    async validate(inputValue) {
      const input = specificationProposalIdentityRequestSchema.parse(inputValue);
      const projectRoot = normalizeRoot(input.projectRoot);
      recoverPendingAcceptance(projectRoot);
      const initialProposal = proposalById(loadStore(projectRoot), input.proposalId);
      if (growthAuthorityExhausted(initialProposal.status)) {
        throw new SpecificationProposalError(`cannot validate a ${initialProposal.status} proposal`, {
          statusCode: 409,
          proposal: initialProposal,
        });
      }
      await beforeValidationCommit({
        projectRoot,
        proposalId: input.proposalId,
        proposal: initialProposal,
      });
      return withProjectLock(projectRoot, () => {
        const store = loadStore(projectRoot);
        const proposal = proposalById(store, input.proposalId);
        const validated = evaluateProposal(projectRoot, proposal);
        replaceProposal(store, validated);
        return validated;
      });
    },

    async accept(inputValue) {
      const input = specificationProposalDecisionRequestSchema.parse(inputValue);
      const projectRoot = normalizeRoot(input.projectRoot);
      recoverPendingAcceptance(projectRoot);
      return withProjectLock(projectRoot, () => {
        const store = loadStore(projectRoot);
        const proposal = proposalById(store, input.proposalId);
        const validated = evaluateProposal(projectRoot, proposal);
        replaceProposal(store, validated);
        if (validated.status !== 'valid' || validated.validation.some((entry) => entry.status !== 'passed')) {
          throw new SpecificationProposalError('proposal acceptance requires current passing deterministic validation', {
            statusCode: 409,
            proposal: validated,
          });
        }
        return acceptProposalAtomically(projectRoot, store, validated, input.actorRef);
      });
    },

    async reject(inputValue) {
      const input = specificationProposalDecisionRequestSchema.parse(inputValue);
      const projectRoot = normalizeRoot(input.projectRoot);
      recoverPendingAcceptance(projectRoot);
      return withProjectLock(projectRoot, () => {
        const store = loadStore(projectRoot);
        const proposal = proposalById(store, input.proposalId);
        if (growthAuthorityExhausted(proposal.status)) {
          throw new SpecificationProposalError(
            `cannot reject a ${proposal.status} proposal because its growth authority is exhausted`,
            { statusCode: 409, proposal },
          );
        }
        const rejected = specificationProposalSchema.parse({
          ...proposal,
          status: 'rejected',
          decision: {
            kind: 'rejected',
            actorRef: input.actorRef,
            decidedAt: now(),
            basisRevision: proposal.basisRevision,
            changedSurfaceRefs: [],
          },
        });
        replaceProposal(store, rejected);
        return rejected;
      });
    },
  };
}
