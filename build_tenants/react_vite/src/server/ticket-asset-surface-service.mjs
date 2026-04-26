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

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, renameSync, unlinkSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, dirname, basename } from 'node:path';
import { randomBytes } from 'node:crypto';

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

function tickByLane(projectRoot, lane) {
  return resolve(projectRoot, '.ai-workspace/tickets', lane);
}

function isTicketFile(name) {
  return /^[TB]-\d+.*\.md$/i.test(name);
}

function readTicketFiles(projectRoot, lane) {
  const dir = tickByLane(projectRoot, lane);
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

function parseTicketFile(filePath, lane, projectRoot) {
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
    sourcePath: relative(projectRoot, filePath),
    lane,
    body: parsed.body?.trim() || undefined,
  };
}

export function loadAllTickets(projectRoot) {
  const records = [];
  for (const lane of LANES) {
    for (const { path } of readTicketFiles(projectRoot, lane)) {
      const record = parseTicketFile(path, lane, projectRoot);
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

// =============================================================================
// T-018 — write actions and change feed
// =============================================================================

// Reverse of FRONTMATTER_KEY_MAP for serializing camelCase back to snake_case.
const FRONTMATTER_REVERSE_MAP = Object.fromEntries(
  Object.entries(FRONTMATTER_KEY_MAP).map(([snake, camel]) => [camel, snake]),
);

// Rewrite a single scalar field inside the YAML frontmatter block of a raw
// ticket file. Preserves everything else (body, comments, ordering of other
// fields). Field name is the snake_case key as it appears in the file.
function rewriteScalarFieldInRaw(raw, snakeKey, newValue) {
  const fmMatch = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) {
    throw new Error(`rewriteScalarFieldInRaw: no YAML frontmatter found`);
  }
  const head = fmMatch[1];
  const block = fmMatch[2];
  const tail = fmMatch[3];
  const lineRe = new RegExp(`^(${snakeKey}:\\s*).*$`, 'm');
  const newBlock = lineRe.test(block)
    ? block.replace(lineRe, `$1${newValue}`)
    : `${block}\n${snakeKey}: ${newValue}`;
  return raw.slice(0, fmMatch.index) + head + newBlock + tail + raw.slice(fmMatch.index + fmMatch[0].length);
}

// Atomically write content to targetPath via a temp file in the same directory
// then rename. Same-filesystem rename is atomic on POSIX.
function atomicWriteFile(targetPath, content) {
  const dir = dirname(targetPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmpName = `.${basename(targetPath)}.${randomBytes(6).toString('hex')}.tmp`;
  const tmpPath = join(dir, tmpName);
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, targetPath);
}

function ticketFileAbsolutePath(projectRoot, sourcePath) {
  return resolve(projectRoot, sourcePath);
}

function destinationLanePath(projectRoot, currentSourcePath, toLane) {
  const filename = basename(currentSourcePath);
  return resolve(projectRoot, '.ai-workspace/tickets', toLane, filename);
}

// Find a ticket record by id from a fresh full read. Used by write actions
// rather than the cached surface to avoid stale-cache write decisions.
function findFresh(projectRoot, id) {
  return loadAllTickets(projectRoot).find((r) => r.id === id);
}

function actionResult(ok, payload) {
  return { ok, ...payload };
}

// Action: transition-status. Moves the ticket between lanes and updates the
// status field in frontmatter. New lane is one of LANES.
export function transitionStatus(projectRoot, id, toLane) {
  if (!LANES.includes(toLane)) {
    return actionResult(false, { error: `invalid lane: ${toLane}` });
  }
  const record = findFresh(projectRoot, id);
  if (!record) return actionResult(false, { error: `ticket not found: ${id}` });
  if (record.lane === toLane) {
    return actionResult(false, { error: `ticket ${id} is already in lane ${toLane}` });
  }
  const fromPath = ticketFileAbsolutePath(projectRoot, record.sourcePath);
  const toPath = destinationLanePath(projectRoot, record.sourcePath, toLane);
  let raw;
  try {
    raw = readFileSync(fromPath, 'utf-8');
  } catch (err) {
    return actionResult(false, { error: `read failed: ${err.message}` });
  }
  let updated;
  try {
    updated = rewriteScalarFieldInRaw(raw, 'status', toLane);
  } catch (err) {
    return actionResult(false, { error: err.message });
  }
  try {
    atomicWriteFile(toPath, updated);
    if (fromPath !== toPath) unlinkSync(fromPath);
  } catch (err) {
    return actionResult(false, { error: `write/move failed: ${err.message}` });
  }
  return actionResult(true, { id, fromLane: record.lane, toLane, sourcePath: relative(projectRoot, toPath) });
}

// Action: update-frontmatter-field. Generic single-scalar update.
export function updateFrontmatterField(projectRoot, id, snakeKey, newValue) {
  const record = findFresh(projectRoot, id);
  if (!record) return actionResult(false, { error: `ticket not found: ${id}` });
  const path = ticketFileAbsolutePath(projectRoot, record.sourcePath);
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    return actionResult(false, { error: `read failed: ${err.message}` });
  }
  let updated;
  try {
    updated = rewriteScalarFieldInRaw(raw, snakeKey, String(newValue));
  } catch (err) {
    return actionResult(false, { error: err.message });
  }
  try {
    atomicWriteFile(path, updated);
  } catch (err) {
    return actionResult(false, { error: `write failed: ${err.message}` });
  }
  return actionResult(true, { id, field: snakeKey, value: newValue });
}

// Action: link-dependency. Append a dependency entry to the dependencies list.
export function linkDependency(projectRoot, id, dependencyEntry) {
  const record = findFresh(projectRoot, id);
  if (!record) return actionResult(false, { error: `ticket not found: ${id}` });
  const existing = asArray(record.dependencies).map(String);
  if (existing.includes(dependencyEntry)) {
    return actionResult(false, { error: `dependency already present: ${dependencyEntry}` });
  }
  const path = ticketFileAbsolutePath(projectRoot, record.sourcePath);
  const raw = readFileSync(path, 'utf-8');
  // Replace the dependencies block. Match: dependencies:\n(  - ...\n)*
  const blockRe = /^(dependencies:\s*)((?:\n  - .*)*)$/m;
  const inlineRe = /^(dependencies:\s*)\[\s*\]\s*$/m;
  const newEntryLine = `\n  - ${dependencyEntry}`;
  let updated;
  if (blockRe.test(raw)) {
    updated = raw.replace(blockRe, `$1$2${newEntryLine}`);
  } else if (inlineRe.test(raw)) {
    updated = raw.replace(inlineRe, `dependencies:${newEntryLine}`);
  } else {
    return actionResult(false, { error: 'dependencies field not found' });
  }
  try {
    atomicWriteFile(path, updated);
  } catch (err) {
    return actionResult(false, { error: `write failed: ${err.message}` });
  }
  return actionResult(true, { id, added: dependencyEntry });
}

// Action: assign-to-build-tenant.
export function assignBuildTenant(projectRoot, id, tenant) {
  return updateFrontmatterField(projectRoot, id, 'build_tenant', tenant);
}

// =============================================================================
// Change feed
// =============================================================================

// Polling-based change feed. Diffs snapshots every pollIntervalMs and emits
// typed events to subscribers. Polling is chosen over fs.watch for cross-
// platform reliability and absence of recursive-watch quirks; the cost of a
// 1s poll over ~20 tiny markdown files is negligible.
function snapshotById(records) {
  const map = new Map();
  for (const r of records) {
    // Use a coarse fingerprint: sourcePath + lane + status. Sufficient for
    // detecting status transitions, lane moves, and rough field updates.
    map.set(r.id, `${r.sourcePath}|${r.lane}|${r.status}|${r.updatedAt ?? ''}`);
  }
  return map;
}

function diffSnapshots(prev, next) {
  const events = [];
  for (const [id, sig] of next.entries()) {
    if (!prev.has(id)) {
      events.push({ kind: 'created', id });
    } else if (prev.get(id) !== sig) {
      events.push({ kind: 'updated', id });
    }
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) {
      events.push({ kind: 'deleted', id });
    }
  }
  return events;
}

