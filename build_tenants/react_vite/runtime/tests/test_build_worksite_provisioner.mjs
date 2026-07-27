import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import test from 'node:test';
import { provisionProjectSnapshot } from '../../src/server/build-worksite-provisioner.mjs';
import { observeProjectRevision } from '../../src/server/project-revision-service.mjs';

function createProject(label) {
  const root = mkdtempSync(join(tmpdir(), `odd-manager-worksite-${label}-`));
  mkdirSync(join(root, 'specification'), { recursive: true });
  writeFileSync(join(root, 'specification', 'PRODUCT.md'), `# ${label}\n`, 'utf8');
  execFileSync('git', ['init', '--quiet', root]);
  execFileSync('git', ['-C', root, 'add', '.']);
  execFileSync('git', [
    '-C', root,
    '-c', 'user.name=Odd Manager Test',
    '-c', 'user.email=odd-manager@example.invalid',
    'commit', '--quiet', '-m', 'fixture',
  ]);
  return root;
}

function provision(projectRoot, destinationRoot) {
  return provisionProjectSnapshot({
    projectRoot,
    projectId: 'worksite-fixture',
    revision: observeProjectRevision(projectRoot, '2026-07-27T00:00:00.000Z'),
    destinationRoot,
    observedAt: '2026-07-27T00:00:00.000Z',
  });
}

test('worksite provisioning rejects an absolute symlink even when it targets included Project source', () => {
  const projectRoot = createProject('absolute-link');
  const destinationParent = mkdtempSync(join(tmpdir(), 'odd-manager-worksite-destination-'));
  const destinationRoot = join(destinationParent, 'workspace');
  try {
    writeFileSync(join(projectRoot, 'carrier.txt'), 'source carrier\n', 'utf8');
    symlinkSync(join(projectRoot, 'carrier.txt'), join(projectRoot, 'absolute-link.txt'));

    assert.throws(
      () => provision(projectRoot, destinationRoot),
      /rejects external symlink: absolute-link\.txt; absolute symlink targets are not self-contained/,
    );
    assert.equal(
      existsSync(destinationRoot),
      false,
      'a rejected source link must not leave a partial worksite',
    );
  } finally {
    rmSync(destinationParent, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('worksite provisioning preserves a contained ../ link rebased entirely inside the copied worksite', () => {
  const projectRoot = createProject('relative-parent-link');
  const destinationParent = mkdtempSync(join(tmpdir(), 'odd-manager-worksite-destination-'));
  const destinationRoot = join(destinationParent, 'workspace');
  try {
    mkdirSync(join(projectRoot, 'nested'), { recursive: true });
    writeFileSync(join(projectRoot, 'carrier.txt'), 'snapshot carrier\n', 'utf8');
    symlinkSync('../carrier.txt', join(projectRoot, 'nested', 'carrier-link.txt'));

    provision(projectRoot, destinationRoot);

    const worksiteCarrier = join(destinationRoot, 'carrier.txt');
    const worksiteLink = join(destinationRoot, 'nested', 'carrier-link.txt');
    assert.equal(readlinkSync(worksiteLink), '../carrier.txt');
    assert.equal(realpathSync(worksiteLink), realpathSync(worksiteCarrier));
    assert.notEqual(realpathSync(worksiteLink), realpathSync(join(projectRoot, 'carrier.txt')));

    writeFileSync(join(projectRoot, 'carrier.txt'), 'mutated source carrier\n', 'utf8');
    assert.equal(readFileSync(worksiteLink, 'utf8'), 'snapshot carrier\n');
  } finally {
    rmSync(destinationParent, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('worksite provisioning rejects a ../ link that re-enters source but rebases outside the worksite', () => {
  const projectRoot = createProject('relative-source-reentry');
  const destinationParent = mkdtempSync(join(tmpdir(), 'odd-manager-worksite-destination-'));
  const destinationRoot = join(destinationParent, 'workspace');
  try {
    writeFileSync(join(projectRoot, 'carrier.txt'), 'source carrier\n', 'utf8');
    const sourceReentry = `../${basename(projectRoot)}/carrier.txt`;
    symlinkSync(sourceReentry, join(projectRoot, 'source-reentry-link.txt'));
    assert.equal(
      realpathSync(join(projectRoot, 'source-reentry-link.txt')),
      realpathSync(join(projectRoot, 'carrier.txt')),
      'the source-side link resolves inside the admitted Project before rebasing',
    );

    assert.throws(
      () => provision(projectRoot, destinationRoot),
      /rejects symlink rebased outside worksite: source-reentry-link\.txt/,
    );
    assert.equal(
      existsSync(destinationRoot),
      false,
      'a rejected rebased link must not leave a partial worksite',
    );
  } finally {
    rmSync(destinationParent, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});

test('worksite provisioning rejects a relative symlink whose target carrier is excluded from the snapshot', () => {
  const projectRoot = createProject('excluded-link-target');
  const destinationParent = mkdtempSync(join(tmpdir(), 'odd-manager-worksite-destination-'));
  const destinationRoot = join(destinationParent, 'workspace');
  try {
    mkdirSync(join(projectRoot, 'build'), { recursive: true });
    writeFileSync(join(projectRoot, 'build', 'generated.txt'), 'mutable generated carrier\n', 'utf8');
    symlinkSync('build/generated.txt', join(projectRoot, 'generated-link.txt'));

    assert.throws(
      () => provision(projectRoot, destinationRoot),
      /rejects symlink target absent from worksite: generated-link\.txt/,
    );
    assert.equal(
      existsSync(destinationRoot),
      false,
      'a post-copy symlink validation failure must remove the partial worksite',
    );
  } finally {
    rmSync(destinationParent, { recursive: true, force: true });
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
