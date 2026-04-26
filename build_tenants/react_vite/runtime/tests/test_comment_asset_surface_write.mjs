// T-019 — verification of write actions, per-agent unread state, change feed.
//
// Builds a self-contained fixture .ai-workspace/comments tree, runs each
// action, asserts POSTING_GUIDE conformance and atomicity, exercises the
// unread-state durability and the change feed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, writeFileSync, readFileSync, rmSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

import {
  createCommentSurface,
  createPost,
  createReply,
  markRead,
  markUnread,
  getUnreadIds,
} from '../../src/server/comment-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_comment_write');
const commentsRoot = resolve(fixtureRoot, '.ai-workspace/comments');

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(commentsRoot, { recursive: true });
}

function teardown() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('createPost writes a POSTING_GUIDE-conformant file', () => {
  setup();
  try {
    const result = createPost(fixtureRoot, {
      author: 'claude',
      category: 'REVIEW',
      subject: 'Test review of asset surface contract',
      body: 'This is the body.\n\nMultiple paragraphs.',
      addresses: 'design module ASSET_SURFACE_AND_TOPOLOGY.md',
      timestampOverride: '20260426T200000Z',
      dateOverride: '2026-04-26T20:00:00Z',
    });
    assert.equal(result.ok, true, `result.error: ${result.error}`);
    assert.match(result.filename, /^20260426T200000Z_REVIEW_test-review-of-asset-surface-contract\.md$/);
    const path = join(commentsRoot, 'claude', result.filename);
    assert.equal(existsSync(path), true, 'file written');
    const content = readFileSync(path, 'utf-8');
    assert.match(content, /^# REVIEW: Test review of asset surface contract$/m);
    assert.match(content, /^\*\*Author\*\*: claude$/m);
    assert.match(content, /^\*\*Date\*\*: 2026-04-26T20:00:00Z$/m);
    assert.match(content, /^\*\*Addresses\*\*: design module ASSET_SURFACE_AND_TOPOLOGY\.md$/m);
    assert.match(content, /^\*\*Status\*\*: Draft$/m);
    assert.match(content, /This is the body\./);
  } finally {
    teardown();
  }
});

test('createPost rejects invalid category and empty subject', () => {
  setup();
  try {
    const r1 = createPost(fixtureRoot, { author: 'claude', category: 'NOT_A_CATEGORY', subject: 'x' });
    assert.equal(r1.ok, false);
    assert.match(r1.error, /invalid category/);
    const r2 = createPost(fixtureRoot, { author: 'claude', category: 'REVIEW', subject: '   ' });
    assert.equal(r2.ok, false);
    assert.match(r2.error, /subject required|empty slug/);
  } finally {
    teardown();
  }
});

test('createPost rejects invalid agent name', () => {
  setup();
  try {
    const r = createPost(fixtureRoot, { author: '../etc', category: 'REVIEW', subject: 'x' });
    assert.equal(r.ok, false);
    assert.match(r.error, /invalid author/);
  } finally {
    teardown();
  }
});

test('createReply derives Addresses from parent comment', () => {
  setup();
  try {
    const parent = createPost(fixtureRoot, {
      author: 'claude', category: 'STRATEGY', subject: 'parent strategy',
      body: 'parent body', timestampOverride: '20260426T200000Z',
    });
    assert.equal(parent.ok, true);
    const reply = createReply(fixtureRoot, parent.id, {
      author: 'codex', body: 'a reply',
    });
    assert.equal(reply.ok, true, `reply.error: ${reply.error}`);
    const replyPath = join(commentsRoot, 'codex', reply.filename);
    const content = readFileSync(replyPath, 'utf-8');
    assert.match(content, /^\*\*Addresses\*\*: \.ai-workspace\/comments\/claude\//m);
    assert.match(content, /^# REVIEW: re: parent-strategy$/m);
  } finally {
    teardown();
  }
});

test('mark-read removes id from unread set; mark-unread adds it', () => {
  setup();
  try {
    let r = markUnread(fixtureRoot, 'claude', 'codex/some-comment');
    assert.equal(r.ok, true);
    assert.deepEqual(getUnreadIds(fixtureRoot, 'claude'), ['codex/some-comment']);
    r = markRead(fixtureRoot, 'claude', 'codex/some-comment');
    assert.equal(r.ok, true);
    assert.deepEqual(getUnreadIds(fixtureRoot, 'claude'), []);
  } finally {
    teardown();
  }
});

test('unread state persists across reads (server-restart-equivalent)', () => {
  setup();
  try {
    markUnread(fixtureRoot, 'claude', 'a');
    markUnread(fixtureRoot, 'claude', 'b');
    // Simulate restart by calling load fresh
    assert.deepEqual(getUnreadIds(fixtureRoot, 'claude'), ['a', 'b']);
    markRead(fixtureRoot, 'claude', 'a');
    assert.deepEqual(getUnreadIds(fixtureRoot, 'claude'), ['b']);
  } finally {
    teardown();
  }
});

test('per-agent isolation: claude unread != codex unread', () => {
  setup();
  try {
    markUnread(fixtureRoot, 'claude', 'x');
    markUnread(fixtureRoot, 'codex', 'y');
    assert.deepEqual(getUnreadIds(fixtureRoot, 'claude'), ['x']);
    assert.deepEqual(getUnreadIds(fixtureRoot, 'codex'), ['y']);
  } finally {
    teardown();
  }
});

test('surface methods invalidate cache after createPost', () => {
  setup();
  try {
    const surface = createCommentSurface(fixtureRoot, { pollIntervalMs: 50 });
    assert.equal(surface.list().length, 0);
    surface.createPost({
      author: 'claude', category: 'REVIEW', subject: 'a fresh review',
      body: 'body', timestampOverride: '20260426T210000Z',
    });
    assert.equal(surface.list().length, 1);
  } finally {
    teardown();
  }
});

test('change feed emits created event after a new post', async () => {
  setup();
  try {
    const surface = createCommentSurface(fixtureRoot, { pollIntervalMs: 50 });
    const events = [];
    const unsubscribe = surface.subscribe((batch) => events.push(...batch));
    createPost(fixtureRoot, {
      author: 'claude', category: 'GAP', subject: 'gap noted',
      body: 'gap body', timestampOverride: '20260426T220000Z',
    });
    await new Promise((r) => setTimeout(r, 200));
    unsubscribe();
    const created = events.filter((e) => e.kind === 'created');
    assert.ok(created.length >= 1, `expected ≥1 created event, got ${JSON.stringify(events)}`);
  } finally {
    teardown();
  }
});

test('demo: create + reply + mark-read round trip', () => {
  setup();
  try {
    const surface = createCommentSurface(fixtureRoot, { pollIntervalMs: 100 });
    /* eslint-disable no-console */
    console.log('\n=== T-019 write actions live demo ===');
    const post = surface.createPost({
      author: 'claude', category: 'STRATEGY', subject: 'demo strategy post',
      body: 'demo body', timestampOverride: '20260426T230000Z',
    });
    console.log(`created: ${post.id}`);
    const reply = surface.createReply(post.id, { author: 'codex', body: 'a quick reply' });
    console.log(`replied: ${reply.id} (Addresses → ${post.sourcePath})`);
    surface.markUnread('claude', reply.id);
    console.log(`unread for claude: ${JSON.stringify(surface.getUnreadIds('claude'))}`);
    surface.markRead('claude', reply.id);
    console.log(`after read for claude: ${JSON.stringify(surface.getUnreadIds('claude'))}`);
    /* eslint-enable no-console */
  } finally {
    teardown();
  }
});
