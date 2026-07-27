import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  assuranceAttentionIdentity,
  buildPortfolioSchema,
  developerControlBootstrapSchema,
} from '@odd-manager/developer-control-contracts';
import {
  loadDeveloperControlBootstrap,
  loadDeveloperControlPortfolio,
  observeProjectRevision,
} from '../../src/server/developer-control-bootstrap-service.mjs';
import {
  fingerprintProjectSource,
  sameProjectRevisionBasis,
} from '../../src/server/project-revision-service.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-developer-control-'));
  mkdirSync(join(root, '.ai-workspace'), { recursive: true });
  mkdirSync(join(root, 'specification', 'requirements'), { recursive: true });
  writeFileSync(join(root, 'specification', 'PRODUCT.md'), '# Fixture Product\n', 'utf8');
  const projects = [{
    id: 'fixture-project',
    name: 'Fixture Project',
    root,
    odd_type: 'odd_glc',
    has_ai_workspace: true,
  }];
  return { root, projects, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

function commitFixture(root) {
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', [
    '-C', root,
    '-c', 'user.name=Odd Manager Test',
    '-c', 'user.email=odd-manager@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ]);
}

function readyAdmissions(root) {
  return {
    buildDescriptorAdmission: {
      schemaVersion: '1',
      projectRoot: root,
      status: 'ready',
      descriptor: {
        schemaVersion: '1',
        descriptorRef: 'build-carrier-descriptor://odd_glc/software-build',
        productRef: 'product://odd_glc',
        productVersion: '0.1.0',
        carrierKind: 'graph_function',
        carrierRef: 'graph-function://odd_glc/software-build',
        startupConfigRef: 'startup-config://odd_glc/software-build',
        publicStartTarget: 'start-target://odd_glc/software-build',
        inputSchemaRef: 'schema://odd_glc/software-build-input/v1',
        worksiteProvisionerRef: 'worksite-provisioner://odd_manager/project-snapshot/v1',
        executionAdapterRef: 'execution-adapter://fixture/process/v1',
        supportedCommands: ['submit', 'attach', 'cancel'],
        requirementCatalogRefs: ['requirements://odd_glc/software-build'],
        expectedAssetCatalogRefs: ['assets://odd_glc/software-build'],
        proofRefs: ['proof://odd_glc/software-build'],
      },
      reason: null,
      sourceRefs: ['descriptor://fixture'],
    },
    assuranceCatalogAdmission: {
      schemaVersion: '1',
      projectRoot: root,
      status: 'ready',
      catalog: {
        schemaVersion: '1',
        catalogRef: 'assurance-catalog://odd_glc/software-build',
        productRef: 'product://odd_glc',
        requirementCatalogRef: 'requirements://odd_glc/software-build',
        assetCatalogRef: 'assets://odd_glc/software-build',
        gates: [],
        assets: [],
        sourceRefs: ['assurance-catalog://odd_glc/software-build'],
      },
      reason: null,
      sourceRefs: ['assurance-catalog://odd_glc/software-build'],
    },
  };
}

function portfolioProjectRef(current) {
  return {
    id: current.projects[0].id,
    root: current.root,
    label: current.projects[0].name,
    publishedProductRef: `product://${current.projects[0].odd_type}`,
  };
}

function mismatchedRevision(revision) {
  return {
    ...revision,
    sourceDigest: `${revision.sourceDigest}-foreign`,
  };
}

function portfolioGateAttentionId(projectId, executionId) {
  return assuranceAttentionIdentity({
    projectId,
    executionId,
    sourceKind: 'gate',
    sourceIdentity: 'gate://fixture/portfolio',
  });
}

function buildObservation(current, revision, withExecution = false) {
  const project = portfolioProjectRef(current);
  const descriptorAdmission = readyAdmissions(current.root).buildDescriptorAdmission;
  const descriptor = descriptorAdmission.descriptor;
  const request = {
    schemaVersion: '1',
    requestId: 'request-portfolio-1',
    correlationId: 'correlation-portfolio-1',
    project,
    revision,
    descriptorBinding: descriptor,
    adapterBinding: {
      adapterRef: descriptor.executionAdapterRef,
      sourceRefs: ['adapter://fixture/portfolio'],
    },
    descriptorRef: descriptor.descriptorRef,
    carrierRef: descriptor.carrierRef,
    startupConfigRef: descriptor.startupConfigRef,
    publicStartTarget: descriptor.publicStartTarget,
    inputs: {},
    requestedBy: 'actor://operator/portfolio-test',
    requestedAt: '2026-07-11T00:00:00.000Z',
    resourcePolicyRef: 'policy://fixture/portfolio',
    authorityRefs: ['authority://fixture/portfolio'],
  };
  const execution = {
    schemaVersion: '1',
    executionId: 'execution-portfolio-1',
    requestId: request.requestId,
    correlationId: request.correlationId,
    project,
    revision,
    state: 'running',
    attempt: 1,
    queuePosition: null,
    processRef: 'process://fixture/portfolio',
    worksiteRef: 'worksite://fixture/portfolio',
    runRefs: ['run://fixture/portfolio'],
    startedAt: '2026-07-11T00:00:00.000Z',
    updatedAt: '2026-07-11T00:00:01.000Z',
    completedAt: null,
    heartbeatAt: '2026-07-11T00:00:01.000Z',
    resumedAt: null,
    resumedBy: null,
    processOutcome: null,
    cancelRequestedAt: null,
    cancelledBy: null,
    assuranceSummaryRef: null,
    sourceRefs: ['build-execution://execution-portfolio-1'],
  };
  return {
    schemaVersion: '1',
    projectRoot: current.root,
    revision,
    descriptorAdmission,
    requests: withExecution ? [request] : [],
    executions: withExecution ? [execution] : [],
    scheduler: {
      maxConcurrent: 2,
      maxQueued: 10,
      runningCount: withExecution ? 1 : 0,
      queuedCount: 0,
      availableSlots: withExecution ? 1 : 2,
    },
    observedAt: '2026-07-11T00:00:01.000Z',
    sourceRefs: ['build-control-store://fixture'],
  };
}

function assuranceObservation(current, revision, execution) {
  const project = portfolioProjectRef(current);
  const executionId = execution?.executionId ?? null;
  const correlationId = execution?.correlationId ?? `project:${project.id}:assurance`;
  return {
    schemaVersion: '1',
    projectRoot: current.root,
    revision,
    execution,
    catalogAdmission: {
      schemaVersion: '1',
      projectRoot: current.root,
      status: 'unsupported',
      catalog: null,
      reason: 'Fixture catalog is intentionally unsupported.',
      sourceRefs: ['assurance-catalog://fixture'],
    },
    evidenceBundleRef: null,
    gateAssessments: [{
      gateRef: 'gate://fixture/portfolio',
      label: 'Portfolio gate',
      requirementRef: 'requirement://fixture/portfolio',
      project,
      revision,
      executionId,
      regime: 'F_D',
      status: 'missing',
      detail: 'No admitted evidence.',
      producerRef: null,
      evidenceDigest: null,
      evidenceRefs: [],
      decision: null,
      sourceRefs: ['gate://fixture/portfolio'],
      assessedAt: '2026-07-11T00:00:01.000Z',
    }],
    assetDeliveries: [{
      requirementRef: 'requirement://fixture/portfolio-asset',
      label: 'Portfolio asset',
      artifactRef: null,
      project,
      revision,
      executionId,
      status: 'missing',
      detail: 'No admitted asset.',
      producerRef: null,
      digest: null,
      evidenceRefs: [],
      sourceRefs: ['asset://fixture/portfolio'],
    }],
    attentionItems: [{
      attentionId: portfolioGateAttentionId(project.id, executionId),
      correlationId,
      project,
      executionId,
      sourceKind: 'gate',
      sourceRef: 'gate://fixture/portfolio',
      severity: 'blocking',
      reason: 'Portfolio gate is missing.',
      observedAt: '2026-07-11T00:00:01.000Z',
      reactionRefs: [],
    }],
    summary: {
      posture: 'unsupported',
      gateCounts: {
        total: 1,
        satisfied: 0,
        failed: 0,
        missing: 1,
        stale: 0,
        waitingHuman: 0,
      },
      assetCounts: {
        total: 1,
        delivered: 0,
        failed: 0,
        missing: 1,
        stale: 0,
      },
      blockingAttentionCount: 1,
    },
    observedAt: '2026-07-11T00:00:01.000Z',
    sourceRefs: [
      'assurance-catalog://fixture',
      executionId ? `build-execution://${executionId}` : `project://${project.id}/assurance`,
    ],
  };
}

test('developer control bootstrap publishes six schema-valid capability contributions', () => {
  const current = fixture();
  try {
    commitFixture(current.root);
    const bootstrap = loadDeveloperControlBootstrap(current.root, current.projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
    });
    assert.doesNotThrow(() => developerControlBootstrapSchema.parse(bootstrap));
    assert.equal(bootstrap.capabilities.length, 6);
    assert.equal(bootstrap.context.project.id, 'fixture-project');
    assert.equal(bootstrap.context.project.publishedProductRef, 'product://odd_glc');
    assert.equal(bootstrap.context.revision?.kind, 'commit');

    const proposal = bootstrap.capabilities.find((entry) => entry.id === 'specification-proposal');
    const build = bootstrap.capabilities.find((entry) => entry.id === 'build-control');
    const run = bootstrap.capabilities.find((entry) => entry.id === 'run-observation');
    assert.equal(proposal?.availability.kind, 'ready');
    assert.deepEqual(proposal?.availability.contractRefs, [
      'contract://odd_manager/developer-control/project-revision',
      'action://odd_manager/specification-proposal',
      'participant://codex/specification-proposal',
    ]);
    assert.equal(proposal?.implementationStage, 'mvp');
    assert.equal(build?.availability.kind, 'unavailable');
    assert.deepEqual(build?.availability.missingRefs, ['build-carrier-descriptor://odd_glc/software-build']);
    assert.equal(run?.availability.kind, 'ready');
  } finally {
    current.cleanup();
  }
});

