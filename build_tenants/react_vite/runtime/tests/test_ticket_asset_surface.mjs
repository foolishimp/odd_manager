// Verification + demo script for the TicketAssetSurface service.
//
// The assertions use a fixture-owned ticket tree. Live workspace lane
// distribution is mutable work truth, not a stable qualification fixture.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import ts from 'typescript';

import {
  createTicketSurface,
  loadAllTickets,
} from '../../src/server/ticket-asset-surface-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(here, '_fixture_ticket_read');
const ticketsRoot = resolve(fixtureRoot, '.ai-workspace/tickets');
const ingressValidationModulePath = resolve(
  here,
  '../../src/features/sidecar/sidecar-ingress-validation.ts',
);

async function loadIngressValidationModule() {
  const source = readFileSync(ingressValidationModulePath, 'utf-8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  const encoded = Buffer.from(compiled, 'utf-8').toString('base64');
  return import(`data:text/javascript;base64,${encoded}`);
}

function writeRichTicket(lane, id, {
  title = `Ticket ${id}`,
  governance = 'STDO Method',
  expansion = ['S: SPEC_METHOD.md', 'T: TICKET_METHOD.md', 'D: DESIGN_MODULE_METHOD.md', 'O: ODD_METHOD.md'],
  buildTenant = 'react_vite',
  dependencies = [],
  proofSurface = [],
} = {}) {
  const dir = join(ticketsRoot, lane);
  mkdirSync(dir, { recursive: true });
  const content = [
    '---',
    `id: ${id}`,
    `title: ${title}`,
    'type: feature',
    'ticket_category: build_wave',
    `status: ${lane}`,
    'goal: test-goal',
    'change_intent: test',
    'change_class: realization_refactor',
    're_entry_point: realization',
    'priority: high',
    'triaged_at: 2026-04-26',
    'created_at: 2026-04-26',
    'updated_at: 2026-04-26',
    `build_tenant: ${buildTenant}`,
    `governance_scope: ${governance}`,
    'governance_scope_expansion:',
    ...expansion.map((entry) => `  - ${entry}`),
    'dependencies:',
    ...dependencies.map((entry) => `  - ${entry}`),
    'evaluation_criteria:',
    '  - criterion one',
    '  - criterion two',
    '  - criterion three',
    '  - criterion four',
    'proof_surface:',
    ...proofSurface.map((entry) => `  - ${entry}`),
    '---',
    '',
    '## STDO Reading',
    '',
    'fixture body',
    '',
  ].join('\n');
  writeFileSync(join(dir, `${id}-fixture.md`), content);
}

function writeSparseTicket(lane, id, { dependencies } = {}) {
  const dir = join(ticketsRoot, lane);
  mkdirSync(dir, { recursive: true });
  const dependencyLines = dependencies === undefined
    ? []
    : Array.isArray(dependencies)
      ? ['- dependencies:', ...dependencies.map((entry) => `  - ${entry}`)]
      : [`- dependencies: ${dependencies}`];
  writeFileSync(join(dir, `${id}-sparse.md`), [
    `# ${id} Sparse Fixture`,
    '',
    `- id: ${id}`,
    '- type: feature',
    ...dependencyLines,
    `- status: ${lane}`,
    '- priority: medium',
    '',
  ].join('\n'));
}

function writeRawTicket(lane, id, lines, suffix = 'raw', terminalLineBreak = true) {
  const dir = join(ticketsRoot, lane);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, `${id}-${suffix}.md`),
    `${lines.join('\n')}${terminalLineBreak ? '\n' : ''}`,
  );
}

function setupFixture() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
  writeSparseTicket('active', 'T-001', { dependencies: 'T-000' });
  writeSparseTicket('active', 'T-002', { dependencies: ['T-001', 'T-000'] });
  writeRichTicket('active', 'T-006', {
    title: 'STDO-UX fixture',
    governance: 'STDO-UX Method',
    expansion: [
      'S: SPEC_METHOD.md',
      'T: TICKET_METHOD.md',
      'D: DESIGN_MODULE_METHOD.md',
      'O: ODD_METHOD.md',
      'U: UX_METHOD.md',
    ],
  });
  writeRichTicket('backlog', 'T-007', {
    title: 'Realize TicketAssetSurface over .ai-workspace/tickets',
    proofSurface: ['sessions:// projection assertion before and after restart'],
  });
  writeRichTicket('backlog', 'T-008', { dependencies: ['T-007 completed'] });
  writeRichTicket('completed', 'T-009', { buildTenant: 'project_package' });
}

