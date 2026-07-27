import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createFixtureSpecificationProposalProvider } from '../../src/server/specification-proposal-provider.mjs';
import {
  createSpecificationProposalService,
  SpecificationProposalError,
  specificationProposalPatchPaths,
} from '../../src/server/specification-proposal-service.mjs';
import { observeProjectRevision } from '../../src/server/project-revision-service.mjs';

function fixture(options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-proposal-project-'));
  const managerStateRoot = mkdtempSync(join(tmpdir(), 'odd-manager-proposal-state-'));
  mkdirSync(join(root, 'specification'), { recursive: true });
  writeFileSync(
    join(root, 'specification', 'PRODUCT.md'),
    '# Fixture Product\n\n## Product Identity\n\nA governed fixture.\n',
    'utf8',
  );
  writeFileSync(
    join(root, 'specification', 'INTENT.md'),
    '# Intent\n\nKeep candidate truth isolated.\n',
    'utf8',
  );
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, 'add', 'specification']);
  execFileSync('git', [
    '-C', root,
    '-c', 'user.name=Odd Manager Test',
    '-c', 'user.email=odd-manager@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ]);
  let id = 0;
  let tick = 0;
  const provider = options.provider ?? createFixtureSpecificationProposalProvider();
  const service = createSpecificationProposalService({
    managerStateRoot,
    provider,
    retentionLimit: options.retentionLimit,
    idFactory: options.idFactory ?? (() => `proposal-${++id}`),
    now: options.now ?? (() => `2026-07-11T01:${String(tick++).padStart(2, '0')}:00.000Z`),
    lockTokenFactory: options.lockTokenFactory,
    processIsAlive: options.processIsAlive,
    staleLockMs: options.staleLockMs,
    beforeValidationCommit: options.beforeValidationCommit,
    acceptanceFaultInjector: options.acceptanceFaultInjector,
  });
  const project = {
    id: 'fixture-project',
    root,
    label: 'Fixture Project',
    publishedProductRef: 'product://fixture',
  };
  return {
    root,
    managerStateRoot,
    project,
    provider,
    service,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
      rmSync(managerStateRoot, { recursive: true, force: true });
    },
  };
}

function proposalStoreId(current) {
  return createHash('sha256').update(current.root).digest('hex').slice(0, 24);
}

function proposalLockPath(current) {
  return join(
    current.managerStateRoot,
    '.ai-workspace',
    'runtime',
    'developer-control',
    'specification-proposals',
    `${proposalStoreId(current)}.lock`,
  );
}

function proposalLockClaimPaths(current) {
  const root = `${proposalLockPath(current)}.claims`;
  if (!existsSync(root)) return [];
  return readdirSync(root)
    .filter((name) => name.endsWith('.claim'))
    .map((name) => join(root, name));
}

function proposalAcceptanceJournalPath(current) {
  return join(
    current.managerStateRoot,
    '.ai-workspace',
    'runtime',
    'developer-control',
    'specification-proposals',
    `${proposalStoreId(current)}.acceptance-journal.json`,
  );
}

function restartedService(current, options = {}) {
  return createSpecificationProposalService({
    managerStateRoot: current.managerStateRoot,
    provider: current.provider,
    now: options.now ?? (() => '2026-07-12T00:00:00.000Z'),
    processIsAlive: options.processIsAlive,
    staleLockMs: options.staleLockMs,
  });
}

function generateInput(current, prompt = 'Clarify the governed product boundary.', predecessorProposalId = null) {
  return {
    project: current.project,
    basisRevision: observeProjectRevision(current.root, '2026-07-11T00:00:00.000Z'),
    prompt,
    contextAttachmentRefs: ['specification/INTENT.md', 'run://fixture/latest'],
    predecessorProposalId,
  };
}

function deferred() {
  let resolvePromise;
  let rejectPromise;
  const promise = new Promise((resolve, reject) => {
    resolvePromise = resolve;
    rejectPromise = reject;
  });
  return {
    promise,
    resolve: resolvePromise,
    reject: rejectPromise,
  };
}

function createDeferredFixtureProvider() {
  const delegate = createFixtureSpecificationProposalProvider();
  const pending = [];
  return {
    pending,
    provider: {
      participantRef: delegate.participantRef,
      generate(input) {
        const gate = deferred();
        pending.push({ input, gate });
        return gate.promise.then(() => delegate.generate(input));
      },
    },
  };
}

test('proposal generation, validation, and acceptance preserve candidate truth until one atomic apply', async () => {
  const current = fixture();
  try {
    const before = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    const proposal = await current.service.generate(generateInput(current));
    assert.equal(proposal.status, 'draft');
    assert.equal(proposal.participantRef, 'participant://fixture/specification-proposal');
    assert.equal(proposal.contextAttachments.length, 2);
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'), before);

    const validated = await current.service.validate({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
    });
    assert.equal(validated.status, 'valid');
    assert.deepEqual(validated.validation.map((entry) => entry.status), [
      'passed',
      'passed',
      'passed',
      'passed',
    ]);
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'), before);

    const accepted = await current.service.accept({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
      actorRef: 'actor://operator/jim',
    });
    const after = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    assert.equal(accepted.status, 'accepted');
    assert.equal(accepted.decision.kind, 'accepted');
    assert.equal(accepted.decision.actorRef, 'actor://operator/jim');
    assert.notEqual(after, before);
    assert.match(after, /Clarify the governed product boundary/);
    assert.notEqual(accepted.resultingRevision.specificationDigest, accepted.basisRevision.specificationDigest);
    assert.equal(current.service.list(current.root).proposals[0].status, 'accepted');
  } finally {
    current.cleanup();
  }
});

