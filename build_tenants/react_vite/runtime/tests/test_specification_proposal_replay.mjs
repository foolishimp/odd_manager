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
    correlationId: initial.commands[0].correlationId,
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
  const wrongGeneratePayload = update.updateSpecificationProposal(generatedRequest.state, {
    type: 'proposal/generated',
    commandId: generatedRequest.commands[0].commandId,
    correlationId: generatedRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: { ...generated, prompt: 'A different request.' },
  });
  assert.strictEqual(wrongGeneratePayload.state, generatedRequest.state);
  const generatedState = update.updateSpecificationProposal(generatedRequest.state, {
    type: 'proposal/generated',
    commandId: generatedRequest.commands[0].commandId,
    correlationId: generatedRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: generated,
  }).state;
  const validateRequest = update.updateSpecificationProposal(generatedState, {
    type: 'proposal/validate-requested',
  });
  assert.equal(validateRequest.commands[0].type, 'proposal.validate');

  const valid = proposalRecord('proposal-1', projectRef, basis, 'valid');
  const wrongValidateTarget = update.updateSpecificationProposal(validateRequest.state, {
    type: 'proposal/validated',
    commandId: validateRequest.commands[0].commandId,
    correlationId: validateRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: { ...valid, proposalId: 'proposal-forged' },
  });
  assert.strictEqual(wrongValidateTarget.state, validateRequest.state);
  const authorityIncreasingValidation = update.updateSpecificationProposal(validateRequest.state, {
    type: 'proposal/validated',
    commandId: validateRequest.commands[0].commandId,
    correlationId: validateRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: {
      ...valid,
      status: 'accepted',
      resultingRevision: revision('b'),
      decision: {
        kind: 'accepted',
        actorRef: 'actor://forged',
        decidedAt: '2026-07-11T00:01:30.000Z',
        basisRevision: basis,
        changedSurfaceRefs: valid.affectedSurfaceRefs,
      },
    },
  });
  assert.strictEqual(authorityIncreasingValidation.state, validateRequest.state);
  const validatedState = update.updateSpecificationProposal(validateRequest.state, {
    type: 'proposal/validated',
    commandId: validateRequest.commands[0].commandId,
    correlationId: validateRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: valid,
  }).state;
  const acceptRequest = update.updateSpecificationProposal(validatedState, {
    type: 'proposal/accept-requested',
    actorRef: 'actor://operator/jim',
  });
  assert.equal(acceptRequest.commands[0].type, 'proposal.accept');
  assert.equal(acceptRequest.commands[0].actorRef, 'actor://operator/jim');

  const incompleteAcceptance = update.updateSpecificationProposal(acceptRequest.state, {
    type: 'proposal/accepted',
    commandId: acceptRequest.commands[0].commandId,
    correlationId: acceptRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: valid,
  });
  assert.strictEqual(incompleteAcceptance.state, acceptRequest.state);

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
    correlationId: acceptRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: accepted,
  }).state;
  assert.equal(acceptedState.currentProposal.status, 'accepted');
  assert.equal(acceptedState.pendingCommands.length, 1);
  assert.equal(acceptedState.pendingCommands[0].type, 'proposal.refresh-context');
  assert.equal(acceptedState.pendingCommands[0].reason, 'accepted');

  const wrongActorAcceptance = update.updateSpecificationProposal(acceptRequest.state, {
    type: 'proposal/accepted',
    commandId: acceptRequest.commands[0].commandId,
    correlationId: acceptRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    proposal: {
      ...accepted,
      decision: { ...accepted.decision, actorRef: 'actor://forged' },
    },
  });
  assert.strictEqual(wrongActorAcceptance.state, acceptRequest.state);
  const consumed = update.updateSpecificationProposal(acceptedState, {
    type: 'proposal/supporting-command-consumed',
    commandId: acceptedState.pendingCommands[0].commandId,
    correlationId: acceptedState.pendingCommands[0].correlationId,
  }).state;
  assert.equal(consumed.pendingCommands.length, 0);
  const terminalRefine = update.replaySpecificationProposalMessages(consumed, [
    { type: 'proposal/refinement-edited', value: 'Continue from accepted evidence.' },
    { type: 'proposal/refine-requested' },
  ]);
  assert.deepEqual(terminalRefine.commands, []);
  assert.equal(terminalRefine.state.currentProposal.status, 'accepted');
  const terminalHistoryRequest = update.updateSpecificationProposal(consumed, {
    type: 'proposal/history-requested',
  });
  const terminalDowngrade = update.updateSpecificationProposal(terminalHistoryRequest.state, {
    type: 'proposal/history-loaded',
    commandId: terminalHistoryRequest.commands[0].commandId,
    correlationId: terminalHistoryRequest.commands[0].correlationId,
    projectRoot: projectRef.root,
    history: {
      schemaVersion: '1',
      projectRoot: projectRef.root,
      proposals: [valid],
      retentionLimit: 50,
      truncated: false,
      sourceRefs: ['proposal-store://project-a'],
    },
  });
  assert.strictEqual(terminalDowngrade.state, terminalHistoryRequest.state);
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
  const crossProjectHistory = update.updateSpecificationProposal(contextA.state, {
    type: 'proposal/history-loaded',
    commandId: contextA.commands[0].commandId,
    correlationId: contextA.commands[0].correlationId,
    projectRoot: projectA.root,
    history: {
      schemaVersion: '1',
      projectRoot: projectA.root,
      proposals: [proposalRecord('proposal-b', projectB, basisB)],
      retentionLimit: 50,
      truncated: false,
      sourceRefs: ['proposal-store://a'],
    },
  });
  assert.strictEqual(crossProjectHistory.state, contextA.state);
  const incoherentHistory = update.updateSpecificationProposal(contextA.state, {
    type: 'proposal/history-loaded',
    commandId: contextA.commands[0].commandId,
    correlationId: contextA.commands[0].correlationId,
    projectRoot: projectA.root,
    history: {
      schemaVersion: '1',
      projectRoot: projectA.root,
      proposals: [{
        ...proposalRecord('proposal-forged', projectA, basisA, 'valid'),
        status: 'accepted',
        decision: null,
        resultingRevision: null,
      }],
      retentionLimit: 50,
      truncated: false,
      sourceRefs: ['proposal-store://a'],
    },
  });
  assert.strictEqual(incoherentHistory.state, contextA.state);
  const brokenLineageHistory = update.updateSpecificationProposal(contextA.state, {
    type: 'proposal/history-loaded',
    commandId: contextA.commands[0].commandId,
    correlationId: contextA.commands[0].correlationId,
    projectRoot: projectA.root,
    history: {
      schemaVersion: '1',
      projectRoot: projectA.root,
      proposals: [{
        ...proposalRecord('proposal-orphan', projectA, basisA),
        predecessorProposalId: 'proposal-missing',
      }],
      retentionLimit: 50,
      truncated: false,
      sourceRefs: ['proposal-store://a'],
    },
  });
  assert.strictEqual(brokenLineageHistory.state, contextA.state);
  const cyclicLineageHistory = update.updateSpecificationProposal(contextA.state, {
    type: 'proposal/history-loaded',
    commandId: contextA.commands[0].commandId,
    correlationId: contextA.commands[0].correlationId,
    projectRoot: projectA.root,
    history: {
      schemaVersion: '1',
      projectRoot: projectA.root,
      proposals: [
        { ...proposalRecord('proposal-cycle-a', projectA, basisA), predecessorProposalId: 'proposal-cycle-b' },
        { ...proposalRecord('proposal-cycle-b', projectA, basisA), predecessorProposalId: 'proposal-cycle-a' },
      ],
      retentionLimit: 50,
      truncated: false,
      sourceRefs: ['proposal-store://a'],
    },
  });
  assert.strictEqual(cyclicLineageHistory.state, contextA.state);
  const readyA = update.updateSpecificationProposal(contextA.state, {
    type: 'proposal/history-loaded',
    commandId: contextA.commands[0].commandId,
    correlationId: contextA.commands[0].correlationId,
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
  const concurrentHistory = update.updateSpecificationProposal(requestedA.state, {
    type: 'proposal/history-requested',
  });
  assert.deepEqual(concurrentHistory.commands, []);
  assert.strictEqual(concurrentHistory.state, requestedA.state);
  const crossProjectCurrentResult = update.updateSpecificationProposal(requestedA.state, {
    type: 'proposal/generated',
    commandId: requestedA.commands[0].commandId,
    correlationId: requestedA.commands[0].correlationId,
    projectRoot: projectA.root,
    proposal: proposalRecord('proposal-b', projectB, basisA),
  });
  assert.strictEqual(crossProjectCurrentResult.state, requestedA.state);
  const contextB = update.updateSpecificationProposal(requestedA.state, {
    type: 'proposal/context-changed', project: projectB, revision: basisB,
  }).state;
  const late = update.updateSpecificationProposal(contextB, {
    type: 'proposal/generated',
    commandId: requestedA.commands[0].commandId,
    correlationId: requestedA.commands[0].correlationId,
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

  const sameRootDifferentIdentity = update.updateSpecificationProposal(refreshed, {
    type: 'proposal/context-changed',
    project: {
      ...projectA,
      id: 'project-a-replaced',
      label: 'replacement',
    },
    revision: basisA2,
  }).state;
  assert.equal(sameRootDifferentIdentity.currentProposal, null);
  assert.deepEqual(sameRootDifferentIdentity.history, []);
  assert.equal(sameRootDifferentIdentity.promptDraft, '');
  assert.deepEqual(sameRootDifferentIdentity.contextAttachmentRefs, []);

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
    correlationId: context.commands[0].correlationId,
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
    correlationId: request.commands[0].correlationId,
    error: 'provider unavailable',
    proposal: null,
  }).state;
  assert.equal(failed.status, 'error');
  assert.equal(failed.error, 'provider unavailable');
  assert.equal(failed.currentProposal, null);
  assert.equal(failed.pendingCommands.length, 0);

  const validProposal = proposalRecord('proposal-a', projectRef, basis, 'valid');
  const accepting = update.updateSpecificationProposal({
    ...state.createSpecificationProposalState(),
    project: projectRef,
    basisRevision: basis,
    currentProposal: validProposal,
    history: [validProposal],
    selectedProposalId: validProposal.proposalId,
  }, {
    type: 'proposal/accept-requested',
    actorRef: 'actor://operator/current',
  });
  const acceptCommand = accepting.commands[0];

  const wrongFailureKind = update.updateSpecificationProposal(accepting.state, {
    type: 'proposal/validation-failed',
    commandId: acceptCommand.commandId,
    correlationId: acceptCommand.correlationId,
    error: 'wrong command family',
    proposal: validProposal,
  });
  assert.strictEqual(wrongFailureKind.state, accepting.state);

  const crossProjectFailure = update.updateSpecificationProposal(accepting.state, {
    type: 'proposal/accept-failed',
    commandId: acceptCommand.commandId,
    correlationId: acceptCommand.correlationId,
    error: 'cross-Project payload',
    proposal: {
      ...validProposal,
      project: project('project-b'),
    },
  });
  assert.strictEqual(crossProjectFailure.state, accepting.state);

  const staleBasisPayload = update.updateSpecificationProposal(accepting.state, {
    type: 'proposal/accept-failed',
    commandId: acceptCommand.commandId,
    correlationId: acceptCommand.correlationId,
    error: 'wrong basis payload',
    proposal: {
      ...validProposal,
      basisRevision: revision('b'),
    },
  });
  assert.strictEqual(staleBasisPayload.state, accepting.state);

  const admittedAcceptFailure = update.updateSpecificationProposal(accepting.state, {
    type: 'proposal/accept-failed',
    commandId: acceptCommand.commandId,
    correlationId: acceptCommand.correlationId,
    error: 'basis changed before apply',
    proposal: { ...validProposal, status: 'stale' },
  });
  assert.equal(admittedAcceptFailure.state.currentProposal.status, 'stale');
  assert.equal(admittedAcceptFailure.state.error, 'basis changed before apply');
  assert.deepEqual(
    admittedAcceptFailure.commands.map((command) => command.type),
    ['proposal.refresh-context'],
  );

  const authorityIncreasingFailure = update.updateSpecificationProposal(accepting.state, {
    type: 'proposal/accept-failed',
    commandId: acceptCommand.commandId,
    correlationId: acceptCommand.correlationId,
    error: 'forged terminal payload',
    proposal: {
      ...validProposal,
      status: 'accepted',
      resultingRevision: revision('b'),
      decision: {
        kind: 'accepted',
        actorRef: 'actor://operator/current',
        decidedAt: '2026-07-11T00:02:00.000Z',
        basisRevision: basis,
        changedSurfaceRefs: validProposal.affectedSurfaceRefs,
      },
    },
  });
  assert.strictEqual(authorityIncreasingFailure.state, accepting.state);
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
    correlationId: context.commands[0].correlationId,
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
    correlationId: rejectRequest.commands[0].correlationId,
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