test('non-Git Project keeps revision-dependent capabilities unavailable while generic work remains available', () => {
  const current = fixture();
  try {
    const revisionSourceRef = 'project://fixture-project/revision';
    const bootstrap = loadDeveloperControlBootstrap(current.root, current.projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
      revision: null,
      ...readyAdmissions(current.root),
    });

    assert.equal(bootstrap.context.revision, null);
    for (const capabilityId of [
      'specification-proposal',
      'build-control',
      'assurance-attention',
    ]) {
      const capability = bootstrap.capabilities.find((entry) => entry.id === capabilityId);
      assert.equal(capability?.availability.kind, 'unavailable');
      assert.deepEqual(capability?.availability.missingRefs, [revisionSourceRef]);
      assert.match(capability?.availability.reason, /requires an admitted ProjectRevision/);
    }
    for (const capabilityId of ['build-portfolio', 'project-workbench', 'run-observation']) {
      const capability = bootstrap.capabilities.find((entry) => entry.id === capabilityId);
      assert.equal(capability?.availability.kind, 'ready');
    }
  } finally {
    current.cleanup();
  }
});

test('Project revision observation failure errors revision-dependent capabilities without suppressing generic work', () => {
  const current = fixture();
  try {
    const revisionSourceRef = 'project://fixture-project/revision';
    const bootstrap = loadDeveloperControlBootstrap(current.root, current.projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
      revisionObserver: () => {
        throw new Error('revision observer exploded');
      },
      ...readyAdmissions(current.root),
    });

    assert.equal(bootstrap.context.revision, null);
    for (const capabilityId of [
      'specification-proposal',
      'build-control',
      'assurance-attention',
    ]) {
      const capability = bootstrap.capabilities.find((entry) => entry.id === capabilityId);
      assert.equal(capability?.availability.kind, 'error');
      assert.deepEqual(capability?.availability.sourceRefs, [revisionSourceRef]);
      assert.match(capability?.availability.error, /revision observer exploded/);
    }
    for (const capabilityId of ['build-portfolio', 'project-workbench', 'run-observation']) {
      const capability = bootstrap.capabilities.find((entry) => entry.id === capabilityId);
      assert.equal(capability?.availability.kind, 'ready');
    }
  } finally {
    current.cleanup();
  }
});

