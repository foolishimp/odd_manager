// Session contract — shared between FE and BE per UX_METHOD §10.
// Authoritative type for any SessionAssetSurface consumer.
//
// Companion to: build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md (§3 Sessions)
// Realized by: build_tenants/react_vite/src/server/session-asset-surface-service.mjs
// Adopted via: T-009 (read path); T-020 (spawn/attach + xterm.js); T-021 (server-restart survival)

export type SessionStatus = 'running' | 'detached' | 'stopped' | 'unknown' | string;
export type SessionAgentType = 'claude_code' | 'codex' | 'shell' | 'unknown' | string;

export interface SessionContextSnapshot {
  project?: string;
  workspace?: string;
  odd_type?: string;
}

export interface SessionRecord {
  id: string;
  agent_type: SessionAgentType;
  cwd: string;
  status: SessionStatus;
  started_at?: string;
  transcript_ref?: string;
  context_at_spawn?: SessionContextSnapshot;
  // Source path (when registry-backed); absent for in-memory / pool-backed sessions.
  source_path?: string;
  // Forward-compat raw bag for unknown fields the surface should preserve.
  raw?: Record<string, unknown>;
}

export interface SessionCollectionFilter {
  project?: string;
  agent_type?: SessionAgentType | SessionAgentType[];
  status?: SessionStatus | SessionStatus[];
}

export interface SessionSurfaceDiagnostic {
  backplane: 'registry' | 'none' | 'oddterm';
  registry_root?: string;
  notes?: string[];
  runtime?: Record<string, unknown>;
}

export interface SessionCollectionQuery {
  list(filter?: SessionCollectionFilter): SessionRecord[];
  get(id: string): SessionRecord | undefined;
  count(filter?: SessionCollectionFilter): number;
  diagnostic(): SessionSurfaceDiagnostic;
}
