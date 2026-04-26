// SessionAssetSurface service — server-side read implementation for the
// sessions:// surface defined in build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md (§3).
//
// Closes T-009 read path:
//   - lists, gets, counts sessions from the runtime session registry
//   - returns typed SessionRecord projections matching src/contracts/session.ts
//   - reports diagnostic { backplane: 'registry' | 'none' } so consumers can
//     render an explicit empty-state when no backplane is configured yet
//
// Read source: .ai-workspace/runtime/sessions/<id>.json (one record per file).
// Empty state when the directory is absent or empty — diagnostic surfaces this
// so the scaffold UI can show an explicit "no session backplane yet" note
// instead of a silent empty list.
//
// Out of scope:
//   - T-020: spawn / attach / detach / kill actions; xterm.js attachment
//   - T-021: pty server-restart survival via tmux/zellij or native equivalent

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

function sessionsRoot(projectRoot) {
  return resolve(projectRoot, '.ai-workspace/runtime/sessions');
}

function readSessionFile(path, projectRoot) {
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch {
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if (!parsed.id) return null;
  return {
    id: String(parsed.id),
    agent_type: parsed.agent_type ?? 'unknown',
    cwd: parsed.cwd ?? '',
    status: parsed.status ?? 'unknown',
    started_at: parsed.started_at,
    transcript_ref: parsed.transcript_ref,
    context_at_spawn: parsed.context_at_spawn,
    source_path: relative(projectRoot, path),
    raw: parsed,
  };
}

export function loadAllSessions(projectRoot) {
  const root = sessionsRoot(projectRoot);
  if (!existsSync(root)) return { records: [], diagnostic: { backplane: 'none', notes: [`registry root absent: ${relative(projectRoot, root)}`] } };
  const records = [];
  let entries;
  try {
    entries = readdirSync(root);
  } catch {
    return { records: [], diagnostic: { backplane: 'none', notes: ['registry root unreadable'] } };
  }
  for (const name of entries) {
    if (!name.endsWith('.json')) continue;
    const path = join(root, name);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const record = readSessionFile(path, projectRoot);
    if (record) records.push(record);
  }
  return {
    records,
    diagnostic: {
      backplane: 'registry',
      registry_root: relative(projectRoot, root),
      notes: records.length === 0 ? ['registry present but empty — no sessions recorded yet'] : [],
    },
  };
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function matchesFilter(record, filter) {
  if (!filter) return true;
  if (filter.project && record.context_at_spawn?.project !== filter.project) return false;
  if (filter.agent_type && !asArray(filter.agent_type).includes(record.agent_type)) return false;
  if (filter.status && !asArray(filter.status).includes(record.status)) return false;
  return true;
}

export function createSessionSurface(projectRoot) {
  let cache = null;
  function ensure() {
    if (cache === null) cache = loadAllSessions(projectRoot);
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