test('developer control portfolio projects registered roots without changing active Context', () => {
  const current = fixture();
  const secondRoot = mkdtempSync(join(tmpdir(), 'odd-manager-portfolio-second-'));
  try {
    const projects = [
      { ...current.projects[0], is_active: true, build_tenants: ['react_vite'], has_genesis: true },
      {
        id: 'second-project',
        name: 'Second Project',
        root: secondRoot,
        odd_type: 'unknown',
        has_ai_workspace: false,
        has_genesis: false,
        build_tenants: [],
        is_active: false,
      },
    ];
    const portfolio = loadDeveloperControlPortfolio(projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
      browseRoot: dirname(current.root),
    });
    assert.doesNotThrow(() => buildPortfolioSchema.parse(portfolio));
    assert.equal(portfolio.rows.length, 2);
    assert.equal(portfolio.rows[0].active, true);
    assert.equal(portfolio.rows[0].specification.kind, 'present');
    assert.equal(portfolio.rows[0].build.kind, 'unavailable');
    assert.equal(portfolio.rows[1].specification.kind, 'missing');
    assert.equal(portfolio.rows[1].run.kind, 'unsupported');
    assert.ok(portfolio.rows[1].attention.every((item) => item.sourceRef));
    assert.ok(portfolio.rows[1].attention.every((item) => item.correlationId));
  } finally {
    current.cleanup();
    rmSync(secondRoot, { recursive: true, force: true });
  }
});

