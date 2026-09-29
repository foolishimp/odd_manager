import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { analyzeEventCarrier } from '../analyze_abg_event_stream.mjs';

function event(ordinal, kind, additions = {}) {
  return {
    kind,
    eventId: `event:${ordinal}`,
    eventTime: `2026-08-28T00:00:0${ordinal}.000Z`,
    eventTimeUnixMs: ordinal * 1000,
    eventAdmissionOrdinal: ordinal,
    ...additions,
  };
}

function fixture(events, withProof = false) {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-abg-census-'));
  const runRoot = join(root, 'run');
  const eventDirectory = join(runRoot, 'instance', '.ai-workspace', 'events');
  mkdirSync(eventDirectory, { recursive: true });
  const body = `${events.map((row) => JSON.stringify(row)).join('\n')}\n`;
  writeFileSync(join(eventDirectory, 'events.jsonl'), body);
  if (withProof) {
    const digest = `sha256:${createHash('sha256').update(body).digest('hex')}`;
    writeFileSync(join(runRoot, 'fixture-proof.json'), JSON.stringify({
      kind: 'fixture_overlay_live_proof',
      eventLogSha256: digest,
      eventSequence: events,
      eventCounts: Object.fromEntries(events.map((row) => [row.kind, 1])),
      substrate: {
        productId: 'abiogenesis',
        packageName: '@abiogenesis/typescript-tenant',
        packageVersion: 'test',
      },
    }));
  }
  return { root, runRoot };
}

test('admits a contiguous terminal stream and verifies its proof binding', async (context) => {
  const subject = fixture([
    event(0, 'basis_admitted', { basisId: 'basis:1', runId: 'run:1' }),
    event(1, 'terminal_reached', { basisId: 'basis:1', terminalKind: 'converged' }),
  ], true);
  context.after(() => rmSync(subject.root, { recursive: true, force: true }));

  const result = await analyzeEventCarrier(subject.runRoot);
  assert.equal(result.structuralValid, true);
  assert.equal(result.stableSnapshot, true);
  assert.equal(result.disposition, 'converged');
  assert.equal(result.eventCount, 2);
  assert.equal(result.proof.eventLogDigestMatches, true);
  assert.equal(result.proof.eventSequenceCountMatches, true);
});

test('rejects an ordinal discontinuity without inventing terminal state', async (context) => {
  const subject = fixture([
    event(0, 'basis_admitted', { basisId: 'basis:1' }),
    event(2, 'vector_traversal_planned', { basisId: 'basis:1', vectorIndex: 0 }),
  ]);
  context.after(() => rmSync(subject.root, { recursive: true, force: true }));

  const result = await analyzeEventCarrier(subject.runRoot);
  assert.equal(result.structuralValid, false);
  assert.equal(result.ordinalDiscontinuityCount, 1);
  assert.equal(result.disposition, 'non_terminal');
  assert.equal(result.proof.state, 'absent');
});