function teardownFixture() {
  if (existsSync(fixtureRoot)) rmSync(fixtureRoot, { recursive: true, force: true });
}

test('loadAllTickets reads tickets across all lanes from a fixture tree', () => {
  setupFixture();
  try {
    const all = loadAllTickets(fixtureRoot);
    assert.equal(all.length, 6);
    const lanes = new Set(all.map((r) => r.lane));
    assert.deepEqual([...lanes].sort(), ['active', 'backlog', 'completed']);
  } finally {
    teardownFixture();
  }
});

test('rich-shape STDO ticket parses with mapped key set', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const t = surface.get('T-007');
    assert.ok(t, 'T-007 should be present');
    assert.equal(t.title, 'Realize TicketAssetSurface over .ai-workspace/tickets');
    assert.equal(t.type, 'feature');
    assert.equal(t.changeClass, 'realization_refactor');
    assert.equal(t.reEntryPoint, 'realization');
    assert.equal(t.buildTenant, 'react_vite');
    assert.equal(t.governanceScope, 'STDO Method');
    assert.ok(Array.isArray(t.dependencies), 'dependencies should parse as array');
    assert.ok(Array.isArray(t.evaluationCriteria), 'evaluationCriteria should be array');
    assert.equal(t.evaluationCriteria.length, 4);
    assert.ok(Array.isArray(t.governanceScopeExpansion), 'expansion is an array of inline maps');
    assert.deepEqual(t.governanceScopeExpansion[0], { S: 'SPEC_METHOD.md' });
  } finally {
    teardownFixture();
  }
});

test('STDO-UX ticket carries the U expansion entry', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const t = surface.get('T-006');
    assert.ok(t, 'T-006 should be present');
    assert.equal(t.governanceScope, 'STDO-UX Method');
    const letters = t.governanceScopeExpansion.map((m) => Object.keys(m)[0]);
    assert.deepEqual(letters, ['S', 'T', 'D', 'O', 'U']);
  } finally {
    teardownFixture();
  }
});

test('legacy sparse-shape ticket still parses', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const t = surface.get('T-001');
    assert.ok(t, 'T-001 sparse fixture should be present');
    assert.equal(t.type, 'feature');
    assert.equal(t.status, 'active', 'array parsing must not consume following top-level metadata');
    assert.equal(t.priority, 'medium');
  } finally {
    teardownFixture();
  }
});

test('ordinary colon-bearing list items remain strings', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    assert.deepEqual(surface.get('T-007').proofSurface, [
      'sessions:// projection assertion before and after restart',
    ]);
  } finally {
    teardownFixture();
  }
});

test('sparse scalar and nested arrays normalize without collapsing absent and empty fields', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    assert.deepEqual(surface.get('T-001').dependencies, ['T-000']);
    assert.equal(surface.get('T-001').links, undefined);
    assert.deepEqual(surface.get('T-002').dependencies, ['T-001', 'T-000']);
    assert.deepEqual(surface.get('T-007').dependencies, []);
  } finally {
    teardownFixture();
  }
});

test('frontmatter admits plain, quoted, absent, empty, inline, nested, and folded array values', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-010', [
      '---',
      'id: T-010',
      'title: Frontmatter scalar shapes',
      'type: feature',
      'status: active',
      'change_intent: plain scalar text',
      'affected_boundary: "quoted scalar text"',
      'dependencies: ["T-001", \'T-002\']',
      'proof_surface:',
      'links:',
      '  - sessions:// projection remains a string',
      'non_closure_conditions: >-',
      '  first condition',
      '  remains bounded',
      'priority: high',
      '---',
      '',
      'fixture body',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-010');
    assert.equal(record.changeIntent, 'plain scalar text');
    assert.equal(record.affectedBoundary, 'quoted scalar text');
    assert.equal(record.evaluationCriteria, undefined);
    assert.deepEqual(record.proofSurface, []);
    assert.deepEqual(record.dependencies, ['T-001', 'T-002']);
    assert.deepEqual(record.links, ['sessions:// projection remains a string']);
    assert.deepEqual(record.nonClosureConditions, ['first condition remains bounded']);
    assert.equal(record.priority, 'high', 'block parsing must stop before the next top-level field');
  } finally {
    teardownFixture();
  }
});

