// Verification + demo for the ProjectAssetSurface read path.
//
// Run from repo root:
//   node build_tenants/react_vite/runtime/tests/test_project_asset_surface.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { createProjectSurface, loadAllProjects } from '../../src/server/project-asset-surface-service.mjs';

test('loadAllProjects scans the apps registry and finds candidates', () => {
  const { records, diagnostic } = loadAllProjects('/Users/jim/src/apps');
  assert.ok(diagnostic.scanned_count > 0, 'scanned at least one directory');
  assert.ok(records.length >= 1, `expected ≥1 Project candidate, got ${records.length}`);
  const ids = new Set(records.map((r) => r.id));
  assert.ok(ids.has('odd_manager'), 'odd_manager should be a candidate (has .ai-workspace/)');
});

test('ProjectRecord shape includes odd_type and tenant list', () => {
  const surface = createProjectSurface('/Users/jim/src/apps');
  const oddManager = surface.get('odd_manager');
  assert.ok(oddManager, 'odd_manager record present');
  assert.equal(oddManager.has_ai_workspace, true);
  assert.ok(typeof oddManager.has_genesis === 'boolean');
  assert.ok(Array.isArray(oddManager.installed_packages));
  assert.ok(Array.isArray(oddManager.build_tenants));
  assert.ok(oddManager.build_tenants.includes('react_vite'), 'react_vite tenant detected');
});

test('odd_type detection: odd_sdlc workspace identifies as such', () => {
  const surface = createProjectSurface('/Users/jim/src/apps');
  const oddSdlc = surface.get('odd_sdlc');
  if (!oddSdlc) {
    // odd_sdlc may not be present in this environment; allow skip.
    return;
  }
  // odd_sdlc is governed by odd_sdlc itself, so its .genesis/odd_sdlc/ should exist.
  if (oddSdlc.installed_packages.includes('odd_sdlc')) {
    assert.equal(oddSdlc.odd_type, 'odd_sdlc');
  }
});

test('filter by build_tenant returns matching projects only', () => {
  const surface = createProjectSurface('/Users/jim/src/apps');
  const reactVite = surface.list({ build_tenant: 'react_vite' });
  assert.ok(reactVite.length >= 1, 'odd_manager has react_vite');
  for (const r of reactVite) {
    assert.ok(r.build_tenants.includes('react_vite'));
  }
});

test('filter by has_ai_workspace = true is the default candidate condition', () => {
  const surface = createProjectSurface('/Users/jim/src/apps');
  const all = surface.list();
  for (const r of all) {
    assert.equal(r.has_ai_workspace, true, 'every returned record has .ai-workspace/');
  }
});

test('demo: print discovered Projects', () => {
  const surface = createProjectSurface('/Users/jim/src/apps');
  /* eslint-disable no-console */
  console.log('\n=== ProjectAssetSurface live read ===');
  console.log('diagnostic:', surface.diagnostic());
  for (const r of surface.list()) {
    console.log(`  ${r.id.padEnd(32)} odd_type=${r.odd_type.padEnd(16)} tenants=[${r.build_tenants.join(', ')}]  packages=[${r.installed_packages.join(', ')}]`);
  }
  /* eslint-enable no-console */
});
