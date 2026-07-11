import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readdirSync, readFileSync, readlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';

function hashDirectory(root) {
  if (!existsSync(root)) return null;
  const digest = createHash('sha256');
  const queue = [resolve(root)];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = readdirSync(current, { withFileTypes: true })
      .filter((entry) => entry.name !== '.DS_Store')
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = join(current, entry.name);
      const relativePath = relative(root, absolutePath).split('\\').join('/');
      if (entry.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }
      digest.update(relativePath);
      digest.update('\0');
      const stat = lstatSync(absolutePath);
      if (stat.isSymbolicLink()) {
        digest.update(`symlink:${readlinkSync(absolutePath)}`);
      } else if (stat.isFile()) {
        digest.update(readFileSync(absolutePath));
      }
      digest.update('\0');
    }
  }
  return `sha256:${digest.digest('hex')}`;
}

export function observeProjectRevision(projectRoot, observedAt = new Date().toISOString()) {
  try {
    const root = resolve(projectRoot);
    const revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    const status = execFileSync(
      'git',
      ['-C', root, 'status', '--porcelain=v1', '--untracked-files=normal'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim();
    const dirty = status.length > 0;
    const specificationDigest = hashDirectory(join(root, 'specification'));
    const sourceDigest = dirty
      ? `sha256:${createHash('sha256')
        .update(revision)
        .update('\0')
        .update(status)
        .update('\0')
        .update(specificationDigest ?? 'specification:missing')
        .digest('hex')}`
      : revision;
    return {
      kind: dirty ? 'worktree' : 'commit',
      revision,
      dirty,
      sourceDigest,
      specificationDigest,
      observedAt,
    };
  } catch {
    return null;
  }
}

export function sameProjectRevisionBasis(left, right) {
  return Boolean(
    left
    && right
    && left.kind === right.kind
    && left.revision === right.revision
    && left.dirty === right.dirty
    && left.sourceDigest === right.sourceDigest
    && left.specificationDigest === right.specificationDigest,
  );
}

