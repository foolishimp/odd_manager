// Verification + demo for the SessionAssetSurface read path.
//
// Run from repo root:
//   node build_tenants/react_vite/runtime/tests/test_session_asset_surface.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import {
  createSessionSurface,
  loadAllSessions,
} from '../../src/server/session-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..', '..', '..');
const fixtureRoot = resolve(here, '_fixture_session_surface');
const fixtureRegistry = resolve(fixtureRoot, '.ai-workspace/runtime/sessions');

function setupFixture() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRegistry, { recursive: true });
  writeFileSync(join(fixtureRegistry, 'sess-1.json'), JSON.stringify({
    id: 'sess-1',
    agent_type: 'claude_code',
    cwd: '/Users/jim/src/apps/odd_manager',
    status: 'running',
    started_at: '2026-04-26T16:00:00Z',
    transcript_ref: '.ai-workspace/runtime/sessions/sess-1.transcript',
    context_at_spawn: { project: 'odd_manager', workspace: 'react_vite', odd_type: 'odd_sdlc' },
  }, null, 2));
  writeFileSync(join(fixtureRegistry, 'sess-2.json'), JSON.stringify({
    id: 'sess-2',
    agent_type: 'codex',
    cwd: '/Users/jim/src/apps/odd_sdlc',
    status: 'detached',
    context_at_spawn: { project: 'odd_sdlc', workspace: 'typescript' },
  }, null, 2));
  writeFileSync(join(fixtureRegistry, 'sess-3.json'), JSON.stringify({
    id: 'sess-3',
    agent_type: 'shell',
    cwd: '/Users/jim',
    status: 'stopped',
    context_at_spawn: { project: 'odd_manager', workspace: 'react_vite' },
  }, null, 2));
}

function teardownFixture() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('empty backplane reports diagnostic.backplane = "none"', () => {
  const surface = createSessionSurface(projectRoot);
  const d = surface.diagnostic();
  assert.equal(d.backplane, 'none');
  assert.equal(surface.list().length, 0);
  assert.equal(surface.count(), 0);
  assert.ok(Array.isArray(d.notes) && d.notes.length >= 1, 'no-backplane note included');
});

test('present backplane returns typed SessionRecord[]', () => {
  setupFixture();
  try {
    const surface = createSessionSurface(fixtureRoot);
    const all = surface.list();
    assert.equal(all.length, 3);
    const d = surface.diagnostic();
    assert.equal(d.backplane, 'registry');
    const sess1 = surface.get('sess-1');
    assert.ok(sess1, 'sess-1 should be present');
    assert.equal(sess1.agent_type, 'claude_code');
    assert.equal(sess1.context_at_spawn.project, 'odd_manager');
  } finally {
    teardownFixture();
  }
});

test('filter by project + agent_type + status', () => {
  setupFixture();
  try {
    const surface = createSessionSurface(fixtureRoot);
    assert.equal(surface.list({ project: 'odd_manager' }).length, 2);
    assert.equal(surface.list({ agent_type: 'codex' }).length, 1);
    assert.equal(surface.list({ status: ['running', 'detached'] }).length, 2);
    assert.equal(surface.list({ project: 'odd_manager', agent_type: 'claude_code' }).length, 1);
  } finally {
    teardownFixture();
  }
});

test('malformed session file is skipped without crashing', () => {
  setupFixture();
  try {
    writeFileSync(join(fixtureRegistry, 'broken.json'), '{ not valid json');
    writeFileSync(join(fixtureRegistry, 'no-id.json'), JSON.stringify({ agent_type: 'shell' }));
    const surface = createSessionSurface(fixtureRoot);
    assert.equal(surface.list().length, 3, 'broken records skipped, valid ones returned');
  } finally {
    teardownFixture();
  }
});

test('demo: print surface state', () => {
  const surface = createSessionSurface(projectRoot);
  const d = surface.diagnostic();
  /* eslint-disable no-console */
  console.log('\n=== SessionAssetSurface live read ===');
  console.log(`projectRoot: ${projectRoot}`);
  console.log('diagnostic:', d);
  console.log(`sessions: ${surface.count()}`);
  /* eslint-enable no-console */
});
