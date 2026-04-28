// odd_manager data MCP server — publishes the four AssetSurfaces as MCP
// resources and write actions as MCP tools. Closes T-011.
//
// Composition with the existing IRC MCP:
//   runtime/odd_manager_irc_mcp.mjs   — messaging / OddChat rooms (T-008 era)
//   runtime/odd_manager_data_mcp.mjs  — workspace data surfaces (this file)
//
// Both speak JSON-RPC over stdio per the MCP framing protocol; both can be
// mounted concurrently as separate MCP servers in a coding-agent client
// (Claude Code, Codex, etc.). Author-as-agent identity is derived from the
// MCP client's session label when present (env: OMAN_SESSION_LABEL or
// OMAN_AGENT_PROVIDER), falling back to the configurable VIEWER_AGENT.
//
// Resources:
//   tickets://                         — list of TicketRecord
//   tickets://<id>                     — one TicketRecord
//   comments://                        — list of CommentRecord
//   comments://<id>                    — one CommentRecord
//   sessions://                        — { records, diagnostic }
//   projects://                        — list of ProjectRecord
//   active_context://current           — current Context (operator-defined initially)
//
// Tools:
//   tickets_transition_status         — { id, to_lane }
//   tickets_link_dependency           — { id, dependency_entry }
//   tickets_assign_build_tenant       — { id, tenant }
//   tickets_update_field              — { id, snake_key, value }
//   comments_create_post              — { category, subject, body, addresses?, status? }
//   comments_create_reply             — { parent_id, body, category?, subject? }
//   comments_mark_read                — { agent, comment_id }
//   comments_mark_unread              — { agent, comment_id }
//   query_unread_for_agent            — { agent }
//
// Out of scope:
//   - session spawn / attach (T-020 / T-021)
//   - real change-feed subscription via MCP notifications (could land later
//     once the wave needs streaming; for now consumers re-read on demand)

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createTicketSurface } from '../src/server/ticket-asset-surface-service.mjs';
import { createCommentSurface } from '../src/server/comment-asset-surface-service.mjs';
import { createSessionSurface } from '../src/server/session-asset-surface-service.mjs';
import { createProjectSurface } from '../src/server/project-asset-surface-service.mjs';
import { rehydrateSessions } from '../src/server/session-pty-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(process.env.OMAN_WORKSPACE_ROOT || resolve(here, '..', '..', '..'));
const managerWorkspaceRoot = resolve(here, '..', '..', '..');
const REGISTRY_ROOT = process.env.PROJECT_REGISTRY_ROOT ?? '/Users/jim/src/apps';
const VIEWER_AGENT = process.env.OMAN_AGENT_PROVIDER ?? process.env.OMAN_SESSION_LABEL ?? 'operator';

const ticketSurface = createTicketSurface(projectRoot);
const commentSurface = createCommentSurface(projectRoot);
rehydrateSessions(projectRoot);
const sessionSurface = createSessionSurface(projectRoot);
const projectSurface = createProjectSurface(managerWorkspaceRoot, { discoveryRoot: REGISTRY_ROOT });

// =============================================================================
// Tool registry
// =============================================================================