test('frontmatter block scalars implement folded and literal clip, strip, and keep chomping', async () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-011', [
      '---',
      'id: T-011',
      'title: Live-shaped block scalar ticket',
      'type: feature',
      'status: active',
      'change_intent: >-',
      '  Reprice the manager around one admitted Project',
      '  while preserving its exact runtime identity.',
      '',
      '  Generic observation remains available.',
      'affected_boundary: >',
      '  Project Context and Sidecar ingress',
      '  across the operator workbench.',
      'intake_source: >+',
      '  Independent exact-candidate review',
      '  over the live manager projection.',
      '',
      'target_truth: |-',
      '  Context binds project id and root.',
      '  No root-only authority remains.',
      'superseded_truth: |',
      '  A matching root is sufficient.',
      '  Project id may drift.',
      'closure_law: |+',
      '  Exact identity is admitted.',
      '  Partial failure remains honest.',
      '',
      'library_rationale: >-',
      '  Ordinary folded text.',
      '    More-indented text remains physical.',
      '',
      '  Ordinary text resumes after a blank.',
      'migration_strategy: |-',
      '  Preserve significant blank indentation.',
      '    ',
      '  Preserve the following line.',
      'priority: high',
      '---',
      '',
      'fixture body',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-011');
    assert.equal(
      record.changeIntent,
      'Reprice the manager around one admitted Project while preserving its exact runtime identity.\nGeneric observation remains available.',
    );
    assert.equal(
      record.affectedBoundary,
      'Project Context and Sidecar ingress across the operator workbench.\n',
    );
    assert.equal(
      record.intakeSource,
      'Independent exact-candidate review over the live manager projection.\n\n',
    );
    assert.equal(
      record.targetTruth,
      'Context binds project id and root.\nNo root-only authority remains.',
    );
    assert.equal(
      record.supersededTruth,
      'A matching root is sufficient.\nProject id may drift.\n',
    );
    assert.equal(
      record.closureLaw,
      'Exact identity is admitted.\nPartial failure remains honest.\n\n',
    );
    assert.equal(
      record.libraryRationale,
      'Ordinary folded text.\n  More-indented text remains physical.\n\nOrdinary text resumes after a blank.',
    );
    assert.equal(
      record.migrationStrategy,
      'Preserve significant blank indentation.\n  \nPreserve the following line.',
    );
    assert.equal(record.priority, 'high');
    const ingress = await loadIngressValidationModule();
    assert.deepEqual(
      ingress.asSidecarTicketCollection([record]),
      [record],
      'live-shaped block scalar text must pass the actual browser ingress',
    );
  } finally {
    teardownFixture();
  }
});

test('sparse block scalars normalize scalar arrays and nested block-list entries', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-012', [
      '# T-012 Sparse Block Scalar Fixture',
      '',
      '- id: T-012',
      '- type: feature',
      '- dependencies: >-',
      '  T-001 completed',
      '  after exact review',
      '- links:',
      '  - >-',
      '    sessions:// projection remains',
      '    stable after restart',
      '- change_intent: |-',
      '  retain the first line',
      '  retain the second line',
      '- status: active',
      '- priority: high',
      '',
      '## Context',
      '',
      'fixture body',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-012');
    assert.deepEqual(record.dependencies, ['T-001 completed after exact review']);
    assert.deepEqual(record.links, [
      'sessions:// projection remains stable after restart',
    ]);
    assert.equal(record.changeIntent, 'retain the first line\nretain the second line');
    assert.equal(record.status, 'active');
    assert.equal(record.priority, 'high');
  } finally {
    teardownFixture();
  }
});

test('rendered block-scalar array values retain literal surrounding quotes', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-019', [
      '---',
      'id: T-019',
      'title: Quoted Block Array Fixture',
      'type: feature',
      'status: active',
      'dependencies: >-',
      '  "T-001 exact quoted dependency"',
      'priority: high',
      '---',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-019');
    assert.deepEqual(record.dependencies, ['"T-001 exact quoted dependency"']);
  } finally {
    teardownFixture();
  }
});

