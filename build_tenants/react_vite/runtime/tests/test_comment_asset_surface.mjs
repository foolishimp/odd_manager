// Verification + demo for the CommentAssetSurface read path.
//
// Run from repo root:
//   node build_tenants/react_vite/runtime/tests/test_comment_asset_surface.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import {
  createCommentSurface,
  loadAllComments,
} from '../../src/server/comment-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..', '..', '..', '..');

test('loadAllComments reads comments across agent directories', () => {
  const all = loadAllComments(projectRoot);
  assert.ok(all.length >= 1, `expected ≥1 comment, got ${all.length}`);
  const authors = new Set(all.map((r) => r.author));
  assert.ok(authors.has('claude'), 'expected at least one comment from agent "claude"');
});

test('rich POSTING_GUIDE bold-key frontmatter parses', () => {
  const surface = createCommentSurface(projectRoot);
  const strategy = surface.list({ author: 'claude', category: 'STRATEGY' });
  assert.ok(strategy.length >= 1, 'should find the 2026-04-24 STRATEGY post');
  const post = strategy[0];
  assert.ok(post.title, 'title from H1 should parse');
  assert.ok(post.date, 'Date metadata should parse');
  assert.equal(post.author, 'claude');
  assert.ok(post.body && post.body.length > 100, 'body should follow the metadata block');
});

test('REVIEW category and unread-derivable timestamp parse', () => {
  const surface = createCommentSurface(projectRoot);
  const reviews = surface.list({ author: 'claude', category: 'REVIEW' });
  assert.ok(reviews.length >= 1, 'should find ≥1 REVIEW post');
  for (const r of reviews) {
    assert.ok(r.timestamp && r.timestamp.startsWith('2026'), 'timestamp parses');
    assert.ok(r.subject, 'subject derives from filename');
  }
});

test('thread id is derivable for posts with Addresses', () => {
  const surface = createCommentSurface(projectRoot);
  const all = surface.list({ author: 'claude' });
  const withAddresses = all.filter((r) => r.addresses);
  assert.ok(withAddresses.length >= 1, 'at least one post should have Addresses');
  for (const r of withAddresses) {
    assert.ok(r.threadId, 'threadId is derived');
  }
});

test('filter by addressesIncludes finds posts referencing a path fragment', () => {
  const surface = createCommentSurface(projectRoot);
  const referencing = surface.list({ addressesIncludes: 'PRODUCT.md' });
  assert.ok(referencing.length >= 1, 'self-review and strategy reference PRODUCT.md');
});

test('demo: print surface summary', () => {
  const surface = createCommentSurface(projectRoot);
  const all = surface.list();
  const byAuthor = all.reduce((acc, r) => {
    acc[r.author] = (acc[r.author] ?? 0) + 1;
    return acc;
  }, {});
  const byCategory = all.reduce((acc, r) => {
    const c = r.category ?? 'UNKNOWN';
    acc[c] = (acc[c] ?? 0) + 1;
    return acc;
  }, {});
  /* eslint-disable no-console */
  console.log('\n=== CommentAssetSurface live read ===');
  console.log(`projectRoot: ${projectRoot}`);
  console.log(`total: ${all.length}  by-author:`, byAuthor);
  console.log(`by-category:`, byCategory);
  if (all.length) {
    const sample = all[0];
    console.log('\nsample (excerpt):');
    console.log({
      id: sample.id,
      author: sample.author,
      category: sample.category,
      timestamp: sample.timestamp,
      title: sample.title,
      addresses: sample.addresses?.slice(0, 80),
      status: sample.status,
      bodyLength: sample.body?.length,
    });
  }
  /* eslint-enable no-console */
});
