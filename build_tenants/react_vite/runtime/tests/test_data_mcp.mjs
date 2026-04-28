// T-011 — verification of the data MCP server.
//
// Runs JSON-RPC requests directly against handleRequest (no stdio) so the
// suite is hermetic. Exercises initialize / tools/list / tools/call /
// resources/list / resources/read across the four AssetSurfaces.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';

import { handleRequest, __testing__, createStdioMessageParser } from '../odd_manager_data_mcp.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const mcpModuleUrl = pathToFileURL(resolve(here, '../odd_manager_data_mcp.mjs')).href;

let nextId = 1;
function rpc(method, params) {
  return { jsonrpc: '2.0', id: nextId++, method, params };
}

test('initialize handshake returns server info and capabilities', async () => {
  const reply = await handleRequest(rpc('initialize', { protocolVersion: '2024-11-05' }));
  assert.equal(reply.result.serverInfo.name, 'odd_manager_data_mcp');
  assert.ok(reply.result.capabilities.tools);
  assert.ok(reply.result.capabilities.resources);
});

test('tools/list publishes the full T-011 tool set', async () => {
  const reply = await handleRequest(rpc('tools/list'));
  const names = reply.result.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [
    'comments_create_post',
    'comments_create_reply',
    'comments_mark_read',
    'comments_mark_unread',
    'query_unread_for_agent',
    'tickets_assign_build_tenant',
    'tickets_link_dependency',
    'tickets_transition_status',
    'tickets_update_field',
  ]);
});

test('comment write tools do not expose caller-controlled author fields', async () => {
  const reply = await handleRequest(rpc('tools/list'));
  const tools = new Map(reply.result.tools.map((tool) => [tool.name, tool]));
  const postSchema = tools.get('comments_create_post').inputSchema;
  const replySchema = tools.get('comments_create_reply').inputSchema;
  assert.equal(Object.hasOwn(postSchema.properties, 'author'), false);
  assert.equal(Object.hasOwn(replySchema.properties, 'author'), false);
  assert.deepEqual(postSchema.required, ['category', 'subject']);
  assert.deepEqual(replySchema.required, ['parent_id', 'body']);
});

test('resources/list publishes the AssetSurface resources', async () => {
  const reply = await handleRequest(rpc('resources/list'));
  const uris = reply.result.resources.map((r) => r.uri).sort();
  assert.deepEqual(uris, [
    'active_context://current',
    'comments://',
    'projects://',
    'sessions://',
    'tickets://',
  ]);
});

test('resources/read tickets:// returns the live TicketRecord list', async () => {
  const reply = await handleRequest(rpc('resources/read', { uri: 'tickets://' }));
  const tickets = JSON.parse(reply.result.contents[0].text);
  assert.ok(Array.isArray(tickets));
  assert.ok(tickets.length >= 15, 'live tree should expose ≥15 tickets');
  const t007 = tickets.find((t) => t.id === 'T-007');
  assert.ok(t007, 'T-007 should be in the live read');
});

test('resources/read tickets://<id> returns one record', async () => {
  const reply = await handleRequest(rpc('resources/read', { uri: 'tickets://T-006' }));
  const t = JSON.parse(reply.result.contents[0].text);
  assert.equal(t.id, 'T-006');
  assert.equal(t.governanceScope, 'STDO-UX Method');
});

test('resources/read comments:// returns CommentRecord list', async () => {
  const reply = await handleRequest(rpc('resources/read', { uri: 'comments://' }));
  const comments = JSON.parse(reply.result.contents[0].text);
  assert.ok(Array.isArray(comments));
  assert.ok(comments.length >= 1);
});

test('resources/read sessions:// returns records + diagnostic', async () => {
  const reply = await handleRequest(rpc('resources/read', { uri: 'sessions://' }));
  const payload = JSON.parse(reply.result.contents[0].text);
  assert.ok(Array.isArray(payload.records));
  assert.ok(payload.diagnostic);
  assert.ok(['registry', 'none'].includes(payload.diagnostic.backplane));
});

test('resources/read projects:// returns ProjectRecord list', async () => {
  const reply = await handleRequest(rpc('resources/read', { uri: 'projects://' }));
  const projects = JSON.parse(reply.result.contents[0].text);
  assert.ok(Array.isArray(projects));
  for (const project of projects) {
    assert.equal(project.registry_source, 'registry');
    assert.ok(typeof project.root === 'string' && project.root.startsWith('/'));
  }
});

