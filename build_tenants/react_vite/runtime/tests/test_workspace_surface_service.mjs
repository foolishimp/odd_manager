import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  readWorkspaceSurface,
  workspaceSurfaceMediaType,
} from '../../src/server/workspace-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_workspace_surface');
const outsideRoot = resolve(here, '_fixture_workspace_surface_outside');

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  if (existsSync(outsideRoot)) rmSync(outsideRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(outsideRoot, { recursive: true });
}

function teardown() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  if (existsSync(outsideRoot)) rmSync(outsideRoot, { recursive: true, force: true });
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

test('readWorkspaceSurface rejects file and directory symlink escapes from the Project root', () => {
  setup();
  try {
    writeFileSync(join(outsideRoot, 'secret.json'), '{"secret":true}\n', 'utf8');
    symlinkSync(join(outsideRoot, 'secret.json'), join(fixtureRoot, 'leak.json'));
    symlinkSync(outsideRoot, join(fixtureRoot, 'leak-directory'));

    const fileEscape = readWorkspaceSurface(fixtureRoot, 'leak.json');
    assert.equal(fileEscape.kind, 'unreadable');
    assert.equal(fileEscape.reason, 'outside_workspace');

    const directoryEscape = readWorkspaceSurface(
      fixtureRoot,
      'leak-directory/secret.json',
    );
    assert.equal(directoryEscape.kind, 'unreadable');
    assert.equal(directoryEscape.reason, 'outside_workspace');

    const listing = readWorkspaceSurface(fixtureRoot, '.');
    assert.equal(listing.kind, 'directory');
    assert.equal(
      listing.entries.some((entry) => entry.name === 'leak.json'),
      false,
    );
    assert.equal(
      listing.entries.some((entry) => entry.name === 'leak-directory'),
      false,
    );
  } finally {
    teardown();
  }
});

test('readWorkspaceSurface follows only symlinks whose real targets remain inside the Project', () => {
  setup();
  try {
    mkdirSync(join(fixtureRoot, 'inside'), { recursive: true });
    writeFileSync(join(fixtureRoot, 'inside', 'data.json'), '{"ok":true}\n', 'utf8');
    symlinkSync('inside', join(fixtureRoot, 'alias'));

    const surface = readWorkspaceSurface(fixtureRoot, 'alias/data.json');
    assert.equal(surface.kind, 'file');
    assert.equal(surface.content, '{"ok":true}\n');

    const listing = readWorkspaceSurface(fixtureRoot, '.');
    assert.equal(listing.kind, 'directory');
    assert.deepEqual(
      listing.entries.find((entry) => entry.name === 'alias'),
      {
        name: 'alias',
        kind: 'directory',
        relative_path: 'alias',
      },
    );
  } finally {
    teardown();
  }
});
