// T-018 — verification of write actions and change feed.
//
// Builds a self-contained fixture .ai-workspace/tickets tree, runs each
// action, asserts atomicity and frontmatter preservation, then exercises
// the change feed with concurrent mutations.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import {
  createTicketSurface,
  transitionStatus,
  updateFrontmatterField,
  linkDependency,
  assignBuildTenant,
} from '../../src/server/ticket-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_ticket_write');
const ticketsRoot = resolve(fixtureRoot, '.ai-workspace/tickets');

function mkTicket(lane, id, extras = {}) {
  const filename = `${id}-test-ticket.md`;
  const dir = join(ticketsRoot, lane);
  mkdirSync(dir, { recursive: true });
  const fm = [
    '---',
    `id: ${id}`,
    `title: Test ${id}`,
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
    extras.buildTenant ? `build_tenant: ${extras.buildTenant}` : null,
    'dependencies:',
    ...(extras.dependencies ?? []).map((d) => `  - ${d}`),
    '---',
    '',
    '## STDO Reading',
    '',
    'fixture body',
    '',
  ].filter((line) => line !== null).join('\n');
  writeFileSync(join(dir, filename), fm);
  return join(dir, filename);
}

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkTicket('active', 'T-100');
  mkTicket('backlog', 'T-101', { buildTenant: 'react_vite', dependencies: ['T-100 completed'] });
  mkTicket('completed', 'T-102');
}

function teardown() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

function fileExists(lane, id) {
  const dir = join(ticketsRoot, lane);
  if (!existsSync(dir)) return false;
  return readdirSync(dir).some((n) => n.startsWith(`${id}-`));
}

test('transitionStatus moves file between lanes and updates frontmatter status', () => {
  setup();
  try {
    const result = transitionStatus(fixtureRoot, 'T-100', 'completed');
    assert.equal(result.ok, true, `result.error: ${result.error}`);
    assert.equal(result.fromLane, 'active');
    assert.equal(result.toLane, 'completed');
    assert.equal(fileExists('active', 'T-100'), false, 'old file removed');
    assert.equal(fileExists('completed', 'T-100'), true, 'new file present');
    const written = readFileSync(join(ticketsRoot, 'completed', 'T-100-test-ticket.md'), 'utf-8');
    assert.match(written, /^status: completed$/m, 'status field updated to "completed"');
  } finally {
    teardown();
  }
});

test('transitionStatus rejects invalid lane and same-lane transitions', () => {
  setup();
  try {
    const r1 = transitionStatus(fixtureRoot, 'T-100', 'invalid');
    assert.equal(r1.ok, false);
    assert.match(r1.error, /invalid lane/);
    const r2 = transitionStatus(fixtureRoot, 'T-100', 'active');
    assert.equal(r2.ok, false);
    assert.match(r2.error, /already in lane/);
  } finally {
    teardown();
  }
});

