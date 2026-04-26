// CommentAssetSurface service — server-side read implementation for the
// comments:// surface defined in build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md (§3).
//
// Closes T-008 read path:
//   - lists, gets, counts comments across .ai-workspace/comments/<agent>/*.md
//   - derives author-as-agent from <agent>/ directory
//   - parses POSTING_GUIDE bold-key frontmatter (Author, Date, Addresses, Status, ...)
//   - derives category, timestamp, subject from filename
//   - returns typed CommentRecord projections matching src/contracts/comment.ts
//
// Out of scope (T-019): write actions (post / reply / mark-read), per-agent
// unread state persistence, full threading semantics with stable thread ids
// across renames.

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { join, relative, resolve, basename, dirname } from 'node:path';
import { randomBytes } from 'node:crypto';

function commentsRoot(projectRoot) {
  return resolve(projectRoot, '.ai-workspace/comments');
}

function isCommentFile(name) {
  return /\.md$/i.test(name) && !name.startsWith('.');
}

// Filename pattern (POSTING_GUIDE):
//   YYYYMMDDTHHMMSS_CATEGORY_SUBJECT.md
//   YYYYMMDDTHHMMSSZ_CATEGORY_SUBJECT.md      (with trailing Z)
// Tolerates the operator-style ODDTERM prefixed names too.
function parseFilename(filename) {
  const stem = filename.replace(/\.md$/i, '');
  const match = stem.match(/^(\d{8}T\d{6}Z?)_([A-Z][A-Z_]*)_(.+)$/);
  if (match) {
    return { timestamp: match[1], category: match[2], subject: match[3] };
  }
  return { timestamp: undefined, category: undefined, subject: stem };
}

// Parse POSTING_GUIDE-style header. Format:
//   # CATEGORY: Subject
//   **Author**: name
//   **Date**: 2026-04-26T14:00:00Z
//   **Addresses**: ...
//   **Status**: Draft
//   ... (body after first blank line following the metadata block)
function parseFrontHeader(raw) {
  const lines = raw.split(/\r?\n/);
  const header = {};
  let title;
  let bodyStart = 0;
  let metaSeen = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (i === 0 && line.startsWith('# ')) {
      title = line.slice(2).trim();
      bodyStart = i + 1;
      continue;
    }
    if (line.trim() === '') {
      if (metaSeen) { bodyStart = i + 1; break; }
      bodyStart = i + 1;
      continue;
    }
    const meta = line.match(/^\*\*([A-Za-z][A-Za-z _-]*)\*\*:\s*(.*)$/);
    if (meta) {
      header[meta[1].trim()] = meta[2].trim();
      metaSeen = true;
      bodyStart = i + 1;
      continue;
    }
    if (metaSeen) { bodyStart = i; break; }
    // Pre-metadata non-blank, non-meta line: still in header zone but unrecognized.
    bodyStart = i + 1;
  }
  const body = lines.slice(bodyStart).join('\n').replace(/^\n+/, '');
  return { title, header, body };
}

function deriveThreadId({ filename, addresses, author }) {
  // Initial heuristic: when Addresses cites a comment path, thread = the path.
  // Otherwise thread = author + filename root (unique per post; T-019 will
  // upgrade this to stable cross-rename thread identity).
  if (addresses) {
    const m = addresses.match(/comments\/[^\s;,)]+/);
    if (m) return m[0];
  }
  return `${author}/${filename.replace(/\.md$/i, '')}`;
}

function readCommentsForAgent(commentsDirRoot, agent, projectRoot) {
  const dir = join(commentsDirRoot, agent);
  if (!existsSync(dir)) return [];
  const records = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  for (const filename of entries) {
    if (!isCommentFile(filename)) continue;
    const path = join(dir, filename);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    let raw;
    try {
      raw = readFileSync(path, 'utf-8');
    } catch {
      continue;
    }
    const { title, header, body } = parseFrontHeader(raw);
    const fnInfo = parseFilename(filename);
    const id = `${agent}/${filename.replace(/\.md$/i, '')}`;
    const addresses = header['Addresses'];
    records.push({
      id,
      author: agent,
      sourcePath: relative(projectRoot, path),
      filename,
      timestamp: fnInfo.timestamp,
      category: fnInfo.category,
      subject: fnInfo.subject,
      threadId: deriveThreadId({ filename, addresses, author: agent }),
      title,
      date: header['Date'],
      addresses,
      status: header['Status'],
      scope: header['Scope'],
      governance: header['Governance'],
      body: body?.trim() || undefined,
      raw: header,
    });
  }
  return records;
}