test('developer control portfolio fails explicitly when Build observation throws', () => {
  const current = fixture();
  let assuranceObserved = false;
  try {
    assert.throws(
      () => loadDeveloperControlPortfolio(current.projects, {
        observedAt: '2026-07-11T00:00:00.000Z',
        buildObservation: () => {
          throw new Error('build observer exploded');
        },
        assuranceObservation: () => {
          assuranceObserved = true;
          return null;
        },
      }),
      /portfolio Build observation failed for Project fixture-project: build observer exploded/,
    );
    assert.equal(
      assuranceObserved,
      false,
      'a failed Build observation must abort projection rather than synthesizing empty Build activity',
    );
  } finally {
    current.cleanup();
  }
});

test('developer control portfolio fails explicitly when Assurance observation throws', () => {
  const current = fixture();
  try {
    execFileSync('git', ['init', '--quiet', current.root]);
    execFileSync('git', ['-C', current.root, 'add', '.']);
    execFileSync('git', [
      '-C', current.root,
      '-c', 'user.name=Odd Manager Test',
      '-c', 'user.email=odd-manager@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ]);

    assert.throws(
      () => loadDeveloperControlPortfolio(current.projects, {
        observedAt: '2026-07-11T00:00:00.000Z',
        buildObservation: () => buildObservation(
          current,
          observeProjectRevision(current.root, '2026-07-11T00:00:00.000Z'),
        ),
        assuranceObservation: () => {
          throw new Error('assurance observer exploded');
        },
      }),
      /portfolio Assurance observation failed for Project fixture-project: assurance observer exploded/,
    );
  } finally {
    current.cleanup();
  }
});

test('portfolio rejects schema-valid Build observations from another Project or revision', () => {
  const current = fixture();
  try {
    commitFixture(current.root);
    const revision = observeProjectRevision(current.root, '2026-07-11T00:00:00.000Z');
    const foreignProject = {
      id: 'foreign-project',
      root: `${current.root}-foreign`,
      label: 'Foreign Project',
      publishedProductRef: 'product://foreign',
    };

    const foreignSnapshot = buildObservation(current, revision, true);
    foreignSnapshot.projectRoot = foreignProject.root;
    foreignSnapshot.descriptorAdmission.projectRoot = foreignProject.root;
    foreignSnapshot.requests[0].project = foreignProject;
    foreignSnapshot.executions[0].project = foreignProject;
    assert.throws(
      () => loadDeveloperControlPortfolio(current.projects, {
        observedAt: '2026-07-11T00:00:00.000Z',
        buildObservation: () => foreignSnapshot,
      }),
      /portfolio Build observation failed for Project fixture-project: Build observation Project root does not match/,
    );

    const wrongRevision = buildObservation(current, revision, true);
    wrongRevision.revision = mismatchedRevision(revision);
    wrongRevision.requests[0].revision = wrongRevision.revision;
    wrongRevision.executions[0].revision = wrongRevision.revision;
    assert.throws(
      () => loadDeveloperControlPortfolio(current.projects, {
        observedAt: '2026-07-11T00:00:00.000Z',
        buildObservation: () => wrongRevision,
      }),
      /portfolio Build observation failed for Project fixture-project: Build observation revision does not match/,
    );

    const foreignExecution = buildObservation(current, revision, true);
    foreignExecution.executions[0].project = foreignProject;
    assert.throws(
      () => loadDeveloperControlPortfolio(current.projects, {
        observedAt: '2026-07-11T00:00:00.000Z',
        buildObservation: () => foreignExecution,
      }),
      /execution execution-portfolio-1 does not belong to the portfolio row Project/,
    );
  } finally {
    current.cleanup();
  }
});

test('portfolio rejects Assurance results outside the row Project, revision, or selected execution', () => {
  const current = fixture();
  try {
    commitFixture(current.root);
    const revision = observeProjectRevision(current.root, '2026-07-11T00:00:00.000Z');
    const buildSnapshot = buildObservation(current, revision, true);
    const execution = buildSnapshot.executions[0];
    const foreignProject = {
      id: 'foreign-project',
      root: `${current.root}-foreign`,
      label: 'Foreign Project',
      publishedProductRef: 'product://foreign',
    };
    const cases = [
      {
        label: 'Project root',
        mutate(snapshot) { snapshot.projectRoot = foreignProject.root; },
        pattern: /Assurance observation Project root does not match/,
      },
      {
        label: 'revision',
        mutate(snapshot) { snapshot.revision = mismatchedRevision(revision); },
        pattern: /Assurance observation revision does not match/,
      },
      {
        label: 'selected execution',
        mutate(snapshot) { snapshot.execution.executionId = 'execution-foreign'; },
        pattern: /selected Build Execution does not match/,
      },
      {
        label: 'gate assessment',
        mutate(snapshot) { snapshot.gateAssessments[0].project = foreignProject; },
        pattern: /Assurance attention identity is not bound to its exact Project, execution, source kind, and assessment/,
      },
      {
        label: 'asset delivery',
        mutate(snapshot) {
          snapshot.assetDeliveries[0].revision = mismatchedRevision(revision);
        },
        pattern: /asset delivery requirement:\/\/fixture\/portfolio-asset does not belong/,
      },
      {
        label: 'attention item',
        mutate(snapshot) { snapshot.attentionItems[0].project = foreignProject; },
        pattern: /Assurance attention identity is not bound to its exact Project, execution, source kind, and assessment/,
      },
      {
        label: 'attention correlation',
        mutate(snapshot) { snapshot.attentionItems[0].correlationId = 'correlation-foreign'; },
        pattern: /attention item assurance:v1.*does not belong to the portfolio row selection or correlation/,
      },
    ];

    for (const currentCase of cases) {
      const snapshot = assuranceObservation(current, revision, structuredClone(execution));
      currentCase.mutate(snapshot);
      assert.throws(
        () => loadDeveloperControlPortfolio(current.projects, {
          observedAt: '2026-07-11T00:00:00.000Z',
          buildObservation: () => structuredClone(buildSnapshot),
          assuranceObservation: () => snapshot,
        }),
        currentCase.pattern,
        currentCase.label,
      );
    }
  } finally {
    current.cleanup();
  }
});

test('portfolio preserves exact execution and Project-level Assurance attention correlations', () => {
  const current = fixture();
  try {
    commitFixture(current.root);
    const revision = observeProjectRevision(current.root, '2026-07-11T00:00:00.000Z');
    const buildWithExecution = buildObservation(current, revision, true);
    const execution = buildWithExecution.executions[0];
    const executionPortfolio = loadDeveloperControlPortfolio(current.projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
      buildObservation: () => structuredClone(buildWithExecution),
      assuranceObservation: () => assuranceObservation(
        current,
        revision,
        structuredClone(execution),
      ),
    });
    assert.equal(
      executionPortfolio.rows[0].attention.find(
        (item) => item.attentionId
          === portfolioGateAttentionId('fixture-project', 'execution-portfolio-1'),
      )?.correlationId,
      execution.correlationId,
    );

    const buildWithoutExecution = buildObservation(current, revision, false);
    const projectCorrelation = `project:${current.projects[0].id}:assurance`;
    const projectPortfolio = loadDeveloperControlPortfolio(current.projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
      buildObservation: () => structuredClone(buildWithoutExecution),
      assuranceObservation: () => assuranceObservation(current, revision, null),
    });
    assert.equal(
      projectPortfolio.rows[0].attention.find(
        (item) => item.attentionId
          === portfolioGateAttentionId('fixture-project', null),
      )?.correlationId,
      projectCorrelation,
    );

    const foreignProjectAttention = assuranceObservation(current, revision, null);
    foreignProjectAttention.attentionItems[0].correlationId = 'project:foreign:assurance';
    assert.throws(
      () => loadDeveloperControlPortfolio(current.projects, {
        observedAt: '2026-07-11T00:00:00.000Z',
        buildObservation: () => structuredClone(buildWithoutExecution),
        assuranceObservation: () => foreignProjectAttention,
      }),
      /attention item assurance:v1.*does not belong to the portfolio row selection or correlation/,
    );
  } finally {
    current.cleanup();
  }
});