test('resources/read active_context://current returns the active Context', async () => {
  const reply = await handleRequest(rpc('resources/read', { uri: 'active_context://current' }));
  const ctx = JSON.parse(reply.result.contents[0].text);
  assert.equal(ctx.project.id, 'odd_manager');
  assert.equal(ctx.workspace.id, 'react_vite');
});

test('resources/read unknown uri returns -32602 error', async () => {
  const reply = await handleRequest(rpc('resources/read', { uri: 'made_up://' }));
  assert.ok(reply.error);
  assert.equal(reply.error.code, -32602);
});

test('tools/call query_unread_for_agent returns ok envelope', async () => {
  const reply = await handleRequest(rpc('tools/call', {
    name: 'query_unread_for_agent',
    arguments: { agent: 'operator' },
  }));
  const result = JSON.parse(reply.result.content[0].text);
  assert.equal(result.ok, true);
  assert.equal(result.agent, 'operator');
  assert.ok(Array.isArray(result.unread_ids));
});

test('comments_create_post and comments_create_reply derive author from MCP environment', () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'odd-manager-mcp-author-'));
  try {
    const script = `
      import { handleRequest } from ${JSON.stringify(mcpModuleUrl)};
      let id = 1;
      const rpc = (method, params) => ({ jsonrpc: '2.0', id: id++, method, params });
      const postReply = await handleRequest(rpc('tools/call', {
        name: 'comments_create_post',
        arguments: {
          author: 'spoofed_agent',
          category: 'REVIEW',
          subject: 'Spoof Attempt',
          body: 'body'
        }
      }));
      const post = JSON.parse(postReply.result.content[0].text);
      const replyReply = await handleRequest(rpc('tools/call', {
        name: 'comments_create_reply',
        arguments: {
          parent_id: post.id,
          author: 'spoofed_agent',
          body: 'reply body'
        }
      }));
      const reply = JSON.parse(replyReply.result.content[0].text);
      console.log(JSON.stringify({ post, reply }));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
      env: {
        ...process.env,
        OMAN_WORKSPACE_ROOT: workspaceRoot,
        OMAN_AGENT_PROVIDER: 'codex_mcp',
        OMAN_SESSION_LABEL: 'session_label_should_not_win',
      },
    });
    assert.equal(run.status, 0, run.stderr);
    const observed = JSON.parse(run.stdout.trim());
    assert.equal(observed.post.ok, true, observed.post.error);
    assert.equal(observed.reply.ok, true, observed.reply.error);
    assert.equal(observed.post.author, 'codex_mcp');
    assert.equal(observed.reply.author, 'codex_mcp');
    assert.match(observed.post.sourcePath, /^\.ai-workspace\/comments\/codex_mcp\//);
    assert.match(observed.reply.sourcePath, /^\.ai-workspace\/comments\/codex_mcp\//);
    assert.equal(existsSync(join(workspaceRoot, '.ai-workspace/comments/spoofed_agent')), false);
    const postFile = readFileSync(join(workspaceRoot, observed.post.sourcePath), 'utf-8');
    assert.match(postFile, /^\*\*Author\*\*: codex_mcp$/m);
    assert.doesNotMatch(postFile, /spoofed_agent/);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('tools/call unknown tool returns -32602 error', async () => {
  const reply = await handleRequest(rpc('tools/call', { name: 'made_up_tool' }));
  assert.ok(reply.error);
  assert.equal(reply.error.code, -32602);
});

test('tools/call surfaces ok=false as isError=true content envelope', async () => {
  const reply = await handleRequest(rpc('tools/call', {
    name: 'tickets_transition_status',
    arguments: { id: 'T-NONEXISTENT', to_lane: 'completed' },
  }));
  const result = JSON.parse(reply.result.content[0].text);
  assert.equal(result.ok, false);
  assert.equal(reply.result.isError, true);
});

test('tickets_update_field fails closed for invalid keys and scalar injection through MCP', () => {
  const workspaceRoot = mkdtempSync(join(tmpdir(), 'odd-manager-mcp-ticket-'));
  try {
    const ticketDir = join(workspaceRoot, '.ai-workspace/tickets/active');
    mkdirSync(ticketDir, { recursive: true });
    writeFileSync(join(ticketDir, 'T-900-test.md'), [
      '---',
      'id: T-900',
      'title: Test ticket',
      'type: bug',
      'status: active',
      'priority: high',
      'build_tenant: react_vite',
      '---',
      '',
      'body',
      '',
    ].join('\n'));
    const script = `
      import { handleRequest } from ${JSON.stringify(mcpModuleUrl)};
      let id = 1;
      const rpc = (method, params) => ({ jsonrpc: '2.0', id: id++, method, params });
      const badKeyReply = await handleRequest(rpc('tools/call', {
        name: 'tickets_update_field',
        arguments: { id: 'T-900', snake_key: 'title', value: 'bad' }
      }));
      const injectionReply = await handleRequest(rpc('tools/call', {
        name: 'tickets_update_field',
        arguments: { id: 'T-900', snake_key: 'priority', value: "critical\\nstatus: completed" }
      }));
      console.log(JSON.stringify({
        badKey: JSON.parse(badKeyReply.result.content[0].text),
        badKeyIsError: badKeyReply.result.isError,
        injection: JSON.parse(injectionReply.result.content[0].text),
        injectionIsError: injectionReply.result.isError
      }));
    `;
    const run = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      encoding: 'utf-8',
      env: { ...process.env, OMAN_WORKSPACE_ROOT: workspaceRoot },
    });
    assert.equal(run.status, 0, run.stderr);
    const observed = JSON.parse(run.stdout.trim());
    assert.equal(observed.badKey.ok, false);
    assert.equal(observed.badKeyIsError, true);
    assert.match(observed.badKey.error, /not mutable/);
    assert.equal(observed.injection.ok, false);
    assert.equal(observed.injectionIsError, true);
    assert.match(observed.injection.error, /newlines are not allowed/);
    const written = readFileSync(join(ticketDir, 'T-900-test.md'), 'utf-8');
    assert.match(written, /^status: active$/m);
    assert.match(written, /^priority: high$/m);
  } finally {
    rmSync(workspaceRoot, { recursive: true, force: true });
  }
});

test('unknown method returns -32601', async () => {
  const reply = await handleRequest(rpc('totally_not_a_method'));
  assert.ok(reply.error);
  assert.equal(reply.error.code, -32601);
});

test('stdio parser preserves split Content-Length header until complete', () => {
  const body = '{"jsonrpc":"2.0","id":1,"method":"ping"}';
  const parser = createStdioMessageParser();
  parser.push('Content-Len');
  assert.equal(parser.next().status, 'incomplete');
  parser.push(`gth: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
  const parsed = parser.next();
  assert.equal(parsed.status, 'message');
  assert.equal(parsed.framed, true);
  assert.equal(parsed.message.method, 'ping');
  assert.equal(parser.next().status, 'incomplete');
});

