import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

import {
  appendConversationEntry,
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

test('conversation history admits only Project-local regular non-symlink carriers', () => {
  const proofRoot = mkdtempSync(join(tmpdir(), 'odd-manager-conversation-carrier-'));
  const projectRoot = join(proofRoot, 'project');
  const outsideRoot = join(proofRoot, 'outside');
  const historyId = 'oddterm_carrier_proof';
  const runtimeRoot = join(projectRoot, '.ai-workspace', 'runtime');
  const historyRoot = join(runtimeRoot, 'conversation_history');
  const historyDirectory = join(historyRoot, historyId);
  const externalHistory = join(outsideRoot, historyId);
  const externalMeta = join(outsideRoot, 'external-meta.json');
  const externalEntries = join(outsideRoot, 'external-entries.ndjson');
  const meta = {
    conversationHistoryId: historyId,
    workspaceRoot: projectRoot,
    ownerKind: 'oddterm_session',
    ownerRef: 'carrier-proof',
    metadata: {},
    createdAt: '2026-07-27T00:00:00.000Z',
    updatedAt: '2026-07-27T00:00:00.000Z',
  };

  try {
    mkdirSync(runtimeRoot, { recursive: true });
    mkdirSync(externalHistory, { recursive: true });
    writeFileSync(join(externalHistory, 'meta.json'), `${JSON.stringify(meta)}\n`, 'utf8');
    writeFileSync(
      join(externalHistory, 'entries.ndjson'),
      `${JSON.stringify({ entryKind: 'output', payload: { text: 'outside\n' } })}\n`,
      'utf8',
    );
    symlinkSync(outsideRoot, historyRoot);
    assert.throws(
      () => loadConversationHistory(projectRoot, historyId),
      /non-symlink directory/,
    );
    assert.throws(
      () => ensureConversationHistory(projectRoot, {
        historyId,
        ownerKind: 'oddterm_session',
        ownerRef: 'carrier-proof',
      }),
      /non-symlink directory/,
    );
    assert.match(readFileSync(join(externalHistory, 'entries.ndjson'), 'utf8'), /outside/);

    unlinkSync(historyRoot);
    mkdirSync(historyRoot, { recursive: true });
    symlinkSync(externalHistory, historyDirectory);
    assert.throws(
      () => loadConversationHistory(projectRoot, historyId),
      /non-symlink directory/,
    );

    unlinkSync(historyDirectory);
    mkdirSync(historyDirectory, { recursive: true });
    writeFileSync(externalMeta, `${JSON.stringify(meta)}\n`, 'utf8');
    symlinkSync(externalMeta, join(historyDirectory, 'meta.json'));
    assert.throws(
      () => loadConversationHistory(projectRoot, historyId),
      /regular non-symlink file/,
    );

    rmSync(join(historyDirectory, 'meta.json'), { force: true });
    writeFileSync(join(historyDirectory, 'meta.json'), `${JSON.stringify(meta)}\n`, 'utf8');
    writeFileSync(externalEntries, '{"payload":{"text":"outside\\n"}}\n', 'utf8');
    symlinkSync(externalEntries, join(historyDirectory, 'entries.ndjson'));
    assert.throws(
      () => loadConversationHistory(projectRoot, historyId),
      /regular non-symlink file/,
    );
    assert.equal(readFileSync(externalEntries, 'utf8'), '{"payload":{"text":"outside\\n"}}\n');

    for (const unsafeHistoryId of ['../outside', 'oddterm/outside', 'oddterm\\outside']) {
      assert.throws(
        () => ensureConversationHistory(projectRoot, {
          historyId: unsafeHistoryId,
          ownerKind: 'oddterm_session',
          ownerRef: 'carrier-proof',
        }),
        /canonical runtime carrier segment/,
      );
    }
  } finally {
    rmSync(proofRoot, { recursive: true, force: true });
  }
});

test('conversation history metadata binds replay to one exact Project and owner', () => {
  const proofRoot = mkdtempSync(join(tmpdir(), 'odd-manager-conversation-binding-'));
  const sourceProject = join(proofRoot, 'source');
  const victimProject = join(proofRoot, 'victim');
  const historyId = 'oddterm_12345678-1234-4123-8123-123456789abc';
  const sourceHistory = join(
    sourceProject,
    '.ai-workspace',
    'runtime',
    'conversation_history',
    historyId,
  );
  const victimHistoryRoot = join(
    victimProject,
    '.ai-workspace',
    'runtime',
    'conversation_history',
  );
  const victimHistory = join(victimHistoryRoot, historyId);

  try {
    mkdirSync(sourceProject, { recursive: true });
    mkdirSync(victimProject, { recursive: true });
    ensureConversationHistory(sourceProject, {
      historyId,
      ownerKind: 'oddterm_session',
      ownerRef: '12345678-1234-4123-8123-123456789abc',
    });
    appendConversationEntry(sourceProject, historyId, {
      entryKind: 'output',
      payload: { text: 'SOURCE-ONLY\n' },
    });
    mkdirSync(victimHistoryRoot, { recursive: true });
    cpSync(sourceHistory, victimHistory, { recursive: true });

    assert.throws(
      () => loadConversationHistory(victimProject, historyId),
      /exact Project and history identity/,
    );
    assert.throws(
      () => ensureConversationHistory(victimProject, {
        historyId,
        ownerKind: 'oddterm_session',
        ownerRef: '12345678-1234-4123-8123-123456789abc',
      }),
      /exact Project and history identity/,
    );
    assert.equal(
      loadConversationHistory(sourceProject, historyId).entries[0].payload.text,
      'SOURCE-ONLY\n',
    );

    rmSync(victimHistory, { recursive: true, force: true });
    ensureConversationHistory(victimProject, {
      historyId,
      ownerKind: 'oddterm_session',
      ownerRef: '12345678-1234-4123-8123-123456789abc',
    });
    assert.throws(
      () => ensureConversationHistory(victimProject, {
        historyId,
        ownerKind: 'oddterm_session',
        ownerRef: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      }),
      /owner does not match/,
    );
  } finally {
    rmSync(proofRoot, { recursive: true, force: true });
  }
});
