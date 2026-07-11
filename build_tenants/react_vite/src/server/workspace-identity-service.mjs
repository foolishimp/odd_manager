import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

const MAX_TEXT_BYTES = 64 * 1024;

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function readText(path) {
  if (!existsSync(path)) return null;
  try {
    return readFileSync(path, 'utf8').slice(0, MAX_TEXT_BYTES);
  } catch {
    return null;
  }
}

function readJson(path) {
  const text = readText(path);
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizedIdentity(value) {
  const candidate = String(value ?? '').trim().replace(/^@/, '');
  if (!candidate) return null;
  const segment = candidate.includes('/') ? candidate.split('/').at(-1) : candidate;
  const normalized = String(segment).replace(/-product$/i, '').replace(/-/g, '_');
  return /^[a-z][a-z0-9_]*$/i.test(normalized) ? normalized.toLowerCase() : null;
}

function identityFromProductDefinition(projectRoot) {
  const relativePath = 'specification/PRODUCT.md';
  const text = readText(join(projectRoot, relativePath));
  if (!text) return null;
  const heading = text.match(/^#\s+`?([A-Za-z][A-Za-z0-9_-]*)`?\s+Product\b/im);
  const identity = normalizedIdentity(heading?.[1]);
  if (!identity) return null;
  return {
    id: identity,
    label: heading?.[1] ?? identity,
    kind: 'source_project',
    version: null,
    sourceRef: relativePath,
    confidence: 'high',
  };
}

function identityFromPackage(projectRoot) {
  const relativePath = 'package.json';
  const value = readJson(join(projectRoot, relativePath));
  if (!value || typeof value !== 'object') return null;
  const identity = normalizedIdentity(value.name);
  if (!identity || !identity.startsWith('odd_')) return null;
  return {
    id: identity,
    label: typeof value.name === 'string' ? value.name : identity,
    kind: 'source_project',
    version: typeof value.version === 'string' ? value.version : null,
    sourceRef: relativePath,
    confidence: 'medium',
  };
}

function identityFromInstall(projectRoot) {
  for (const relativePath of [
    '.abiogenesis/install-manifest.json',
    '.genesis/release/install_manifest.json',
  ]) {
    const value = readJson(join(projectRoot, relativePath));
    if (!value || typeof value !== 'object') continue;
    const identity = normalizedIdentity(value.productId ?? value.product_id ?? value.installedPackageName);
    if (!identity) continue;
    return {
      id: identity,
      label: String(value.productId ?? value.product_id ?? value.installedPackageName),
      kind: 'install',
      version: typeof value.version === 'string'
        ? value.version
        : typeof value.packageVersion === 'string'
          ? value.packageVersion
          : null,
      sourceRef: relativePath,
      confidence: 'medium',
    };
  }
  return null;
}

function governancePackages(projectRoot) {
  const values = [];
  const genesisRoot = join(projectRoot, '.genesis');
  if (isDirectory(genesisRoot)) {
    try {
      for (const entry of readdirSync(genesisRoot, { withFileTypes: true })) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) values.push(entry.name);
      }
    } catch {
      // Absence is represented by the empty set.
    }
  }
  const abiManifest = readJson(join(projectRoot, '.abiogenesis/install-manifest.json'));
  const runtimeName = abiManifest && typeof abiManifest === 'object'
    ? abiManifest.runtimePackage?.packageName
    : null;
  if (typeof runtimeName === 'string' && runtimeName.trim()) values.push(runtimeName);
  return [...new Set(values)].sort();
}

export function detectPublishedWorkspaceIdentity(projectRootInput) {
  const projectRoot = resolve(projectRootInput || '.');
  const published = identityFromProductDefinition(projectRoot)
    ?? identityFromPackage(projectRoot)
    ?? identityFromInstall(projectRoot);
  const identity = published ?? {
    id: 'unknown',
    label: basename(projectRoot) || 'unknown',
    kind: 'unknown',
    version: null,
    sourceRef: null,
    confidence: 'low',
  };
  return {
    ...identity,
    projectRoot,
    governancePackages: governancePackages(projectRoot),
  };
}