test('stdio parser preserves split framed body until full Content-Length arrives', () => {
  const body = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
  const parser = createStdioMessageParser();
  parser.push(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body.slice(0, 12)}`);
  assert.equal(parser.next().status, 'incomplete');
  parser.push(body.slice(12));
  const parsed = parser.next();
  assert.equal(parsed.status, 'message');
  assert.deepEqual(parsed.message, { jsonrpc: '2.0', id: 1, method: 'ping' });
});

test('stdio parser consumes multiple concatenated framed messages', () => {
  const first = JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' });
  const second = JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const parser = createStdioMessageParser();
  parser.push(`Content-Length: ${Buffer.byteLength(first)}\r\n\r\n${first}Content-Length: ${Buffer.byteLength(second)}\r\n\r\n${second}`);
  const m1 = parser.next();
  const m2 = parser.next();
  assert.equal(m1.status, 'message');
  assert.equal(m2.status, 'message');
  assert.equal(m1.message.id, 1);
  assert.equal(m2.message.id, 2);
});

test('stdio parser drops malformed frame and recovers on following framed message', () => {
  const good = JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'ping' });
  const parser = createStdioMessageParser();
  parser.push(`Content-Length: x\r\n\r\n{}Content-Length: ${Buffer.byteLength(good)}\r\n\r\n${good}`);
  const malformed = parser.next();
  assert.equal(malformed.status, 'malformed');
  const parsed = parser.next();
  assert.equal(parsed.status, 'message');
  assert.equal(parsed.message.id, 3);
});

test('stdio parser still accepts line-delimited JSON when no framed prefix is present', () => {
  const parser = createStdioMessageParser();
  parser.push('{"jsonrpc":"2.0","id":4,"method":"ping"}\n');
  const parsed = parser.next();
  assert.equal(parsed.status, 'message');
  assert.equal(parsed.framed, false);
  assert.equal(parsed.message.id, 4);
});

test('demo: list tools and resources', () => {
  /* eslint-disable no-console */
  console.log('\n=== odd_manager_data_mcp tool + resource registry ===');
  console.log('Tools:');
  for (const t of __testing__.TOOLS) {
    console.log(`  ${t.name}`);
  }
  console.log('Resources:');
  for (const r of __testing__.RESOURCES) {
    console.log(`  ${r.uri}  ${r.description}`);
  }
  /* eslint-enable no-console */
});
