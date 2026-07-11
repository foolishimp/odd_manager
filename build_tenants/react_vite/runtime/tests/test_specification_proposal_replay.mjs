import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const here = dirname(fileURLToPath(import.meta.url));
const sourceRoot = resolve(here, '../../src');

async function loadTypeScriptModule(relativePath) {
  const source = readFileSync(resolve(sourceRoot, relativePath), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`);
}

function project(id) {
  return {
    id,
    root: `/workspace/${id}`,
    label: id,
    publishedProductRef: `product://${id}`,
  };
}

function revision(seed) {
  return {
    kind: 'commit',
    revision: seed.repeat(40).slice(0, 40),
    dirty: false,
    sourceDigest: seed.repeat(40).slice(0, 40),
    specificationDigest: `sha256:spec-${seed}`,
    observedAt: '2026-07-11T00:00:00.000Z',
  };
}

function proposalRecord(id, projectRef, basisRevision, status = 'draft') {
  const validation = status === 'valid'
    ? ['basis', 'scope', 'whitespace', 'apply'].map((name) => ({
        checkRef: `validation://odd_manager/specification-proposal/${name}`,
        status: 'passed',
        detail: `${name} passed`,
        sourceRefs: ['specification/PRODUCT.md'],
      }))
    : [];
  return {
    schemaVersion: '1',
    proposalId: id,
    project: projectRef,
    basisRevision,
    participantRef: 'participant://codex/specification-proposal',
    createdAt: '2026-07-11T00:01:00.000Z',
    status,
    prompt: 'Clarify the product boundary.',
    summary: 'Clarify PRODUCT',
    contextAttachments: [],
    patch: [
      'diff --git a/specification/PRODUCT.md b/specification/PRODUCT.md',
      '--- a/specification/PRODUCT.md',
      '+++ b/specification/PRODUCT.md',
      '@@ -1 +1,2 @@',
      ' # Product',
      '+Bounded truth.',
      '',
    ].join('\n'),
    validation,
    affectedSurfaceRefs: ['specification/PRODUCT.md'],
    predecessorProposalId: null,
    resultingRevision: null,
    decision: null,
    sourceRefs: [`proposal://${id}`],
  };
}

test('proposal Msg replay preserves one generate, validate, and accept command path', async () => {
  const update = await loadTypeScriptModule('capabilities/specification-proposal/update.ts');
  const state = await loadTypeScriptModule('capabilities/specification-proposal/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const initial = update.updateSpecificationProposal(state.createSpecificationProposalState(), {
    type: 'proposal/context-changed',
    project: projectRef,
    revision: basis,
  });
  const historyLoaded = update.updateSpecificationProposal(initial.state, {
    type: 'proposal/history-loaded',
    commandId: initial.commands[0].commandId,
    projectRoot: projectRef.root,
    history: {
      schemaVersion: '1',
      projectRoot: projectRef.root,
      proposals: [],
      retentionLimit: 50,
      truncated: false,
      sourceRefs: ['proposal-store://project-a'],
    },
  }).state;
  const generatedRequest = update.replaySpecificationProposalMessages(historyLoaded, [
    { type: 'proposal/prompt-edited', value: 'Clarify the product boundary.' },
    { type: 'proposal/generate-requested' },
  ]);
  assert.deepEqual(generatedRequest.commands.map((entry) => entry.type), ['proposal.generate']);

  const generated = proposalRecord('proposal-1', projectRef, basis);
  const generatedState = update.updateSpecificationProposal(generatedRequest.state, {
    type: 'proposal/generated',
    commandId: generatedRequest.commands[0].commandId,
    projectRoot: projectRef.root,
    proposal: generated,
  }).state;
  const validateRequest = update.updateSpecificationProposal(generatedState, {
    type: 'proposal/validate-requested',
  });
  assert.equal(validateRequest.commands[0].type, 'proposal.validate');

  const valid = proposalRecord('proposal-1', projectRef, basis, 'valid');
  const validatedState = update.updateSpecificationProposal(validateRequest.state, {
    type: 'proposal/validated',
    commandId: validateRequest.commands[0].commandId,
    projectRoot: projectRef.root,
    proposal: valid,
  }).state;
  const acceptRequest = update.updateSpecificationProposal(validatedState, {
    type: 'proposal/accept-requested',
    actorRef: 'actor://operator/jim',
  });
  assert.equal(acceptRequest.commands[0].type, 'proposal.accept');
  assert.equal(acceptRequest.commands[0].actorRef, 'actor://operator/jim');

  const accepted = {
    ...valid,
    status: 'accepted',
    resultingRevision: revision('b'),
    decision: {
      kind: 'accepted',
      actorRef: 'actor://operator/jim',
      decidedAt: '2026-07-11T00:02:00.000Z',
      basisRevision: basis,
      changedSurfaceRefs: ['specification/PRODUCT.md'],
    },
  };
  const acceptedState = update.updateSpecificationProposal(acceptRequest.state, {
    type: 'proposal/accepted',
    commandId: acceptRequest.commands[0].commandId,
    projectRoot: projectRef.root,
    proposal: accepted,
  }).state;
  assert.equal(acceptedState.currentProposal.status, 'accepted');
  assert.equal(acceptedState.pendingCommands.length, 1);
  assert.equal(acceptedState.pendingCommands[0].type, 'proposal.refresh-context');
  assert.equal(acceptedState.pendingCommands[0].reason, 'accepted');
  const consumed = update.updateSpecificationProposal(acceptedState, {
    type: 'proposal/supporting-command-consumed',
    commandId: acceptedState.pendingCommands[0].commandId,
  }).state;
  assert.equal(consumed.pendingCommands.length, 0);
});