export function createTicketSurface(projectRoot, options = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  let cache = null;
  let snapshot = null;
  let listeners = new Set();
  let pollTimer = null;

  function ensure() {
    if (cache === null) {
      cache = loadAllTickets(projectRoot);
      snapshot = snapshotById(cache);
    }
    return cache;
  }

  function pollOnce() {
    const fresh = loadAllTickets(projectRoot);
    const next = snapshotById(fresh);
    const prev = snapshot ?? new Map();
    const events = diffSnapshots(prev, next);
    if (events.length) {
      cache = fresh;
      snapshot = next;
      for (const listener of listeners) {
        try {
          listener(events);
        } catch {
          // listener errors must not affect other subscribers
        }
      }
    }
  }

  function startPolling() {
    if (pollTimer) return;
    pollTimer = setInterval(pollOnce, pollIntervalMs);
    if (typeof pollTimer.unref === 'function') pollTimer.unref();
  }

  function stopPolling() {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
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
      snapshot = null;
    },

    // Write actions — every action produces a typed result and invalidates the cache.
    transitionStatus(id, toLane) {
      const result = transitionStatus(projectRoot, id, toLane);
      if (result.ok) this.invalidate();
      return result;
    },
    updateFrontmatterField(id, snakeKey, newValue) {
      const result = updateFrontmatterField(projectRoot, id, snakeKey, newValue);
      if (result.ok) this.invalidate();
      return result;
    },
    linkDependency(id, dependencyEntry) {
      const result = linkDependency(projectRoot, id, dependencyEntry);
      if (result.ok) this.invalidate();
      return result;
    },
    assignBuildTenant(id, tenant) {
      const result = assignBuildTenant(projectRoot, id, tenant);
      if (result.ok) this.invalidate();
      return result;
    },

    // Change feed.
    subscribe(listener) {
      listeners.add(listener);
      ensure();
      startPolling();
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0) stopPolling();
      };
    },
    pollOnce,
  };
}
