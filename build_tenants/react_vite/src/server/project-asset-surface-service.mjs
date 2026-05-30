// ProjectAssetSurface service.
//
// Projects are maintained manager-workspace state, not a scan result. Discovery
// can propose candidates, but the Projects collection is the local registry
// stored at `.ai-workspace/runtime/odd_manager/projects.local.json` under the
// odd_manager workspace. The committed `projects.template.json` documents the
// shape without carrying machine-specific paths.

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const DEFAULT_MANAGER_WORKSPACE_ROOT = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../../../../',
);
const DEFAULT_DISCOVERY_ROOT = resolve(DEFAULT_MANAGER_WORKSPACE_ROOT, '..');
const PROJECT_REGISTRY_RELATIVE_PATH = '.ai-workspace/runtime/odd_manager/projects.local.json';
const PROJECT_REGISTRY_VERSION = 1;

function nowIso() {
  return new Date().toISOString();
}

function isDirectory(path) {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function listDirNames(path) {
  if (!existsSync(path)) return [];
  try {
    return readdirSync(path).filter((name) => isDirectory(join(path, name)));
  } catch {
    return [];
  }
}

function projectIdFromRoot(root) {
  const base = basename(root) || 'project';
  const hash = createHash('sha1').update(resolve(root)).digest('hex').slice(0, 8);
  return `${base}-${hash}`;
}

function projectDisplayNameFromRoot(root) {
  const parts = resolve(root).split('/').filter(Boolean);
  const sandboxName = sandboxWorkspaceDisplayName(parts);
  if (sandboxName) return sandboxName;
  return basename(root) || 'project';
}

function sandboxWorkspaceDisplayName(parts) {
  const leaf = parts.at(-1);
  const runFolder = parts.at(-2);
  const browserFolder = parts.at(-3);
  if (leaf !== 'workspace' || !runFolder || !browserFolder) return null;
  const match = runFolder.match(/(?:^|_)pid([A-Za-z0-9]+)$/);
  if (!match) return null;
  return `${browserFolder}.pid${match[1]}.workspace`;
}

function detectOddType(installedPackages) {
  if (installedPackages.includes('odd_sdlc')) return 'odd_sdlc';
  if (installedPackages.includes('odd_world_model')) return 'odd_world_model';
  return 'unknown';
}

function registryPath(managerWorkspaceRoot) {
  return join(resolve(managerWorkspaceRoot || DEFAULT_MANAGER_WORKSPACE_ROOT), PROJECT_REGISTRY_RELATIVE_PATH);
}

function emptyRegistry() {
  return {
    version: PROJECT_REGISTRY_VERSION,
    active_project_root: null,
    projects: [],
  };
}

function normalizeRegistryRecord(value) {
  if (!value || typeof value !== 'object') return null;
  const root = typeof value.root === 'string' && value.root.trim() ? resolve(value.root) : null;
  if (!root) return null;
  const observedAt = nowIso();
  const fallbackLabel = projectDisplayNameFromRoot(root);
  return {
    id: typeof value.id === 'string' && value.id.trim() ? value.id.trim() : projectIdFromRoot(root),
    root,
    label: typeof value.label === 'string' && value.label.trim() ? value.label.trim() : fallbackLabel,
    tags: Array.isArray(value.tags) ? value.tags.filter((tag) => typeof tag === 'string' && tag.trim()) : [],
    registered_at: typeof value.registered_at === 'string' && value.registered_at.trim() ? value.registered_at : observedAt,
    updated_at: typeof value.updated_at === 'string' && value.updated_at.trim() ? value.updated_at : observedAt,
  };
}

function normalizeRegistry(payload) {
  const source = payload && typeof payload === 'object' ? payload : {};
  const records = Array.isArray(source.projects)
    ? source.projects.map(normalizeRegistryRecord).filter(Boolean)
    : [];
  const seenRoots = new Set();
  const projects = [];
  for (const record of records) {
    if (seenRoots.has(record.root)) continue;
    seenRoots.add(record.root);
    projects.push(record);
  }
  const activeRoot = typeof source.active_project_root === 'string' && source.active_project_root.trim()
    ? resolve(source.active_project_root)
    : null;
  return {
    version: PROJECT_REGISTRY_VERSION,
    active_project_root: activeRoot,
    projects,
  };
}

function readRegistry(managerWorkspaceRoot) {
  const path = registryPath(managerWorkspaceRoot);
  if (!existsSync(path)) {
    return emptyRegistry();
  }
  try {
    return normalizeRegistry(JSON.parse(readFileSync(path, 'utf8')));
  } catch {
    return emptyRegistry();
  }
}

function writeRegistry(managerWorkspaceRoot, registry) {
  const path = registryPath(managerWorkspaceRoot);
  mkdirSync(dirname(path), { recursive: true });
  const normalized = normalizeRegistry(registry);
  const tempPath = `${path}.${process.pid}.tmp`;
  writeFileSync(tempPath, `${JSON.stringify(normalized, null, 2)}\n`, 'utf8');
  renameSync(tempPath, path);
  return normalized;
}

function describeProjectAt(name, root, registryEntry = null, activeProjectRoot = null) {
  const path = resolve(root);
  const displayName = projectDisplayNameFromRoot(path);
  const registryLabel = registryEntry?.label ?? name;
  const visibleName = registryLabel && registryLabel !== 'workspace' ? registryLabel : displayName;
  const hasAiWorkspace = isDirectory(join(path, '.ai-workspace'));
  const genesisPath = join(path, '.genesis');
  const hasGenesis = isDirectory(genesisPath);
  const installedPackages = hasGenesis ? listDirNames(genesisPath).filter((n) => n.startsWith('odd_')) : [];
  const buildTenants = listDirNames(join(path, 'build_tenants'))
    .filter((n) => n !== 'common' && n !== 'TENANT_REGISTRY.md');
  return {
    id: registryEntry?.id ?? projectIdFromRoot(path),
    name: visibleName,
    root: path,
    odd_type: detectOddType(installedPackages),
    has_ai_workspace: hasAiWorkspace,
    has_genesis: hasGenesis,
    installed_packages: installedPackages,
    build_tenants: buildTenants,
    registry_source: registryEntry ? 'registry' : 'discovery',
    registered_at: registryEntry?.registered_at ?? null,
    updated_at: registryEntry?.updated_at ?? null,
    tags: registryEntry?.tags ?? [],
    is_active: activeProjectRoot ? resolve(activeProjectRoot) === path : false,
  };
}

export function discoverProjects(discoveryRoot = process.env.PROJECT_REGISTRY_ROOT || DEFAULT_DISCOVERY_ROOT) {
  const root = resolve(discoveryRoot);
  if (!existsSync(root)) {
    return { records: [], diagnostic: { discovery_root: root, scanned_count: 0, candidate_count: 0 } };
  }
  const candidates = listDirNames(root);
  const records = [];
  for (const name of candidates) {
    if (name.startsWith('.')) continue;
    const path = join(root, name);
    if (!isDirectory(join(path, '.ai-workspace'))) continue;
    records.push(describeProjectAt(name, path));
  }
  return {
    records,
    diagnostic: { discovery_root: root, scanned_count: candidates.length, candidate_count: records.length },
  };
}

export function loadAllProjects(managerWorkspaceRoot = DEFAULT_MANAGER_WORKSPACE_ROOT) {
  const registry = readRegistry(managerWorkspaceRoot);
  return {
    records: registry.projects.map((record) => describeProjectAt(record.label, record.root, record, registry.active_project_root)),
    diagnostic: {
      registry_root: registryPath(managerWorkspaceRoot),
      manager_workspace_root: resolve(managerWorkspaceRoot || DEFAULT_MANAGER_WORKSPACE_ROOT),
      registry_version: registry.version,
      active_project_root: registry.active_project_root,
      candidate_count: registry.projects.length,
    },
  };
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function matchesFilter(record, filter) {
  if (!filter) return true;
  if (filter.odd_type && !asArray(filter.odd_type).includes(record.odd_type)) return false;
  if (typeof filter.has_ai_workspace === 'boolean' && record.has_ai_workspace !== filter.has_ai_workspace) return false;
  if (filter.installed_package && !record.installed_packages.includes(filter.installed_package)) return false;
  if (filter.build_tenant && !record.build_tenants.includes(filter.build_tenant)) return false;
  return true;
}

function findRegistryRecord(registry, identity) {
  const normalized = typeof identity === 'string' && identity.trim() ? identity.trim() : null;
  if (!normalized) return null;
  const resolved = normalized.startsWith('/') ? resolve(normalized) : null;
  return registry.projects.find((record) => record.id === normalized || record.root === resolved) ?? null;
}

function registerProject(managerWorkspaceRoot, projectRoot, options = {}) {
  const root = resolve(projectRoot || '');
  if (!isDirectory(root)) {
    throw new Error(`Project root is not a directory: ${projectRoot}`);
  }
  const registry = readRegistry(managerWorkspaceRoot);
  const existing = registry.projects.find((record) => record.root === root);
  const observedAt = nowIso();
  const nextRecord = normalizeRegistryRecord({
    ...(existing ?? {}),
    id: existing?.id ?? projectIdFromRoot(root),
    root,
    label: options.label ?? existing?.label ?? basename(root),
    tags: options.tags ?? existing?.tags ?? [],
    registered_at: existing?.registered_at ?? observedAt,
    updated_at: observedAt,
  });
  const projects = existing
    ? registry.projects.map((record) => (record.root === root ? nextRecord : record))
    : [...registry.projects, nextRecord];
  const nextRegistry = writeRegistry(managerWorkspaceRoot, {
    ...registry,
    active_project_root: options.setActive ? root : registry.active_project_root,
    projects,
  });
  return describeProjectAt(nextRecord.label, nextRecord.root, nextRecord, nextRegistry.active_project_root);
}

function unregisterProject(managerWorkspaceRoot, identity) {
  const registry = readRegistry(managerWorkspaceRoot);
  const existing = findRegistryRecord(registry, identity);
  if (!existing) {
    throw new Error(`Project is not registered: ${identity}`);
  }
  if (registry.active_project_root && resolve(registry.active_project_root) === existing.root) {
    throw new Error('Cannot remove the active Project. Activate another Project first.');
  }
  const nextRegistry = writeRegistry(managerWorkspaceRoot, {
    ...registry,
    projects: registry.projects.filter((record) => record.root !== existing.root),
  });
  return {
    removed: describeProjectAt(existing.label, existing.root, existing, registry.active_project_root),
    projects: nextRegistry.projects.map((record) => describeProjectAt(record.label, record.root, record, nextRegistry.active_project_root)),
  };
}

function setActiveProject(managerWorkspaceRoot, identityOrRoot, options = {}) {
  let registry = readRegistry(managerWorkspaceRoot);
  let record = findRegistryRecord(registry, identityOrRoot);
  if (!record && typeof identityOrRoot === 'string' && identityOrRoot.trim().startsWith('/')) {
    const root = resolve(identityOrRoot);
    if (!isDirectory(root)) {
      throw new Error(`Project root is not a directory: ${identityOrRoot}`);
    }
    if (options.registerIfMissing === false) {
      const nextRegistry = writeRegistry(managerWorkspaceRoot, {
        ...registry,
        active_project_root: root,
      });
      return describeProjectAt(projectDisplayNameFromRoot(root), root, null, nextRegistry.active_project_root);
    }
    registerProject(managerWorkspaceRoot, root);
    registry = readRegistry(managerWorkspaceRoot);
    record = findRegistryRecord(registry, root);
  }
  if (!record) {
    throw new Error(`Project is not registered: ${identityOrRoot}`);
  }
  const nextRegistry = writeRegistry(managerWorkspaceRoot, {
    ...registry,
    active_project_root: record.root,
  });
  return describeProjectAt(record.label, record.root, record, nextRegistry.active_project_root);
}

export function createProjectSurface(managerWorkspaceRoot = DEFAULT_MANAGER_WORKSPACE_ROOT, options = {}) {
  const discoveryRoot = options.discoveryRoot ?? process.env.PROJECT_REGISTRY_ROOT ?? DEFAULT_DISCOVERY_ROOT;
  let cache = null;
  function ensure() {
    if (cache === null) cache = loadAllProjects(managerWorkspaceRoot);
    return cache;
  }
  function invalidate() {
    cache = null;
  }
  return {
    list(filter) {
      return ensure().records.filter((record) => matchesFilter(record, filter));
    },
    get(id) {
      return ensure().records.find((record) => record.id === id || record.root === id);
    },
    count(filter) {
      return ensure().records.filter((record) => matchesFilter(record, filter)).length;
    },
    diagnostic() {
      return ensure().diagnostic;
    },
    discover() {
      return discoverProjects(discoveryRoot);
    },
    register(projectRoot, registerOptions = {}) {
      const record = registerProject(managerWorkspaceRoot, projectRoot, registerOptions);
      invalidate();
      return record;
    },
    unregister(identity) {
      const result = unregisterProject(managerWorkspaceRoot, identity);
      invalidate();
      return result;
    },
    setActive(identityOrRoot, activeOptions = {}) {
      const record = setActiveProject(managerWorkspaceRoot, identityOrRoot, activeOptions);
      invalidate();
      return record;
    },
    invalidate,
  };
}