test('developer control bootstrap rejects an unregistered Project root', () => {
  const current = fixture();
  try {
    assert.throws(
      () => loadDeveloperControlBootstrap(join(current.root, 'other'), current.projects),
      /requires a registered Project/,
    );
  } finally {
    current.cleanup();
  }
});

test('Project revision observation distinguishes committed and dirty worktree bases', () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-project-revision-'));
  try {
    execFileSync('git', ['init', '--quiet', root]);
    writeFileSync(join(root, 'PRODUCT.md'), '# Fixture\n', 'utf8');
    writeFileSync(join(root, '.gitignore'), 'ignored-input.txt\n', 'utf8');
    execFileSync('git', ['-C', root, 'add', 'PRODUCT.md', '.gitignore']);
    execFileSync('git', [
      '-C', root,
      '-c', 'user.name=Odd Manager Test',
      '-c', 'user.email=odd-manager@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ]);

    const committed = observeProjectRevision(root, '2026-07-11T00:00:00.000Z');
    assert.equal(committed.kind, 'commit');
    assert.equal(committed.dirty, false);
    assert.match(committed.revision, /^[0-9a-f]{40}$/);
    assert.match(committed.sourceDigest, /^sha256:[0-9a-f]{64}$/);

    writeFileSync(join(root, 'ignored-input.txt'), 'ignored A\n', 'utf8');
    const ignoredA = observeProjectRevision(root, '2026-07-11T00:00:00.100Z');
    assert.equal(ignoredA.kind, 'worktree');
    assert.equal(ignoredA.dirty, true);
    writeFileSync(join(root, 'ignored-input.txt'), 'ignored B\n', 'utf8');
    const ignoredB = observeProjectRevision(root, '2026-07-11T00:00:00.200Z');
    assert.notEqual(ignoredB.sourceDigest, ignoredA.sourceDigest);
    rmSync(join(root, 'ignored-input.txt'));

    writeFileSync(join(root, 'PRODUCT.md'), '# Dirty Fixture\n', 'utf8');
    const dirty = observeProjectRevision(root, '2026-07-11T00:00:01.000Z');
    assert.equal(dirty.kind, 'worktree');
    assert.equal(dirty.dirty, true);
    assert.equal(dirty.revision, committed.revision);
    writeFileSync(join(root, 'PRODUCT.md'), '# Different Dirty Fixture\n', 'utf8');
    const changedDirty = observeProjectRevision(root, '2026-07-11T00:00:02.000Z');
    assert.notEqual(changedDirty.sourceDigest, dirty.sourceDigest);
    writeFileSync(join(root, 'untracked.txt'), 'untracked A\n', 'utf8');
    const untrackedA = observeProjectRevision(root, '2026-07-11T00:00:03.000Z');
    writeFileSync(join(root, 'untracked.txt'), 'untracked B\n', 'utf8');
    const untrackedB = observeProjectRevision(root, '2026-07-11T00:00:04.000Z');
    assert.notEqual(untrackedB.sourceDigest, untrackedA.sourceDigest);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Project revision status applies source exclusions to generated paths without masking source drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-project-revision-exclusions-'));
  try {
    const sourceRoot = join(root, 'src');
    const generatedRoot = join(
      root,
      'build_tenants',
      'fixture',
      'typescript',
      'test_runs',
    );
    mkdirSync(sourceRoot, { recursive: true });
    mkdirSync(join(generatedRoot, 'old run'), { recursive: true });
    writeFileSync(join(root, '.gitignore'), 'build_tenants/**/test_runs/\n', 'utf8');
    writeFileSync(join(sourceRoot, 'change me.ts'), 'export const value = 1;\n', 'utf8');
    writeFileSync(join(sourceRoot, 'rename me.ts'), 'export const renamed = false;\n', 'utf8');
    writeFileSync(join(sourceRoot, 'delete me.ts'), 'export const retained = true;\n', 'utf8');
    writeFileSync(join(generatedRoot, 'old run', 'rename me.txt'), 'generated rename\n', 'utf8');
    writeFileSync(join(generatedRoot, 'delete me.txt'), 'generated deletion\n', 'utf8');
    execFileSync('git', ['init', '--quiet', root]);
    execFileSync('git', ['-C', root, 'add', '.gitignore', 'src']);
    execFileSync('git', [
      '-C', root, 'add', '-f',
      'build_tenants/fixture/typescript/test_runs/old run/rename me.txt',
      'build_tenants/fixture/typescript/test_runs/delete me.txt',
    ]);
    execFileSync('git', [
      '-C', root,
      '-c', 'user.name=Odd Manager Test',
      '-c', 'user.email=odd-manager@example.invalid',
      'commit', '--quiet', '-m', 'fixture',
    ]);

    const committed = observeProjectRevision(root, '2026-07-27T00:00:00.000Z');
    assert.equal(committed.kind, 'commit');
    assert.equal(committed.dirty, false);

    mkdirSync(join(generatedRoot, 'new run'), { recursive: true });
    execFileSync('git', [
      '-C', root, 'mv', '-f',
      'build_tenants/fixture/typescript/test_runs/old run/rename me.txt',
      'build_tenants/fixture/typescript/test_runs/new run/renamed artifact.txt',
    ]);
    rmSync(join(generatedRoot, 'delete me.txt'));
    writeFileSync(
      join(generatedRoot, 'new run', 'ignored output with spaces.json'),
      '{"generated":true}\n',
      'utf8',
    );
    mkdirSync(join(root, 'dist'), { recursive: true });
    writeFileSync(join(root, 'dist', 'untracked output with spaces.js'), 'generated\n', 'utf8');

    assert.notEqual(
      execFileSync(
        'git',
        ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=normal'],
        { encoding: 'utf8' },
      ),
      '',
      'fixture must exercise tracked rename/deletion and untracked porcelain records',
    );
    assert.notEqual(
      execFileSync(
        'git',
        ['-C', root, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
        { encoding: 'utf8' },
      ),
      '',
      'fixture must exercise ignored generated records',
    );

    const generatedOnly = observeProjectRevision(root, '2026-07-27T00:00:01.000Z');
    assert.equal(generatedOnly.kind, committed.kind);
    assert.equal(generatedOnly.dirty, committed.dirty);
    assert.equal(generatedOnly.sourceDigest, committed.sourceDigest);
    assert.equal(sameProjectRevisionBasis(generatedOnly, committed), true);

    execFileSync('git', [
      '-C', root, 'mv',
      'src/rename me.ts',
      'src/renamed source.ts',
    ]);
    rmSync(join(sourceRoot, 'delete me.ts'));
    writeFileSync(join(sourceRoot, 'change me.ts'), 'export const value = 2;\n', 'utf8');
    const sourceChanged = observeProjectRevision(root, '2026-07-27T00:00:02.000Z');
    assert.equal(sourceChanged.kind, 'worktree');
    assert.equal(sourceChanged.dirty, true);
    assert.notEqual(sourceChanged.sourceDigest, committed.sourceDigest);
    assert.equal(sameProjectRevisionBasis(sourceChanged, committed), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Project source fingerprint excludes generated test_runs at any depth but retains source files', () => {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-project-fingerprint-'));
  try {
    mkdirSync(join(root, 'src'), { recursive: true });
    const generatedParent = join(root, 'build_tenants', 'odd_glc', 'typescript');
    mkdirSync(generatedParent, { recursive: true });
    writeFileSync(join(root, 'src', 'runtime.ts'), 'export const value = 1;\n', 'utf8');
    const sourceBasis = fingerprintProjectSource(root);

    const nestedRunRoot = join(
      generatedParent,
      'test_runs',
      'generated-run',
    );
    mkdirSync(nestedRunRoot, { recursive: true });
    writeFileSync(join(nestedRunRoot, 'proof.json'), '{"outcome":"first"}\n', 'utf8');
    assert.equal(fingerprintProjectSource(root), sourceBasis);

    writeFileSync(join(nestedRunRoot, 'proof.json'), '{"outcome":"second"}\n', 'utf8');
    assert.equal(fingerprintProjectSource(root), sourceBasis);

    writeFileSync(join(root, 'src', 'runtime.ts'), 'export const value = 2;\n', 'utf8');
    assert.notEqual(fingerprintProjectSource(root), sourceBasis);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('Project revision observation does not inherit an ancestor repository revision', () => {
  const parentRoot = mkdtempSync(join(tmpdir(), 'odd-manager-parent-repository-'));
  try {
    writeFileSync(join(parentRoot, 'parent-source.txt'), 'parent source\n', 'utf8');
    execFileSync('git', ['init', '--quiet', parentRoot]);
    execFileSync('git', ['-C', parentRoot, 'add', 'parent-source.txt']);
    execFileSync('git', [
      '-C', parentRoot,
      '-c', 'user.name=Odd Manager Test',
      '-c', 'user.email=odd-manager@example.invalid',
      'commit', '--quiet', '-m', 'parent fixture',
    ]);

    const nestedProjectRoot = join(parentRoot, 'generated', 'run-instance');
    mkdirSync(nestedProjectRoot, { recursive: true });
    writeFileSync(join(nestedProjectRoot, 'source.txt'), 'nested Project source\n', 'utf8');

    assert.equal(
      observeProjectRevision(nestedProjectRoot, '2026-07-11T00:00:00.000Z'),
      null,
    );
  } finally {
    rmSync(parentRoot, { recursive: true, force: true });
  }
});

test('Project revision observation surfaces post-HEAD source failures', () => {
  const current = fixture();
  try {
    commitFixture(current.root);
    execFileSync('mkfifo', [join(current.root, 'unsupported.pipe')]);
    assert.throws(
      () => observeProjectRevision(current.root, '2026-07-11T00:00:00.000Z'),
      /Project revision observation failed.*unsupported file type: unsupported\.pipe/,
    );
  } finally {
    current.cleanup();
  }
});