const TOOLS = [
  {
    name: 'tickets_transition_status',
    description: 'Move a ticket between active / backlog / completed, atomically updating its frontmatter status.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        to_lane: { type: 'string', enum: ['active', 'backlog', 'completed'] },
      },
      required: ['id', 'to_lane'],
      additionalProperties: false,
    },
    handler: ({ id, to_lane }) => ticketSurface.transitionStatus(id, to_lane),
  },
  {
    name: 'tickets_link_dependency',
    description: 'Append a dependency entry to a ticket\'s dependencies list.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        dependency_entry: { type: 'string' },
      },
      required: ['id', 'dependency_entry'],
      additionalProperties: false,
    },
    handler: ({ id, dependency_entry }) => ticketSurface.linkDependency(id, dependency_entry),
  },
  {
    name: 'tickets_assign_build_tenant',
    description: 'Set a ticket\'s build_tenant frontmatter field.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        tenant: { type: 'string' },
      },
      required: ['id', 'tenant'],
      additionalProperties: false,
    },
    handler: ({ id, tenant }) => ticketSurface.assignBuildTenant(id, tenant),
  },
  {
    name: 'tickets_update_field',
    description: 'Update a single scalar frontmatter field on a ticket. Use snake_case key as it appears in the file.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string' },
        snake_key: { type: 'string' },
        value: { type: 'string' },
      },
      required: ['id', 'snake_key', 'value'],
      additionalProperties: false,
    },
    handler: ({ id, snake_key, value }) => ticketSurface.updateFrontmatterField(id, snake_key, value),
  },
  {
    name: 'comments_create_post',
    description: 'Create a new comment under .ai-workspace/comments/<server-derived-author>/ following POSTING_GUIDE filename and frontmatter rules.',
    inputSchema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['REVIEW', 'STRATEGY', 'GAP', 'SCHEMA', 'HANDOFF', 'MATRIX'] },
        subject: { type: 'string' },
        body: { type: 'string' },
        addresses: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['category', 'subject'],
      additionalProperties: false,
    },
    handler: ({ category, subject, body, addresses, status }) => commentSurface.createPost({
      author: VIEWER_AGENT,
      category,
      subject,
      body,
      addresses,
      status,
    }),
  },
  {
    name: 'comments_create_reply',
    description: 'Create a reply to a comment using the server-derived author. Addresses field is auto-derived from the parent\'s source path.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string' },
        body: { type: 'string' },
        category: { type: 'string' },
        subject: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['parent_id', 'body'],
      additionalProperties: false,
    },
    handler: ({ parent_id, body, category, subject, status }) => commentSurface.createReply(parent_id, {
      author: VIEWER_AGENT,
      body,
      category,
      subject,
      status,
    }),
  },
  {
    name: 'comments_mark_read',
    description: 'Remove a comment from an agent\'s unread set.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string' },
        comment_id: { type: 'string' },
      },
      required: ['agent', 'comment_id'],
      additionalProperties: false,
    },
    handler: ({ agent, comment_id }) => commentSurface.markRead(agent, comment_id),
  },
  {
    name: 'comments_mark_unread',
    description: 'Add a comment to an agent\'s unread set.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string' },
        comment_id: { type: 'string' },
      },
      required: ['agent', 'comment_id'],
      additionalProperties: false,
    },
    handler: ({ agent, comment_id }) => commentSurface.markUnread(agent, comment_id),
  },
  {
    name: 'query_unread_for_agent',
    description: 'Return the list of comment ids currently in an agent\'s unread set.',
    inputSchema: {
      type: 'object',
      properties: {
        agent: { type: 'string' },
      },
      required: ['agent'],
      additionalProperties: false,
    },
    handler: ({ agent }) => ({ ok: true, agent, unread_ids: commentSurface.getUnreadIds(agent) }),
  },
];

// =============================================================================
// Resource registry
// =============================================================================

const RESOURCES = [
  { uri: 'tickets://', mimeType: 'application/json', name: 'All tickets', description: 'TicketRecord[] across all lanes' },
  { uri: 'comments://', mimeType: 'application/json', name: 'All comments', description: 'CommentRecord[] across all agent directories' },
  { uri: 'sessions://', mimeType: 'application/json', name: 'All sessions', description: '{ records: SessionRecord[], diagnostic }' },
  { uri: 'projects://', mimeType: 'application/json', name: 'All projects', description: 'ProjectRecord[] maintained in the manager workspace registry' },
  { uri: 'active_context://current', mimeType: 'application/json', name: 'Active context', description: 'Current Context (Project x Workspace) for this MCP session' },
];

const ACTIVE_CONTEXT = {
  project: { id: 'odd_manager', root: projectRoot, odd_type: 'odd_sdlc' },
  workspace: { id: 'react_vite', profile: 'odd_sdlc' },
  session: null,
};

function readResource(uri) {
  if (uri === 'tickets://') return ticketSurface.list();
  if (uri.startsWith('tickets://')) {
    const id = decodeURIComponent(uri.slice('tickets://'.length));
    return ticketSurface.get(id) ?? null;
  }
  if (uri === 'comments://') return commentSurface.list();
  if (uri.startsWith('comments://')) {
    const id = decodeURIComponent(uri.slice('comments://'.length));
    return commentSurface.get(id) ?? null;
  }
  if (uri === 'sessions://') {
    return { records: sessionSurface.list(), diagnostic: sessionSurface.diagnostic() };
  }
  if (uri === 'projects://') return projectSurface.list();
  if (uri === 'active_context://current') return ACTIVE_CONTEXT;
  return null;
}

