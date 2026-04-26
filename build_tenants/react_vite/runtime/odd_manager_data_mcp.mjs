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
//   comments_create_post              — { author, category, subject, body, addresses?, status? }
//   comments_create_reply             — { parent_id, author, body, category?, subject? }
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

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(process.env.OMAN_WORKSPACE_ROOT || resolve(here, '..', '..', '..'));
const REGISTRY_ROOT = process.env.PROJECT_REGISTRY_ROOT ?? '/Users/jim/src/apps';
const VIEWER_AGENT = process.env.OMAN_AGENT_PROVIDER ?? process.env.OMAN_SESSION_LABEL ?? 'operator';

const ticketSurface = createTicketSurface(projectRoot);
const commentSurface = createCommentSurface(projectRoot);
const sessionSurface = createSessionSurface(projectRoot);
const projectSurface = createProjectSurface(REGISTRY_ROOT);

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
    description: 'Create a new comment under .ai-workspace/comments/<author>/ following POSTING_GUIDE filename and frontmatter rules.',
    inputSchema: {
      type: 'object',
      properties: {
        author: { type: 'string' },
        category: { type: 'string', enum: ['REVIEW', 'STRATEGY', 'GAP', 'SCHEMA', 'HANDOFF', 'MATRIX'] },
        subject: { type: 'string' },
        body: { type: 'string' },
        addresses: { type: 'string' },
        status: { type: 'string' },
      },
      required: ['author', 'category', 'subject'],
      additionalProperties: false,
    },
    handler: (args) => commentSurface.createPost(args),
  },
  {
    name: 'comments_create_reply',
    description: 'Create a reply to a comment. Addresses field is auto-derived from the parent\'s source path.',
    inputSchema: {
      type: 'object',
      properties: {
        parent_id: { type: 'string' },
        author: { type: 'string' },
        body: { type: 'string' },
        category: { type: 'string' },
        subject: { type: 'string' },
      },
      required: ['parent_id', 'author', 'body'],
      additionalProperties: false,
    },
    handler: ({ parent_id, ...rest }) => commentSurface.createReply(parent_id, rest),
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
  { uri: 'projects://', mimeType: 'application/json', name: 'All projects', description: 'ProjectRecord[] discovered under PROJECT_REGISTRY_ROOT' },
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

export const __testing__ = { TOOLS, RESOURCES, readResource, ACTIVE_CONTEXT };

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

function tryConsumeFramed() {
  while (true) {
    const headerEnd = stdinBuffer.indexOf('\r\n\r\n');
    if (headerEnd === -1) return null;
    const header = stdinBuffer.slice(0, headerEnd).toString('utf-8');
    const lengthMatch = header.match(/Content-Length:\s*(\d+)/i);
    if (!lengthMatch) {
      stdinBuffer = stdinBuffer.slice(headerEnd + 4);
      continue;
    }
    const contentLength = Number(lengthMatch[1]);
    const totalLength = headerEnd + 4 + contentLength;
    if (stdinBuffer.length < totalLength) return null;
    const body = stdinBuffer.slice(headerEnd + 4, totalLength).toString('utf-8');
    stdinBuffer = stdinBuffer.slice(totalLength);
    try {
      return JSON.parse(body);
    } catch {
      return null;
    }
  }
}

function tryConsumeLineDelimited() {
  const newlineIndex = stdinBuffer.indexOf('\n');
  if (newlineIndex === -1) return null;
  const line = stdinBuffer.slice(0, newlineIndex).toString('utf-8').trim();
  stdinBuffer = stdinBuffer.slice(newlineIndex + 1);
  if (!line) return null;
  try {
    return JSON.parse(line);
  } catch {
    return null;
  }
}

async function startStdio() {
  process.stdin.on('data', async (chunk) => {
    stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
    while (true) {
      // Try framed first; fall back to line-delimited for clients that don't frame.
      const framed = tryConsumeFramed();
      if (framed !== null) {
        const reply = await handleRequest(framed);
        if (reply) writeFramed(reply);
        continue;
      }
      const line = tryConsumeLineDelimited();
      if (line !== null) {
        const reply = await handleRequest(line);
        if (reply) process.stdout.write(JSON.stringify(reply) + '\n');
        continue;
      }
      break;
    }
  });
  process.stdin.on('end', () => process.exit(0));
}

// Auto-start stdio loop only when invoked directly (not when imported by tests).
if (import.meta.url === `file://${process.argv[1]}`) {
  startStdio();
}
