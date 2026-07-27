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

import { readdirSync, readFileSync, statSync, existsSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
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

const STRING_ARRAY_FIELDS = new Set([
  'dependencies',
  'evaluation_criteria',
  'proof_surface',
  'non_closure_conditions',
  'links',
]);
const GOVERNANCE_EXPANSION_FIELD = 'governance_scope_expansion';
const GOVERNANCE_EXPANSION_SHORTHAND = Object.freeze({
  S: 'SPEC_METHOD.md',
  T: 'TICKET_METHOD.md',
  D: 'DESIGN_MODULE_METHOD.md',
  O: 'ODD_METHOD.md',
  U: 'UX_METHOD.md',
});
const COLLECTION_FIELDS = new Set([
  ...STRING_ARRAY_FIELDS,
  GOVERNANCE_EXPANSION_FIELD,
]);

const TICKET_OPTIONAL_SCALAR_FIELDS = [
  'ticketCategory',
  'goal',
  'changeIntent',
  'changeClass',
  'reEntryPoint',
  'triagedAt',
  'createdAt',
  'updatedAt',
  'priority',
  'intakeSource',
  'affectedBoundary',
  'buildTenant',
  'sourceTicket',
  'governanceScope',
  'targetTruth',
  'supersededTruth',
  'closureLaw',
  'migrationStrategy',
  'libraryUsage',
  'governingLibrary',
  'libraryRationale',
  'body',
];

const TICKET_OPTIONAL_STRING_ARRAY_FIELDS = [
  'dependencies',
  'links',
  'evaluationCriteria',
  'proofSurface',
  'nonClosureConditions',
];

const MUTABLE_SCALAR_FIELDS = new Set([
  'priority',
  'build_tenant',
  'source_ticket',
  'ticket_category',
  'goal',
  'updated_at',
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
function unquoteScalar(value) {
  return value.replace(/^"(.*)"$/, '$1').replace(/^'(.*)'$/, '$1');
}

function parseBlockScalarIndicator(value, label) {
  const match = value.match(/^([>|])([-+]?)$/);
  if (match) return { style: match[1], chomp: match[2] };
  if (value.startsWith('>') || value.startsWith('|')) {
    throw new Error(`${label} has an unsupported block scalar indicator: ${value}`);
  }
  return null;
}

function lineIndent(line, label) {
  const prefix = line.match(/^[ \t]*/)?.[0] ?? '';
  if (prefix.includes('\t')) {
    throw new Error(`${label} has malformed tab indentation`);
  }
  return prefix.length;
}

function renderLiteralBlock(lines, hasTerminalLineBreak) {
  if (lines.length === 0) return '';
  return `${lines.map((line) => line.text).join('\n')}${hasTerminalLineBreak ? '\n' : ''}`;
}

function renderFoldedBlock(lines, hasTerminalLineBreak) {
  if (lines.length === 0) return '';
  let rendered = '';
  let index = 0;
  while (index < lines.length && lines[index].text === '') {
    if (index < lines.length - 1 || hasTerminalLineBreak) rendered += '\n';
    index++;
  }
  while (index < lines.length) {
    const current = lines[index];
    rendered += current.text;
    let nextIndex = index + 1;
    while (nextIndex < lines.length && lines[nextIndex].text === '') nextIndex++;
    const blankCount = nextIndex - index - 1;
    if (nextIndex >= lines.length) {
      rendered += '\n'.repeat(blankCount + (hasTerminalLineBreak ? 1 : 0));
      break;
    }
    if (blankCount > 0) {
      const preservesPhysicalBreak = current.moreIndented || lines[nextIndex].moreIndented;
      rendered += '\n'.repeat(blankCount + (preservesPhysicalBreak ? 1 : 0));
    } else {
      rendered += current.moreIndented || lines[nextIndex].moreIndented ? '\n' : ' ';
    }
    index = nextIndex;
  }
  return rendered;
}

function chompBlockScalar(rendered, chomp, hasTerminalLineBreak) {
  if (chomp === '+') return rendered;
  const stripped = rendered.replace(/\n+$/, '');
  if (chomp === '-') return stripped;
  return stripped === '' || !hasTerminalLineBreak ? stripped : `${stripped}\n`;
}

function parseBlockScalar(
  lines,
  startIndex,
  parentIndent,
  indicator,
  label,
  isBoundary,
  sourceHasTerminalLineBreak = true,
) {
  const content = [];
  const leadingBlanks = [];
  let contentIndent = null;
  let index = startIndex;
  while (index < lines.length) {
    const line = lines[index];
    const indent = lineIndent(line, label);
    if (line.trim() === '') {
      if (contentIndent === null) {
        leadingBlanks.push({ indent });
      } else {
        content.push({
          text: indent > contentIndent ? line.slice(contentIndent) : '',
          moreIndented: indent > contentIndent,
        });
      }
      index++;
      continue;
    }
    if (indent <= parentIndent) {
      if (isBoundary(line, indent)) break;
      throw new Error(
        `${label} has malformed indentation: unindented content is not a metadata boundary`,
      );
    }
    if (contentIndent === null) {
      contentIndent = indent;
      for (const blank of leadingBlanks) {
        if (blank.indent > contentIndent) {
          throw new Error(
            `${label} has malformed indentation: a leading blank line is more indented than its content`,
          );
        }
        content.push({ text: '', moreIndented: false });
      }
    }
    if (indent < contentIndent) {
      throw new Error(
        `${label} has malformed indentation: expected at least ${contentIndent} spaces, received ${indent}`,
      );
    }
    content.push({
      text: line.slice(contentIndent),
      moreIndented: indent > contentIndent,
    });
    index++;
  }
  if (contentIndent === null) {
    content.push(...leadingBlanks.map(() => ({ text: '', moreIndented: false })));
  }
  const hasTerminalLineBreak = index < lines.length || sourceHasTerminalLineBreak;
  const rendered = indicator.style === '|'
    ? renderLiteralBlock(content, hasTerminalLineBreak)
    : renderFoldedBlock(content, hasTerminalLineBreak);
  return {
    value: chompBlockScalar(rendered, indicator.chomp, hasTerminalLineBreak),
    nextIndex: index,
  };
}

function parseCollectionItem(key, itemBody) {
  const cleaned = unquoteScalar(itemBody.trim());
  if (key !== GOVERNANCE_EXPANSION_FIELD) return cleaned;
  const inlineMap = cleaned.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
  if (inlineMap) {
    return { [inlineMap[1]]: unquoteScalar(inlineMap[2].trim()) };
  }
  if (Object.hasOwn(GOVERNANCE_EXPANSION_SHORTHAND, cleaned)) {
    return { [cleaned]: GOVERNANCE_EXPANSION_SHORTHAND[cleaned] };
  }
  throw new Error(`unsupported governance_scope_expansion shorthand: ${cleaned}`);
}

function parseInlineCollection(key, value) {
  if (!value.startsWith('[') || !value.endsWith(']')) return value;
  const inner = value.slice(1, -1).trim();
  return inner === ''
    ? []
    : inner.split(',').map((entry) => parseCollectionItem(key, entry));
}

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
    const blockIndicator = parseBlockScalarIndicator(valueRest, `frontmatter.${key}`);
    if (blockIndicator) {
      const parsedBlock = parseBlockScalar(
        lines,
        i + 1,
        0,
        blockIndicator,
        `frontmatter.${key}`,
        (next, indent) => indent === 0 && /^[A-Za-z0-9_]+:\s*.*$/.test(next),
      );
      frontmatter[key] = parsedBlock.value;
      i = parsedBlock.nextIndex;
      continue;
    }
    if (valueRest === '') {
      // List or map follows — collect indented lines starting with "- ".
      const items = [];
      i++;
      while (i < lines.length) {
        const next = lines[i];
        if (next.trim() === '') { i++; continue; }
        const itemMatch = next.match(/^([ ]+)-\s+(.*)$/);
        if (!itemMatch) break;
        const itemIndicator = parseBlockScalarIndicator(
          itemMatch[2].trim(),
          `frontmatter.${key}[${items.length}]`,
        );
        if (itemIndicator) {
          const parsedBlock = parseBlockScalar(
            lines,
            i + 1,
            itemMatch[1].length,
            itemIndicator,
            `frontmatter.${key}[${items.length}]`,
            (candidate, indent) => (
              (indent === itemMatch[1].length && /^[ ]+-\s+.*$/.test(candidate))
              || (indent === 0 && /^[A-Za-z0-9_]+:\s*.*$/.test(candidate))
            ),
          );
          items.push(parsedBlock.value);
          i = parsedBlock.nextIndex;
        } else {
          items.push(parseCollectionItem(key, itemMatch[2]));
          i++;
        }
      }
      frontmatter[key] = COLLECTION_FIELDS.has(key) || items.length > 0 ? items : '';
    } else {
      // Scalar value — strip surrounding quotes if present.
      const cleaned = unquoteScalar(valueRest);
      frontmatter[key] = COLLECTION_FIELDS.has(key)
        ? parseInlineCollection(key, cleaned)
        : cleaned;
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
  const sourceHasTerminalLineBreak = /\r?\n$/.test(raw);
  const lines = raw.split(/\r?\n/);
  // String splitting manufactures one empty sentinel for the terminal line
  // break. It is not a YAML blank content line; remove exactly that sentinel
  // while retaining every real trailing blank line before it.
  if (lines.at(-1) === '') lines.pop();
  // Markdown preambles are permitted before the sparse record. Anchor parsing
  // at the canonical ticket identity, then consume only its contiguous
  // metadata region so later Markdown bullets cannot masquerade as fields.
  const metadataStart = lines.findIndex((line) => {
    const identity = line.match(/^-\s+id:\s*(.+)$/);
    return identity && unquoteScalar(identity[1].trim()) === headerMatch[1];
  });
  if (metadataStart < 0) return null;
  let i = metadataStart;
  while (i < lines.length) {
    if (lines[i].trim() === '') {
      i++;
      continue;
    }
    const m = lines[i].match(/^-\s+([A-Za-z0-9_]+):\s*(.*)$/);
    if (!m) break;
    i++;
    const key = m[1];
    const scalarSource = m[2].trim();
    const blockIndicator = parseBlockScalarIndicator(scalarSource, `sparse.${key}`);
    if (blockIndicator) {
      const parsedBlock = parseBlockScalar(
        lines,
        i,
        0,
        blockIndicator,
        `sparse.${key}`,
        (next, indent) => indent === 0 && (
          /^-\s+[A-Za-z0-9_]+:\s*.*$/.test(next)
          || /^#{1,6}\s+\S/.test(next)
        ),
        sourceHasTerminalLineBreak,
      );
      fm[key] = parsedBlock.value;
      i = parsedBlock.nextIndex;
      continue;
    }
    const scalar = unquoteScalar(scalarSource);
    if (scalar !== '') {
      fm[key] = COLLECTION_FIELDS.has(key)
        ? parseInlineCollection(key, scalar)
        : scalar;
      continue;
    }
    const items = [];
    while (i < lines.length) {
      if (lines[i].trim() === '') {
        i++;
        continue;
      }
      const itemMatch = lines[i].match(/^([ ]+)-\s+(.*)$/);
      if (!itemMatch) break;
      const itemIndicator = parseBlockScalarIndicator(
        itemMatch[2].trim(),
        `sparse.${key}[${items.length}]`,
      );
      if (itemIndicator) {
        const parsedBlock = parseBlockScalar(
          lines,
          i + 1,
          itemMatch[1].length,
          itemIndicator,
          `sparse.${key}[${items.length}]`,
          (candidate, indent) => (
            (indent === itemMatch[1].length && /^[ ]+-\s+.*$/.test(candidate))
            || (indent === 0 && (
              /^-\s+[A-Za-z0-9_]+:\s*.*$/.test(candidate)
              || /^#{1,6}\s+\S/.test(candidate)
            ))
          ),
          sourceHasTerminalLineBreak,
        );
        items.push(parsedBlock.value);
        i = parsedBlock.nextIndex;
      } else {
        items.push(parseCollectionItem(key, itemMatch[2]));
        i++;
      }
    }
    fm[key] = COLLECTION_FIELDS.has(key) || items.length > 0 ? items : '';
  }
  if (!fm.id || (!fm.type && !fm.ticket_type)) return null;
  return { frontmatter: fm, body: raw };
}

function normalizeStringArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string') return value;
  if (value.trim() === '') return [];
  return [value];
}

function applyKeyMap(frontmatter) {
  if (
    Object.hasOwn(frontmatter, 'type')
    && Object.hasOwn(frontmatter, 'ticket_type')
  ) {
    throw new Error('ticket declares both type and legacy ticket_type');
  }
  const mapped = { raw: { ...frontmatter } };
  for (const [k, v] of Object.entries(frontmatter)) {
    const target = k === 'ticket_type' ? 'type' : FRONTMATTER_KEY_MAP[k] ?? k;
    mapped[target] = STRING_ARRAY_FIELDS.has(k) ? normalizeStringArray(v) : v;
  }
  return mapped;
}

function asProjectionRecord(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireProjectionString(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertOptionalProjectionString(value, label) {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`${label} must be a string when present`);
  }
}

function assertProjectionStringArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`);
  value.forEach((entry, index) => requireProjectionString(entry, `${label}[${index}]`));
}

function isBoundedRelativePath(value) {
  return (
    !value.startsWith('/')
    && !/^[A-Za-z]:[\\/]/.test(value)
    && !value.includes('\0')
    && !value.split(/[\\/]+/).some((segment) => segment === '.' || segment === '..')
  );
}

function assertTicketProjection(record, index) {
  const label = `tickets[${index}]`;
  const value = asProjectionRecord(record, label);
  requireProjectionString(value.id, `${label}.id`);
  if (!LANES.includes(value.lane)) throw new Error(`${label}.lane is unsupported`);
  const sourcePath = requireProjectionString(value.sourcePath, `${label}.sourcePath`);
  if (!isBoundedRelativePath(sourcePath)) {
    throw new Error(`${label}.sourcePath must be a bounded relative path`);
  }
  if (!sourcePath.startsWith(`.ai-workspace/tickets/${value.lane}/`)) {
    throw new Error(`${label}.sourcePath does not belong to its declared lane`);
  }
  requireProjectionString(value.title, `${label}.title`);
  requireProjectionString(value.type, `${label}.type`);
  requireProjectionString(value.status, `${label}.status`);
  asProjectionRecord(value.raw, `${label}.raw`);
  for (const field of TICKET_OPTIONAL_SCALAR_FIELDS) {
    assertOptionalProjectionString(value[field], `${label}.${field}`);
  }
  for (const field of TICKET_OPTIONAL_STRING_ARRAY_FIELDS) {
    if (value[field] !== undefined) {
      assertProjectionStringArray(value[field], `${label}.${field}`);
    }
  }
  if (value.governanceScopeExpansion !== undefined) {
    if (!Array.isArray(value.governanceScopeExpansion)) {
      throw new Error(`${label}.governanceScopeExpansion must be an array`);
    }
    value.governanceScopeExpansion.forEach((entry, entryIndex) => {
      const expansion = asProjectionRecord(
        entry,
        `${label}.governanceScopeExpansion[${entryIndex}]`,
      );
      for (const [key, method] of Object.entries(expansion)) {
        requireProjectionString(key, `${label}.governanceScopeExpansion[${entryIndex}] key`);
        requireProjectionString(
          method,
          `${label}.governanceScopeExpansion[${entryIndex}].${key}`,
        );
      }
    });
  }
}

function assertTicketCollectionProjection(records) {
  const ids = new Set();
  const sourcePaths = new Set();
  records.forEach((record, index) => {
    assertTicketProjection(record, index);
    if (ids.has(record.id)) {
      throw new Error(`tickets contains duplicate identity: ${record.id}`);
    }
    if (sourcePaths.has(record.sourcePath)) {
      throw new Error(`ticket source paths contains duplicate identity: ${record.sourcePath}`);
    }
    ids.add(record.id);
    sourcePaths.add(record.sourcePath);
  });
  return records;
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

function loadTicketRecords(projectRoot) {
  const records = [];
  for (const lane of LANES) {
    for (const { path } of readTicketFiles(projectRoot, lane)) {
      const record = parseTicketFile(path, lane, projectRoot);
      if (record) records.push(record);
    }
  }
  records.forEach(assertTicketProjection);
  return records;
}

export function loadAllTickets(projectRoot) {
  const records = loadTicketRecords(projectRoot);
  return assertTicketCollectionProjection(records);
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
  if (!MUTABLE_SCALAR_FIELDS.has(snakeKey)) {
    throw new Error(`field is not mutable through update_field: ${snakeKey}`);
  }
  if (!/^[A-Za-z0-9_]+$/.test(snakeKey)) {
    throw new Error(`invalid frontmatter key: ${snakeKey}`);
  }
  const scalarValue = String(newValue);
  if (/[\r\n\x00-\x08\x0b\x0c\x0e-\x1f]/.test(scalarValue)) {
    throw new Error(`invalid scalar value for ${snakeKey}: control characters and newlines are not allowed`);
  }
  const fmMatch = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) {
    throw new Error(`rewriteScalarFieldInRaw: no YAML frontmatter found`);
  }
  const head = fmMatch[1];
  const block = fmMatch[2];
  const tail = fmMatch[3];
  const escapedKey = snakeKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const lineRe = new RegExp(`^(${escapedKey}:\\s*).*$`, 'm');
  const newBlock = lineRe.test(block)
    ? block.replace(lineRe, `$1${scalarValue}`)
    : `${block}\n${snakeKey}: ${scalarValue}`;
  return raw.slice(0, fmMatch.index) + head + newBlock + tail + raw.slice(fmMatch.index + fmMatch[0].length);
}

function rewriteStatusFieldInRaw(raw, toLane) {
  const fmMatch = raw.match(/^(---\r?\n)([\s\S]*?)(\r?\n---)/);
  if (!fmMatch) {
    throw new Error(`rewriteStatusFieldInRaw: no YAML frontmatter found`);
  }
  const head = fmMatch[1];
  const block = fmMatch[2];
  const tail = fmMatch[3];
  const lineRe = /^(status:\s*).*$/m;
  const newBlock = lineRe.test(block)
    ? block.replace(lineRe, `$1${toLane}`)
    : `${block}\nstatus: ${toLane}`;
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

function actionResult(ok, payload) {
  return { ok, ...payload };
}

// Resolve exactly one ticket from a fresh, collection-valid read. Write
// actions fail before filesystem mutation when any producer, contract, or
// collection-identity check fails.
function resolveFreshTicket(projectRoot, id) {
  let records;
  try {
    records = loadAllTickets(projectRoot);
  } catch (err) {
    return actionResult(false, {
      error: `ticket collection rejected: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
  const matches = records.filter((record) => record.id === id);
  if (matches.length === 0) {
    return actionResult(false, { error: `ticket not found: ${id}` });
  }
  if (matches.length !== 1) {
    return actionResult(false, { error: `ticket identity is ambiguous: ${id}` });
  }
  return actionResult(true, { record: matches[0] });
}

// Action: transition-status. Moves the ticket between lanes and updates the
// status field in frontmatter. New lane is one of LANES.
export function transitionStatus(projectRoot, id, toLane) {
  if (!LANES.includes(toLane)) {
    return actionResult(false, { error: `invalid lane: ${toLane}` });
  }
  const resolved = resolveFreshTicket(projectRoot, id);
  if (!resolved.ok) return resolved;
  const { record } = resolved;
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
    updated = rewriteStatusFieldInRaw(raw, toLane);
  } catch (err) {
    return actionResult(false, { error: err.message });
  }
  try {
    if (existsSync(toPath)) {
      return actionResult(false, { error: `destination ticket already exists: ${relative(projectRoot, toPath)}` });
    }
    mkdirSync(dirname(toPath), { recursive: true });
    renameSync(fromPath, toPath);
    atomicWriteFile(toPath, updated);
  } catch (err) {
    return actionResult(false, { error: `move/update failed: ${err.message}` });
  }
  return actionResult(true, { id, fromLane: record.lane, toLane, sourcePath: relative(projectRoot, toPath) });
}

// Action: update-frontmatter-field. Generic single-scalar update.
export function updateFrontmatterField(projectRoot, id, snakeKey, newValue) {
  const resolved = resolveFreshTicket(projectRoot, id);
  if (!resolved.ok) return resolved;
  const { record } = resolved;
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
  const resolved = resolveFreshTicket(projectRoot, id);
  if (!resolved.ok) return resolved;
  const { record } = resolved;
  const existing = asArray(record.dependencies).map(String);
  if (existing.includes(dependencyEntry)) {
    return actionResult(false, { error: `dependency already present: ${dependencyEntry}` });
  }
  const path = ticketFileAbsolutePath(projectRoot, record.sourcePath);
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    return actionResult(false, {
      error: `read failed: ${err instanceof Error ? err.message : String(err)}`,
    });
  }
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