test('acceptance store failure rolls source back and leaves no journal or accepted decision', async () => {
  const current = fixture({
    acceptanceFaultInjector({ phase }) {
      if (phase === 'before-store-write') return new Error('injected store failure');
      return undefined;
    },
  });
  try {
    const before = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    const proposal = await current.service.generate(generateInput(current, 'Rollback on store failure.'));
    await assert.rejects(
      current.service.accept({
        projectRoot: current.root,
        proposalId: proposal.proposalId,
        actorRef: 'actor://operator/jim',
      }),
      (error) => (
        error instanceof SpecificationProposalError
        && error.statusCode === 500
        && /injected store failure/.test(error.message)
      ),
    );
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'), before);
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), false);
    assert.equal(
      current.service.list(current.root).proposals.find(
        (entry) => entry.proposalId === proposal.proposalId,
      ).status,
      'valid',
    );
  } finally {
    current.cleanup();
  }
});

test('a post-store journal write fault cannot roll back a durably accepted source decision', async () => {
  let faulted = false;
  const current = fixture({
    acceptanceFaultInjector({ phase }) {
      if (phase === 'before-store-commit-journal-write' && !faulted) {
        faulted = true;
        return new Error('injected post-store journal fault');
      }
      return undefined;
    },
  });
  try {
    const proposal = await current.service.generate(generateInput(
      current,
      'Preserve the committed source and decision.',
    ));
    const accepted = await current.service.accept({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
      actorRef: 'actor://operator/jim',
    });

    assert.equal(accepted.status, 'accepted');
    assert.match(
      readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
      /Preserve the committed source and decision/,
    );
    assert.equal(
      current.service.list(current.root).proposals.find(
        (entry) => entry.proposalId === proposal.proposalId,
      ).status,
      'accepted',
    );
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), false);
  } finally {
    current.cleanup();
  }
});

test('persistent post-commit journal cleanup failure retains accepted truth for restart recovery', async () => {
  const current = fixture({
    acceptanceFaultInjector({ phase }) {
      if (
        phase === 'before-acceptance-journal-clear'
        || phase === 'before-committed-journal-recovery-clear'
      ) {
        return new Error('injected persistent journal cleanup failure');
      }
      return undefined;
    },
  });
  try {
    const proposal = await current.service.generate(generateInput(
      current,
      'Retain accepted truth across journal cleanup failure.',
    ));
    await assert.rejects(
      current.service.accept({
        projectRoot: current.root,
        proposalId: proposal.proposalId,
        actorRef: 'actor://operator/jim',
      }),
      (error) => (
        error instanceof SpecificationProposalError
        && error.statusCode === 500
        && error.proposal?.status === 'accepted'
        && /durably committed/.test(error.message)
      ),
    );

    assert.match(
      readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
      /Retain accepted truth across journal cleanup failure/,
    );
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), true);

    const recovered = restartedService(current).list(current.root).proposals.find(
      (entry) => entry.proposalId === proposal.proposalId,
    );
    assert.equal(recovered.status, 'accepted');
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), false);
    assert.equal(
      observeProjectRevision(current.root).sourceDigest,
      recovered.resultingRevision.sourceDigest,
    );
  } finally {
    current.cleanup();
  }
});

test('restart rolls a journaled exact source application forward into its attributed accepted decision', async () => {
  let crash = true;
  const current = fixture({
    acceptanceFaultInjector({ phase }) {
      if (phase === 'after-source-apply' && crash) {
        crash = false;
        return 'crash';
      }
      return undefined;
    },
  });
  try {
    const proposal = await current.service.generate(generateInput(current, 'Recover exact acceptance.'));
    await assert.rejects(
      current.service.accept({
        projectRoot: current.root,
        proposalId: proposal.proposalId,
        actorRef: 'actor://operator/jim',
      }),
      /simulated acceptance crash/,
    );
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), true);
    assert.match(
      readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
      /Recover exact acceptance/,
    );

    const recovered = restartedService(current).list(current.root).proposals.find(
      (entry) => entry.proposalId === proposal.proposalId,
    );
    assert.equal(recovered.status, 'accepted');
    assert.equal(recovered.decision.actorRef, 'actor://operator/jim');
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), false);
    assert.equal(
      observeProjectRevision(current.root).sourceDigest,
      recovered.resultingRevision.sourceDigest,
    );
  } finally {
    current.cleanup();
  }
});