test('sparse EOF clip and keep forms preserve the physical terminal-line-break fact', () => {
  setupFixture();
  try {
    const forms = ['|', '|+', '>', '>+'];
    forms.forEach((indicator, index) => {
      const withLfId = `T-${String(30 + index).padStart(3, '0')}`;
      const withoutLfId = `T-${String(40 + index).padStart(3, '0')}`;
      const ticketLines = (id) => [
        `# ${id} Sparse EOF ${indicator} Fixture`,
        '',
        `- id: ${id}`,
        '- type: feature',
        '- status: active',
        `- change_intent: ${indicator}`,
        '  one physical line',
      ];
      writeRawTicket('active', withLfId, ticketLines(withLfId), `eof-${index}-with-lf`, true);
      writeRawTicket('active', withoutLfId, ticketLines(withoutLfId), `eof-${index}-without-lf`, false);
    });

    const surface = createTicketSurface(fixtureRoot);
    forms.forEach((indicator, index) => {
      const withLfId = `T-${String(30 + index).padStart(3, '0')}`;
      const withoutLfId = `T-${String(40 + index).padStart(3, '0')}`;
      assert.equal(
        surface.get(withLfId).changeIntent,
        'one physical line\n',
        `${indicator} must retain one physical terminal line break`,
      );
      assert.equal(
        surface.get(withoutLfId).changeIntent,
        'one physical line',
        `${indicator} must not invent a terminal line break`,
      );
    });
  } finally {
    teardownFixture();
  }
});

test('canonical governance shorthand normalizes to exact method objects through actual ingress', async () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-050', [
      '# T-050 Sparse Governance Shorthand Fixture',
      '',
      '- id: T-050',
      '- type: feature',
      '- status: active',
      '- governance_scope_expansion: [S, T, D, O, U]',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-050');
    assert.deepEqual(record.governanceScopeExpansion, [
      { S: 'SPEC_METHOD.md' },
      { T: 'TICKET_METHOD.md' },
      { D: 'DESIGN_MODULE_METHOD.md' },
      { O: 'ODD_METHOD.md' },
      { U: 'UX_METHOD.md' },
    ]);
    const ingress = await loadIngressValidationModule();
    assert.deepEqual(ingress.asSidecarTicketCollection([record]), [record]);
  } finally {
    teardownFixture();
  }
});

test('unknown bare governance shorthand fails closed', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-051', [
      '# T-051 Unknown Governance Shorthand Fixture',
      '',
      '- id: T-051',
      '- type: feature',
      '- status: active',
      '- governance_scope_expansion: [S, X]',
    ]);
    assert.throws(
      () => loadAllTickets(fixtureRoot),
      /unsupported governance_scope_expansion shorthand: X/,
    );
  } finally {
    teardownFixture();
  }
});

test('legacy ticket_type normalizes once to canonical TicketRecord type', async () => {
  setupFixture();
  try {
    writeRawTicket('completed', 'T-052', [
      '---',
      'id: T-052',
      'title: Legacy Ticket Type Fixture',
      'ticket_type: implementation',
      'status: completed',
      'priority: high',
      '---',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-052');
    assert.equal(record.type, 'implementation');
    assert.equal(record.raw.ticket_type, 'implementation');
    assert.equal(record.raw.type, undefined);
    const ingress = await loadIngressValidationModule();
    assert.deepEqual(ingress.asSidecarTicketCollection([record]), [record]);

    writeRawTicket('completed', 'T-053', [
      '# T-053 Sparse Legacy Ticket Type Fixture',
      '',
      '- id: T-053',
      '- ticket_type: implementation',
      '- status: completed',
      '- priority: high',
    ]);
    const sparseRecord = createTicketSurface(fixtureRoot).get('T-053');
    assert.equal(sparseRecord.type, 'implementation');
    assert.equal(sparseRecord.raw.ticket_type, 'implementation');
    assert.equal(sparseRecord.raw.type, undefined);
    assert.deepEqual(ingress.asSidecarTicketCollection([sparseRecord]), [sparseRecord]);
  } finally {
    teardownFixture();
  }
});

test('block scalar indentation fails closed instead of admitting a marker or truncated value', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-013', [
      '---',
      'id: T-013',
      'title: Malformed Block Scalar Fixture',
      'type: feature',
      'change_intent: >-',
      '    first line establishes four-space content indentation',
      '  second line illegally dedents inside the scalar',
      'status: active',
      '---',
    ]);
    assert.throws(
      () => loadAllTickets(fixtureRoot),
      /malformed indentation/,
    );
  } finally {
    teardownFixture();
  }
});

test('optional block scalar rejects unindented content that is not next-field metadata', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-014', [
      '---',
      'id: T-014',
      'title: Unindented Optional Block Scalar Fixture',
      'type: feature',
      'status: active',
      'change_intent: >-',
      'not indented',
      'priority: high',
      '---',
    ]);
    assert.throws(
      () => loadAllTickets(fixtureRoot),
      /frontmatter\.change_intent has malformed indentation: unindented content is not a metadata boundary/,
    );
  } finally {
    teardownFixture();
  }
});

