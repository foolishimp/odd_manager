import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { createFixtureSpecificationProposalProvider } from '../../src/server/specification-proposal-provider.mjs';
import {
  createSpecificationProposalService,
  SpecificationProposalError,
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
  const service = createSpecificationProposalService({
    managerStateRoot,
    provider: options.provider ?? createFixtureSpecificationProposalProvider(),
    retentionLimit: options.retentionLimit,
    idFactory: () => `proposal-${++id}`,
    now: () => `2026-07-11T01:${String(tick++).padStart(2, '0')}:00.000Z`,
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
    service,
    cleanup() {
      rmSync(root, { recursive: true, force: true });
      rmSync(managerStateRoot, { recursive: true, force: true });
    },
  };
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

test('proposal generation, validation, and acceptance preserve candidate truth until one atomic apply', async () => {
  const current = fixture();
  try {
    const before = readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8');
    const proposal = await current.service.generate(generateInput(current));
    assert.equal(proposal.status, 'draft');
    assert.equal(proposal.participantRef, 'participant://fixture/specification-proposal');
    assert.equal(proposal.contextAttachments.length, 2);
    assert.equal(readFileSync(join(current.root, 'specification', 'PRODUCT.md'), 'utf8'), before);

    const validated = current.service.validate({
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

    const accepted = current.service.accept({
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

    const rejected = current.service.reject({
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
    const validated = current.service.validate({
      projectRoot: current.root,
      proposalId: proposal.proposalId,
    });
    assert.equal(validated.status, 'stale');
    assert.equal(validated.validation[0].status, 'failed');
    assert.equal(validated.validation.at(-1).status, 'unavailable');
    assert.throws(
      () => current.service.accept({
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
    const rejected = current.service.reject({
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