test('restart never attributes an external exact patch from a ready journal as acceptance', async () => {
  let externalApplyCompleted = false;
  const current = fixture({
    acceptanceFaultInjector({ phase, projectRoot, proposal }) {
      if (phase === 'after-ready-journal' && !externalApplyCompleted) {
        externalApplyCompleted = true;
        execFileSync('git', ['-C', projectRoot, 'apply', '--whitespace=nowarn', '-'], {
          input: proposal.patch,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        return 'crash';
      }
      return undefined;
    },
  });
  try {
    const proposal = await current.service.generate(generateInput(
      current,
      'External exact patch remains externally attributed.',
    ));
    await assert.rejects(
      current.service.accept({
        projectRoot: current.root,
        proposalId: proposal.proposalId,
        actorRef: 'actor://operator/jim',
      }),
      /simulated acceptance crash/,
    );
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), true);

    const recovered = restartedService(current).list(current.root).proposals.find(
      (entry) => entry.proposalId === proposal.proposalId,
    );
    assert.equal(recovered.status, 'stale');
    assert.equal(recovered.decision, null);
    assert.equal(recovered.resultingRevision, null);
    assert.match(
      readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
      /External exact patch remains externally attributed/,
    );
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), false);
  } finally {
    current.cleanup();
  }
});

test('restart blocks pre-success apply phases without deleting an external exact writer', async (t) => {
  for (const faultPhase of ['before-probe-apply', 'before-final-apply']) {
    await t.test(faultPhase, async () => {
      let externalApplyCompleted = false;
      const current = fixture({
        acceptanceFaultInjector({ phase, projectRoot, proposal }) {
          if (phase === faultPhase && !externalApplyCompleted) {
            externalApplyCompleted = true;
            execFileSync('git', ['-C', projectRoot, 'apply', '--whitespace=nowarn', '-'], {
              input: proposal.patch,
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            return 'crash';
          }
          return undefined;
        },
      });
      try {
        const proposal = await current.service.generate(generateInput(
          current,
          `External writer at ${faultPhase}.`,
        ));
        await assert.rejects(
          current.service.accept({
            projectRoot: current.root,
            proposalId: proposal.proposalId,
            actorRef: 'actor://operator/jim',
          }),
          /simulated acceptance crash/,
        );
        assert.equal(existsSync(proposalAcceptanceJournalPath(current)), true);

        await assert.rejects(
          Promise.resolve().then(() => restartedService(current).list(current.root)),
          (error) => (
            error instanceof SpecificationProposalError
            && error.statusCode === 500
            && error.proposal?.status === 'stale'
            && /intent but not successful manager apply/.test(error.message)
          ),
        );
        assert.match(
          readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
          new RegExp(`External writer at ${faultPhase}`),
        );
        assert.equal(existsSync(proposalAcceptanceJournalPath(current)), true);
      } finally {
        current.cleanup();
      }
    });
  }
});

test('restart blocks a rollback-intent journal without deleting a post-rollback external writer', async (t) => {
  for (const rollbackBoundary of ['after-probe-rollback', 'after-acceptance-rollback']) {
    await t.test(rollbackBoundary, async () => {
      let forcedSourceRollback = false;
      let externalApplyCompleted = false;
      const current = fixture({
        acceptanceFaultInjector({ phase, projectRoot, proposal }) {
          if (
            rollbackBoundary === 'after-acceptance-rollback'
            && phase === 'after-source-apply'
            && !forcedSourceRollback
          ) {
            forcedSourceRollback = true;
            return new Error('force accepted-source rollback');
          }
          if (phase === rollbackBoundary && !externalApplyCompleted) {
            externalApplyCompleted = true;
            execFileSync('git', ['-C', projectRoot, 'apply', '--whitespace=nowarn', '-'], {
              input: proposal.patch,
              encoding: 'utf8',
              stdio: ['pipe', 'pipe', 'pipe'],
            });
            return 'crash';
          }
          return undefined;
        },
      });
      try {
        const proposal = await current.service.generate(generateInput(
          current,
          `External writer after ${rollbackBoundary}.`,
        ));
        await assert.rejects(
          current.service.accept({
            projectRoot: current.root,
            proposalId: proposal.proposalId,
            actorRef: 'actor://operator/jim',
          }),
          /simulated acceptance crash/,
        );
        assert.equal(existsSync(proposalAcceptanceJournalPath(current)), true);

        await assert.rejects(
          Promise.resolve().then(() => restartedService(current).list(current.root)),
          (error) => (
            error instanceof SpecificationProposalError
            && error.statusCode === 500
            && error.proposal?.status === 'stale'
            && /reverting records intent but not successful manager apply/.test(error.message)
          ),
        );
        assert.match(
          readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
          new RegExp(`External writer after ${rollbackBoundary}`),
        );
        assert.equal(existsSync(proposalAcceptanceJournalPath(current)), true);
      } finally {
        current.cleanup();
      }
    });
  }
});

test('an external exact patch won between check and final apply is never reversed or accepted by the manager', async () => {
  let externalApplyCompleted = false;
  const current = fixture({
    acceptanceFaultInjector({ phase, projectRoot, proposal }) {
      if (phase === 'before-final-apply' && !externalApplyCompleted) {
        externalApplyCompleted = true;
        execFileSync('git', ['-C', projectRoot, 'apply', '--whitespace=nowarn', '-'], {
          input: proposal.patch,
          encoding: 'utf8',
          stdio: ['pipe', 'pipe', 'pipe'],
        });
      }
      return undefined;
    },
  });
  try {
    const proposal = await current.service.generate(generateInput(
      current,
      'External writer owns this exact patch.',
    ));
    await assert.rejects(
      current.service.accept({
        projectRoot: current.root,
        proposalId: proposal.proposalId,
        actorRef: 'actor://operator/jim',
      }),
      (error) => (
        error instanceof SpecificationProposalError
        && error.statusCode === 409
        && error.proposal?.status === 'stale'
        && /final patch could not be applied/.test(error.message)
      ),
    );

    assert.match(
      readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
      /External writer owns this exact patch/,
    );
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), false);
    assert.equal(
      current.service.list(current.root).proposals.find(
        (entry) => entry.proposalId === proposal.proposalId,
      ).status,
      'stale',
    );
  } finally {
    current.cleanup();
  }
});