test('block scalar rejects an over-indented leading blank line', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-015', [
      '---',
      'id: T-015',
      'title: Over-indented Leading Blank Fixture',
      'type: feature',
      'status: active',
      'change_intent: |-',
      '    ',
      '  first nonblank line establishes two-space indentation',
      'priority: high',
      '---',
    ]);
    assert.throws(
      () => loadAllTickets(fixtureRoot),
      /leading blank line is more indented than its content/,
    );
  } finally {
    teardownFixture();
  }
});

test('sparse keep chomping at EOF removes only the manufactured split sentinel', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-016', [
      '# T-016 Sparse EOF Keep Fixture',
      '',
      '- id: T-016',
      '- type: feature',
      '- status: active',
      '- change_intent: |+',
      '  one physical line',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-016');
    assert.equal(record.changeIntent, 'one physical line\n');
  } finally {
    teardownFixture();
  }
});

test('sparse final block admits an explicit Markdown body boundary and ignores body bullets', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-017', [
      '# T-017 Sparse Body Boundary Fixture',
      '',
      'Historical disposition preamble retained as Markdown.',
      '',
      '## Intake Triage',
      '',
      'The canonical sparse record begins below this preamble.',
      '',
      '- id: T-017',
      '- type: feature',
      '- status: active',
      '- authority_refs:',
      '  - specification/GOALS.md',
      '  - specification/PRODUCT.md',
      '- closure_law: >-',
      '  Close only after exact review',
      '  of the admitted candidate.',
      '',
      '## Context',
      '',
      '- status: completed',
      '- change_intent: body prose is not ticket metadata',
    ]);
    const record = createTicketSurface(fixtureRoot).get('T-017');
    assert.equal(record.closureLaw, 'Close only after exact review of the admitted candidate.');
    assert.deepEqual(record.authority_refs, [
      'specification/GOALS.md',
      'specification/PRODUCT.md',
    ]);
    assert.equal(record.status, 'active');
    assert.equal(record.changeIntent, undefined);
  } finally {
    teardownFixture();
  }
});

test('sparse block scalar rejects arbitrary dedented content before its body boundary', () => {
  setupFixture();
  try {
    writeRawTicket('active', 'T-018', [
      '# T-018 Sparse Malformed Dedent Fixture',
      '',
      '- id: T-018',
      '- type: feature',
      '- status: active',
      '- change_intent: >-',
      'not a sparse metadata field or Markdown body heading',
      '- priority: high',
    ]);
    assert.throws(
      () => loadAllTickets(fixtureRoot),
      /sparse\.change_intent has malformed indentation: unindented content is not a metadata boundary/,
    );
  } finally {
    teardownFixture();
  }
});

test('the complete producer collection passes the exact Sidecar TicketRecord ingress', async () => {
  setupFixture();
  try {
    const ingress = await loadIngressValidationModule();
    const records = loadAllTickets(fixtureRoot);
    assert.deepEqual(ingress.asSidecarTicketCollection(records), records);
  } finally {
    teardownFixture();
  }
});

test('filter by lane returns lane-scoped records only', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const completed = surface.list({ lane: 'completed' });
    assert.equal(completed.length, 1);
    assert.equal(completed[0].lane, 'completed');
  } finally {
    teardownFixture();
  }
});

test('filter by buildTenant scopes records', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const reactVite = surface.list({ buildTenant: 'react_vite' });
    assert.equal(reactVite.length, 3);
  } finally {
    teardownFixture();
  }
});

test('filter by hasDependency finds downstream tickets', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const dependsOnT007 = surface.list({ hasDependency: 'T-007' });
    assert.deepEqual(dependsOnT007.map((record) => record.id), ['T-008']);
  } finally {
    teardownFixture();
  }
});

test('demo: print fixture surface summary', () => {
  setupFixture();
  try {
    const surface = createTicketSurface(fixtureRoot);
    const all = surface.list();
    const byLane = all.reduce((acc, r) => {
      acc[r.lane] = (acc[r.lane] ?? 0) + 1;
      return acc;
    }, {});
    /* eslint-disable no-console */
    console.log('\n=== TicketAssetSurface fixture read ===');
    console.log(`projectRoot: ${fixtureRoot}`);
    console.log(`total: ${all.length}  by-lane:`, byLane);
    console.log('STDO-UX tickets:',
      surface.list().filter((r) => r.governanceScope === 'STDO-UX Method').map((r) => r.id));
    /* eslint-enable no-console */
  } finally {
    teardownFixture();
  }
});
