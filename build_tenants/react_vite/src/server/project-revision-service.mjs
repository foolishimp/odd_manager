import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readdirSync,
  readFileSync,
  readlinkSync,
  realpathSync,
} from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, relative, resolve } from 'node:path';

const EXCLUDED_PROJECT_DIRECTORY_NAMES_AT_ANY_DEPTH = new Set([
  '.git',
  'node_modules',
  '__pycache__',
  '.pytest_cache',
]);

const KNOWN_GENERATED_PROJECT_ROOTS = [
  /^(?:build|dist|coverage|test-results|playwright-report)$/,
  /^build_tenants\/[^/]+\/(?:build|dist|coverage|test-results|playwright-report)$/,
  /^build_tenants\/[^/]+\/packages\/[^/]+\/(?:build|dist|coverage)$/,
  /^packages\/[^/]+\/(?:build|dist|coverage)$/,
  /^(?:build_tenants\/[^/]+\/)?tests\/artifacts$/,
  /^build_tenants\/[^/]+\/\.ai-workspace\/runtime$/,
  /^packages\/[^/]+\/\.ai-workspace\/runtime$/,
];

export function projectSourcePathExcluded(relativePath, name, isDirectory) {
  const normalizedPath = relativePath.split('\\').join('/').replace(/^\.\/+/, '').replace(/\/+$/, '');
  const pathSegments = normalizedPath.split('/').filter(Boolean);
  const testRunsSegment = pathSegments.indexOf('test_runs');
  if (name === '.DS_Store') return true;
  if (isDirectory && EXCLUDED_PROJECT_DIRECTORY_NAMES_AT_ANY_DEPTH.has(name)) return true;
  if (
    testRunsSegment >= 0
    && (isDirectory || testRunsSegment < pathSegments.length - 1)
  ) {
    return true;
  }
  if (
    isDirectory
    && KNOWN_GENERATED_PROJECT_ROOTS.some((pattern) => pattern.test(normalizedPath))
  ) {
    return true;
  }
  return normalizedPath === '.ai-workspace/runtime'
    || normalizedPath.startsWith('.ai-workspace/runtime/');
}

function normalizeGitProjectPath(value) {
  const normalized = value
    .split('\\').join('/')
    .replace(/^\.\//, '')
    .replace(/\/+$/, '');
  const segments = normalized.split('/').filter(Boolean);
  if (
    !normalized
    || normalized.startsWith('/')
    || /^[A-Za-z]:\//.test(normalized)
    || segments.some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`Git reported an invalid Project-relative path: ${JSON.stringify(value)}`);
  }
  return { normalized, segments };
}

function gitProjectPathExcluded(projectRoot, value) {
  const directoryMarker = /[\\/]$/.test(value);
  const { segments } = normalizeGitProjectPath(value);
  for (let index = 0; index < segments.length; index++) {
    const candidate = segments.slice(0, index + 1).join('/');
    const isAncestor = index < segments.length - 1;
    const absolutePath = join(projectRoot, candidate);
    const isDirectory = isAncestor
      || directoryMarker
      || (existsSync(absolutePath) && lstatSync(absolutePath).isDirectory());
    if (projectSourcePathExcluded(candidate, segments[index], isDirectory)) {
      return true;
    }
  }
  return false;
}

function parseGitPorcelainV1Z(value) {
  const fields = value.split('\0');
  if (fields.at(-1) === '') fields.pop();
  const entries = [];
  let index = 0;
  while (index < fields.length) {
    const record = fields[index++];
    if (record.length < 4 || record[2] !== ' ') {
      throw new Error(`Git reported malformed porcelain status: ${JSON.stringify(record)}`);
    }
    const status = record.slice(0, 2);
    const paths = [record.slice(3)];
    if (!paths[0]) {
      throw new Error(`Git reported an empty porcelain status path for ${status}`);
    }
    if (status.includes('R') || status.includes('C')) {
      if (index >= fields.length || !fields[index]) {
        throw new Error(`Git reported an incomplete rename/copy status for ${paths[0]}`);
      }
      paths.push(fields[index++]);
    }
    paths.forEach(normalizeGitProjectPath);
    entries.push({ status, paths });
  }
  return entries;
}

function parseGitNullTerminatedPaths(value) {
  const fields = value.split('\0');
  if (fields.at(-1) === '') fields.pop();
  fields.forEach(normalizeGitProjectPath);
  return fields;
}

function updateDigestField(digest, value) {
  const bytes = Buffer.isBuffer(value) ? value : Buffer.from(String(value));
  digest.update(String(bytes.byteLength));
  digest.update(':');
  digest.update(bytes);
  digest.update('\0');
}

export function fingerprintProjectSource(projectRoot) {
  const root = resolve(projectRoot);
  if (!existsSync(root)) return null;
  const digest = createHash('sha256');
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift();
    const entries = readdirSync(current, { withFileTypes: true })
      .sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = join(current, entry.name);
      const relativePath = relative(root, absolutePath).split('\\').join('/');
      const stat = lstatSync(absolutePath);
      if (projectSourcePathExcluded(relativePath, entry.name, stat.isDirectory())) {
        continue;
      }
      updateDigestField(digest, relativePath);
      if (stat.isDirectory()) {
        updateDigestField(digest, 'directory');
        queue.push(absolutePath);
      } else if (stat.isSymbolicLink()) {
        updateDigestField(digest, 'symlink');
        updateDigestField(digest, readlinkSync(absolutePath));
      } else if (stat.isFile()) {
        updateDigestField(digest, 'regular');
        updateDigestField(digest, (stat.mode & 0o111) === 0 ? 'non-executable' : 'executable');
        updateDigestField(digest, readFileSync(absolutePath));
      } else {
        throw new Error(`Project source contains unsupported file type: ${relativePath}`);
      }
    }
  }
  return `sha256:${digest.digest('hex')}`;
}

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
  const root = resolve(projectRoot);
  let revision;
  try {
    const repositoryRoot = realpathSync(resolve(execFileSync(
      'git',
      ['-C', root, 'rev-parse', '--show-toplevel'],
      {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
      },
    ).trim()));
    if (repositoryRoot !== realpathSync(root)) return null;
    revision = execFileSync('git', ['-C', root, 'rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch (caught) {
    if (caught && typeof caught === 'object' && caught.code === 'ENOENT') {
      throw new Error('Project revision observation requires the git executable.');
    }
    return null;
  }

  try {
    const status = execFileSync(
      'git',
      ['-C', root, 'status', '--porcelain=v1', '-z', '--untracked-files=normal'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const includedStatus = parseGitPorcelainV1Z(status).filter(
      (entry) => entry.paths.some((relativePath) => (
        !gitProjectPathExcluded(root, relativePath)
      )),
    );
    const ignoredPaths = parseGitNullTerminatedPaths(execFileSync(
      'git',
      ['-C', root, 'ls-files', '--others', '--ignored', '--exclude-standard', '--directory', '-z'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ));
    const includedIgnoredPaths = ignoredPaths.filter(
      (relativePath) => !gitProjectPathExcluded(root, relativePath),
    );
    const dirty = includedStatus.length > 0 || includedIgnoredPaths.length > 0;
    const specificationDigest = hashDirectory(join(root, 'specification'));
    const sourceDigest = fingerprintProjectSource(root);
    return {
      kind: dirty ? 'worktree' : 'commit',
      revision,
      dirty,
      sourceDigest,
      specificationDigest,
      observedAt,
    };
  } catch (caught) {
    const detail = caught instanceof Error ? caught.message : String(caught);
    throw new Error(`Project revision observation failed for ${root}: ${detail}`);
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