test('concurrent external source change during final apply is retained while the candidate patch rolls back', async () => {
  let wroteConcurrentSource = false;
  const current = fixture({
    acceptanceFaultInjector({ phase, projectRoot }) {
      if (phase === 'after-final-apply-before-observe' && !wroteConcurrentSource) {
        wroteConcurrentSource = true;
        writeFileSync(
          join(projectRoot, 'specification', 'CONCURRENT.md'),
          '# Concurrent writer\n',
          'utf8',
        );
      }
      return undefined;
    },
  });
  try {
    const productBefore = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    const proposal = await current.service.generate(generateInput(current, 'Reject mixed authorship.'));
    await assert.rejects(
      current.service.accept({
        projectRoot: current.root,
        proposalId: proposal.proposalId,
        actorRef: 'actor://operator/jim',
      }),
      (error) => (
        error instanceof SpecificationProposalError
        && error.statusCode === 409
        && error.proposal?.status === 'stale'
        && /unexpected proposal result/.test(error.message)
      ),
    );
    assert.equal(
      readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
      productBefore,
    );
    assert.equal(
      readFileSync(join(current.root, 'specification', 'CONCURRENT.md'), 'utf8'),
      '# Concurrent writer\n',
    );
    assert.equal(existsSync(proposalAcceptanceJournalPath(current)), false);
    assert.equal(
      current.service.list(current.root).proposals.find(
        (entry) => entry.proposalId === proposal.proposalId,
      ).status,
      'stale',
    );
  } finally {
    current.cleanup();
  }
});

test('refinement creates a successor and rejection changes no constitutional source', async () => {
  const current = fixture();
  try {
    const before = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    const first = await current.service.generate(generateInput(current, 'First candidate.'));
    const refined = await current.service.generate(generateInput(
      current,
      'Refine the candidate with an explicit constraint.',
      first.proposalId,
    ));
    assert.equal(refined.predecessorProposalId, first.proposalId);
    const history = current.service.list(current.root);
    assert.equal(history.proposals.find((entry) => entry.proposalId === first.proposalId).status, 'superseded');

    const rejected = await current.service.reject({
      projectRoot: current.root,
      proposalId: refined.proposalId,
      actorRef: 'actor://operator/jim',
    });
    assert.equal(rejected.status, 'rejected');
    assert.equal(rejected.decision.kind, 'rejected');
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'), before);
  } finally {
    current.cleanup();
  }
});

test('superseded proposal authority cannot validate, accept, reject, or select another refinement', async () => {
  const current = fixture();
  try {
    const before = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    const first = await current.service.generate(generateInput(current, 'First candidate.'));
    await current.service.generate(generateInput(current, 'Selected successor.', first.proposalId));
    const superseded = current.service.list(current.root).proposals.find(
      (entry) => entry.proposalId === first.proposalId,
    );
    assert.equal(superseded.status, 'superseded');

    for (const [action, input] of [
      ['validate', { projectRoot: current.root, proposalId: first.proposalId }],
      ['accept', {
        projectRoot: current.root,
        proposalId: first.proposalId,
        actorRef: 'actor://operator/jim',
      }],
      ['reject', {
        projectRoot: current.root,
        proposalId: first.proposalId,
        actorRef: 'actor://operator/jim',
      }],
    ]) {
      await assert.rejects(
        current.service[action](input),
        (error) => (
          error instanceof SpecificationProposalError
          && error.statusCode === 409
          && /superseded/.test(error.message)
        ),
      );
    }
    await assert.rejects(
      current.service.generate(generateInput(current, 'Unlawful second successor.', first.proposalId)),
      /cannot refine a superseded proposal because its growth authority is exhausted/,
    );
    assert.deepEqual(
      current.service.list(current.root).proposals.find(
        (entry) => entry.proposalId === first.proposalId,
      ),
      superseded,
    );
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'), before);
  } finally {
    current.cleanup();
  }
});

