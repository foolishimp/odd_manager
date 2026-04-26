// T-011 — verification of the data MCP server.
//
// Runs JSON-RPC requests directly against handleRequest (no stdio) so the
// suite is hermetic. Exercises initialize / tools/list / tools/call /
// resources/list / resources/read across the four AssetSurfaces.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { handleRequest, __testing__ } from '../odd_manager_data_mcp.mjs';

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
  assert.ok(projects.length >= 1);
  assert.ok(projects.some((p) => p.id === 'odd_manager'));
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

test('unknown method returns -32601', async () => {
  const reply = await handleRequest(rpc('totally_not_a_method'));
  assert.ok(reply.error);
  assert.equal(reply.error.code, -32601);
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
