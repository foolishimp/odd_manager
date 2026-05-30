// Verification + demo for the workspace-owned ProjectAssetSurface registry.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createProjectSurface, discoverProjects, loadAllProjects } from '../../src/server/project-asset-surface-service.mjs';

function makeProject(root, name, options = {}) {
  const projectRoot = join(root, name);
  mkdirSync(join(projectRoot, '.ai-workspace'), { recursive: true });
  if (options.oddSdlc) {
    mkdirSync(join(projectRoot, '.genesis/odd_sdlc'), { recursive: true });
  }
  if (options.reactVite) {
    mkdirSync(join(projectRoot, 'build_tenants/react_vite'), { recursive: true });
  }
  return projectRoot;
}

test('ProjectAssetSurface starts from a manager-workspace registry, not discovery scan', () => {
  const managerRoot = mkdtempSync(join(tmpdir(), 'odd-manager-registry-'));
  const discoveryRoot = mkdtempSync(join(tmpdir(), 'odd-manager-discovery-'));
  try {
    makeProject(discoveryRoot, 'discoverable_project', { oddSdlc: true });
    const surface = createProjectSurface(managerRoot, { discoveryRoot });
    assert.equal(surface.list().length, 0, 'unregistered discovery candidates are not Projects');
    const discovered = surface.discover();
    assert.equal(discovered.records.length, 1, 'discovery remains available as candidate input');
  } finally {
    rmSync(managerRoot, { recursive: true, force: true });
    rmSync(discoveryRoot, { recursive: true, force: true });
  }
});

test('register persists Project records under the manager workspace', () => {
  const managerRoot = mkdtempSync(join(tmpdir(), 'odd-manager-registry-'));
  const projectRoot = makeProject(mkdtempSync(join(tmpdir(), 'odd-manager-project-')), 'alpha', {
    oddSdlc: true,
    reactVite: true,
  });
  try {
    const surface = createProjectSurface(managerRoot);
    const registered = surface.register(projectRoot, { setActive: true });
    assert.equal(registered.root, projectRoot);
    assert.equal(registered.odd_type, 'odd_sdlc');
    assert.equal(registered.has_ai_workspace, true);
    assert.equal(registered.is_active, true);
    assert.ok(registered.build_tenants.includes('react_vite'));

    const registryPath = join(managerRoot, '.ai-workspace/runtime/odd_manager/projects.local.json');
    assert.equal(existsSync(registryPath), true);
    const registry = JSON.parse(readFileSync(registryPath, 'utf8'));
    assert.equal(registry.active_project_root, projectRoot);
    assert.equal(registry.projects.length, 1);

    const reloaded = loadAllProjects(managerRoot);
    assert.equal(reloaded.records.length, 1);
    assert.equal(reloaded.records[0].root, projectRoot);
    assert.equal(reloaded.records[0].registry_source, 'registry');
  } finally {
    rmSync(managerRoot, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('unregister removes a non-active Project and refuses the active Project', () => {
  const managerRoot = mkdtempSync(join(tmpdir(), 'odd-manager-registry-'));
  const projectParent = mkdtempSync(join(tmpdir(), 'odd-manager-projects-'));
  const firstRoot = makeProject(projectParent, 'first');
  const secondRoot = makeProject(projectParent, 'second');
  try {
    const surface = createProjectSurface(managerRoot);
    const first = surface.register(firstRoot, { setActive: true });
    const second = surface.register(secondRoot);
    assert.throws(() => surface.unregister(first.id), /Cannot remove the active Project/);

    const result = surface.unregister(second.id);
    assert.equal(result.removed.root, secondRoot);
    assert.equal(surface.list().length, 1);
  } finally {
    rmSync(managerRoot, { recursive: true, force: true });
    rmSync(projectParent, { recursive: true, force: true });
  }
});

test('setActive can register a root and mark it active', () => {
  const managerRoot = mkdtempSync(join(tmpdir(), 'odd-manager-registry-'));
  const projectRoot = makeProject(mkdtempSync(join(tmpdir(), 'odd-manager-project-')), 'beta');
  try {
    const surface = createProjectSurface(managerRoot);
    const active = surface.setActive(projectRoot);
    assert.equal(active.root, projectRoot);
    assert.equal(active.is_active, true);
    assert.equal(surface.list()[0].is_active, true);
  } finally {
    rmSync(managerRoot, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('sandbox workspace roots display browser folder plus pid instead of generic workspace', () => {
  const managerRoot = mkdtempSync(join(tmpdir(), 'odd-manager-registry-'));
  const sandboxRoot = mkdtempSync(join(tmpdir(), 'odd-manager-sandbox-'));
  const projectRoot = join(sandboxRoot, 'scenario_t164_rust_hello_service_lite_live', '20260520T091815799Z_pid60808', 'workspace');
  try {
    mkdirSync(join(projectRoot, '.ai-workspace'), { recursive: true });
    const surface = createProjectSurface(managerRoot);
    const registered = surface.register(projectRoot, { setActive: true, label: 'workspace' });
    assert.equal(registered.name, 'scenario_t164_rust_hello_service_lite_live.pid60808.workspace');
    assert.equal(surface.list()[0].name, 'scenario_t164_rust_hello_service_lite_live.pid60808.workspace');
  } finally {
    rmSync(managerRoot, { recursive: true, force: true });
    rmSync(sandboxRoot, { recursive: true, force: true });
  }
});

test('discoverProjects still scans candidate roots without registering them', () => {
  const discoveryRoot = mkdtempSync(join(tmpdir(), 'odd-manager-discovery-'));
  try {
    const projectRoot = makeProject(discoveryRoot, 'candidate');
    const discovered = discoverProjects(discoveryRoot);
    assert.equal(discovered.records.length, 1);
    assert.equal(discovered.records[0].root, projectRoot);
    assert.equal(discovered.records[0].registry_source, 'discovery');
  } finally {
    rmSync(discoveryRoot, { recursive: true, force: true });
  }
});

test('demo: print maintained Projects', () => {
  const managerRoot = join(process.cwd(), '../..');
  const surface = createProjectSurface(managerRoot);
  /* eslint-disable no-console */
  console.log('\n=== ProjectAssetSurface maintained registry read ===');
  console.log('diagnostic:', surface.diagnostic());
  for (const record of surface.list()) {
    console.log(`  ${record.id.padEnd(32)} active=${String(record.is_active).padEnd(5)} root=${record.root}`);
  }
  /* eslint-enable no-console */
});