test('accepted and rejected proposal authority cannot validate, decide again, or select a refinement', async (t) => {
  for (const terminalStatus of ['accepted', 'rejected']) {
    await t.test(terminalStatus, async () => {
      const current = fixture();
      try {
        const first = await current.service.generate(generateInput(
          current,
          `Candidate to become ${terminalStatus}.`,
        ));
        const terminal = await current.service[
          terminalStatus === 'accepted' ? 'accept' : 'reject'
        ]({
          projectRoot: current.root,
          proposalId: first.proposalId,
          actorRef: 'actor://operator/jim',
        });
        assert.equal(terminal.status, terminalStatus);
        const sourceAfterDecision = readFileSync(
          join(current.root, 'specification', 'PRODUCT.md'),
          'utf8',
        );

        for (const [action, input] of [
          ['validate', { projectRoot: current.root, proposalId: first.proposalId }],
          ['accept', {
            projectRoot: current.root,
            proposalId: first.proposalId,
            actorRef: 'actor://operator/jim',
          }],
          ['reject', {
            projectRoot: current.root,
            proposalId: first.proposalId,
            actorRef: 'actor://operator/jim',
          }],
        ]) {
          await assert.rejects(
            current.service[action](input),
            (error) => (
              error instanceof SpecificationProposalError
              && error.statusCode === 409
              && error.proposal?.status === terminalStatus
              && error.message.includes(terminalStatus)
            ),
          );
        }
        await assert.rejects(
          current.service.generate(generateInput(
            current,
            `Unlawful refinement of ${terminalStatus} evidence.`,
            first.proposalId,
          )),
          (error) => (
            error instanceof SpecificationProposalError
            && error.statusCode === 409
            && error.proposal?.status === terminalStatus
            && error.message.includes(`cannot refine a ${terminalStatus} proposal`)
          ),
        );
        assert.deepEqual(
          current.service.list(current.root).proposals.find(
            (entry) => entry.proposalId === first.proposalId,
          ),
          terminal,
        );
        assert.equal(
          readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'),
          sourceAfterDecision,
        );
      } finally {
        current.cleanup();
      }
    });
  }
});

test('concurrent generation commits reload and merge so both proposals persist', async () => {
  const controlled = createDeferredFixtureProvider();
  const current = fixture({ provider: controlled.provider });
  try {
    const firstGeneration = current.service.generate(generateInput(current, 'Concurrent candidate one.'));
    const secondGeneration = current.service.generate(generateInput(current, 'Concurrent candidate two.'));
    assert.equal(controlled.pending.length, 2);

    controlled.pending[1].gate.resolve();
    controlled.pending[0].gate.resolve();
    const generated = await Promise.all([firstGeneration, secondGeneration]);

    const history = current.service.list(current.root);
    assert.equal(history.proposals.length, 2);
    assert.deepEqual(
      new Set(history.proposals.map((entry) => entry.proposalId)),
      new Set(generated.map((entry) => entry.proposalId)),
    );
    assert.deepEqual(
      new Set(history.proposals.map((entry) => entry.prompt)),
      new Set(['Concurrent candidate one.', 'Concurrent candidate two.']),
    );
  } finally {
    current.cleanup();
  }
});

test('manager restart recovers a stale lock owned by a dead predecessor process', async () => {
  const deadPid = 424_242;
  const current = fixture({
    staleLockMs: 1_000,
    processIsAlive(pid) {
      assert.equal(pid, deadPid);
      return false;
    },
  });
  try {
    const path = proposalLockPath(current);
    const abandonedLock = `${JSON.stringify({
      pid: deadPid,
      acquiredAt: '2026-07-10T00:00:00.000Z',
    })}\n`;
    writeFileSync(path, abandonedLock, 'utf8');

    const proposal = await current.service.generate(generateInput(
      current,
      'Recover after the prior manager process stopped.',
    ));
    assert.equal(proposal.status, 'draft');
    assert.equal(current.service.list(current.root).proposals.length, 1);
    assert.equal(readFileSync(path, 'utf8'), abandonedLock);
  } finally {
    current.cleanup();
  }
});

test('manager restart safely ignores aged empty and truncated legacy lock sentinels without deleting them', async () => {
  for (const malformedLock of ['', '{"pid":424242']) {
    const current = fixture({
      staleLockMs: 1_000,
      now: () => '2026-07-11T01:00:00.000Z',
      processIsAlive() {
        assert.fail('malformed lock recovery must not invent a process owner');
      },
    });
    try {
      const path = proposalLockPath(current);
      writeFileSync(path, malformedLock, 'utf8');
      const old = new Date('2026-07-10T00:00:00.000Z');
      utimesSync(path, old, old);

      const proposal = await current.service.generate(generateInput(
        current,
        'Recover without deleting an aged malformed legacy lock.',
      ));
      assert.equal(proposal.status, 'draft');
      assert.equal(readFileSync(path, 'utf8'), malformedLock);
    } finally {
      current.cleanup();
    }
  }
});

test('a fresh malformed legacy lock fails closed until its bounded lease ages', async () => {
  const current = fixture({
    staleLockMs: 60_000,
    now: () => '2026-07-11T01:00:00.000Z',
  });
  try {
    const path = proposalLockPath(current);
    const malformedLock = '{"pid":';
    writeFileSync(path, malformedLock, 'utf8');
    const fresh = new Date('2026-07-11T00:59:30.000Z');
    utimesSync(path, fresh, fresh);

    await assert.rejects(
      current.service.generate(generateInput(current, 'Respect a fresh incomplete owner record.')),
      (error) => error instanceof SpecificationProposalError && error.statusCode === 409,
    );
    assert.equal(readFileSync(path, 'utf8'), malformedLock);
  } finally {
    current.cleanup();
  }
});

test('a stale-looking lock owned by a demonstrably live foreign process is never removed', async () => {
  const livePid = 515_151;
  const current = fixture({
    staleLockMs: 0,
    processIsAlive(pid) {
      assert.equal(pid, livePid);
      return true;
    },
  });
  try {
    const path = proposalLockPath(current);
    const foreignLock = `${JSON.stringify({
      schemaVersion: '1',
      pid: livePid,
      acquiredAt: '2020-01-01T00:00:00.000Z',
      ownerInstanceId: 'foreign-manager-instance',
      token: 'foreign-live-token',
    })}\n`;
    writeFileSync(path, foreignLock, 'utf8');

    await assert.rejects(
      current.service.generate(generateInput(current, 'Do not steal the live manager lock.')),
      (error) => (
        error instanceof SpecificationProposalError
        && error.statusCode === 409
        && /another proposal decision is active/.test(error.message)
      ),
    );
    assert.equal(readFileSync(path, 'utf8'), foreignLock);
    assert.equal(current.service.list(current.root).proposals.length, 0);
  } finally {
    current.cleanup();
  }
});

