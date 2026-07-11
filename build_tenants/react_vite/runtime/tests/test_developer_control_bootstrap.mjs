import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import {
  buildPortfolioSchema,
  developerControlBootstrapSchema,
} from '@odd-manager/developer-control-contracts';
import {
  loadDeveloperControlBootstrap,
  loadDeveloperControlPortfolio,
  observeProjectRevision,
} from '../../src/server/developer-control-bootstrap-service.mjs';

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

test('developer control bootstrap publishes six schema-valid capability contributions', () => {
  const current = fixture();
  try {
    const bootstrap = loadDeveloperControlBootstrap(current.root, current.projects, {
      observedAt: '2026-07-11T00:00:00.000Z',
    });
    assert.doesNotThrow(() => developerControlBootstrapSchema.parse(bootstrap));
    assert.equal(bootstrap.capabilities.length, 6);
    assert.equal(bootstrap.context.project.id, 'fixture-project');
    assert.equal(bootstrap.context.project.publishedProductRef, 'product://odd_glc');
    assert.equal(bootstrap.context.revision, null);

    const proposal = bootstrap.capabilities.find((entry) => entry.id === 'specification-proposal');
    const build = bootstrap.capabilities.find((entry) => entry.id === 'build-control');
    const run = bootstrap.capabilities.find((entry) => entry.id === 'run-observation');
    assert.equal(proposal?.availability.kind, 'ready');
    assert.deepEqual(proposal?.availability.contractRefs, [
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
  } finally {
    current.cleanup();
    rmSync(secondRoot, { recursive: true, force: true });
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
    execFileSync('git', ['-C', root, 'add', 'PRODUCT.md']);
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
    assert.equal(committed.sourceDigest, committed.revision);

    writeFileSync(join(root, 'PRODUCT.md'), '# Dirty Fixture\n', 'utf8');
    const dirty = observeProjectRevision(root, '2026-07-11T00:00:01.000Z');
    assert.equal(dirty.kind, 'worktree');
    assert.equal(dirty.dirty, true);
    assert.equal(dirty.revision, committed.revision);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