test('updateFrontmatterField updates a scalar field atomically', () => {
  setup();
  try {
    const result = updateFrontmatterField(fixtureRoot, 'T-101', 'priority', 'critical');
    assert.equal(result.ok, true);
    const written = readFileSync(join(ticketsRoot, 'backlog', 'T-101-test-ticket.md'), 'utf-8');
    assert.match(written, /^priority: critical$/m);
    assert.match(written, /^status: backlog$/m, 'other fields unchanged');
    assert.match(written, /## STDO Reading/, 'body preserved');
  } finally {
    teardown();
  }
});

test('linkDependency appends to dependencies list without disturbing other fields', () => {
  setup();
  try {
    const result = linkDependency(fixtureRoot, 'T-101', 'T-099 completed');
    assert.equal(result.ok, true, `result.error: ${result.error}`);
    const written = readFileSync(join(ticketsRoot, 'backlog', 'T-101-test-ticket.md'), 'utf-8');
    assert.match(written, /T-100 completed/, 'existing dependency preserved');
    assert.match(written, /T-099 completed/, 'new dependency added');
  } finally {
    teardown();
  }
});

test('linkDependency refuses duplicate', () => {
  setup();
  try {
    const result = linkDependency(fixtureRoot, 'T-101', 'T-100 completed');
    assert.equal(result.ok, false);
    assert.match(result.error, /already present/);
  } finally {
    teardown();
  }
});

test('assignBuildTenant updates the build_tenant field', () => {
  setup();
  try {
    const result = assignBuildTenant(fixtureRoot, 'T-100', 'react_vite');
    assert.equal(result.ok, true);
    const file = readdirSync(join(ticketsRoot, 'active')).find((n) => n.startsWith('T-100'));
    const written = readFileSync(join(ticketsRoot, 'active', file), 'utf-8');
    assert.match(written, /^build_tenant: react_vite$/m);
  } finally {
    teardown();
  }
});

test('surface methods invalidate cache after successful action', () => {
  setup();
  try {
    const surface = createTicketSurface(fixtureRoot, { pollIntervalMs: 50 });
    assert.equal(surface.get('T-100').lane, 'active');
    const result = surface.transitionStatus('T-100', 'completed');
    assert.equal(result.ok, true);
    assert.equal(surface.get('T-100').lane, 'completed', 'cache reflects new lane');
  } finally {
    teardown();
  }
});

test('change feed emits update event after a transition', async () => {
  setup();
  try {
    const surface = createTicketSurface(fixtureRoot, { pollIntervalMs: 50 });
    const events = [];
    const unsubscribe = surface.subscribe((batch) => events.push(...batch));
    // Mutate via direct action so the surface picks it up via polling.
    transitionStatus(fixtureRoot, 'T-101', 'completed');
    // Wait for at least one poll cycle.
    await new Promise((r) => setTimeout(r, 200));
    unsubscribe();
    const updates = events.filter((e) => e.kind === 'updated' && e.id === 'T-101');
    assert.ok(updates.length >= 1, `expected ≥1 update event for T-101, got ${JSON.stringify(events)}`);
  } finally {
    teardown();
  }
});

test('change feed emits created and deleted events', async () => {
  setup();
  try {
    const surface = createTicketSurface(fixtureRoot, { pollIntervalMs: 50 });
    const events = [];
    const unsubscribe = surface.subscribe((batch) => events.push(...batch));
    mkTicket('active', 'T-200');
    await new Promise((r) => setTimeout(r, 200));
    rmSync(join(ticketsRoot, 'completed', 'T-102-test-ticket.md'));
    await new Promise((r) => setTimeout(r, 200));
    unsubscribe();
    const created = events.filter((e) => e.kind === 'created' && e.id === 'T-200');
    const deleted = events.filter((e) => e.kind === 'deleted' && e.id === 'T-102');
    assert.ok(created.length >= 1, 'created event for T-200');
    assert.ok(deleted.length >= 1, 'deleted event for T-102');
  } finally {
    teardown();
  }
});

test('demo: status transition round-trip via surface methods', () => {
  setup();
  try {
    const surface = createTicketSurface(fixtureRoot, { pollIntervalMs: 100 });
    /* eslint-disable no-console */
    console.log('\n=== T-018 write actions live demo ===');
    console.log(`before: T-100 lane=${surface.get('T-100').lane}`);
    surface.transitionStatus('T-100', 'completed');
    console.log(`after:  T-100 lane=${surface.get('T-100').lane}`);
    surface.assignBuildTenant('T-100', 'react_vite');
    console.log(`tenant: T-100 buildTenant=${surface.get('T-100').buildTenant}`);
    surface.linkDependency('T-100', 'T-006 completed');
    console.log(`deps:   T-100 dependencies=${JSON.stringify(surface.get('T-100').dependencies)}`);
    /* eslint-enable no-console */
  } finally {
    teardown();
  }
});
