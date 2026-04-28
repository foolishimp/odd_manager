// Verification + demo script for the TicketAssetSurface service.
//
// The assertions use a fixture-owned ticket tree. Live workspace lane
// distribution is mutable work truth, not a stable qualification fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import {
  createTicketSurface,
  loadAllTickets,
} from '../../src/server/ticket-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_ticket_read');
const ticketsRoot = resolve(fixtureRoot, '.ai-workspace/tickets');

function writeRichTicket(lane, id, {
  title = `Ticket ${id}`,
  governance = 'STDO Method',
  expansion = ['S: SPEC_METHOD.md', 'T: TICKET_METHOD.md', 'D: DESIGN_MODULE_METHOD.md', 'O: ODD_METHOD.md'],
  buildTenant = 'react_vite',
  dependencies = [],
} = {}) {
  const dir = join(ticketsRoot, lane);
  mkdirSync(dir, { recursive: true });
  const content = [
    '---',
    `id: ${id}`,
    `title: ${title}`,
    'type: feature',
    'ticket_category: build_wave',
    `status: ${lane}`,
    'goal: test-goal',
    'change_intent: test',
    'change_class: realization_refactor',
    're_entry_point: realization',
    'priority: high',
    'triaged_at: 2026-04-26',
    'created_at: 2026-04-26',
    'updated_at: 2026-04-26',
    `build_tenant: ${buildTenant}`,
    `governance_scope: ${governance}`,
    'governance_scope_expansion:',
    ...expansion.map((entry) => `  - ${entry}`),
    'dependencies:',
    ...dependencies.map((entry) => `  - ${entry}`),
    'evaluation_criteria:',
    '  - criterion one',
    '  - criterion two',
    '  - criterion three',
    '  - criterion four',
    '---',
    '',
    '## STDO Reading',
    '',
    'fixture body',
    '',
  ].join('\n');
  writeFileSync(join(dir, `${id}-fixture.md`), content);
}

function writeSparseTicket(lane, id) {
  const dir = join(ticketsRoot, lane);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${id}-sparse.md`), [
    `# ${id} Sparse Fixture`,
    '',
    `- id: ${id}`,
    '- type: feature',
    `- status: ${lane}`,
    '',
  ].join('\n'));
}

function setupFixture() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  writeSparseTicket('active', 'T-001');
  writeRichTicket('active', 'T-006', {
    title: 'STDO-UX fixture',
    governance: 'STDO-UX Method',
    expansion: [
      'S: SPEC_METHOD.md',
      'T: TICKET_METHOD.md',
      'D: DESIGN_MODULE_METHOD.md',
      'O: ODD_METHOD.md',
      'U: UX_METHOD.md',
    ],
  });
  writeRichTicket('backlog', 'T-007', { title: 'Realize TicketAssetSurface over .ai-workspace/tickets' });
  writeRichTicket('backlog', 'T-008', { dependencies: ['T-007 completed'] });
  writeRichTicket('completed', 'T-009', { buildTenant: 'project_package' });
}

function teardownFixture() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('loadAllTickets reads tickets across all lanes from a fixture tree', () => {
  setupFixture();
  try {
    const all = loadAllTickets(fixtureRoot);
    assert.equal(all.length, 5);
    const lanes = new Set(all.map((r) => r.lane));
    assert.deepEqual([...lanes].sort(), ['active', 'backlog', 'completed']);
  } finally {
    teardownFixture();
  }
});

test('rich-shape STDO ticket parses with mapped key set', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const t = surface.get('T-007');
    assert.ok(t, 'T-007 should be present');
    assert.equal(t.title, 'Realize TicketAssetSurface over .ai-workspace/tickets');
    assert.equal(t.type, 'feature');
    assert.equal(t.changeClass, 'realization_refactor');
    assert.equal(t.reEntryPoint, 'realization');
    assert.equal(t.buildTenant, 'react_vite');
    assert.equal(t.governanceScope, 'STDO Method');
    assert.ok(Array.isArray(t.dependencies), 'dependencies should parse as array');
    assert.ok(Array.isArray(t.evaluationCriteria), 'evaluationCriteria should be array');
    assert.equal(t.evaluationCriteria.length, 4);
    assert.ok(Array.isArray(t.governanceScopeExpansion), 'expansion is an array of inline maps');
    assert.deepEqual(t.governanceScopeExpansion[0], { S: 'SPEC_METHOD.md' });
  } finally {
    teardownFixture();
  }
});

test('STDO-UX ticket carries the U expansion entry', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const t = surface.get('T-006');
    assert.ok(t, 'T-006 should be present');
    assert.equal(t.governanceScope, 'STDO-UX Method');
    const letters = t.governanceScopeExpansion.map((m) => Object.keys(m)[0]);
    assert.deepEqual(letters, ['S', 'T', 'D', 'O', 'U']);
  } finally {
    teardownFixture();
  }
});

test('legacy sparse-shape ticket still parses', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const t = surface.get('T-001');
    assert.ok(t, 'T-001 sparse fixture should be present');
    assert.equal(t.type, 'feature');
  } finally {
    teardownFixture();
  }
});

test('filter by lane returns lane-scoped records only', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const completed = surface.list({ lane: 'completed' });
    assert.equal(completed.length, 1);
    assert.equal(completed[0].lane, 'completed');
  } finally {
    teardownFixture();
  }
});

test('filter by buildTenant scopes records', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const reactVite = surface.list({ buildTenant: 'react_vite' });
    assert.equal(reactVite.length, 3);
  } finally {
    teardownFixture();
  }
});

test('filter by hasDependency finds downstream tickets', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const dependsOnT007 = surface.list({ hasDependency: 'T-007' });
    assert.deepEqual(dependsOnT007.map((record) => record.id), ['T-008']);
  } finally {
    teardownFixture();
  }
});

test('demo: print fixture surface summary', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const all = surface.list();
    const byLane = all.reduce((acc, r) => {
      acc[r.lane] = (acc[r.lane] ?? 0) + 1;
      return acc;
    }, {});
    /* eslint-disable no-console */
    console.log('\n=== TicketAssetSurface fixture read ===');
    console.log(`projectRoot: ${fixtureRoot}`);
    console.log(`total: ${all.length}  by-lane:`, byLane);
    console.log('STDO-UX tickets:',
      surface.list().filter((r) => r.governanceScope === 'STDO-UX Method').map((r) => r.id));
    /* eslint-enable no-console */
  } finally {
    teardownFixture();
  }
});