test('proposal replay rejects late cross-Project generation results', async () => {
  const update = await loadTypeScriptModule('capabilities/specification-proposal/update.ts');
  const state = await loadTypeScriptModule('capabilities/specification-proposal/state.ts');
  const projectA = project('project-a');
  const projectB = project('project-b');
  const basisA = revision('a');
  const basisB = revision('b');
  const contextA = update.updateSpecificationProposal(state.createSpecificationProposalState(), {
    type: 'proposal/context-changed', project: projectA, revision: basisA,
  });
  const readyA = update.updateSpecificationProposal(contextA.state, {
    type: 'proposal/history-loaded',
    commandId: contextA.commands[0].commandId,
    projectRoot: projectA.root,
    history: {
      schemaVersion: '1', projectRoot: projectA.root, proposals: [], retentionLimit: 50,
      truncated: false, sourceRefs: ['proposal-store://a'],
    },
  }).state;
  const requestedA = update.replaySpecificationProposalMessages(readyA, [
    { type: 'proposal/prompt-edited', value: 'Candidate A' },
    { type: 'proposal/generate-requested' },
  ]);
  const contextB = update.updateSpecificationProposal(requestedA.state, {
    type: 'proposal/context-changed', project: projectB, revision: basisB,
  }).state;
  const late = update.updateSpecificationProposal(contextB, {
    type: 'proposal/generated',
    commandId: requestedA.commands[0].commandId,
    projectRoot: projectA.root,
    proposal: proposalRecord('proposal-a', projectA, basisA),
  });
  assert.equal(late.state.project.root, projectB.root);
  assert.equal(late.state.currentProposal, null);
});

test('attention context handoff is bounded and proposal drafts remain Project-isolated', async () => {
  const update = await loadTypeScriptModule('capabilities/specification-proposal/update.ts');
  const state = await loadTypeScriptModule('capabilities/specification-proposal/state.ts');
  const projectA = project('project-a');
  const projectB = project('project-b');
  const basisA = revision('a');
  const basisA2 = revision('c');
  const basisB = revision('b');
  const contextA = update.updateSpecificationProposal(state.createSpecificationProposalState(), {
    type: 'proposal/context-changed', project: projectA, revision: basisA,
  }).state;
  const prepared = update.replaySpecificationProposalMessages(contextA, [
    { type: 'proposal/context-attachment-edited', value: 'specification/PRODUCT.md' },
    { type: 'proposal/prompt-edited', value: 'Clarify this pressure.' },
    { type: 'proposal/refinement-edited', value: 'Keep the boundary narrow.' },
    { type: 'proposal/context-attached', sourceRef: 'git://project-a/aaaaaaaa' },
    { type: 'proposal/context-attached', sourceRef: 'git://project-a/aaaaaaaa' },
  ]).state;
  assert.equal(prepared.contextAttachmentDraft, 'specification/PRODUCT.md');
  assert.deepEqual(prepared.contextAttachmentRefs, ['git://project-a/aaaaaaaa']);

  const refreshed = update.updateSpecificationProposal(prepared, {
    type: 'proposal/context-changed', project: projectA, revision: basisA2,
  }).state;
  assert.equal(refreshed.promptDraft, 'Clarify this pressure.');
  assert.equal(refreshed.refinementDraft, 'Keep the boundary narrow.');
  assert.equal(refreshed.contextAttachmentDraft, 'specification/PRODUCT.md');
  assert.deepEqual(refreshed.contextAttachmentRefs, ['git://project-a/aaaaaaaa']);

  const switched = update.updateSpecificationProposal(refreshed, {
    type: 'proposal/context-changed', project: projectB, revision: basisB,
  }).state;
  assert.equal(switched.promptDraft, '');
  assert.equal(switched.refinementDraft, '');
  assert.equal(switched.contextAttachmentDraft, '');
  assert.deepEqual(switched.contextAttachmentRefs, []);
});

