// Verification + demo script for the TicketAssetSurface service.
//
// Run from repo root:
//   node build_tenants/react_vite/runtime/tests/test_ticket_asset_surface.mjs
//
// Asserts the surface reads ticket files across all three lanes from this
// workspace and parses both the rich STDO frontmatter shape (T-005..T-015)
// and the legacy sparse shape (T-001..T-003, B-004). Prints a summary
// and a sample record so an operator can see typed projection coming
// out of the surface — first concrete proof of T-007 evidence route.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  createTicketSurface,
  loadAllTickets,
} from '../../src/server/ticket-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// runtime/tests → runtime → react_vite → abiogenesis → build_tenants → odd_manager
const projectRoot = resolve(here, '..', '..', '..', '..');

test('loadAllTickets reads tickets across all lanes', () => {
  const all = loadAllTickets(projectRoot);
  assert.ok(all.length >= 15, `expected ≥15 tickets, got ${all.length}`);
  const lanes = new Set(all.map((r) => r.lane));
  assert.ok(lanes.has('active'), 'expected at least one active ticket');
  assert.ok(lanes.has('backlog'), 'expected at least one backlog ticket');
  assert.ok(lanes.has('completed'), 'expected at least one completed ticket');
});

test('rich-shape STDO ticket parses with mapped key set', () => {
  const surface = createTicketSurface(projectRoot);
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
  assert.ok(t.evaluationCriteria.length >= 4, 'T-007 has at least 4 evaluation criteria after Wave A scope narrow');
  assert.ok(Array.isArray(t.governanceScopeExpansion), 'expansion is an array of inline maps');
  assert.deepEqual(t.governanceScopeExpansion[0], { S: 'SPEC_METHOD.md' });
});

test('STDO-UX ticket carries the U expansion entry', () => {
  const surface = createTicketSurface(projectRoot);
  const t = surface.get('T-006');
  assert.ok(t, 'T-006 should be present');
  assert.equal(t.governanceScope, 'STDO-UX Method');
  const letters = t.governanceScopeExpansion.map((m) => Object.keys(m)[0]);
  assert.deepEqual(letters, ['S', 'T', 'D', 'O', 'U']);
});

test('legacy sparse-shape ticket still parses', () => {
  const surface = createTicketSurface(projectRoot);
  const t = surface.get('T-001');
  assert.ok(t, 'T-001 (sparse) should be present');
  assert.equal(t.type, 'feature');
});

test('filter by lane returns lane-scoped records only', () => {
  const surface = createTicketSurface(projectRoot);
  const completed = surface.list({ lane: 'completed' });
  assert.ok(completed.length >= 3, 'expected ≥3 completed tickets after the wave starts');
  for (const r of completed) {
    assert.equal(r.lane, 'completed');
  }
});

test('filter by buildTenant scopes to react_vite work', () => {
  const surface = createTicketSurface(projectRoot);
  const reactVite = surface.list({ buildTenant: 'react_vite' });
  assert.ok(reactVite.length >= 6, 'wave tickets are tenant-tagged');
});

test('filter by hasDependency finds downstream tickets', () => {
  const surface = createTicketSurface(projectRoot);
  const dependsOnT007 = surface.list({ hasDependency: 'T-007' });
  assert.ok(dependsOnT007.length >= 2, 'T-008 and T-014 depend on T-007');
});

// Demonstration block — runs after all tests so an operator gets a
// human-readable summary even when the suite passes silently.
test('demo: print surface summary', () => {
  const surface = createTicketSurface(projectRoot);
  const all = surface.list();
  const byLane = all.reduce((acc, r) => {
    acc[r.lane] = (acc[r.lane] ?? 0) + 1;
    return acc;
  }, {});
  /* eslint-disable no-console */
  console.log('\n=== TicketAssetSurface live read ===');
  console.log(`projectRoot: ${projectRoot}`);
  console.log(`total: ${all.length}  by-lane:`, byLane);
  console.log('STDO-UX tickets:',
    surface.list().filter((r) => r.governanceScope === 'STDO-UX Method').map((r) => r.id));
  const sample = surface.get('T-007');
  console.log('\nsample T-007 (excerpt):');
  console.log({
    id: sample.id,
    lane: sample.lane,
    status: sample.status,
    title: sample.title,
    changeClass: sample.changeClass,
    buildTenant: sample.buildTenant,
    governanceScope: sample.governanceScope,
    dependencies: sample.dependencies,
    evaluationCriteriaCount: sample.evaluationCriteria?.length,
    governanceScopeExpansion: sample.governanceScopeExpansion,
  });
  /* eslint-enable no-console */
});