test('an aged lock whose owner liveness is indeterminate remains blocking and untouched', async () => {
  const unknownPid = 525_252;
  const current = fixture({
    staleLockMs: 0,
    processIsAlive(pid) {
      assert.equal(pid, unknownPid);
      throw new Error('process liveness is unavailable');
    },
  });
  try {
    const path = proposalLockPath(current);
    const unknownLock = `${JSON.stringify({
      schemaVersion: '1',
      pid: unknownPid,
      acquiredAt: '2020-01-01T00:00:00.000Z',
      ownerInstanceId: 'unknown-manager-instance',
      token: 'unknown-owner-token',
    })}\n`;
    writeFileSync(path, unknownLock, 'utf8');

    await assert.rejects(
      current.service.generate(generateInput(current, 'Do not guess owner liveness.')),
      (error) => error instanceof SpecificationProposalError && error.statusCode === 409,
    );
    assert.equal(readFileSync(path, 'utf8'), unknownLock);
  } finally {
    current.cleanup();
  }
});

test('a non-regular legacy lock carrier is indeterminate and always blocks recovery', async () => {
  const current = fixture({
    staleLockMs: 0,
    processIsAlive() {
      assert.fail('a non-regular carrier has no admitted process owner');
    },
  });
  try {
    const path = proposalLockPath(current);
    mkdirSync(path);

    await assert.rejects(
      current.service.generate(generateInput(current, 'Do not recover an unknown lock carrier.')),
      (error) => error instanceof SpecificationProposalError && error.statusCode === 409,
    );
    assert.equal(existsSync(path), true);
  } finally {
    current.cleanup();
  }
});

test('lock release does not unlink its unique claim after the ownership token changes', async () => {
  let current;
  const foreignLock = `${JSON.stringify({
    schemaVersion: '2',
    pid: process.pid,
    acquiredAt: '2026-07-11T00:00:00.000Z',
    ownerInstanceId: 'replacement-manager-instance',
    token: 'replacement-owner-token',
    phase: 'held',
    ticket: 1,
  })}\n`;
  current = fixture({
    idFactory() {
      const claims = proposalLockClaimPaths(current);
      assert.equal(claims.length, 1);
      writeFileSync(claims[0], foreignLock, 'utf8');
      return 'proposal-owned-release';
    },
  });
  try {
    const proposal = await current.service.generate(generateInput(
      current,
      'Preserve a replacement lock owner.',
    ));
    assert.equal(proposal.proposalId, 'proposal-owned-release');
    const retained = proposalLockClaimPaths(current);
    assert.equal(retained.length, 1);
    assert.equal(readFileSync(retained[0], 'utf8'), foreignLock);
  } finally {
    current.cleanup();
  }
});

test('an aged recovery candidate cannot delete a newly published live legacy owner', async () => {
  let current;
  const oldPathContents = `${JSON.stringify({
    pid: 616_161,
    acquiredAt: '2020-01-01T00:00:00.000Z',
  })}\n`;
  const newLiveOwner = `${JSON.stringify({
    schemaVersion: '1',
    pid: 717_171,
    acquiredAt: '2026-07-11T01:00:00.000Z',
    ownerInstanceId: 'new-live-manager',
    token: 'new-live-owner',
  })}\n`;
  current = fixture({
    staleLockMs: 0,
    processIsAlive(pid) {
      if (pid === 616_161) return false;
      if (pid === 717_171) return true;
      assert.fail(`unexpected pid ${pid}`);
    },
    idFactory() {
      writeFileSync(proposalLockPath(current), newLiveOwner, 'utf8');
      return 'proposal-before-new-owner';
    },
  });
  try {
    writeFileSync(proposalLockPath(current), oldPathContents, 'utf8');
    const first = await current.service.generate(generateInput(
      current,
      'Finish the already elected stale-owner recovery.',
    ));
    assert.equal(first.proposalId, 'proposal-before-new-owner');
    assert.equal(readFileSync(proposalLockPath(current), 'utf8'), newLiveOwner);

    await assert.rejects(
      restartedService(current, {
        staleLockMs: 0,
        processIsAlive: (pid) => pid === 717_171,
      }).generate(generateInput(current, 'Competing recovery must respect the new owner.')),
      (error) => error instanceof SpecificationProposalError && error.statusCode === 409,
    );
    assert.equal(readFileSync(proposalLockPath(current), 'utf8'), newLiveOwner);
  } finally {
    current.cleanup();
  }
});