test('proposal command failure is explicit and cannot invent a proposal', async () => {
  const update = await loadTypeScriptModule('capabilities/specification-proposal/update.ts');
  const state = await loadTypeScriptModule('capabilities/specification-proposal/state.ts');
  const projectRef = project('project-a');
  const basis = revision('a');
  const context = update.updateSpecificationProposal(state.createSpecificationProposalState(), {
    type: 'proposal/context-changed', project: projectRef, revision: basis,
  });
  const ready = update.updateSpecificationProposal(context.state, {
    type: 'proposal/history-loaded',
    commandId: context.commands[0].commandId,
    projectRoot: projectRef.root,
    history: {
      schemaVersion: '1', projectRoot: projectRef.root, proposals: [], retentionLimit: 50,
      truncated: false, sourceRefs: ['proposal-store://a'],
    },
  }).state;
  const request = update.replaySpecificationProposalMessages(ready, [
    { type: 'proposal/prompt-edited', value: 'Fail explicitly.' },
    { type: 'proposal/generate-requested' },
  ]);
  const failed = update.updateSpecificationProposal(request.state, {
    type: 'proposal/generate-failed',
    commandId: request.commands[0].commandId,
    error: 'provider unavailable',
    proposal: null,
  }).state;
  assert.equal(failed.status, 'error');
  assert.equal(failed.error, 'provider unavailable');
  assert.equal(failed.currentProposal, null);
  assert.equal(failed.pendingCommands.length, 0);
});

test('stale proposal acceptance is blocked and regeneration preserves predecessor on the current basis', async () => {
  const update = await loadTypeScriptModule('capabilities/specification-proposal/update.ts');
  const state = await loadTypeScriptModule('capabilities/specification-proposal/state.ts');
  const projectRef = project('project-a');
  const basisA = revision('a');
  const basisB = revision('b');
  const stale = proposalRecord('proposal-stale', projectRef, basisA, 'valid');
  const context = update.updateSpecificationProposal({
    ...state.createSpecificationProposalState(),
    project: projectRef,
    basisRevision: basisA,
    currentProposal: stale,
    history: [stale],
    selectedProposalId: stale.proposalId,
  }, {
    type: 'proposal/context-changed', project: projectRef, revision: basisB,
  });
  assert.equal(context.commands[0].type, 'proposal.history');
  const loaded = update.updateSpecificationProposal(context.state, {
    type: 'proposal/history-loaded',
    commandId: context.commands[0].commandId,
    projectRoot: projectRef.root,
    history: {
      schemaVersion: '1', projectRoot: projectRef.root, proposals: [stale], retentionLimit: 50,
      truncated: false, sourceRefs: ['proposal-store://a'],
    },
  }).state;
  const blocked = update.updateSpecificationProposal(loaded, {
    type: 'proposal/accept-requested', actorRef: 'actor://operator/test',
  });
  assert.equal(blocked.commands.length, 0);

  const regenerated = update.updateSpecificationProposal(loaded, {
    type: 'proposal/regenerate-requested',
  });
  assert.equal(regenerated.commands[0].type, 'proposal.generate');
  assert.equal(regenerated.commands[0].predecessorProposalId, stale.proposalId);
  assert.equal(regenerated.commands[0].basisRevision.revision, basisB.revision);
  assert.equal(regenerated.commands[0].prompt, stale.prompt);

  const rejectRequest = update.updateSpecificationProposal(loaded, {
    type: 'proposal/reject-requested', actorRef: 'actor://operator/test',
  });
  const rejected = update.updateSpecificationProposal(rejectRequest.state, {
    type: 'proposal/rejected',
    commandId: rejectRequest.commands[0].commandId,
    projectRoot: projectRef.root,
    proposal: {
      ...stale,
      status: 'rejected',
      decision: {
        kind: 'rejected', actorRef: 'actor://operator/test',
        decidedAt: '2026-07-11T00:03:00.000Z', basisRevision: basisA, changedSurfaceRefs: [],
      },
    },
  });
  assert.equal(rejected.state.currentProposal.status, 'rejected');
  assert.equal(rejected.state.pendingCommands.length, 0);
});

test('structured diff projection preserves file and line semantics', async () => {
  const selectors = await loadTypeScriptModule('capabilities/specification-proposal/selectors.ts');
  const record = proposalRecord('proposal-1', project('project-a'), revision('a'), 'valid');
  const files = selectors.selectProposalDiff(record);
  assert.equal(files.length, 1);
  assert.equal(files[0].path, 'specification/PRODUCT.md');
  assert.equal(files[0].lines.find((line) => line.kind === 'addition').content, 'Bounded truth.');
  assert.equal(selectors.selectProposalCanAccept(record), true);
});