export function loadAllComments(projectRoot) {
  const root = commentsRoot(projectRoot);
  if (!existsSync(root)) return [];
  const agents = readdirSync(root).filter((name) => {
    const p = join(root, name);
    try {
      return statSync(p).isDirectory();
    } catch {
      return false;
    }
  });
  const records = [];
  for (const agent of agents) {
    records.push(...readCommentsForAgent(root, agent, projectRoot));
  }
  return records;
}

function asArray(value) {
  if (value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function matchesFilter(record, filter) {
  if (!filter) return true;
  if (filter.author && !asArray(filter.author).includes(record.author)) return false;
  if (filter.category && !asArray(filter.category).includes(record.category)) return false;
  if (filter.status && !asArray(filter.status).includes(record.status)) return false;
  if (filter.threadId && record.threadId !== filter.threadId) return false;
  if (filter.addressesIncludes) {
    const a = record.addresses ?? '';
    if (!a.includes(filter.addressesIncludes)) return false;
  }
  return true;
}

// =============================================================================
// T-019 — write actions (POSTING_GUIDE-conformant create/reply), per-agent
// unread state, change feed
// =============================================================================

const ALLOWED_CATEGORIES = ['REVIEW', 'STRATEGY', 'GAP', 'SCHEMA', 'HANDOFF', 'MATRIX'];

function actionResult(ok, payload) {
  return { ok, ...payload };
}

function atomicWriteFile(targetPath, content) {
  const dir = dirname(targetPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmpName = `.${basename(targetPath)}.${randomBytes(6).toString('hex')}.tmp`;
  const tmpPath = join(dir, tmpName);
  writeFileSync(tmpPath, content, 'utf-8');
  renameSync(tmpPath, targetPath);
}

function utcStamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}Z`;
}

function utcIso(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}Z`;
}

function kebabSubject(subject) {
  return String(subject)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function isValidAgentName(name) {
  return /^[a-z0-9_][a-z0-9_-]*$/i.test(String(name));
}

// Action: create-post. Enforces POSTING_GUIDE filename pattern + required
// frontmatter (Author, Date, Status). Returns the created CommentRecord
// shape on success.
export function createPost(projectRoot, { author, category, subject, body, addresses, status, dateOverride, timestampOverride }) {
  if (!isValidAgentName(author)) return actionResult(false, { error: `invalid author: ${author}` });
  if (!ALLOWED_CATEGORIES.includes(category)) {
    return actionResult(false, { error: `invalid category: ${category} (allowed: ${ALLOWED_CATEGORIES.join(', ')})` });
  }
  if (!subject || !String(subject).trim()) return actionResult(false, { error: 'subject required' });
  const stamp = timestampOverride || utcStamp();
  const slug = kebabSubject(subject);
  if (!slug) return actionResult(false, { error: 'subject produces empty slug' });
  const filename = `${stamp}_${category}_${slug}.md`;
  const dir = join(commentsRoot(projectRoot), author);
  const path = join(dir, filename);
  if (existsSync(path)) return actionResult(false, { error: `post already exists at ${relative(projectRoot, path)}` });
  const date = dateOverride || utcIso();
  const headerLines = [
    `# ${category}: ${subject}`,
    '',
    `**Author**: ${author}`,
    `**Date**: ${date}`,
    addresses ? `**Addresses**: ${addresses}` : null,
    `**Status**: ${status || 'Draft'}`,
    '',
  ].filter((l) => l !== null);
  const fullBody = body ? `${body.replace(/\s+$/, '')}\n` : '';
  const content = `${headerLines.join('\n')}\n${fullBody}`;
  try {
    atomicWriteFile(path, content);
  } catch (err) {
    return actionResult(false, { error: `write failed: ${err.message}` });
  }
  return actionResult(true, {
    id: `${author}/${filename.replace(/\.md$/i, '')}`,
    author,
    category,
    subject,
    filename,
    sourcePath: relative(projectRoot, path),
    date,
  });
}

// Action: create-reply. Derives Addresses from the parent comment's source
// path so the thread linkage is recoverable.
export function createReply(projectRoot, parentId, { author, body, category, subject, status }) {
  const all = loadAllComments(projectRoot);
  const parent = all.find((r) => r.id === parentId);
  if (!parent) return actionResult(false, { error: `parent comment not found: ${parentId}` });
  const replyCategory = category || 'REVIEW';
  const replySubject = subject || `re: ${parent.subject || parent.filename}`;
  return createPost(projectRoot, {
    author,
    category: replyCategory,
    subject: replySubject,
    body,
    addresses: parent.sourcePath,
    status: status || 'Draft',
  });
}

// =============================================================================
// Per-agent unread state
// =============================================================================
//
// Persistence: .ai-workspace/runtime/oddboard/unread-<agent>.json
// Shape: { unread_ids: string[], last_updated: iso }
//
// "unread" is a positive set: a comment id appears in unread_ids until the
// agent explicitly mark-reads it. New comments arriving (visible only via
// the surface) are not auto-flagged unread for an agent that hasn't seen
// them yet — that policy is T-NNN follow-up. For now, mark-read is the
// only path that removes an id from the set; mark-unread adds.

function unreadStateRoot(projectRoot) {
  return resolve(projectRoot, '.ai-workspace/runtime/oddboard');
}

function unreadStatePath(projectRoot, agent) {
  return join(unreadStateRoot(projectRoot), `unread-${agent}.json`);
}

function loadUnreadState(projectRoot, agent) {
  const path = unreadStatePath(projectRoot, agent);
  if (!existsSync(path)) return { unread_ids: [], last_updated: null };
  try {
    const raw = readFileSync(path, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      unread_ids: Array.isArray(parsed.unread_ids) ? parsed.unread_ids.map(String) : [],
      last_updated: parsed.last_updated ?? null,
    };
  } catch {
    return { unread_ids: [], last_updated: null };
  }
}

function saveUnreadState(projectRoot, agent, state) {
  const path = unreadStatePath(projectRoot, agent);
  const content = JSON.stringify({
    unread_ids: state.unread_ids,
    last_updated: utcIso(),
  }, null, 2);
  atomicWriteFile(path, content);
}

export function markRead(projectRoot, agent, commentId) {
  if (!isValidAgentName(agent)) return actionResult(false, { error: `invalid agent: ${agent}` });
  const state = loadUnreadState(projectRoot, agent);
  if (!state.unread_ids.includes(commentId)) {
    return actionResult(true, { agent, commentId, alreadyRead: true });
  }
  state.unread_ids = state.unread_ids.filter((id) => id !== commentId);
  try {
    saveUnreadState(projectRoot, agent, state);
  } catch (err) {
    return actionResult(false, { error: `write failed: ${err.message}` });
  }
  return actionResult(true, { agent, commentId, alreadyRead: false });
}

export function markUnread(projectRoot, agent, commentId) {
  if (!isValidAgentName(agent)) return actionResult(false, { error: `invalid agent: ${agent}` });
  const state = loadUnreadState(projectRoot, agent);
  if (state.unread_ids.includes(commentId)) {
    return actionResult(true, { agent, commentId, alreadyUnread: true });
  }
  state.unread_ids.push(commentId);
  try {
    saveUnreadState(projectRoot, agent, state);
  } catch (err) {
    return actionResult(false, { error: `write failed: ${err.message}` });
  }
  return actionResult(true, { agent, commentId, alreadyUnread: false });
}

export function getUnreadIds(projectRoot, agent) {
  return loadUnreadState(projectRoot, agent).unread_ids;
}

// =============================================================================
// Change feed (polling-based, mirrors the ticket surface pattern)
// =============================================================================

function snapshotById(records) {
  const map = new Map();
  for (const r of records) {
    map.set(r.id, `${r.sourcePath}|${r.status ?? ''}|${r.date ?? ''}`);
  }
  return map;
}

function diffSnapshots(prev, next) {
  const events = [];
  for (const [id, sig] of next.entries()) {
    if (!prev.has(id)) events.push({ kind: 'created', id });
    else if (prev.get(id) !== sig) events.push({ kind: 'updated', id });
  }
  for (const id of prev.keys()) {
    if (!next.has(id)) events.push({ kind: 'deleted', id });
  }
  return events;
}

export function createCommentSurface(projectRoot, options = {}) {
  const pollIntervalMs = options.pollIntervalMs ?? 1000;
  let cache = null;
  let snapshot = null;
  let listeners = new Set();
  let pollTimer = null;

  function ensure() {
    if (cache === null) {
      cache = loadAllComments(projectRoot);
      snapshot = snapshotById(cache);
    }
    return cache;
  }

  function pollOnce() {
    const fresh = loadAllComments(projectRoot);
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
          /* ignored */
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

    // Write actions
    createPost(input) {
      const result = createPost(projectRoot, input);
      if (result.ok) this.invalidate();
      return result;
    },
    createReply(parentId, input) {
      const result = createReply(projectRoot, parentId, input);
      if (result.ok) this.invalidate();
      return result;
    },

    // Per-agent unread state
    markRead(agent, commentId) { return markRead(projectRoot, agent, commentId); },
    markUnread(agent, commentId) { return markUnread(projectRoot, agent, commentId); },
    getUnreadIds(agent) { return getUnreadIds(projectRoot, agent); },

    // Change feed
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
