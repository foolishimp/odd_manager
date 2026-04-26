// Project contract — shared between FE and BE per UX_METHOD §10.
// Authoritative type for any ProjectAssetSurface consumer.
//
// Companion to: build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md (§3 Projects)
// Realized by: build_tenants/react_vite/src/server/project-asset-surface-service.mjs
// Adopted via: T-017 (read + switcher pane)

export type OddType = 'odd_sdlc' | 'odd_world_model' | 'unknown' | string;

export interface ProjectRecord {
  id: string;          // directory basename
  root: string;        // absolute path
  odd_type: OddType;   // detected from .genesis/<package>/ subdir; 'unknown' when none
  has_ai_workspace: boolean;
  has_genesis: boolean;
  installed_packages: string[]; // package names found under .genesis/
  build_tenants: string[];      // tenant names found under build_tenants/
}

export interface ProjectCollectionFilter {
  odd_type?: OddType | OddType[];
  has_ai_workspace?: boolean;
  installed_package?: string;
  build_tenant?: string;
}

export interface ProjectSurfaceDiagnostic {
  registry_root: string;
  scanned_count: number;
  candidate_count: number;
}

export interface ProjectCollectionQuery {
  list(filter?: ProjectCollectionFilter): ProjectRecord[];
  get(id: string): ProjectRecord | undefined;
  count(filter?: ProjectCollectionFilter): number;
  diagnostic(): ProjectSurfaceDiagnostic;
}
