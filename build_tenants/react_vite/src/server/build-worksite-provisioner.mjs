import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  observeProjectRevision,
  sameProjectRevisionBasis,
} from './project-revision-service.mjs';

const EXCLUDED_DIRECTORY_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  'build',
  'coverage',
  'test-results',
  'playwright-report',
  '__pycache__',
  '.pytest_cache',
]);

function normalizedRelative(root, path) {
  return relative(root, path).split('\\').join('/');
}

function excluded(relativePath, name, isDirectory) {
  if (isDirectory && EXCLUDED_DIRECTORY_NAMES.has(name)) return true;
  return relativePath === '.ai-workspace/runtime'
    || relativePath.startsWith('.ai-workspace/runtime/')
    || relativePath === 'test_runs'
    || relativePath.startsWith('test_runs/');
}

function isWithin(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function fingerprintProject(root) {
  const digest = createHash('sha256');
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const path = join(current, entry.name);
      const relativePath = normalizedRelative(root, path);
      if (excluded(relativePath, entry.name, entry.isDirectory())) continue;
      digest.update(relativePath);
      digest.update('\0');
      if (entry.isDirectory()) {
        queue.push(path);
      } else if (entry.isSymbolicLink()) {
        digest.update(`symlink:${readlinkSync(path)}`);
      } else if (entry.isFile()) {
        digest.update(readFileSync(path));
      }
      digest.update('\0');
    }
  }
  return `sha256:${digest.digest('hex')}`;
}

function copyProjectTree(sourceRoot, destinationRoot) {
  const realSourceRoot = realpathSync(sourceRoot);
  const queue = [sourceRoot];
  mkdirSync(destinationRoot, { recursive: true });
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const sourcePath = join(current, entry.name);
      const relativePath = normalizedRelative(sourceRoot, sourcePath);
      if (excluded(relativePath, entry.name, entry.isDirectory())) continue;
      const destinationPath = join(destinationRoot, relativePath);
      if (entry.isDirectory()) {
        mkdirSync(destinationPath, { recursive: true });
        queue.push(sourcePath);
      } else if (entry.isSymbolicLink()) {
        const link = readlinkSync(sourcePath);
        const resolvedTarget = resolve(dirname(sourcePath), link);
        if (!isWithin(realSourceRoot, resolvedTarget)) {
          throw new Error(`Project snapshot rejects external symlink: ${relativePath}`);
        }
        mkdirSync(dirname(destinationPath), { recursive: true });
        symlinkSync(link, destinationPath);
      } else if (entry.isFile()) {
        mkdirSync(dirname(destinationPath), { recursive: true });
        copyFileSync(sourcePath, destinationPath);
      }
    }
  }
}

export function provisionProjectSnapshot(options) {
  const sourceRoot = resolve(options.projectRoot);
  const destinationRoot = resolve(options.destinationRoot);
  if (!existsSync(sourceRoot) || !lstatSync(sourceRoot).isDirectory()) {
    throw new Error(`Project snapshot source is unavailable: ${sourceRoot}`);
  }
  const beforeRevision = observeProjectRevision(sourceRoot, options.observedAt);
  if (!sameProjectRevisionBasis(options.revision, beforeRevision)) {
    throw new Error('Project Revision changed before worksite provisioning.');
  }
  const beforeFingerprint = fingerprintProject(sourceRoot);
  rmSync(destinationRoot, { recursive: true, force: true });
  copyProjectTree(sourceRoot, destinationRoot);
  const afterFingerprint = fingerprintProject(sourceRoot);
  const worksiteFingerprint = fingerprintProject(destinationRoot);
  const afterRevision = observeProjectRevision(sourceRoot, options.observedAt);
  if (
    beforeFingerprint !== afterFingerprint
    || beforeFingerprint !== worksiteFingerprint
    || !sameProjectRevisionBasis(beforeRevision, afterRevision)
  ) {
    rmSync(destinationRoot, { recursive: true, force: true });
    throw new Error('Project basis changed while the immutable worksite was provisioned.');
  }
  return {
    path: destinationRoot,
    digest: worksiteFingerprint,
    sourceRefs: [
      `project://${options.projectId}`,
      `worksite-digest://${worksiteFingerprint.slice('sha256:'.length)}`,
    ],
  };
}
