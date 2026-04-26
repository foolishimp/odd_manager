// ProjectAssetSurface service — server-side read implementation for the
// projects:// surface defined in build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md (§3).
//
// Closes T-017 read path:
//   - scans a registry root (default /Users/jim/src/apps/) one directory level
//     for candidate Projects
//   - a candidate is any subdirectory that contains an .ai-workspace/ dir
//   - detects odd_type from .genesis/<package>/ presence
//   - lists installed packages and build_tenants
//   - returns typed ProjectRecord projections matching src/contracts/project.ts
//
// Registry root configurable via PROJECT_REGISTRY_ROOT env var.

import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_REGISTRY_ROOT = '/Users/jim/src/apps';

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
    return readdirSync(path).filter((n) => isDirectory(join(path, n)));
  } catch {
    return [];
  }
}

function detectOddType(installedPackages) {
  if (installedPackages.includes('odd_sdlc')) return 'odd_sdlc';
  if (installedPackages.includes('odd_world_model')) return 'odd_world_model';
  return 'unknown';
}

function describeProjectAt(name, root) {
  const path = resolve(root);
  const hasAiWorkspace = isDirectory(join(path, '.ai-workspace'));
  if (!hasAiWorkspace) return null;
  const genesisPath = join(path, '.genesis');
  const hasGenesis = isDirectory(genesisPath);
  const installedPackages = hasGenesis ? listDirNames(genesisPath).filter((n) => n.startsWith('odd_')) : [];
  const buildTenants = listDirNames(join(path, 'build_tenants'))
    .filter((n) => n !== 'common' && n !== 'TENANT_REGISTRY.md');
  return {
    id: name,
    root: path,
    odd_type: detectOddType(installedPackages),
    has_ai_workspace: true,
    has_genesis: hasGenesis,
    installed_packages: installedPackages,
    build_tenants: buildTenants,
  };
}

export function loadAllProjects(registryRoot = process.env.PROJECT_REGISTRY_ROOT || DEFAULT_REGISTRY_ROOT) {
  const root = resolve(registryRoot);
  if (!existsSync(root)) {
    return { records: [], diagnostic: { registry_root: root, scanned_count: 0, candidate_count: 0 } };
  }
  const candidates = listDirNames(root);
  const records = [];
  for (const name of candidates) {
    if (name.startsWith('.')) continue;
    const record = describeProjectAt(name, join(root, name));
    if (record) records.push(record);
  }
  return {
    records,
    diagnostic: { registry_root: root, scanned_count: candidates.length, candidate_count: records.length },
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

export function createProjectSurface(registryRoot) {
  let cache = null;
  function ensure() {
    if (cache === null) cache = loadAllProjects(registryRoot);
    return cache;
  }
  return {
    list(filter) {
      return ensure().records.filter((r) => matchesFilter(r, filter));
    },
    get(id) {
      return ensure().records.find((r) => r.id === id);
    },
    count(filter) {
      return ensure().records.filter((r) => matchesFilter(r, filter)).length;
    },
    diagnostic() {
      return ensure().diagnostic;
    },
    invalidate() {
      cache = null;
    },
  };
}
