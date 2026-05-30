import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  composeManagerWorld,
  managerSurfaceMediaType,
  projectRequirements,
  readManagerSurface,
  runManagerCommand,
} from '../../src/server/manager-world-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_manager_world');

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
}

function teardown() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('readManagerSurface rejects paths outside workspace', () => {
  setup();
  try {
    const surface = readManagerSurface(fixtureRoot, '../outside.json');
    assert.equal(surface.kind, 'unreadable');
    assert.equal(surface.reason, 'outside_workspace');
  } finally {
    teardown();
  }
});

test('readManagerSurface treats PDFs as binary metadata instead of UTF-8 JSON payloads', () => {
  setup();
  try {
    writeFileSync(join(fixtureRoot, 'report.pdf'), Buffer.from('%PDF-1.7\nfixture\n%%EOF\n'));

    const surface = readManagerSurface(fixtureRoot, 'report.pdf');

    assert.equal(surface.kind, 'file');
    assert.equal(surface.media_type, 'application/pdf');
    assert.equal(surface.encoding, 'binary');
    assert.equal(surface.content, '');
    assert.equal(surface.size_bytes, 23);
    assert.equal(managerSurfaceMediaType('report.html'), 'text/html; charset=utf-8');
  } finally {
    teardown();
  }
});

test('projectRequirements reads block and table requirement styles', () => {
  setup();
  try {
    const requirementsRoot = join(fixtureRoot, 'specification/requirements');
    const runtimeRoot = join(fixtureRoot, '.ai-workspace/runtime');
    mkdirSync(requirementsRoot, { recursive: true });
    mkdirSync(runtimeRoot, { recursive: true });
    writeFileSync(
      join(requirementsRoot, '00-starter.md'),
      [
        '# Requirement Family: Starter Requirements',
        '',
        '**Family**: starter',
        '**Status**: specified',
        '**Traces To**: INT-001, INT-002',
        '**Derives From**: INT-ROOT',
        '',
        '### REQ-START-01 - Block Style Requirement',
        '',
        '**Priority**: High',
        '**Type**: Functional',
        '**Description**: A fully authored requirement block.',
        '',
        'Acceptance Criteria',
        '- First proof point',
        '- Second proof point',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      join(requirementsRoot, '10-generated-bootstrap.md'),
      [
        '# Generated Bootstrap Requirements',
        '',
        '### 11. Record Accounting (ACC) - INT-008',
        '',
        '| ID | Title | Priority | Type |',
        '|----|-------|----------|------|',
        '| REQ-ACC-01 | Accounting Invariant | Critical | Functional |',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      join(runtimeRoot, 'odd_sdlc-requirement-closure.json'),
      JSON.stringify({
        requirements: [{
          requirement_id: 'REQ-START-01',
          status: 'realized',
          authority_refs: ['specification/requirements/00-starter.md'],
          code_refs: ['build_tenants/react_vite/src/server/index.mjs'],
        }],
      }),
      'utf8',
    );

    const projected = projectRequirements(fixtureRoot);
    const indexed = Object.fromEntries(projected.map((entry) => [entry.requirement_id, entry]));

    assert.equal(projected.length, 2);
    assert.equal(indexed['REQ-START-01'].title, 'Block Style Requirement');
    assert.equal(indexed['REQ-START-01'].family, 'starter');
    assert.equal(indexed['REQ-START-01'].status, 'realized');
    assert.equal(indexed['REQ-START-01'].delivery_status, 'converged');
    assert.deepEqual(indexed['REQ-START-01'].traces_to, ['INT-001', 'INT-002']);
    assert.deepEqual(indexed['REQ-START-01'].acceptance_criteria, ['First proof point', 'Second proof point']);
    assert.equal(indexed['REQ-ACC-01'].family_title, 'Record Accounting (ACC)');
    assert.equal(indexed['REQ-ACC-01'].priority, 'Critical');
  } finally {
    teardown();
  }
});

test('composeManagerWorld uses Node projection contract and gap dossier truth', () => {
  setup();
  try {
    const requirementsRoot = join(fixtureRoot, 'specification/requirements');
    const runtimeRoot = join(fixtureRoot, '.ai-workspace/runtime');
    mkdirSync(requirementsRoot, { recursive: true });
    mkdirSync(runtimeRoot, { recursive: true });
    writeFileSync(
      join(requirementsRoot, '01-control.md'),
      [
        '# Control',
        '',
        '**Status**: Active',
        '',
        '### REQ-CTL-001 - Control Exists',
        '',
        '**Priority**: Critical',
      ].join('\n'),
      'utf8',
    );
    writeFileSync(
      join(runtimeRoot, 'odd_sdlc-gap-dossier.json'),
      JSON.stringify({
        published: false,
        unavailable_reason: 'published_analysis_stale',
        summary: { published: false, gap_count: 0 },
        dossiers: [],
      }),
      'utf8',
    );

    const world = composeManagerWorld(fixtureRoot);

    assert.equal(world.domain.query_contract.name, 'odd_manager.node-world');
    assert.equal(world.domain.domain_contract.compatibility, 'supported');
    assert.equal(world.domain.gaps.converged, false);
    assert.equal(world.domain.gaps.unavailable_reason, 'published_analysis_stale');
    assert.equal(world.graph_set.graphs.length, 1);
  } finally {
    teardown();
  }
});

test('runManagerCommand exposes gaps locally and fails closed for traversal commands', async () => {
  setup();
  try {
    const gaps = await runManagerCommand(fixtureRoot, 'gaps');
    assert.equal(gaps.ok, true);
    assert.equal(gaps.source, 'odd_manager_node_projection');

    const start = await runManagerCommand(fixtureRoot, 'start', { auto: true });
    assert.equal(start.ok, false);
    assert.equal(start.status, 'unavailable');
    assert.match(start.error, /Node-only tenant runtime/);
  } finally {
    teardown();
  }
});
