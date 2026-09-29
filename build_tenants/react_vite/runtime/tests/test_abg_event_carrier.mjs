import { appendFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  detailAbgEventCarrier,
  indexAbgEventCarrier,
  pageAbgEventCarrier,
} from '../../src/server/abg-event-carrier-service.mjs';

function event(ordinal, extra = {}) {
  const eventTimeUnixMs = Date.parse('2026-08-28T01:00:00.000Z') + ordinal * 1000;
  return {
    kind: 'fixture_event', eventId: `fixture-event:${ordinal}`,
    eventTime: new Date(eventTimeUnixMs).toISOString(), eventTimeUnixMs,
    eventAdmissionOrdinal: ordinal, ...extra,
  };
}

function fixture(lines) {
  const root = mkdtempSync(join(tmpdir(), 'odd-manager-event-carrier-'));
  const path = join(root, 'events.jsonl');
  writeFileSync(path, lines, typeof lines === 'string' ? 'utf8' : undefined);
  return { path, cleanup: () => rmSync(root, { recursive: true, force: true }) };
}

test('incremental carrier admits only complete newline-terminated records and pages by generation', () => {
  const carrier = fixture(`${JSON.stringify(event(0))}\n${JSON.stringify(event(1))}\n{"kind":"pending`);
  try {
    const index = indexAbgEventCarrier(carrier.path, { refresh: true });
    assert.equal(index.state, 'ready');
    assert.equal(index.eventCount, 2);
    assert.ok(index.pendingBytes > 0);
    assert.equal(index.eventPosture, 'non_terminal');
    const page = pageAbgEventCarrier(index, { start: 1, limit: 10, generation: index.generation });
    assert.equal(page.ok, true);
    assert.deepEqual(page.page.rows.map((row) => row.ordinal), [1]);
    const detail = detailAbgEventCarrier(index, { ordinal: 1, generation: index.generation });
    assert.equal(detail.ok, true);
    assert.equal(detail.detail.value.eventId, 'fixture-event:1');
  } finally {
    carrier.cleanup();
  }
});

test('duplicate keys, event identities, ordinal gaps, mixed envelopes, and explicit limits fail closed', () => {
  const cases = [
    {
      source: '{"kind":"fixture_event","kind":"other","eventId":"fixture-event:0","eventTime":"2026-08-28T01:00:00.000Z","eventTimeUnixMs":1787878800000,"eventAdmissionOrdinal":0}\n',
      code: 'event_duplicate_json_key',
    },
    {
      source: `${JSON.stringify(event(0))}\n${JSON.stringify(event(1, { eventId: 'fixture-event:0' }))}\n`,
      code: 'event_identity_duplicate',
    },
    {
      source: `${JSON.stringify(event(0))}\n${JSON.stringify(event(2))}\n`,
      code: 'event_envelope_invalid',
    },
    {
      source: `${JSON.stringify(event(0))}\n${JSON.stringify({ kind: 'fixture', workflowVersion: '5.0.0', admissionOrdinal: 2 })}\n`,
      code: 'event_envelope_mixed',
    },
  ];
  for (const subject of cases) {
    const carrier = fixture(subject.source);
    try {
      const index = indexAbgEventCarrier(carrier.path, { refresh: true });
      assert.equal(index.state, 'invalid');
      assert.ok(index.diagnostics.some((entry) => entry.code === subject.code), JSON.stringify(index.diagnostics));
    } finally {
      carrier.cleanup();
    }
  }

  const limited = fixture(`${JSON.stringify(event(0, { large: 'x'.repeat(4096) }))}\n`);
  try {
    const index = indexAbgEventCarrier(limited.path, { refresh: true, maxLineBytes: 512 });
    assert.equal(index.state, 'invalid');
    assert.ok(index.diagnostics.some((entry) => entry.code === 'event_line_limit_exceeded'));
  } finally {
    limited.cleanup();
  }

  const indexLimited = fixture(`${JSON.stringify(event(0))}\n`);
  try {
    const index = indexAbgEventCarrier(indexLimited.path, { refresh: true, maxIndexBytes: 1 });
    assert.equal(index.state, 'invalid');
    assert.ok(index.diagnostics.some((entry) => entry.code === 'event_index_limit_exceeded'));
  } finally {
    indexLimited.cleanup();
  }

  const invalidUtf8 = fixture(Buffer.concat([
    Buffer.from('{"kind":"fixture_'),
    Buffer.from([0xff]),
    Buffer.from('","eventId":"fixture-event:0","eventTime":"2026-08-28T01:00:00.000Z","eventTimeUnixMs":1787878800000,"eventAdmissionOrdinal":0}\n'),
  ]));
  try {
    const index = indexAbgEventCarrier(invalidUtf8.path, { refresh: true });
    assert.equal(index.state, 'invalid');
    assert.ok(index.diagnostics.some((entry) => entry.code === 'event_utf8_invalid'));
  } finally {
    invalidUtf8.cleanup();
  }
});

test('a previously admitted generation refuses detail after append mutation', () => {
  const carrier = fixture(`${JSON.stringify(event(0))}\n`);
  try {
    const index = indexAbgEventCarrier(carrier.path, { refresh: true });
    appendFileSync(carrier.path, `${JSON.stringify(event(1))}\n`, 'utf8');
    const detail = detailAbgEventCarrier(index, { ordinal: 0, generation: index.generation });
    assert.equal(detail.ok, false);
    assert.equal(detail.code, 'stale_event_generation');
    const stalePage = pageAbgEventCarrier(index, { start: 0, generation: 'sha256:stale' });
    assert.equal(stalePage.ok, false);
    assert.equal(stalePage.code, 'stale_event_generation');
  } finally {
    carrier.cleanup();
  }
});
