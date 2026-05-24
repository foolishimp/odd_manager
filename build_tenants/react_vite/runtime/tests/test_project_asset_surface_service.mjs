import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createProjectSurface } from '../../src/server/project-asset-surface-service.mjs';

test('setActive registers an absolute child project root before activating it', () => {
  const tempRoot = mkdtempSync(join(tmpdir(), 'odd-manager-project-surface-'));
  try {
    const managerRoot = join(tempRoot, 'manager');
    const sandboxRoot = join(tempRoot, 'sandbox');
    const childRoot = join(sandboxRoot, 'scenario_t132_hello_world_js_live', '20260512T124856459Z_pid76852', 'workspace');
    mkdirSync(join(managerRoot, '.ai-workspace'), { recursive: true });
    mkdirSync(join(childRoot, '.ai-workspace'), { recursive: true });

    const surface = createProjectSurface(managerRoot, { discoveryRoot: sandboxRoot });
    const project = surface.setActive(childRoot);
    const projects = surface.list();

    assert.equal(project.root, childRoot);
    assert.equal(project.name, 'scenario_t132_hello_world_js_live.pid76852.workspace');
    assert.equal(project.is_active, true);
    assert.equal(projects.length, 1);
    assert.equal(projects[0].root, childRoot);
    assert.equal(projects[0].name, 'scenario_t132_hello_world_js_live.pid76852.workspace');
    assert.equal(projects[0].is_active, true);
  } finally {
    rmSync(tempRoot, { recursive: true, force: true });
  }
});
