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

import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { join, relative, resolve, basename } from 'node:path';

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

export function createCommentSurface(projectRoot) {
  let cache = null;
  function ensure() {
    if (cache === null) cache = loadAllComments(projectRoot);
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