test('generation begun before acceptance cannot overwrite the accepted predecessor', async () => {
  const controlled = createDeferredFixtureProvider();
  const current = fixture({ provider: controlled.provider });
  try {
    const firstGeneration = current.service.generate(generateInput(current, 'Candidate to accept.'));
    assert.equal(controlled.pending.length, 1);
    controlled.pending.shift().gate.resolve();
    const first = await firstGeneration;

    const lateGeneration = current.service.generate(generateInput(
      current,
      'Late refinement after acceptance starts.',
      first.proposalId,
    ));
    assert.equal(controlled.pending.length, 1);
    const lateProvider = controlled.pending.shift();

    const accepted = await current.service.accept({
      projectRoot: current.root,
      proposalId: first.proposalId,
      actorRef: 'actor://operator/jim',
    });
    assert.equal(accepted.status, 'accepted');

    lateProvider.gate.resolve();
    await assert.rejects(
      lateGeneration,
      (error) => error instanceof SpecificationProposalError && error.statusCode === 409,
    );
    const persisted = current.service.list(current.root).proposals.find(
      (entry) => entry.proposalId === first.proposalId,
    );
    assert.deepEqual(persisted, accepted);
  } finally {
    current.cleanup();
  }
});

test('generation begun before rejection cannot use the rejected predecessor to select a successor', async () => {
  const controlled = createDeferredFixtureProvider();
  const current = fixture({ provider: controlled.provider });
  try {
    const firstGeneration = current.service.generate(generateInput(current, 'Candidate to reject.'));
    assert.equal(controlled.pending.length, 1);
    controlled.pending.shift().gate.resolve();
    const first = await firstGeneration;

    const lateGeneration = current.service.generate(generateInput(
      current,
      'Late refinement after rejection starts.',
      first.proposalId,
    ));
    assert.equal(controlled.pending.length, 1);
    const lateProvider = controlled.pending.shift();

    const rejected = await current.service.reject({
      projectRoot: current.root,
      proposalId: first.proposalId,
      actorRef: 'actor://operator/jim',
    });
    assert.equal(rejected.status, 'rejected');

    lateProvider.gate.resolve();
    await assert.rejects(
      lateGeneration,
      /cannot refine a rejected proposal because its growth authority is exhausted/,
    );
    const history = current.service.list(current.root);
    const persisted = history.proposals.find((entry) => entry.proposalId === first.proposalId);
    assert.equal(history.proposals.length, 1);
    assert.deepEqual(persisted, rejected);
  } finally {
    current.cleanup();
  }
});

test('generation begun before supersession cannot use the superseded predecessor to select a successor', async () => {
  const controlled = createDeferredFixtureProvider();
  const current = fixture({ provider: controlled.provider });
  try {
    const firstGeneration = current.service.generate(generateInput(current, 'Candidate to supersede.'));
    assert.equal(controlled.pending.length, 1);
    controlled.pending.shift().gate.resolve();
    const first = await firstGeneration;

    const lateGeneration = current.service.generate(generateInput(
      current,
      'Late refinement after supersession starts.',
      first.proposalId,
    ));
    const selectedGeneration = current.service.generate(generateInput(
      current,
      'Selected refinement.',
      first.proposalId,
    ));
    assert.equal(controlled.pending.length, 2);
    const lateProvider = controlled.pending.shift();
    controlled.pending.shift().gate.resolve();
    const selected = await selectedGeneration;
    const superseded = current.service.list(current.root).proposals.find(
      (entry) => entry.proposalId === first.proposalId,
    );
    assert.equal(superseded.status, 'superseded');

    lateProvider.gate.resolve();
    await assert.rejects(
      lateGeneration,
      /cannot refine a superseded proposal because its growth authority is exhausted/,
    );
    const history = current.service.list(current.root);
    assert.equal(history.proposals.length, 2);
    assert.equal(history.proposals.some((entry) => entry.proposalId === selected.proposalId), true);
    assert.deepEqual(
      history.proposals.find((entry) => entry.proposalId === first.proposalId),
      superseded,
    );
  } finally {
    current.cleanup();
  }
});

async function assertConcurrentValidationPreservesDecision(decision) {
  const validationEntered = deferred();
  const releaseValidation = deferred();
  const current = fixture({
    beforeValidationCommit() {
      validationEntered.resolve();
      return releaseValidation.promise;
    },
  });
  try {
    const proposal = await current.service.generate(generateInput(current, `Candidate to ${decision}.`));
    const validation = current.service.validate({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
    });
    const validationRejected = assert.rejects(
      validation,
      new RegExp(`cannot validate a ${decision === 'accept' ? 'accepted' : 'rejected'} proposal`),
    );
    await validationEntered.promise;

    const decided = await current.service[decision]({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
      actorRef: 'actor://operator/jim',
    });
    releaseValidation.resolve();
    await validationRejected;

    const persisted = current.service.list(current.root).proposals.find(
      (entry) => entry.proposalId === proposal.proposalId,
    );
    assert.equal(decided.status, decision === 'accept' ? 'accepted' : 'rejected');
    assert.equal(persisted.status, decided.status);
    assert.deepEqual(persisted.decision, decided.decision);
  } finally {
    releaseValidation.resolve();
    current.cleanup();
  }
}

test('concurrent validation cannot overwrite an accepted terminal decision', async () => {
  await assertConcurrentValidationPreservesDecision('accept');
});

test('concurrent validation cannot overwrite a rejected terminal decision', async () => {
  await assertConcurrentValidationPreservesDecision('reject');
});

