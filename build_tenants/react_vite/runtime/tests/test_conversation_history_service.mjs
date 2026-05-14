import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ensureConversationHistory,
  listConversationHistories,
  loadConversationHistory,
  loadConversationHistoryStats,
  updateConversationMetadata,
} from '../../src/server/conversation-history-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_conversation_history');

function setup() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
}

function teardown() {
  try {
    chmodSync(
      join(fixtureRoot, '.ai-workspace/runtime/conversation_history/oddterm_readonly'),
      0o755,
    );
    chmodSync(
      join(fixtureRoot, '.ai-workspace/runtime/conversation_history/oddterm_readonly/meta.json'),
      0o644,
    );
    chmodSync(
      join(fixtureRoot, '.ai-workspace/runtime/conversation_history/oddterm_readonly/entries.ndjson'),
      0o644,
    );
  } catch {
    // Fixture may not have reached the chmod phase.
  }
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('conversation history read paths tolerate read-only historical files', () => {
  setup();
  try {
    const historyId = 'oddterm_readonly';
    const historyDir = join(fixtureRoot, '.ai-workspace/runtime/conversation_history', historyId);
    mkdirSync(historyDir, { recursive: true });
    writeFileSync(
      join(historyDir, 'meta.json'),
      `${JSON.stringify({
        conversationHistoryId: historyId,
        workspaceRoot: fixtureRoot,
        ownerKind: 'oddterm_session',
        ownerRef: 'readonly',
        metadata: { label: 'read-only old shell' },
        createdAt: '2026-05-12T00:00:00.000Z',
        updatedAt: '2026-05-12T00:00:00.000Z',
      }, null, 2)}\n`,
      'utf8',
    );
    writeFileSync(
      join(historyDir, 'entries.ndjson'),
      `${JSON.stringify({
        entryId: 'entry-1',
        conversationHistoryId: historyId,
        entryKind: 'output',
        actorRef: null,
        createdAt: '2026-05-12T00:00:01.000Z',
        payload: { text: 'hello from read-only history\n' },
      })}\n`,
      'utf8',
    );
    chmodSync(join(historyDir, 'meta.json'), 0o444);
    chmodSync(join(historyDir, 'entries.ndjson'), 0o444);
    chmodSync(historyDir, 0o555);

    const ensured = ensureConversationHistory(fixtureRoot, {
      historyId,
      ownerKind: 'oddterm_session',
      ownerRef: 'readonly',
      metadata: { label: 'updated label' },
    });
    assert.equal(ensured.conversationHistoryId, historyId);

    const updated = updateConversationMetadata(fixtureRoot, historyId, { state: 'closed' });
    assert.equal(updated.conversationHistoryId, historyId);
    assert.equal(updated.metadata.state, 'closed');

    const loaded = loadConversationHistory(fixtureRoot, historyId);
    assert.equal(loaded.meta.conversationHistoryId, historyId);
    assert.equal(loaded.entries.length, 1);
    assert.match(loaded.entries[0].payload.text, /read-only history/);

    const stats = loadConversationHistoryStats(fixtureRoot, historyId);
    assert.equal(stats.retainedLineCount, 1);
    assert.ok(stats.historyBytes > 0);

    const histories = listConversationHistories(fixtureRoot, { ownerKind: 'oddterm_session' });
    assert.deepEqual(histories.map((history) => history.conversationHistoryId), [historyId]);
  } finally {
    teardown();
  }
});
