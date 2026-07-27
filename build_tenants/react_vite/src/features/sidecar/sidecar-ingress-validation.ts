import type { CommentRecord } from '../../contracts/comment';
import type { ProjectRecord } from '../../contracts/project';
import type {
  SessionContextSnapshot,
  SessionRecord,
  SessionSurfaceDiagnostic,
} from '../../contracts/session';
import type { TicketLane, TicketRecord } from '../../contracts/ticket';
import type { SurfaceData } from '../../lib/types';
import type { ContextRecord, SidecarFolderEntry } from './sidecar-state';

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} must be an array`);
  }
  return value;
}

function requiredString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function optionalString(value: unknown, label: string): void {
  if (value !== undefined && typeof value !== 'string') {
    throw new Error(`${label} must be a string when present`);
  }
}

function optionalNullableString(value: unknown, label: string): void {
  if (value !== undefined && value !== null && typeof value !== 'string') {
    throw new Error(`${label} must be a string or null when present`);
  }
}

function optionalBoolean(value: unknown, label: string): void {
  if (value !== undefined && typeof value !== 'boolean') {
    throw new Error(`${label} must be a boolean when present`);
  }
}

function stringArray(value: unknown, label: string): string[] {
  return asArray(value, label).map((entry, index) => requiredString(entry, `${label}[${index}]`));
}

function optionalStringArray(value: unknown, label: string): void {
  if (value !== undefined) stringArray(value, label);
}

function isAbsolutePath(value: string): boolean {
  return value.startsWith('/') || /^[A-Za-z]:[\\/]/.test(value);
}

function assertAbsolutePath(value: unknown, label: string): string {
  const path = requiredString(value, label);
  if (!isAbsolutePath(path)) {
    throw new Error(`${label} must be absolute`);
  }
  return path;
}

function assertRelativePath(value: unknown, label: string): string {
  const path = requiredString(value, label);
  if (
    isAbsolutePath(path)
    || path.includes('\0')
    || path.split(/[\\/]+/).some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(`${label} must be a bounded relative path`);
  }
  return path;
}

function pathIsWithin(root: string, candidate: string): boolean {
  const separator = root.includes('\\') ? '\\' : '/';
  const boundedRoot = root.length > 1 && root.endsWith(separator)
    ? root.slice(0, -1)
    : root;
  return candidate === boundedRoot
    || (boundedRoot === separator
      ? candidate.startsWith(separator)
      : candidate.startsWith(`${boundedRoot}${separator}`));
}

function assertUnique<T>(
  records: T[],
  key: (record: T) => string,
  label: string,
): void {
  const seen = new Set<string>();
  for (const record of records) {
    const identity = key(record);
    if (seen.has(identity)) {
      throw new Error(`${label} contains duplicate identity: ${identity}`);
    }
    seen.add(identity);
  }
}

function validateOptionalScalarFields(
  record: Record<string, unknown>,
  fields: readonly string[],
  label: string,
): void {
  for (const field of fields) optionalString(record[field], `${label}.${field}`);
}

function asProjectRecord(value: unknown, index: number): ProjectRecord {
  const label = `projects[${index}]`;
  const record = asRecord(value, label);
  requiredString(record.id, `${label}.id`);
  assertAbsolutePath(record.root, `${label}.root`);
  requiredString(record.odd_type, `${label}.odd_type`);
  if (typeof record.has_ai_workspace !== 'boolean' || typeof record.has_genesis !== 'boolean') {
    throw new Error(`${label} must declare boolean workspace and genesis observations`);
  }
  stringArray(record.installed_packages, `${label}.installed_packages`);
  stringArray(record.build_tenants, `${label}.build_tenants`);
  optionalString(record.name, `${label}.name`);
  if (
    record.registry_source !== undefined
    && record.registry_source !== 'registry'
    && record.registry_source !== 'discovery'
  ) {
    throw new Error(`${label}.registry_source is unsupported`);
  }
  optionalNullableString(record.registered_at, `${label}.registered_at`);
  optionalNullableString(record.updated_at, `${label}.updated_at`);
  optionalStringArray(record.tags, `${label}.tags`);
  optionalBoolean(record.is_active, `${label}.is_active`);
  return record as unknown as ProjectRecord;
}

export function asSidecarProjectCollection(value: unknown): ProjectRecord[] {
  const records = asArray(value, 'projects').map(asProjectRecord);
  assertUnique(records, (record) => record.id, 'projects');
  assertUnique(records, (record) => record.root, 'projects roots');
  if (records.filter((record) => record.is_active === true).length > 1) {
    throw new Error('projects contains more than one active Project');
  }
  return records;
}

export function asSidecarContextRecord(
  value: unknown,
  expectedProjectRoot: string | null,
): ContextRecord {
  const payload = asRecord(value, 'context');
  const project = asRecord(payload.project, 'context.project');
  const workspace = asRecord(payload.workspace, 'context.workspace');
  const projectRoot = assertAbsolutePath(project.root, 'context.project.root');
  if (expectedProjectRoot !== null && projectRoot !== expectedProjectRoot) {
    throw new Error(
      `context Project root mismatch: requested ${expectedProjectRoot}, received ${projectRoot}`,
    );
  }
  const context: ContextRecord = {
    project: {
      id: requiredString(project.id, 'context.project.id'),
      root: projectRoot,
      odd_type: requiredString(project.odd_type, 'context.project.odd_type'),
    },
    workspace: {
      id: requiredString(workspace.id, 'context.workspace.id'),
      profile: requiredString(workspace.profile, 'context.workspace.profile'),
    },
    session: null,
  };
  if (payload.session !== null && payload.session !== undefined) {
    const session = asRecord(payload.session, 'context.session');
    context.session = { id: requiredString(session.id, 'context.session.id') };
  }
  return context;
}

export function assertContextProjectInCollection(
  context: ContextRecord,
  projects: ProjectRecord[],
): void {
  const project = projects.find((candidate) => candidate.root === context.project.root);
  if (!project) {
    throw new Error(`projects has no Project at admitted Context root: ${context.project.root}`);
  }
  if (project.id !== context.project.id) {
    throw new Error(`projects disagrees with Context Project identity at ${context.project.root}`);
  }
  if (project.odd_type !== context.project.odd_type) {
    throw new Error(`projects disagrees with Context odd_type at ${context.project.root}`);
  }
}

const TICKET_LANES = new Set<TicketLane>(['active', 'backlog', 'completed']);
const TICKET_OPTIONAL_SCALARS = [
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
] as const;
const TICKET_OPTIONAL_ARRAYS = [
  'dependencies',
  'links',
  'evaluationCriteria',
  'proofSurface',
  'nonClosureConditions',
] as const;

function asTicketRecord(value: unknown, index: number): TicketRecord {
  const label = `tickets[${index}]`;
  const record = asRecord(value, label);
  requiredString(record.id, `${label}.id`);
  if (typeof record.lane !== 'string' || !TICKET_LANES.has(record.lane as TicketLane)) {
    throw new Error(`${label}.lane is unsupported`);
  }
  const sourcePath = assertRelativePath(record.sourcePath, `${label}.sourcePath`);
  if (!sourcePath.startsWith(`.ai-workspace/tickets/${record.lane}/`)) {
    throw new Error(`${label}.sourcePath does not belong to its declared lane`);
  }
  requiredString(record.title, `${label}.title`);
  requiredString(record.type, `${label}.type`);
  requiredString(record.status, `${label}.status`);
  asRecord(record.raw, `${label}.raw`);
  validateOptionalScalarFields(record, TICKET_OPTIONAL_SCALARS, label);
  for (const field of TICKET_OPTIONAL_ARRAYS) {
    optionalStringArray(record[field], `${label}.${field}`);
  }
  if (record.governanceScopeExpansion !== undefined) {
    asArray(record.governanceScopeExpansion, `${label}.governanceScopeExpansion`).forEach((entry, entryIndex) => {
      const expansion = asRecord(entry, `${label}.governanceScopeExpansion[${entryIndex}]`);
      for (const [key, method] of Object.entries(expansion)) {
        requiredString(key, `${label}.governanceScopeExpansion[${entryIndex}] key`);
        requiredString(method, `${label}.governanceScopeExpansion[${entryIndex}].${key}`);
      }
    });
  }
  return record as unknown as TicketRecord;
}

export function asSidecarTicketCollection(value: unknown): TicketRecord[] {
  const records = asArray(value, 'tickets').map(asTicketRecord);
  assertUnique(records, (record) => record.id, 'tickets');
  assertUnique(records, (record) => record.sourcePath, 'ticket source paths');
  return records;
}

const COMMENT_OPTIONAL_SCALARS = [
  'timestamp',
  'category',
  'subject',
  'threadId',
  'title',
  'date',
  'addresses',
  'status',
  'scope',
  'governance',
  'body',
] as const;

function asCommentRecord(value: unknown, index: number): CommentRecord {
  const label = `comments[${index}]`;
  const record = asRecord(value, label);
  const id = requiredString(record.id, `${label}.id`);
  const author = requiredString(record.author, `${label}.author`);
  const sourcePath = assertRelativePath(record.sourcePath, `${label}.sourcePath`);
  const filename = requiredString(record.filename, `${label}.filename`);
  if (!sourcePath.startsWith(`.ai-workspace/comments/${author}/`) || !sourcePath.endsWith(`/${filename}`)) {
    throw new Error(`${label}.sourcePath disagrees with its author or filename`);
  }
  const expectedId = `${author}/${filename.replace(/\.md$/i, '')}`;
  if (id !== expectedId) {
    throw new Error(`${label}.id disagrees with its author or filename`);
  }
  asRecord(record.raw, `${label}.raw`);
  validateOptionalScalarFields(record, COMMENT_OPTIONAL_SCALARS, label);
  return record as unknown as CommentRecord;
}

export function asSidecarCommentCollection(value: unknown): CommentRecord[] {
  const records = asArray(value, 'comments').map(asCommentRecord);
  assertUnique(records, (record) => record.id, 'comments');
  assertUnique(records, (record) => record.sourcePath, 'comment source paths');
  return records;
}

function asSessionContextSnapshot(value: unknown, label: string): SessionContextSnapshot {
  const context = asRecord(value, label);
  optionalString(context.project, `${label}.project`);
  optionalString(context.workspace, `${label}.workspace`);
  optionalString(context.odd_type, `${label}.odd_type`);
  return context as SessionContextSnapshot;
}

function asSessionRecord(value: unknown, label: string, projectRoot: string): SessionRecord {
  const record = asRecord(value, label);
  requiredString(record.id, `${label}.id`);
  requiredString(record.agent_type, `${label}.agent_type`);
  const cwd = assertAbsolutePath(record.cwd, `${label}.cwd`);
  if (!pathIsWithin(projectRoot, cwd)) {
    throw new Error(`${label}.cwd is outside admitted Project root`);
  }
  requiredString(record.status, `${label}.status`);
  optionalString(record.started_at, `${label}.started_at`);
  optionalNullableString(record.transcript_ref, `${label}.transcript_ref`);
  optionalNullableString(record.source_path, `${label}.source_path`);
  if (typeof record.transcript_ref === 'string') {
    assertRelativePath(record.transcript_ref, `${label}.transcript_ref`);
  }
  if (typeof record.source_path === 'string') {
    assertRelativePath(record.source_path, `${label}.source_path`);
  }
  if (record.context_at_spawn !== undefined) {
    asSessionContextSnapshot(record.context_at_spawn, `${label}.context_at_spawn`);
  }
  if (record.raw !== undefined) asRecord(record.raw, `${label}.raw`);
  return record as unknown as SessionRecord;
}

function asSessionDiagnostic(value: unknown): SessionSurfaceDiagnostic | null {
  if (value === null) return null;
  const diagnostic = asRecord(value, 'sessions.diagnostic');
  if (
    diagnostic.backplane !== 'registry'
    && diagnostic.backplane !== 'none'
    && diagnostic.backplane !== 'oddterm'
  ) {
    throw new Error('sessions.diagnostic.backplane is unsupported');
  }
  optionalString(diagnostic.registry_root, 'sessions.diagnostic.registry_root');
  optionalStringArray(diagnostic.notes, 'sessions.diagnostic.notes');
  if (diagnostic.runtime !== undefined) {
    asRecord(diagnostic.runtime, 'sessions.diagnostic.runtime');
  }
  return diagnostic as unknown as SessionSurfaceDiagnostic;
}

export function asSidecarSessionCollection(
  value: unknown,
  projectRoot: string,
): { records: SessionRecord[]; diagnostic: SessionSurfaceDiagnostic | null } {
  const payload = asRecord(value, 'sessions');
  const records = asArray(payload.records, 'sessions.records').map((entry, index) => (
    asSessionRecord(entry, `sessions.records[${index}]`, projectRoot)
  ));
  assertUnique(records, (record) => record.id, 'sessions');
  return {
    records,
    diagnostic: asSessionDiagnostic(payload.diagnostic),
  };
}

export function asSidecarUnreadIds(
  value: unknown,
  comments: CommentRecord[],
): string[] {
  const payload = asRecord(value, 'unread comments');
  const unreadIds = stringArray(payload.unread_ids, 'unread comments.unread_ids');
  assertUnique(unreadIds, (id) => id, 'unread comments');
  const admittedCommentIds = new Set(comments.map((comment) => comment.id));
  for (const id of unreadIds) {
    if (!admittedCommentIds.has(id)) {
      throw new Error(`unread comments references an unknown Comment: ${id}`);
    }
  }
  return unreadIds;
}

export function asSidecarSpawnResult(
  value: unknown,
  projectRoot: string,
  requestedCwd: string | null,
  existingSessionIds: readonly string[],
): SessionRecord {
  const result = asRecord(value, 'session spawn');
  if (result.ok !== true) {
    throw new Error(
      typeof result.error === 'string' && result.error.trim()
        ? result.error
        : 'session spawn did not return success',
    );
  }
  const { ok: _ok, error: _error, ...recordPayload } = result;
  const record = asSessionRecord(recordPayload, 'session spawn record', projectRoot);
  const expectedCwd = requestedCwd ?? projectRoot;
  if (record.cwd !== expectedCwd) {
    throw new Error(`session spawn cwd mismatch: requested ${expectedCwd}, received ${record.cwd}`);
  }
  if (existingSessionIds.includes(record.id)) {
    throw new Error(`session spawn reused existing Session identity: ${record.id}`);
  }
  return record;
}

function expectedChildPath(parent: string, childName: string): string {
  const separator = parent.includes('\\') ? '\\' : '/';
  const base = parent.length > 1 && parent.endsWith(separator) ? parent.slice(0, -1) : parent;
  return base === separator ? `${separator}${childName}` : `${base}${separator}${childName}`;
}

export function asSidecarSurfaceData(
  value: unknown,
  projectRoot: string,
  requestedRelativePath: string,
): SurfaceData {
  const requestedPath = assertRelativePath(requestedRelativePath, 'surface requested relative path');
  const payload = asRecord(value, 'surface');
  if (
    payload.kind !== 'file'
    && payload.kind !== 'directory'
    && payload.kind !== 'missing'
    && payload.kind !== 'unreadable'
  ) {
    throw new Error('surface.kind is unsupported');
  }
  const relativePath = assertRelativePath(payload.relative_path, 'surface.relative_path');
  if (relativePath !== requestedPath) {
    throw new Error(`surface relative path mismatch: requested ${requestedPath}, received ${relativePath}`);
  }
  const absolutePath = assertAbsolutePath(payload.path, 'surface.path');
  const expectedPath = expectedChildPath(projectRoot, requestedPath.replace(/[\\/]+/g, '/'));
  if (!pathIsWithin(projectRoot, absolutePath) || absolutePath !== expectedPath) {
    throw new Error('surface.path does not identify the requested Project surface');
  }

  if (payload.kind === 'file') {
    if (typeof payload.content !== 'string') throw new Error('surface.content must be a string');
    optionalString(payload.media_type, 'surface.media_type');
    if (payload.encoding !== undefined && payload.encoding !== 'utf8' && payload.encoding !== 'binary') {
      throw new Error('surface.encoding is unsupported');
    }
    if (
      payload.size_bytes !== undefined
      && (typeof payload.size_bytes !== 'number' || !Number.isSafeInteger(payload.size_bytes) || payload.size_bytes < 0)
    ) {
      throw new Error('surface.size_bytes must be a non-negative safe integer');
    }
  } else if (payload.kind === 'directory') {
    if (typeof payload.truncated !== 'boolean') throw new Error('surface.truncated must be a boolean');
    const entries = asArray(payload.entries, 'surface.entries').map((entry, index) => {
      const label = `surface.entries[${index}]`;
      const record = asRecord(entry, label);
      const name = requiredString(record.name, `${label}.name`);
      if (name === '.' || name === '..' || /[\\/]/.test(name)) {
        throw new Error(`${label}.name must identify one immediate child`);
      }
      if (record.kind !== 'file' && record.kind !== 'directory') {
        throw new Error(`${label}.kind is unsupported`);
      }
      const entryPath = assertRelativePath(record.relative_path, `${label}.relative_path`);
      const expectedRelativePath = `${requestedPath.replace(/[\\/]+$/g, '')}/${name}`;
      if (entryPath !== expectedRelativePath) {
        throw new Error(`${label}.relative_path does not identify the requested directory child`);
      }
      return record as unknown as { name: string; kind: 'file' | 'directory'; relative_path: string };
    });
    assertUnique(entries, (entry) => entry.name, 'surface entries');
    assertUnique(entries, (entry) => entry.relative_path, 'surface entry paths');
  } else if (payload.kind === 'unreadable') {
    if (
      payload.reason !== 'permission_denied'
      && payload.reason !== 'outside_workspace'
      && payload.reason !== 'read_error'
    ) {
      throw new Error('surface.reason is unsupported');
    }
    requiredString(payload.error, 'surface.error');
  }
  return payload as unknown as SurfaceData;
}

export interface SidecarFolderResponse {
  path: string;
  entries: SidecarFolderEntry[];
  truncated: boolean;
  state: 'present' | 'missing' | 'not_directory';
}

export function asSidecarFolderResponse(
  value: unknown,
  projectRoot: string,
  requestedPath: string,
): SidecarFolderResponse {
  const boundedRoot = assertAbsolutePath(projectRoot, 'folder Project root');
  const boundedRequest = assertAbsolutePath(requestedPath, 'folder requested path');
  if (!pathIsWithin(boundedRoot, boundedRequest)) {
    throw new Error('folder requested path is outside admitted Project root');
  }
  const payload = asRecord(value, 'folder');
  const returnedPath = assertAbsolutePath(payload.path, 'folder.path');
  if (returnedPath !== boundedRequest) {
    throw new Error(`folder path mismatch: requested ${boundedRequest}, received ${returnedPath}`);
  }
  if (payload.state !== 'present' && payload.state !== 'missing' && payload.state !== 'not_directory') {
    throw new Error('folder.state is unsupported');
  }
  if (typeof payload.truncated !== 'boolean') {
    throw new Error('folder.truncated must be a boolean');
  }
  const entries = asArray(payload.entries, 'folder.entries').map((entry, index) => {
    const label = `folder.entries[${index}]`;
    const record = asRecord(entry, label);
    const name = requiredString(record.name, `${label}.name`);
    if (name === '.' || name === '..' || /[\\/]/.test(name)) {
      throw new Error(`${label}.name must identify one immediate child`);
    }
    const absolutePath = assertAbsolutePath(record.absolutePath, `${label}.absolutePath`);
    if (
      absolutePath !== expectedChildPath(boundedRequest, name)
      || !pathIsWithin(boundedRoot, absolutePath)
    ) {
      throw new Error(`${label}.absolutePath is not the requested Project folder child`);
    }
    if (record.kind !== 'directory' && record.kind !== 'file') {
      throw new Error(`${label}.kind is unsupported`);
    }
    const kind: 'directory' | 'file' = record.kind;
    optionalString(record.updatedAt, `${label}.updatedAt`);
    optionalBoolean(record.hasWorkspace, `${label}.hasWorkspace`);
    optionalStringArray(record.markers, `${label}.markers`);
    return {
      name,
      absolutePath,
      kind,
      updatedAt: record.updatedAt as string | undefined,
      hasWorkspace: record.hasWorkspace as boolean | undefined,
      markers: record.markers as string[] | undefined,
    };
  });
  if (payload.state !== 'present' && entries.length > 0) {
    throw new Error(`folder.${payload.state} response cannot contain entries`);
  }
  assertUnique(entries, (entry) => entry.name, 'folder entries');
  assertUnique(entries, (entry) => entry.absolutePath, 'folder entry paths');
  return {
    path: returnedPath,
    entries,
    truncated: payload.truncated,
    state: payload.state,
  };
}
