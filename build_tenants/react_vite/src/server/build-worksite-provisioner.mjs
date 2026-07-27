import {
  chmodSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readdirSync,
  readlinkSync,
  realpathSync,
  rmSync,
  symlinkSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import {
  fingerprintProjectSource,
  observeProjectRevision,
  projectSourcePathExcluded,
  sameProjectRevisionBasis,
} from './project-revision-service.mjs';

function normalizedRelative(root, path) {
  return relative(root, path).split('\\').join('/');
}

function isWithin(root, candidate) {
  const value = relative(root, candidate);
  return value === '' || (!value.startsWith('..') && !isAbsolute(value));
}

function validateWorksiteSymlinks(destinationRoot) {
  const realDestinationRoot = realpathSync(destinationRoot);
  const queue = [destinationRoot];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const destinationPath = join(current, entry.name);
      const relativePath = normalizedRelative(destinationRoot, destinationPath);
      const stat = lstatSync(destinationPath);
      if (stat.isDirectory()) {
        queue.push(destinationPath);
        continue;
      }
      if (!stat.isSymbolicLink()) continue;

      const link = readlinkSync(destinationPath);
      if (isAbsolute(link)) {
        throw new Error(
          `Project snapshot rejects external symlink: ${relativePath}; `
          + 'absolute symlink targets are not self-contained',
        );
      }
      const rebasedTarget = resolve(dirname(destinationPath), link);
      if (!isWithin(destinationRoot, rebasedTarget)) {
        throw new Error(`Project snapshot rejects symlink rebased outside worksite: ${relativePath}`);
      }
      let realTarget;
      try {
        realTarget = realpathSync(destinationPath);
      } catch {
        throw new Error(`Project snapshot rejects symlink target absent from worksite: ${relativePath}`);
      }
      if (!isWithin(realDestinationRoot, realTarget)) {
        throw new Error(`Project snapshot rejects symlink resolving outside worksite: ${relativePath}`);
      }
    }
  }
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
      const stat = lstatSync(sourcePath);
      if (projectSourcePathExcluded(relativePath, entry.name, stat.isDirectory())) continue;
      const destinationPath = join(destinationRoot, relativePath);
      if (stat.isDirectory()) {
        mkdirSync(destinationPath, { recursive: true });
        queue.push(sourcePath);
      } else if (stat.isSymbolicLink()) {
        const link = readlinkSync(sourcePath);
        if (isAbsolute(link)) {
          throw new Error(
            `Project snapshot rejects external symlink: ${relativePath}; `
            + 'absolute symlink targets are not self-contained',
          );
        }
        const sourceLexicalTarget = resolve(dirname(sourcePath), link);
        if (!isWithin(sourceRoot, sourceLexicalTarget)) {
          throw new Error(
            `Project snapshot rejects symlink rebased outside Project basis: ${relativePath}`,
          );
        }
        let realTarget;
        try {
          realTarget = realpathSync(sourcePath);
        } catch {
          throw new Error(`Project snapshot rejects unresolved symlink: ${relativePath}`);
        }
        if (!isWithin(realSourceRoot, realTarget)) {
          throw new Error(`Project snapshot rejects external symlink: ${relativePath}`);
        }
        mkdirSync(dirname(destinationPath), { recursive: true });
        symlinkSync(link, destinationPath);
      } else if (stat.isFile()) {
        mkdirSync(dirname(destinationPath), { recursive: true });
        copyFileSync(sourcePath, destinationPath);
        chmodSync(destinationPath, stat.mode & 0o777);
      } else {
        throw new Error(`Project snapshot rejects unsupported file type: ${relativePath}`);
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
  const beforeFingerprint = fingerprintProjectSource(sourceRoot);
  rmSync(destinationRoot, { recursive: true, force: true });
  try {
    copyProjectTree(sourceRoot, destinationRoot);
    validateWorksiteSymlinks(destinationRoot);
    const afterFingerprint = fingerprintProjectSource(sourceRoot);
    const worksiteFingerprint = fingerprintProjectSource(destinationRoot);
    const afterRevision = observeProjectRevision(sourceRoot, options.observedAt);
    if (
      beforeFingerprint !== afterFingerprint
      || beforeFingerprint !== worksiteFingerprint
      || !sameProjectRevisionBasis(beforeRevision, afterRevision)
    ) {
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
  } catch (caught) {
    rmSync(destinationRoot, { recursive: true, force: true });
    throw caught;
  }
}
