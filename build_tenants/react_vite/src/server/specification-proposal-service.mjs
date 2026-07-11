import { createHash, randomUUID } from 'node:crypto';
import {
  closeSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
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
const MAX_ATTACHMENT_BYTES = 65536;
const MAX_TOTAL_ATTACHMENT_BYTES = 262144;

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

function terminalStatus(status) {
  return status === 'accepted' || status === 'rejected';
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

function normalizePatchPath(value) {
  const normalized = String(value ?? '').trim().replace(/^['"]|['"]$/g, '');
  if (!normalized || normalized === '/dev/null' || isAbsolute(normalized)) return null;
  const withoutPrefix = normalized.replace(/^[ab]\//, '');
  if (withoutPrefix.split('/').includes('..')) return null;
  return withoutPrefix;
}

export function specificationProposalPatchPaths(patch) {
  const paths = [];
  for (const line of String(patch ?? '').split('\n')) {
    const match = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (!match) continue;
    const oldPath = normalizePatchPath(match[1]);
    const newPath = normalizePatchPath(match[2]);
    if (!oldPath || !newPath || oldPath !== newPath) {
      throw new SpecificationProposalError('proposal patch contains an unsupported rename or path');
    }
    paths.push(newPath);
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

function errorDetail(error) {
  const stderr = error && typeof error === 'object' && 'stderr' in error
    ? String(error.stderr ?? '').trim()
    : '';
  return stderr || (error instanceof Error ? error.message : String(error));
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
    mkdirSync(dirname(path), { recursive: true });
    const temporaryPath = `${path}.${process.pid}.${randomUUID()}.tmp`;
    writeFileSync(temporaryPath, `${JSON.stringify(admitted, null, 2)}\n`, 'utf8');
    renameSync(temporaryPath, path);
    return admitted;
  }

  function withProjectLock(projectRoot, callback) {
    const path = lockPath(projectRoot);
    let descriptor;
    try {
      descriptor = openSync(path, 'wx');
      writeFileSync(descriptor, `${JSON.stringify({ pid: process.pid, acquiredAt: now() })}\n`, 'utf8');
    } catch {
      throw new SpecificationProposalError('another proposal decision is active for this Project', { statusCode: 409 });
    }
    try {
      return callback();
    } finally {
      closeSync(descriptor);
      try { unlinkSync(path); } catch { /* Lock cleanup is best effort after descriptor close. */ }
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

  function validationResult(checkRef, status, detail, sourceRefs = []) {
    return { checkRef, status, detail, sourceRefs };
  }

  function validatePersistedProposal(projectRoot, proposalId) {
    const store = loadStore(projectRoot);
    const proposal = proposalById(store, proposalId);
    if (terminalStatus(proposal.status)) {
      throw new SpecificationProposalError(`cannot validate a ${proposal.status} proposal`, { proposal });
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
    replaceProposal(store, next);
    return next;
  }

  return {
    participantRef: provider.participantRef,
    retentionLimit,

    list(projectRoot) {
      return loadStore(projectRoot);
    },

    async generate(inputValue) {
      const input = specificationProposalGenerateRequestSchema.parse(inputValue);
      const projectRoot = normalizeRoot(input.project.root);
      if (projectRoot !== resolve(input.project.root)) {
        throw new SpecificationProposalError('proposal Project identity is invalid');
      }
      const currentRevision = observeProjectRevision(projectRoot, now());
      if (!currentRevision || !currentRevision.specificationDigest) {
        throw new SpecificationProposalError('proposal generation requires a Git Project with specification source');
      }
      if (!sameProjectRevisionBasis(input.basisRevision, currentRevision)) {
        throw new SpecificationProposalError('proposal basis is stale before generation', { statusCode: 409 });
      }

      const store = loadStore(projectRoot);
      const predecessor = input.predecessorProposalId
        ? proposalById(store, input.predecessorProposalId)
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

      const proposalId = idFactory();
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
        predecessorProposalId: predecessor?.proposalId ?? null,
        resultingRevision: null,
        decision: null,
        sourceRefs: [
          `proposal://${proposalId}`,
          `project://${input.project.id}`,
          provider.participantRef,
          ...attachments.map((entry) => entry.record.sourceRef),
        ],
      });

      let nextStore = store;
      if (predecessor && predecessor.status !== 'stale' && !terminalStatus(predecessor.status)) {
        nextStore = {
          ...store,
          proposals: store.proposals.map((entry) => (
            entry.proposalId === predecessor.proposalId
              ? specificationProposalSchema.parse({ ...entry, status: 'superseded' })
              : entry
          )),
        };
      }
      replaceProposal(nextStore, proposal);
      return proposal;
    },

    validate(inputValue) {
      const input = specificationProposalIdentityRequestSchema.parse(inputValue);
      return validatePersistedProposal(normalizeRoot(input.projectRoot), input.proposalId);
    },

    accept(inputValue) {
      const input = specificationProposalDecisionRequestSchema.parse(inputValue);
      const projectRoot = normalizeRoot(input.projectRoot);
      return withProjectLock(projectRoot, () => {
        const validated = validatePersistedProposal(projectRoot, input.proposalId);
        if (validated.status !== 'valid' || validated.validation.some((entry) => entry.status !== 'passed')) {
          throw new SpecificationProposalError('proposal acceptance requires current passing deterministic validation', {
            statusCode: 409,
            proposal: validated,
          });
        }
        const currentRevision = observeProjectRevision(projectRoot, now());
        if (!sameProjectRevisionBasis(validated.basisRevision, currentRevision)) {
          const stale = specificationProposalSchema.parse({ ...validated, status: 'stale' });
          replaceProposal(loadStore(projectRoot), stale);
          throw new SpecificationProposalError('proposal basis changed before acceptance', {
            statusCode: 409,
            proposal: stale,
          });
        }
        try {
          gitApplyCheck(projectRoot, validated.patch, true);
          gitApply(projectRoot, validated.patch);
        } catch (error) {
          throw new SpecificationProposalError(`proposal patch could not be applied: ${errorDetail(error)}`, {
            statusCode: 409,
            proposal: validated,
          });
        }
        const resultingRevision = observeProjectRevision(projectRoot, now());
        if (!resultingRevision) {
          throw new SpecificationProposalError('resulting Project Revision could not be observed', { statusCode: 500 });
        }
        const accepted = specificationProposalSchema.parse({
          ...validated,
          status: 'accepted',
          resultingRevision,
          decision: {
            kind: 'accepted',
            actorRef: input.actorRef,
            decidedAt: now(),
            basisRevision: validated.basisRevision,
            changedSurfaceRefs: validated.affectedSurfaceRefs,
          },
        });
        replaceProposal(loadStore(projectRoot), accepted);
        return accepted;
      });
    },

    reject(inputValue) {
      const input = specificationProposalDecisionRequestSchema.parse(inputValue);
      const projectRoot = normalizeRoot(input.projectRoot);
      return withProjectLock(projectRoot, () => {
        const store = loadStore(projectRoot);
        const proposal = proposalById(store, input.proposalId);
        if (terminalStatus(proposal.status)) {
          throw new SpecificationProposalError(`proposal is already ${proposal.status}`, { proposal });
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
