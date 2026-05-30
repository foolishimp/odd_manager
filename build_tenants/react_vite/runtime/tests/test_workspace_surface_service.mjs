import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readWorkspaceSurface,
  workspaceSurfaceMediaType,
} from '../../src/server/workspace-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_workspace_surface');

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
}

function teardown() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('readWorkspaceSurface rejects paths outside workspace', () => {
  setup();
  try {
    const surface = readWorkspaceSurface(fixtureRoot, '../outside.json');
    assert.equal(surface.kind, 'unreadable');
    assert.equal(surface.reason, 'outside_workspace');
  } finally {
    teardown();
  }
});

test('readWorkspaceSurface treats PDFs as binary metadata instead of UTF-8 JSON payloads', () => {
  setup();
  try {
    writeFileSync(join(fixtureRoot, 'report.pdf'), Buffer.from('%PDF-1.7\nfixture\n%%EOF\n'));

    const surface = readWorkspaceSurface(fixtureRoot, 'report.pdf');

    assert.equal(surface.kind, 'file');
    assert.equal(surface.media_type, 'application/pdf');
    assert.equal(surface.encoding, 'binary');
    assert.equal(surface.content, '');
    assert.equal(surface.size_bytes, 23);
    assert.equal(workspaceSurfaceMediaType('report.html'), 'text/html; charset=utf-8');
  } finally {
    teardown();
  }
});
