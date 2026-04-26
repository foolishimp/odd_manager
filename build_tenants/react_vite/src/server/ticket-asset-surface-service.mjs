// TicketAssetSurface service — server-side read implementation for the
// tickets:// surface defined in build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md.
//
// Closes T-007 read path:
//   - lists, gets, counts tickets across .ai-workspace/tickets/{active,backlog,completed}/
//   - parses STDO YAML frontmatter (and tolerates the sparse legacy bullet shape)
//   - returns typed TicketRecord projections matching src/contracts/ticket.ts
//
// Write path (status transitions, link operations) — separate ticket follow-up.
// MCP projection (resource publication) — T-011.
// UX consumption — T-014 (and T-007 evaluation criteria once a widget consumes this).

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const LANES = ['active', 'backlog', 'completed'];

const FRONTMATTER_KEY_MAP = {
  ticket_category: 'ticketCategory',
  change_intent: 'changeIntent',
  change_class: 'changeClass',
  re_entry_point: 'reEntryPoint',
  triaged_at: 'triagedAt',
  created_at: 'createdAt',
  updated_at: 'updatedAt',
  intake_source: 'intakeSource',
  affected_boundary: 'affectedBoundary',
  build_tenant: 'buildTenant',
  source_ticket: 'sourceTicket',
  governance_scope: 'governanceScope',
  governance_scope_expansion: 'governanceScopeExpansion',
  target_truth: 'targetTruth',
  superseded_truth: 'supersededTruth',
  closure_law: 'closureLaw',
  evaluation_criteria: 'evaluationCriteria',
  proof_surface: 'proofSurface',
  non_closure_conditions: 'nonClosureConditions',
  migration_strategy: 'migrationStrategy',
  library_usage: 'libraryUsage',
  governing_library: 'governingLibrary',
  library_rationale: 'libraryRationale',
};

const ARRAY_FIELDS = new Set([
  'dependencies',
  'governance_scope_expansion',
  'evaluation_criteria',
  'proof_surface',
  'non_closure_conditions',
  'links',
]);

function tickByLane(workspaceRoot, lane) {
  return resolve(workspaceRoot, '.ai-workspace/tickets', lane);
}

function isTicketFile(name) {
  return /^[TB]-\d+.*\.md$/i.test(name);
}

function readTicketFiles(workspaceRoot, lane) {
  const dir = tickByLane(workspaceRoot, lane);
  if (!existsSync(dir)) return [];
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (!isTicketFile(name)) continue;
    const path = join(dir, name);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    entries.push({ path, name });
  }
  return entries;
}

// Minimal YAML-frontmatter parser tuned for the ticket shape.
// Supports: scalar key:value, list of bare scalars under a key, list of
// inline { letter: value } maps (governance_scope_expansion). Permissive
// on whitespace; fails closed on malformed structure by returning null.
function parseFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { frontmatter: null, body: raw };
  const block = match[1];
  const body = raw.slice(match[0].length).replace(/^\r?\n/, '');
  const lines = block.split(/\r?\n/);
  const frontmatter = {};
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.trim() === '') { i++; continue; }
    const scalar = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!scalar) { i++; continue; }
    const key = scalar[1];
    const valueRest = scalar[2].trim();
    if (valueRest === '') {
      // List or map follows — collect indented lines starting with "- ".
      const items = [];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (next.trim() === '') { i++; continue; }
        const itemMatch = next.match(/^\s+-\s+(.*)$/);
        if (!itemMatch) break;
        const itemBody = itemMatch[1];
        const inlineMap = itemBody.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
        if (inlineMap) {
          items.push({ [inlineMap[1]]: inlineMap[2].trim() });
        } else {
          items.push(itemBody);
        }
        i++;
      }
      frontmatter[key] = items;
    } else {
      // Scalar value — strip surrounding quotes if present.
      const cleaned = valueRest.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
      if (ARRAY_FIELDS.has(key) && cleaned.startsWith('[') && cleaned.endsWith(']')) {
        // Inline empty/short array: dependencies: []
        const inner = cleaned.slice(1, -1).trim();
        frontmatter[key] = inner === '' ? [] : inner.split(',').map((s) => s.trim());
      } else {
        frontmatter[key] = cleaned;
      }
      i++;
    }
  }
  return { frontmatter, body };
}

// Tolerate the legacy sparse shape used by T-001..T-003, B-004:
//   # T-001 Title here
//   - id: T-001
//   - type: feature
//   - status: active
//   ...
function parseSparseShape(raw) {
  const headerMatch = raw.match(/^#\s+([TB]-\d+)\s+(.+)$/m);
  if (!headerMatch) return null;
  const fm = { id: headerMatch[1], title: headerMatch[2].trim() };
  const lines = raw.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^-\s+([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) continue;
    fm[m[1]] = m[2].trim();
  }
  if (!fm.id || !fm.type) return null;
  return { frontmatter: fm, body: raw };
}

function applyKeyMap(frontmatter) {
  const mapped = { raw: { ...frontmatter } };
  for (const [k, v] of Object.entries(frontmatter)) {
    const target = FRONTMATTER_KEY_MAP[k] ?? k;
    mapped[target] = v;
  }
  return mapped;
}

function parseTicketFile(filePath, lane, workspaceRoot) {
  const raw = readFileSync(filePath, 'utf-8');
  let parsed = parseFrontmatter(raw);
  if (!parsed.frontmatter) {
    parsed = parseSparseShape(raw);
  }
  if (!parsed || !parsed.frontmatter) return null;
  if (!parsed.frontmatter.id) return null;
  const mapped = applyKeyMap(parsed.frontmatter);
  return {
    ...mapped,
    sourcePath: relative(workspaceRoot, filePath),
    lane,
    body: parsed.body?.trim() || undefined,
  };
}

export function loadAllTickets(workspaceRoot) {
  const records = [];
  for (const lane of LANES) {
    for (const { path } of readTicketFiles(workspaceRoot, lane)) {
      const record = parseTicketFile(path, lane, workspaceRoot);
      if (record) records.push(record);
    }
  }
  return records;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function matchesFilter(record, filter) {
  if (!filter) return true;
  if (filter.lane && !asArray(filter.lane).includes(record.lane)) return false;
  if (filter.status && !asArray(filter.status).includes(record.status)) return false;
  if (filter.goal && record.goal !== filter.goal) return false;
  if (filter.buildTenant && record.buildTenant !== filter.buildTenant) return false;
  if (filter.ticketCategory && record.ticketCategory !== filter.ticketCategory) return false;
  if (filter.changeClass && record.changeClass !== filter.changeClass) return false;
  if (filter.hasDependency) {
    const deps = asArray(record.dependencies);
    if (!deps.some((d) => String(d).startsWith(filter.hasDependency))) return false;
  }
  return true;
}

export function createTicketSurface(workspaceRoot) {
  // Cached read — minimal viable. Cache invalidation on file change is the
  // change-feed work (T-007 evaluation criterion #3); deferred to follow-up.
  let cache = null;
  function ensure() {
    if (cache === null) cache = loadAllTickets(workspaceRoot);
    return cache;
  }
  return {
    list(filter) {
      return ensure().filter((r) => matchesFilter(r, filter));
    },
    get(id) {
      return ensure().find((r) => r.id === id);
    },
    count(filter) {
      return ensure().filter((r) => matchesFilter(r, filter)).length;
    },
    invalidate() {
      cache = null;
    },
  };
}