test('stale proposal validation fails closed and acceptance cannot apply it', async () => {
  const current = fixture();
  try {
    const proposal = await current.service.generate(generateInput(current));
    writeFileSync(
      join(current.root, 'specification', 'INTENT.md'),
      '# Intent\n\nThe authority basis changed independently.\n',
      'utf8',
    );
    const productBefore = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    const validated = await current.service.validate({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
    });
    assert.equal(validated.status, 'stale');
    assert.equal(validated.validation[0].status, 'failed');
    assert.equal(validated.validation.at(-1).status, 'unavailable');
    await assert.rejects(
      current.service.accept({
        projectRoot: current.root,
        proposalId: proposal.proposalId,
        actorRef: 'actor://operator/jim',
      }),
      (error) => error instanceof SpecificationProposalError && error.statusCode === 409,
    );
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'), productBefore);
    const replacement = await current.service.generate(generateInput(
      current,
      'Regenerate the candidate on the current basis.',
      proposal.proposalId,
    ));
    assert.equal(replacement.predecessorProposalId, proposal.proposalId);
    assert.equal(
      current.service.list(current.root).proposals.find((entry) => entry.proposalId === proposal.proposalId).status,
      'stale',
    );
    const rejected = await current.service.reject({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
      actorRef: 'actor://operator/jim',
    });
    assert.equal(rejected.status, 'rejected');
  } finally {
    current.cleanup();
  }
});

test('provider patch outside specification is rejected before persistence', async () => {
  const current = fixture({
    provider: {
      participantRef: 'participant://test/invalid-provider',
      async generate() {
        return {
          summary: 'Invalid source patch',
          affectedSurfaceRefs: ['README.md'],
          patch: [
            'diff --git a/README.md b/README.md',
            '--- a/README.md',
            '+++ b/README.md',
            '@@ -0,0 +1 @@',
            '+invalid',
            '',
          ].join('\n'),
        };
      },
    },
  });
  try {
    await assert.rejects(
      current.service.generate(generateInput(current)),
      /outside specification/,
    );
    assert.equal(current.service.list(current.root).proposals.length, 0);
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8').includes('invalid'), false);
  } finally {
    current.cleanup();
  }
});

test('mixed traditional file headers cannot escape the admitted diff --git scope', async () => {
  const current = fixture({
    provider: {
      participantRef: 'participant://test/mixed-header-provider',
      async generate() {
        return {
          summary: 'Specification change carrying a hidden README addition',
          affectedSurfaceRefs: ['specification/PRODUCT.md'],
          patch: [
            'diff --git a/specification/PRODUCT.md b/specification/PRODUCT.md',
            '--- a/specification/PRODUCT.md',
            '+++ b/specification/PRODUCT.md',
            '@@ -1,5 +1,7 @@',
            ' # Fixture Product',
            ' ',
            ' ## Product Identity',
            ' ',
            ' A governed fixture.',
            '+',
            '+Admitted specification change.',
            '--- /dev/null',
            '+++ b/README.md',
            '@@ -0,0 +1 @@',
            '+scope bypass',
            '',
          ].join('\n'),
        };
      },
    },
  });
  try {
    await assert.rejects(
      current.service.generate(generateInput(current)),
      /proposal patch is malformed/,
    );
    assert.equal(current.service.list(current.root).proposals.length, 0);
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8').includes(
      'Admitted specification change.',
    ), false);
    assert.equal(existsSync(join(current.root, 'README.md')), false);
  } finally {
    current.cleanup();
  }
});

test('patch path admission recognizes bounded rename, new-file, and delete forms', () => {
  const patch = [
    'diff --git a/specification/OLD.md b/specification/RENAMED.md',
    'similarity index 100%',
    'rename from specification/OLD.md',
    'rename to specification/RENAMED.md',
    'diff --git a/specification/NEW.md b/specification/NEW.md',
    'new file mode 100644',
    'index 0000000..1111111',
    '--- /dev/null',
    '+++ b/specification/NEW.md',
    '@@ -0,0 +1 @@',
    '+# New',
    'diff --git a/specification/DELETE.md b/specification/DELETE.md',
    'deleted file mode 100644',
    'index 2222222..0000000',
    '--- a/specification/DELETE.md',
    '+++ /dev/null',
    '@@ -1 +0,0 @@',
    '-# Delete',
    '',
  ].join('\n');
  assert.deepEqual(specificationProposalPatchPaths(patch), [
    'specification/OLD.md',
    'specification/RENAMED.md',
    'specification/NEW.md',
    'specification/DELETE.md',
  ]);
  assert.throws(
    () => specificationProposalPatchPaths([
      'diff --git a/specification/PRODUCT.md b/specification/PRODUCT.md',
      '--- a/specification/PRODUCT.md',
      '',
    ].join('\n')),
    /file headers must be paired/,
  );
});

test('proposal history applies explicit oldest-first retention', async () => {
  const current = fixture({ retentionLimit: 2 });
  try {
    await current.service.generate(generateInput(current, 'Candidate one.'));
    await current.service.generate(generateInput(current, 'Candidate two.'));
    await current.service.generate(generateInput(current, 'Candidate three.'));
    const history = current.service.list(current.root);
    assert.equal(history.retentionLimit, 2);
    assert.equal(history.truncated, true);
    assert.deepEqual(history.proposals.map((entry) => entry.proposalId), ['proposal-3', 'proposal-2']);
  } finally {
    current.cleanup();
  }
});