// =============================================================================
// JSON-RPC dispatch
// =============================================================================

const SERVER_INFO = { name: 'odd_manager_data_mcp', version: '0.1.0' };
const PROTOCOL_VERSION = '2024-11-05';

export async function handleRequest(message) {
  const { id, method, params = {} } = message;
  if (!method) {
    return { jsonrpc: '2.0', id: id ?? null, error: { code: -32600, message: 'missing method' } };
  }
  try {
    if (method === 'initialize') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: PROTOCOL_VERSION,
          serverInfo: SERVER_INFO,
          capabilities: { tools: {}, resources: {} },
        },
      };
    }
    if (method === 'notifications/initialized' || method === 'notifications/cancelled') {
      return null;
    }
    if (method === 'ping') {
      return { jsonrpc: '2.0', id, result: {} };
    }
    if (method === 'tools/list') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          tools: TOOLS.map((t) => ({ name: t.name, description: t.description, inputSchema: t.inputSchema })),
        },
      };
    }
    if (method === 'tools/call') {
      const tool = TOOLS.find((t) => t.name === params.name);
      if (!tool) {
        return { jsonrpc: '2.0', id, error: { code: -32602, message: `unknown tool: ${params.name}` } };
      }
      const result = await tool.handler(params.arguments ?? {});
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
          isError: result && result.ok === false,
        },
      };
    }
    if (method === 'resources/list') {
      return { jsonrpc: '2.0', id, result: { resources: RESOURCES } };
    }
    if (method === 'resources/read') {
      const data = readResource(params.uri);
      if (data === null) {
        return { jsonrpc: '2.0', id, error: { code: -32602, message: `resource not found: ${params.uri}` } };
      }
      return {
        jsonrpc: '2.0',
        id,
        result: {
          contents: [{ uri: params.uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }],
        },
      };
    }
    if (method === 'resources/templates/list' || method === 'prompts/list' || method === 'logging/setLevel') {
      return { jsonrpc: '2.0', id, result: method.endsWith('list') ? { [method.split('/')[0]]: [] } : {} };
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${method}` } };
  } catch (err) {
    return { jsonrpc: '2.0', id, error: { code: -32603, message: err.message ?? String(err) } };
  }
}

export const __testing__ = { TOOLS, RESOURCES, readResource, ACTIVE_CONTEXT, VIEWER_AGENT };

// =============================================================================
// Stdio transport (Content-Length framed). Skipped in test mode.
// =============================================================================

function writeFramed(message) {
  const json = JSON.stringify(message);
  const buf = Buffer.from(json, 'utf-8');
  process.stdout.write(`Content-Length: ${buf.length}\r\n\r\n`);
  process.stdout.write(buf);
}

let stdinBuffer = Buffer.alloc(0);

const CONTENT_LENGTH_PREFIX = 'Content-Length:';

function startsWithFramedPrefix(buffer) {
  if (buffer.length === 0) return false;
  const prefix = buffer.slice(0, Math.min(buffer.length, CONTENT_LENGTH_PREFIX.length)).toString('utf-8');
  return CONTENT_LENGTH_PREFIX.toLowerCase().startsWith(prefix.toLowerCase());
}

function realignAfterMalformedFrame(buffer) {
  const lower = buffer.toString('utf-8').toLowerCase();
  const nextFrame = lower.indexOf(CONTENT_LENGTH_PREFIX.toLowerCase());
  if (nextFrame >= 0) {
    return buffer.slice(nextFrame);
  }
  const nextLine = buffer.indexOf('\n');
  if (nextLine >= 0) {
    return buffer.slice(nextLine + 1);
  }
  return Buffer.alloc(0);
}

function consumeFramedFromBuffer(buffer) {
  if (!startsWithFramedPrefix(buffer)) {
    return { status: 'absent', buffer };
  }
  const headerEnd = buffer.indexOf('\r\n\r\n');
  if (headerEnd === -1) {
    return { status: 'incomplete', buffer };
  }
  const header = buffer.slice(0, headerEnd).toString('utf-8');
  const lengthMatch = header.match(/^Content-Length:\s*(\d+)\s*$/im);
  if (!lengthMatch) {
    return {
      status: 'malformed',
      error: 'malformed Content-Length frame header',
      buffer: realignAfterMalformedFrame(buffer.slice(headerEnd + 4)),
    };
  }
  const contentLength = Number(lengthMatch[1]);
  const totalLength = headerEnd + 4 + contentLength;
  if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
    return {
      status: 'malformed',
      error: 'invalid Content-Length value',
      buffer: buffer.slice(headerEnd + 4),
    };
  }
  if (buffer.length < totalLength) {
    return { status: 'incomplete', buffer };
  }
  const body = buffer.slice(headerEnd + 4, totalLength).toString('utf-8');
  try {
    return {
      status: 'message',
      message: JSON.parse(body),
      framed: true,
      buffer: buffer.slice(totalLength),
    };
  } catch {
    return {
      status: 'malformed',
      error: 'invalid framed JSON body',
      buffer: buffer.slice(totalLength),
    };
  }
}

function tryConsumeFramed() {
  const result = consumeFramedFromBuffer(stdinBuffer);
  stdinBuffer = result.buffer;
  return result;
}

function consumeLineDelimitedFromBuffer(buffer) {
  const newlineIndex = buffer.indexOf('\n');
  if (newlineIndex === -1) return { status: 'incomplete', buffer };
  const line = buffer.slice(0, newlineIndex).toString('utf-8').trim();
  const nextBuffer = buffer.slice(newlineIndex + 1);
  if (!line) return { status: 'empty', buffer: nextBuffer };
  try {
    return { status: 'message', message: JSON.parse(line), framed: false, buffer: nextBuffer };
  } catch {
    return { status: 'malformed', error: 'invalid line-delimited JSON', buffer: nextBuffer };
  }
}

function tryConsumeLineDelimited() {
  const result = consumeLineDelimitedFromBuffer(stdinBuffer);
  stdinBuffer = result.buffer;
  return result;
}

export function createStdioMessageParser() {
  let buffer = Buffer.alloc(0);
  return {
    push(chunk) {
      buffer = Buffer.concat([buffer, Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf-8')]);
    },
    next() {
      const framed = consumeFramedFromBuffer(buffer);
      if (framed.status === 'message' || framed.status === 'malformed') {
        buffer = framed.buffer;
        return framed;
      }
      if (framed.status === 'incomplete') {
        return framed;
      }
      const line = consumeLineDelimitedFromBuffer(buffer);
      buffer = line.buffer;
      return line;
    },
    get bufferedLength() {
      return buffer.length;
    },
  };
}

function maybeLogTransportError(result) {
  if (result.status !== 'malformed') return;
  const text = JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: result.error } });
  const buf = Buffer.from(text, 'utf-8');
  process.stdout.write(`Content-Length: ${buf.length}\r\n\r\n`);
  process.stdout.write(buf);
}

async function dispatchTransportMessage(result) {
  if (result.status !== 'message') return false;
  const reply = await handleRequest(result.message);
  if (reply) {
    if (result.framed) writeFramed(reply);
    else process.stdout.write(JSON.stringify(reply) + '\n');
  }
  return true;
}

function isTerminalParserStatus(result) {
  return result.status === 'incomplete' || result.status === 'absent';
}

function shouldContinueAfterParserStatus(result) {
  return result.status === 'empty' || result.status === 'malformed';
}

function consumeNextStdioMessage() {
  const framed = tryConsumeFramed();
  if (framed.status === 'message' || framed.status === 'incomplete' || framed.status === 'malformed') {
    return framed;
  }
  return tryConsumeLineDelimited();
}

async function drainStdioBuffer() {
  while (true) {
    const next = consumeNextStdioMessage();
    if (next.status === 'malformed') {
      maybeLogTransportError(next);
      if (shouldContinueAfterParserStatus(next)) continue;
    }
    if (await dispatchTransportMessage(next)) {
      continue;
    }
    if (shouldContinueAfterParserStatus(next)) {
      continue;
    }
    if (isTerminalParserStatus(next)) {
      break;
    }
  }
}

async function startStdio() {
  process.stdin.on('data', async (chunk) => {
    stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
    await drainStdioBuffer();
  });
  process.stdin.on('end', () => process.exit(0));
}

// Auto-start stdio loop only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  startStdio();
}
