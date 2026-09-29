import { createHash } from 'node:crypto';

import { visualGraphProjectionSchema } from '@odd-manager/developer-control-contracts';
import {
  abgEventSequence,
  indexAbgEventCarrier, scopeAbgEventCarrier,
} from './abg-event-carrier-service.mjs';
import {
  discoverProjectObservationTopology,
  loadObservationRunProofSnapshot,
} from './project-observation-topology-service.mjs';

const MAX_NODES = 240;
const MAX_EDGES = 480;
const MAX_WORKSPACE_OBSERVATIONS = 80;
const MAX_ACTOR_SESSIONS = 80;
const MAX_DIAGNOSTICS = 80;
const OCCURRENCE_TYPES = new Set([
  'run', 'graph_call', 'frame', 'c_call', 'actor_invocation', 'process',
]);
const OPEN_KINDS = new Set([
  'run_segment_opened', 'graph_call_opened', 'frame_opened', 'c_call_opened',
  'actor_invocation_started', 'actor_process_started',
]);
const CLOSED_KINDS = new Set([
  'run_closed', 'graph_call_closed', 'frame_closed', 'c_call_judged',
  'actor_invocation_closed', 'actor_process_exited',
]);
const FAILED_KINDS = new Set([
  'actor_invocation_failed', 'actor_process_spawn_failed',
  'actor_process_termination_unconfirmed',
]);

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value, maxBytes = 4096) {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value) <= maxBytes
    ? value
    : null;
}

function statusTokenOrNull(value, maxBytes = 80) {
  const token = stringOrNull(value, maxBytes);
  return token && /^[a-z][a-z0-9_]*$/u.test(token) ? token : null;
}

function identifierTokenOrNull(value, maxLength = 240) {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= maxLength
    && /^[A-Za-z0-9][A-Za-z0-9._:-]*$/u.test(value)
    ? value
    : null;
}

function publishedRefOrNull(value) {
  const ref = stringOrNull(value);
  return ref
    && /^(?:[a-z][a-z0-9+.-]*:(?:\/\/)?[^\s]+|[a-z][a-z0-9._-]+@[0-9]+)$/iu.test(ref)
    && !ref.startsWith('/')
    && !/^file:/iu.test(ref)
    && !/[\u0000-\u001f\u007f]/u.test(ref)
    ? ref
    : null;
}

function digestOrNull(value) {
  return typeof value === 'string' && /^sha256:[0-9a-f]{64}$/u.test(value) ? value : null;
}

function numberOrNull(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function eventCoordinate(event) {
  const eventId = publishedRefOrNull(event?.eventId);
  const ordinal = numberOrNull(event?.sourceOrdinal);
  const kind = statusTokenOrNull(event?.kind, 160);
  return eventId && ordinal !== null && kind ? { eventId, ordinal, kind } : null;
}

function diagnostic(severity, code, message, sourceEvent = null) {
  return { severity, code, message, sourceEvent };
}

function sha256Text(value) {
  return createHash('sha256').update(value).digest('hex');
}

function canonicalJson(value) {
  if (value === null || typeof value === 'boolean' || typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('canonical JSON does not admit non-finite numbers');
    return Object.is(value, -0) ? '0' : JSON.stringify(value);
  }
  if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(',')}]`;
  if (!isRecord(value)) throw new TypeError('canonical JSON value is unsupported');
  return `{${Object.entries(value)
    .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
    .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
    .join(',')}}`;
}

function canonicalDigest(value) {
  return `sha256:${createHash('sha256').update(canonicalJson(value)).digest('hex')}`;
}

function exactConstructionResultOrNull(value) {
  if (
    !isRecord(value)
    || value.kind !== 'worksite_construction_result'
    || value.schemaVersion !== '5.0.0'
    || !Array.isArray(value.members)
    || value.members.length === 0
    || !publishedRefOrNull(value.sourceApplicationRef)
    || !digestOrNull(value.resultDigest)
    || !publishedRefOrNull(value.resultRef)
    || Object.keys(value).sort().join('\n') !== [
      'kind', 'members', 'resultDigest', 'resultRef', 'schemaVersion', 'sourceApplicationRef',
    ].sort().join('\n')
  ) return null;
  const resultDigest = canonicalDigest({
    sourceApplicationRef: value.sourceApplicationRef,
    members: value.members,
  });
  const resultRef = `worksite-construction-result://abiogenesis/${resultDigest.slice('sha256:'.length)}`;
  return value.resultDigest === resultDigest && value.resultRef === resultRef ? value : null;
}

function occurrenceNodeId(aggregateType, aggregateId) {
  return `urn:odd-manager:occurrence:${aggregateType}:sha256:${sha256Text(aggregateId)}`;
}

function occurrenceEdgeId(kind, sourceEventId, targetEventId) {
  return `urn:odd-manager:occurrence-edge:${kind}:sha256:${sha256Text(`${sourceEventId}\n${targetEventId}`)}`;
}

function refLabel(kind, ref) {
  const tail = ref.split(/[/:#]/u).filter(Boolean).at(-1) ?? ref;
  const compactTail = tail.length > 18 ? `${tail.slice(0, 12)}…` : tail;
  return `${kind.replaceAll('_', ' ')} · ${compactTail}`;
}

function emptyLimits() {
  return {
    maxNodes: MAX_NODES,
    maxEdges: MAX_EDGES,
    maxWorkspaceObservations: MAX_WORKSPACE_OBSERVATIONS,
    maxActorSessions: MAX_ACTOR_SESSIONS,
    maxDiagnostics: MAX_DIAGNOSTICS,
    nodesTruncated: false,
    edgesTruncated: false,
    workspaceObservationsTruncated: false,
    actorSessionsTruncated: false,
    diagnosticsTruncated: false,
  };
}

function emptyPlanes() {
  return {
    declarationTopology: {
      state: 'missing',
      reason: 'no_declaration_carrier',
      references: [],
      nodes: [],
      edges: [],
    },
    occurrenceGraph: {
      state: 'missing',
      nodes: [],
      edges: [],
      activeNodeIds: [],
      lastObservedNodeId: null,
    },
    workspaceObservations: {
      state: 'missing',
      currentness: 'unobserved',
      observations: [],
    },
    actorSessions: {
      state: 'missing',
      interactionDisposition: 'unavailable',
      sessions: [],
    },
  };
}

function boundedProjection(value) {
  const diagnosticsTruncated = value.diagnostics.length > MAX_DIAGNOSTICS;
  const diagnostics = diagnosticsTruncated
    ? [
        ...value.diagnostics.slice(0, MAX_DIAGNOSTICS - 1),
        diagnostic(
          'warning',
          'visual_graph_diagnostics_bounded',
          `Visual graph diagnostics were bounded to ${MAX_DIAGNOSTICS} rows.`,
        ),
      ]
    : value.diagnostics;
  const candidate = {
    ...value,
    diagnostics,
    limits: {
      ...value.limits,
      diagnosticsTruncated,
    },
  };
  const parsed = visualGraphProjectionSchema.safeParse(candidate);
  if (parsed.success) return parsed.data;
  const fallback = {
    kind: 'visual_graph_projection',
    version: 1,
    generatedAt: new Date().toISOString(),
    state: 'invalid',
    run: null,
    ...emptyPlanes(),
    diagnostics: [diagnostic(
      'error',
      'visual_graph_projection_contract_invalid',
      'The bounded visual graph fold did not satisfy its canonical response contract; all projected rows were withheld.',
    )],
    limits: emptyLimits(),
  };
  const fallbackParsed = visualGraphProjectionSchema.safeParse(fallback);
  return fallbackParsed.success ? fallbackParsed.data : fallback;
}

function emptyProjection(state, diagnostics, run = null, limits = emptyLimits()) {
  return boundedProjection({
    kind: 'visual_graph_projection',
    version: 1,
    generatedAt: new Date().toISOString(),
    state,
    run,
    ...emptyPlanes(),
    diagnostics,
    limits,
  });
}

function runProjection(run, index) {
  const runId = publishedRefOrNull(run.runId);
  if (!runId) return null;
  const sequence = abgEventSequence(index);
  const runSequence = sequence.filter((event) => (
    event.runId === runId
    || (event.aggregateType === 'run' && event.aggregateId === runId)
  ));
  const eventPosture = index.envelopeProfile === 'abiogenesis_5_root'
    ? index.builtInRootContractValidated !== true
      ? 'external_contract_uninterpreted'
      : runSequence.some((event) => event.kind === 'run_closed' && event.aggregateId === runId)
        ? 'terminal_converged'
        : runSequence.some((event) => event.kind === 'terminal_reached')
          ? 'terminal_observed'
          : 'non_terminal'
    : stringOrNull(index.eventPosture, 160) ?? 'invalid';
  return {
    runId,
    runDigest: digestOrNull(run.runDigest),
    scenarioKey: identifierTokenOrNull(run.scenarioKey, 160),
    scenarioId: identifierTokenOrNull(run.scenarioId, 240),
    eventGeneration: digestOrNull(index.generation) ?? `sha256:${'0'.repeat(64)}`,
    eventCount: index.eventCount,
    firstOrdinal: numberOrNull(index.firstOrdinal),
    lastOrdinal: numberOrNull(index.lastOrdinal),
    eventPosture,
    closed: index.builtInRootContractValidated === true
      && sequence.some((event) => event.kind === 'run_closed' && event.runId === run.runId),
    eventContract: {
      publishedDigest: digestOrNull(index.eventContractDigest),
      builtInRegistryDigest: digestOrNull(index.builtInEventContractDigest),
      posture: stringOrNull(index.contractPosture, 160) ?? 'invalid',
      bindingPosture: stringOrNull(index.contractBindingPosture, 160),
    },
    evidence: {
      authority: stringOrNull(run.authority, 160),
      disposition: stringOrNull(run.candidateDisposition, 160),
      validationDisposition: stringOrNull(run.validationDisposition, 160),
    },
  };
}

function declarationProjection(run, sequence, diagnostics, limits) {
  const references = new Map();
  let declarationReferencesTruncated = false;
  const add = (kind, value, event = null) => {
    const ref = publishedRefOrNull(value);
    if (!ref) return;
    const key = `${kind}\n${ref}`;
    if (references.has(key)) return;
    if (references.size >= MAX_NODES) {
      declarationReferencesTruncated = true;
      return;
    }
    references.set(key, { kind, ref, sourceEvent: eventCoordinate(event) });
  };
  add('graph', run.graphRef);
  add('graph_function', run.graphFunctionRef);
  add('overlay', run.overlayRef);
  for (const event of sequence) {
    add('graph', event.graphRef, event);
    add('graph_function', event.graphFunctionRef, event);
    add('overlay', event.overlayRef, event);
    add('materialization', event.materializationRef, event);
  }
  const retained = [...references.values()];
  if (declarationReferencesTruncated) {
    limits.nodesTruncated = true;
    diagnostics.push(diagnostic(
      'warning',
      'declaration_references_bounded',
      `Declaration references were bounded to ${MAX_NODES} rows.`,
    ));
  }
  return {
    state: retained.length > 0 ? 'partial' : 'missing',
    reason: retained.length > 0 ? 'references_without_bodies' : 'no_declaration_carrier',
    references: retained,
    nodes: [],
    edges: [],
  };
}

function occurrenceProjection(run, sequence, diagnostics, limits, interpretLifecycle) {
  let occurrenceNodesTruncated = false;
  let occurrenceEdgesTruncated = false;
  let occurrenceRelationsWithheld = false;
  let missingParentRelations = 0;
  let firstMissingParentEvent = null;
  let missingCausationRelations = 0;
  let firstMissingCausationEvent = null;
  const unsupportedAggregateEvents = sequence.filter((event) => (
    event.runId === run.runId
    && typeof event.aggregateType === 'string'
    && !OCCURRENCE_TYPES.has(event.aggregateType)
  )).length;
  const relevant = sequence.filter((event) => (
    event.runId === run.runId
    && OCCURRENCE_TYPES.has(event.aggregateType)
    && publishedRefOrNull(event.aggregateId)
    && eventCoordinate(event)
  ));
  const relevantByEventId = new Map(relevant.map((event) => [event.eventId, event]));
  const nodesByKey = new Map();
  const nodesByAggregateId = new Map();
  const eventsByNodeId = new Map();
  const eventNodes = new Map();
  const active = new Set();
  let runClosed = false;
  let runClosedEvent = null;
  let lastObservedNodeId = null;
  for (const event of relevant) {
    const aggregateId = event.aggregateId;
    const key = `${event.aggregateType}\n${aggregateId}`;
    let node = nodesByKey.get(key);
    if (!node && nodesByKey.size < MAX_NODES) {
      const coordinate = eventCoordinate(event);
      node = {
        id: occurrenceNodeId(event.aggregateType, aggregateId),
        aggregateType: event.aggregateType,
        aggregateId,
        label: refLabel(event.aggregateType, aggregateId),
        state: 'unknown',
        firstObserved: coordinate,
        lastObserved: coordinate,
      };
      nodesByKey.set(key, node);
      const matchingIds = nodesByAggregateId.get(aggregateId) ?? [];
      matchingIds.push(node);
      nodesByAggregateId.set(aggregateId, matchingIds);
    } else if (!node) {
      limits.nodesTruncated = true;
      occurrenceNodesTruncated = true;
      continue;
    } else {
      node.lastObserved = eventCoordinate(event);
    }
    eventNodes.set(event.eventId, node);
    const nodeEvents = eventsByNodeId.get(node.id) ?? [];
    nodeEvents.push(event);
    eventsByNodeId.set(node.id, nodeEvents);
    lastObservedNodeId = node.id;
    if (interpretLifecycle && OPEN_KINDS.has(event.kind)) {
      node.state = 'open';
      active.add(node.id);
    }
    if (interpretLifecycle && CLOSED_KINDS.has(event.kind)) {
      node.state = 'closed';
      active.delete(node.id);
    }
    if (interpretLifecycle && FAILED_KINDS.has(event.kind)) {
      node.state = 'failed';
      active.delete(node.id);
    }
    if (interpretLifecycle && event.kind === 'run_closed' && event.aggregateId === run.runId) {
      runClosed = true;
      runClosedEvent = eventCoordinate(event);
    }
  }
  const closedRunRetainsActiveChildren = runClosed && active.size > 0;
  if (closedRunRetainsActiveChildren) {
    diagnostics.push(diagnostic(
      'warning',
      'closed_run_retains_active_children',
      `${active.size} retained child occurrence(s) remain explicitly open after the run closure event; their lifecycle was not inferred from the parent run.`,
      runClosedEvent,
    ));
  }
  if (occurrenceNodesTruncated) {
    diagnostics.push(diagnostic(
      'warning',
      'occurrence_nodes_bounded',
      `Occurrence aggregates were bounded to ${MAX_NODES} nodes.`,
    ));
  }
  const edges = [];
  const edgeIds = new Set();
  const addEdge = (kind, sourceNode, targetNode, sourceEvent, targetEvent) => {
    if (!sourceNode || !targetNode || !sourceEvent || !targetEvent) return;
    const id = occurrenceEdgeId(kind, sourceEvent.eventId, targetEvent.eventId);
    if (edgeIds.has(id)) return;
    if (edges.length >= MAX_EDGES) {
      limits.edgesTruncated = true;
      occurrenceEdgesTruncated = true;
      return;
    }
    edgeIds.add(id);
    edges.push({
      id,
      kind,
      sourceNodeId: sourceNode.id,
      targetNodeId: targetNode.id,
      sourceEvent,
      targetEvent,
    });
  };
  for (const node of nodesByKey.values()) {
    const nodeEvents = eventsByNodeId.get(node.id) ?? [];
    const explicitParentEvents = nodeEvents.filter((event) => (
      publishedRefOrNull(event.parentAggregateId) !== null
    ));
    const explicitParentIds = [...new Set(explicitParentEvents.map((event) => event.parentAggregateId))];
    if (explicitParentIds.length > 1) {
      occurrenceRelationsWithheld = true;
      diagnostics.push(diagnostic(
        'warning',
        'aggregate_parent_identity_conflicting',
        'An occurrence aggregate published conflicting explicit parent identities; its aggregate-parent edge was withheld.',
        node.firstObserved,
      ));
      continue;
    }
    const parentEvent = explicitParentEvents[0] ?? null;
    const parentId = explicitParentIds[0] ?? null;
    const parentCandidates = parentId ? nodesByAggregateId.get(parentId) ?? [] : [];
    const parent = parentCandidates.length === 1 ? parentCandidates[0] : null;
    if (parentCandidates.length > 1) {
      occurrenceRelationsWithheld = true;
      diagnostics.push(diagnostic(
        'warning',
        'aggregate_parent_identity_ambiguous',
        'An explicit parent aggregate identity matched more than one retained aggregate type; the parent edge was withheld.',
        node.firstObserved,
      ));
    }
    if (parentId && parentCandidates.length === 0) {
      occurrenceRelationsWithheld = true;
      missingParentRelations += 1;
      firstMissingParentEvent ??= node.firstObserved;
    }
    if (parent && parentEvent) {
      addEdge(
        'aggregate_parent',
        parent,
        node,
        parent.firstObserved,
        eventCoordinate(parentEvent),
      );
    }
  }
  let causationRefsInspected = 0;
  causationTraversal:
  for (const event of relevant) {
    const targetNode = eventNodes.get(event.eventId);
    const targetCoordinate = eventCoordinate(event);
    for (const causeRef of Array.isArray(event.causationEventRefs) ? event.causationEventRefs : []) {
      if (edges.length >= MAX_EDGES || causationRefsInspected >= MAX_EDGES) {
        limits.edgesTruncated = true;
        occurrenceEdgesTruncated = true;
        break causationTraversal;
      }
      causationRefsInspected += 1;
      const sourceNode = eventNodes.get(causeRef);
      const sourceEvent = sourceNode ? eventCoordinate(relevantByEventId.get(causeRef)) : null;
      if (!sourceNode || !targetNode || !sourceEvent || !targetCoordinate) {
        occurrenceRelationsWithheld = true;
        missingCausationRelations += 1;
        firstMissingCausationEvent ??= targetCoordinate;
        continue;
      }
      addEdge('event_causation', sourceNode, targetNode, sourceEvent, targetCoordinate);
    }
  }
  if (occurrenceEdgesTruncated) {
    diagnostics.push(diagnostic(
      'warning',
      'occurrence_edges_bounded',
      `Explicit occurrence relations were bounded to ${MAX_EDGES} edges.`,
    ));
  }
  if (missingParentRelations > 0) {
    diagnostics.push(diagnostic(
      'info',
      'aggregate_parent_outside_bounded_profile',
      `${missingParentRelations} explicit parent relation(s) targeted an aggregate outside the retained bounded occurrence profile and were withheld.`,
      firstMissingParentEvent,
    ));
  }
  if (missingCausationRelations > 0) {
    diagnostics.push(diagnostic(
      'info',
      'event_causation_outside_bounded_profile',
      `${missingCausationRelations} explicit causation relation(s) referenced an event outside the retained bounded occurrence profile and were withheld.`,
      firstMissingCausationEvent,
    ));
  }
  if (unsupportedAggregateEvents > 0) {
    diagnostics.push(diagnostic(
      'info',
      'occurrence_profile_partial',
      `${unsupportedAggregateEvents} run-scoped event(s) use aggregate types outside the bounded v1 occurrence graph and remain available only through their admitted specialist planes or event coordinates.`,
    ));
  }
  const nodes = [...nodesByKey.values()];
  return {
    state: nodes.length > 0
      ? (
          occurrenceNodesTruncated
          || occurrenceEdgesTruncated
          || occurrenceRelationsWithheld
          || unsupportedAggregateEvents > 0
          || closedRunRetainsActiveChildren
          || !interpretLifecycle
            ? 'partial'
            : 'ready'
        )
      : 'missing',
    nodes,
    edges,
    activeNodeIds: [...active].filter((id) => nodes.some((node) => node.id === id)),
    lastObservedNodeId,
  };
}

function workspaceSnapshot(value) {
  const snapshot = isRecord(value) ? value : {};
  return {
    observationRef: publishedRefOrNull(snapshot.observationRef),
    observationDigest: digestOrNull(snapshot.observationDigest),
    subjectRef: publishedRefOrNull(snapshot.subjectRef),
    subjectDigest: digestOrNull(snapshot.subjectDigest),
    bindingRef: publishedRefOrNull(snapshot.workspaceBindingIdentity)
      ?? publishedRefOrNull(snapshot.bindingRef),
    state: statusTokenOrNull(snapshot.state),
    byteLength: numberOrNull(snapshot.byteLength),
    fileDigest: digestOrNull(snapshot.fileDigest),
  };
}

function workspaceReceipt(value) {
  const receipt = isRecord(value) ? value : {};
  return {
    receiptRef: publishedRefOrNull(receipt.receiptRef),
    receiptDigest: digestOrNull(receipt.receiptDigest),
    authorizationRef: publishedRefOrNull(receipt.authorizationRef),
    authorizationDigest: digestOrNull(receipt.authorizationDigest),
    beforeObservationRef: publishedRefOrNull(receipt.beforeObservationRef),
    beforeObservationDigest: digestOrNull(receipt.beforeObservationDigest),
    afterObservationRef: publishedRefOrNull(receipt.afterObservationRef),
    afterObservationDigest: digestOrNull(receipt.afterObservationDigest),
    writtenDigest: digestOrNull(receipt.writtenDigest),
    committed: typeof receipt.committed === 'boolean' ? receipt.committed : null,
  };
}

function sameWorkspaceSnapshot(left, right) {
  return [
    'observationRef', 'observationDigest', 'subjectRef', 'subjectDigest',
    'bindingRef', 'state', 'byteLength', 'fileDigest',
  ].every((key) => left[key] === right[key]);
}

function sameWorkspaceReceipt(left, right) {
  return [
    'receiptRef', 'receiptDigest', 'authorizationRef', 'authorizationDigest',
    'beforeObservationRef', 'beforeObservationDigest', 'afterObservationRef',
    'afterObservationDigest', 'writtenDigest', 'committed',
  ].every((key) => left[key] === right[key]);
}

function exactWorkspaceSnapshot(snapshot) {
  if (
    !snapshot.observationRef
    || !snapshot.observationDigest
    || !snapshot.subjectRef
    || !snapshot.subjectDigest
    || !snapshot.bindingRef
    || !['absent', 'file'].includes(snapshot.state)
  ) return false;
  if (snapshot.state === 'file') {
    return snapshot.byteLength !== null && snapshot.fileDigest !== null;
  }
  return snapshot.byteLength === null && snapshot.fileDigest === null;
}

function exactWorkspaceReceipt(receipt, predecessor, successor) {
  return Boolean(
    receipt.receiptRef
    && receipt.receiptDigest
    && receipt.authorizationRef
    && receipt.authorizationDigest
    && receipt.beforeObservationRef === predecessor.observationRef
    && receipt.beforeObservationDigest === predecessor.observationDigest
    && receipt.afterObservationRef === successor.observationRef
    && receipt.afterObservationDigest === successor.observationDigest
    && receipt.writtenDigest === successor.fileDigest
    && receipt.committed === true
  );
}

function workspaceProjection(run, sequence, evidence, diagnostics, limits, interpretEventSemantics) {
  if (evidence?.kind !== 'generic_live_workflow_evidence_candidate' || !Array.isArray(evidence.files)) {
    return {
      state: 'missing',
      currentness: 'unobserved',
      observations: [],
    };
  }
  const constructionResult = exactConstructionResultOrNull(evidence.constructionResult);
  const resultRef = publishedRefOrNull(constructionResult?.resultRef);
  const resultDigest = digestOrNull(constructionResult?.resultDigest);
  const constructionValueDigest = constructionResult && resultRef && resultDigest
    ? canonicalDigest(constructionResult)
    : null;
  const exactResultEvents = interpretEventSemantics && constructionValueDigest
    ? sequence.filter((event) => (
        event.kind === 'c_call_result_admitted'
        && event.valueKind === 'worksite_construction_result'
        && event.valueDigest === constructionValueDigest
        && eventCoordinate(event)
      ))
    : [];
  const sourceEvent = exactResultEvents.length === 1 ? exactResultEvents[0] : null;
  if (interpretEventSemantics && exactResultEvents.length === 0) {
    diagnostics.push(diagnostic(
      'info',
      'workspace_construction_event_unbound',
      'The retained construction result has no exact matching admitted result event; workspace rows remain evidence-bound without an event coordinate.',
    ));
  } else if (interpretEventSemantics && exactResultEvents.length > 1) {
    diagnostics.push(diagnostic(
      'warning',
      'workspace_construction_event_ambiguous',
      'More than one admitted result event names the retained construction result identity; its source-event coordinate was withheld.',
    ));
  }
  const constructionMembers = constructionResult && Array.isArray(constructionResult.members)
    ? constructionResult.members
    : [];
  const constructionMembersByOrdinal = new Map();
  for (const member of constructionMembers) {
    const ordinal = numberOrNull(member?.ordinal);
    if (ordinal === null) continue;
    const matching = constructionMembersByOrdinal.get(ordinal) ?? [];
    matching.push(member);
    constructionMembersByOrdinal.set(ordinal, matching);
  }
  const rows = [];
  let invalidRetainedRows = 0;
  for (const value of evidence.files) {
    if (rows.length >= MAX_WORKSPACE_OBSERVATIONS) {
      limits.workspaceObservationsTruncated = true;
      break;
    }
    if (!isRecord(value)) continue;
    const ordinal = numberOrNull(value.ordinal);
    if (ordinal === null) {
      invalidRetainedRows += 1;
      continue;
    }
    const matchingMembers = constructionMembersByOrdinal.get(ordinal) ?? [];
    const constructionMember = matchingMembers.length === 1 && isRecord(matchingMembers[0])
      ? matchingMembers[0]
      : null;
    const receiptValue = constructionMember?.receipt;
    const predecessor = workspaceSnapshot(value.predecessorObservation);
    const successor = workspaceSnapshot(value.successorObservation);
    const memberSuccessor = workspaceSnapshot(constructionMember?.successorObservation);
    const receipt = workspaceReceipt(receiptValue);
    const fileByteLength = numberOrNull(value.byteLength);
    const fileDigest = digestOrNull(value.sha256);
    const inlineReceiptMatches = value.receipt === undefined
      || (
        value.receipt?.kind === 'worksite_file_replace_receipt'
        && sameWorkspaceReceipt(workspaceReceipt(value.receipt), receipt)
    );
    if (
      !constructionMember
      || value.predecessorObservation?.kind !== 'worksite_observation'
      || value.successorObservation?.kind !== 'worksite_observation'
      || constructionMember?.successorObservation?.kind !== 'worksite_observation'
      || receiptValue?.kind !== 'worksite_file_replace_receipt'
      || !exactWorkspaceSnapshot(predecessor)
      || !exactWorkspaceSnapshot(successor)
      || predecessor.subjectRef !== successor.subjectRef
      || predecessor.subjectDigest !== successor.subjectDigest
      || predecessor.bindingRef !== successor.bindingRef
      || !sameWorkspaceSnapshot(memberSuccessor, successor)
      || !exactWorkspaceReceipt(receipt, predecessor, successor)
      || !inlineReceiptMatches
      || fileByteLength !== successor.byteLength
      || fileDigest !== successor.fileDigest
    ) {
      invalidRetainedRows += 1;
      continue;
    }
    rows.push({
      ordinal,
      sourceEvent: eventCoordinate(sourceEvent),
      predecessor,
      successor,
      receipt,
      current: {
        state: 'unobserved',
        byteLength: null,
        digest: null,
        posture: 'unavailable',
      },
    });
  }
  if (limits.workspaceObservationsTruncated) {
    diagnostics.push(diagnostic(
      'warning',
      'workspace_observations_bounded',
      `Mutable workspace observations were bounded to ${MAX_WORKSPACE_OBSERVATIONS} rows.`,
    ));
  }
  if (rows.length > 0) {
    diagnostics.push(diagnostic(
      'info',
      'workspace_current_subject_binding_unavailable',
      'The retained observations do not publish an exact subject-to-worksite-path binding; mutable currentness scanning was withheld.',
    ));
  }
  if (invalidRetainedRows > 0) {
    diagnostics.push(diagnostic(
      'warning',
      'workspace_observation_rows_invalid',
      `${invalidRetainedRows} retained workspace observation row(s) lacked an exact construction member, O0/O1 binding, or committed receipt and were withheld.`,
    ));
  }
  return {
    state: rows.length > 0 ? 'partial' : 'missing',
    currentness: 'unobserved',
    observations: rows,
  };
}

function actorSessionProjection(
  run,
  sequence,
  occurrenceGraph,
  limits,
  diagnostics,
  interpretLifecycle,
) {
  const related = sequence.filter((event) => event.runId === run.runId);
  const retainedActorIds = new Set(occurrenceGraph.nodes
    .filter((node) => node.aggregateType === 'actor_invocation')
    .map((node) => node.aggregateId));
  const retainedProcessIds = new Set(occurrenceGraph.nodes
    .filter((node) => node.aggregateType === 'process')
    .map((node) => node.aggregateId));
  const nodeById = new Map(occurrenceGraph.nodes.map((node) => [node.id, node]));
  const retainedParentLoci = new Set(occurrenceGraph.edges.flatMap((edge) => {
    if (edge.kind !== 'aggregate_parent') return [];
    const actorNode = nodeById.get(edge.sourceNodeId);
    const processNode = nodeById.get(edge.targetNodeId);
    return actorNode?.aggregateType === 'actor_invocation'
      && processNode?.aggregateType === 'process'
      ? [`${actorNode.aggregateId}\n${processNode.aggregateId}`]
      : [];
  }));
  const actorEventsById = new Map();
  const processEventsById = new Map();
  for (const event of related) {
    const aggregateId = publishedRefOrNull(event.aggregateId);
    const coordinate = eventCoordinate(event);
    if (!aggregateId || !coordinate) continue;
    const target = event.aggregateType === 'actor_invocation' && retainedActorIds.has(aggregateId)
      ? actorEventsById
      : event.aggregateType === 'process' && retainedProcessIds.has(aggregateId)
        ? processEventsById
        : null;
    if (!target) continue;
    const events = target.get(aggregateId) ?? [];
    events.push(event);
    target.set(aggregateId, events);
  }

  const processLociByActor = new Map();
  let conflictingProcessRelations = 0;
  let withheldProcessRelations = 0;
  let firstConflictingProcessEvent = null;
  let firstWithheldProcessEvent = null;
  for (const [processAggregateId, processEvents] of processEventsById) {
    const parentIds = processEvents.map((event) => publishedRefOrNull(event.parentAggregateId));
    const canonicalParentIds = [...new Set(parentIds.filter(Boolean))];
    const actorInvocationRefs = interpretLifecycle
      ? processEvents.map((event) => publishedRefOrNull(event.actorInvocationRef))
      : [];
    const canonicalActorInvocationRefs = [...new Set(actorInvocationRefs.filter(Boolean))];
    const relationConflicts = canonicalParentIds.length > 1
      || (interpretLifecycle && (
        canonicalActorInvocationRefs.length > 1
        || canonicalParentIds.length === 1
          && canonicalActorInvocationRefs.length === 1
          && canonicalParentIds[0] !== canonicalActorInvocationRefs[0]
      ));
    const actorInvocationId = canonicalParentIds.length === 1 ? canonicalParentIds[0] : null;
    const structurallyExact = actorInvocationId !== null
      && parentIds.every((parentId) => parentId === actorInvocationId)
      && retainedActorIds.has(actorInvocationId)
      && retainedParentLoci.has(`${actorInvocationId}\n${processAggregateId}`);
    const builtInSemanticsExact = !interpretLifecycle || (
      actorInvocationRefs.length === processEvents.length
      && actorInvocationRefs.every((actorInvocationRef) => actorInvocationRef === actorInvocationId)
    );
    if (!structurallyExact || !builtInSemanticsExact) {
      if (relationConflicts) {
        conflictingProcessRelations += 1;
        firstConflictingProcessEvent ??= eventCoordinate(processEvents[0]);
      } else {
        withheldProcessRelations += 1;
        firstWithheldProcessEvent ??= eventCoordinate(processEvents[0]);
      }
      continue;
    }
    const loci = processLociByActor.get(actorInvocationId) ?? [];
    loci.push({ processAggregateId, events: processEvents });
    processLociByActor.set(actorInvocationId, loci);
  }
  if (conflictingProcessRelations > 0) {
    diagnostics.push(diagnostic(
      'warning',
      'actor_process_relation_conflicting',
      `${conflictingProcessRelations} process aggregate relation(s) published crossed or conflicting actor-invocation identities and were withheld.`,
      firstConflictingProcessEvent,
    ));
  }
  if (withheldProcessRelations > 0) {
    diagnostics.push(diagnostic(
      'warning',
      'actor_process_relation_withheld',
      `${withheldProcessRelations} process aggregate relation(s) lacked one exact retained actor-invocation parent edge and were withheld.`,
      firstWithheldProcessEvent,
    ));
  }

  let conflictingActorRefs = 0;
  let firstConflictingActorEvent = null;
  const loci = [];
  for (const [actorInvocationId, actorEvents] of actorEventsById) {
    const processLoci = processLociByActor.get(actorInvocationId) ?? [];
    const actorRefs = interpretLifecycle
      ? [...new Set(actorEvents.map((event) => publishedRefOrNull(event.actorRef)).filter(Boolean))]
      : [];
    const actorRef = actorRefs.length === 1 ? actorRefs[0] : null;
    if (actorRefs.length > 1) {
      conflictingActorRefs += 1;
      firstConflictingActorEvent ??= eventCoordinate(actorEvents[0]);
    }
    const sessionLoci = processLoci.length > 0
      ? processLoci
      : [{ processAggregateId: null, events: [] }];
    for (const processLocus of sessionLoci) {
      const events = [...actorEvents, ...processLocus.events].sort((left, right) => (
        left.sourceOrdinal - right.sourceOrdinal
        || left.eventId.localeCompare(right.eventId)
      ));
      let lifecycleState = 'unknown';
      if (interpretLifecycle) {
        const lifecycleEvents = processLocus.processAggregateId === null
          ? actorEvents
          : processLocus.events;
        for (const event of lifecycleEvents) {
          if (processLocus.processAggregateId === null) {
            if (event.kind === 'actor_invocation_started') lifecycleState = 'running';
            if (event.kind === 'actor_invocation_closed') lifecycleState = 'completed';
            if (event.kind === 'actor_invocation_failed') lifecycleState = 'failed';
          } else {
            if (event.kind === 'actor_process_started') lifecycleState = 'running';
            if (event.kind === 'actor_process_exited') lifecycleState = 'completed';
            if (event.kind === 'actor_process_spawn_failed'
              || event.kind === 'actor_process_termination_unconfirmed') lifecycleState = 'failed';
          }
        }
      }
      const firstObserved = eventCoordinate(events[0]);
      const lastObserved = eventCoordinate(events.at(-1));
      if (!firstObserved || !lastObserved) continue;
      const processIdentity = processLocus.processAggregateId ?? 'none';
      loci.push({
        id: `urn:odd-manager:actor-session:sha256:${sha256Text(`${actorInvocationId}\n${processIdentity}`)}`,
        actorInvocationId,
        processAggregateId: processLocus.processAggregateId,
        actorRef,
        lifecycleState,
        terminalDisposition: lifecycleState === 'completed'
          ? 'completed'
          : lifecycleState === 'unknown' ? 'unknown' : 'unavailable',
        capabilityRefs: [],
        operationRefs: [],
        archiveRefs: [],
        canAttach: false,
        firstObserved,
        lastObserved,
      });
    }
  }
  if (conflictingActorRefs > 0) {
    diagnostics.push(diagnostic(
      'warning',
      'actor_session_actor_ref_conflicting',
      `${conflictingActorRefs} actor invocation(s) published conflicting actor references; actor identity labels were withheld.`,
      firstConflictingActorEvent,
    ));
  }
  loci.sort((left, right) => (
    left.firstObserved.ordinal - right.firstObserved.ordinal
    || left.actorInvocationId.localeCompare(right.actorInvocationId)
    || (left.processAggregateId ?? '').localeCompare(right.processAggregateId ?? '')
  ));
  if (loci.length > MAX_ACTOR_SESSIONS) limits.actorSessionsTruncated = true;
  const projected = loci.slice(0, MAX_ACTOR_SESSIONS);
  if (limits.actorSessionsTruncated) {
    diagnostics.push(diagnostic(
      'warning',
      'actor_sessions_bounded',
      `Actor-session observations were bounded to ${MAX_ACTOR_SESSIONS} rows.`,
    ));
  }
  const interactionDisposition = 'unavailable';
  if (projected.length > 0) {
    diagnostics.push(diagnostic(
      'info',
      'actor_session_effect_not_admitted',
      'Actor lifecycle and output occurrence facts are retained, but no exact current attach/read/input or archive-resolution capability is admitted.',
    ));
  }
  return {
    state: projected.length > 0
      ? (interactionDisposition === 'unavailable' ? 'partial' : 'ready')
      : 'missing',
    interactionDisposition,
    sessions: projected,
  };
}

export function loadVisualGraphProjection(projectRootInput, input = {}) {
  if (input.generation === undefined || input.generation === null || input.generation === '') {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'exact_event_generation_required',
      'Visual graph projection requires an exact event generation digest.',
    )]);
  }
  const generation = digestOrNull(input.generation);
  if (!generation) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'event_generation_invalid',
      'Visual graph projection event generation must be a canonical SHA-256 digest.',
    )]);
  }
  const suppliedRunId = stringOrNull(input.runId);
  const runId = publishedRefOrNull(input.runId);
  if (suppliedRunId && !runId) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'run_identity_invalid',
      'Visual graph projection requires a logical published run identity.',
    )]);
  }
  if (!runId) {
    return emptyProjection('missing', [diagnostic(
      'warning',
      'exact_run_selection_required',
      'Visual graph projection requires an explicit admitted run identity.',
    )]);
  }
  const topology = discoverProjectObservationTopology(projectRootInput, {
    refresh: input.refresh === true,
  });
  const matchingRuns = topology.runs.filter((candidate) => candidate.runId === runId);
  if (matchingRuns.length > 1) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'selected_run_ambiguous',
      'The requested run identity is reused by multiple retained carrier rows and is not an exact projection basis.',
    )]);
  }
  const run = matchingRuns[0] ?? null;
  if (!run) {
    return emptyProjection('missing', [diagnostic(
      'warning',
      'selected_run_missing',
      'The exact requested run identity is not present in the admitted Project observation topology.',
    )]);
  }
  const ledgerIndex = indexAbgEventCarrier(run.eventPath, {
    refresh: input.refresh === true,
    ...(run.eventContractDigest
      ? { publishedEventContractDigest: run.eventContractDigest }
      : {}),
    ...(run.eventContractBindingPosture
      ? { contractBindingPosture: run.eventContractBindingPosture }
      : {}),
  });
  const index = run.carrierKind === 'retained_published_run_observation' ? scopeAbgEventCarrier(ledgerIndex, run.runId) : ledgerIndex;
  const projectedRun = runProjection(run, index);
  if (!projectedRun) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'run_identity_invalid',
      'The selected topology row does not retain an exact logical published run identity.',
    )]);
  }
  if (generation !== index.generation) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'stale_event_generation',
      'The requested event generation is stale; no visual graph rows were projected.',
    )], projectedRun);
  }
  if (run.eventGeneration && run.eventGeneration !== index.generation) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'event_generation_changed_during_load',
      'The event carrier generation changed after topology admission; no visual graph rows were projected.',
    )], projectedRun);
  }
  if (
    run.eventPrefixLength !== undefined
    && (
      index.completePrefixBytes !== run.eventPrefixLength
      || index.completePrefixDigest !== run.eventPrefixDigest
    )
  ) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'event_prefix_changed_during_load',
      'The exact published event prefix changed after topology admission; no visual graph rows were projected.',
    )], projectedRun);
  }
  if (index.state !== 'ready') {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'event_carrier_invalid',
      'The selected run event carrier did not admit a stable valid prefix.',
    )], projectedRun);
  }
  if (index.envelopeProfile !== 'abiogenesis_5_root') {
    return emptyProjection('unsupported', [diagnostic(
      'warning',
      'visual_graph_profile_unsupported',
      'This visual graph projection admits only the ABIogenesis 5 immutable event envelope.',
    )], projectedRun);
  }
  const sequence = abgEventSequence(index);
  if (sequence.some((event) => event.runId !== undefined && event.runId !== run.runId)) {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'event_run_identity_conflict',
      'The selected carrier contains a run-scoped event outside the exact requested run identity.',
    )], projectedRun);
  }
  const diagnostics = [];
  const limits = emptyLimits();
  const interpretBuiltInEventSemantics = index.builtInRootContractValidated === true;
  if (!interpretBuiltInEventSemantics) {
    diagnostics.push(diagnostic(
      'warning',
      'external_event_contract_lifecycle_uninterpreted',
      'The selected run publishes an event contract distinct from the built-in ABIogenesis 5 root registry; event-kind lifecycle states were withheld.',
    ));
  }
  const evidenceSnapshot = loadObservationRunProofSnapshot(run);
  if (run.proofState === 'candidate' && evidenceSnapshot.state !== 'ready') {
    return emptyProjection('invalid', [diagnostic(
      'error',
      'evidence_candidate_changed_during_projection',
      'The selected evidence candidate changed after topology admission; no workspace observation rows were projected.',
    )], projectedRun);
  }
  const evidence = evidenceSnapshot.value;
  const declarationTopology = declarationProjection(
    run,
    interpretBuiltInEventSemantics ? sequence : [],
    diagnostics,
    limits,
  );
  const occurrenceGraph = occurrenceProjection(
    run,
    sequence,
    diagnostics,
    limits,
    interpretBuiltInEventSemantics,
  );
  const workspaceObservations = workspaceProjection(
    run,
    sequence,
    evidence,
    diagnostics,
    limits,
    interpretBuiltInEventSemantics,
  );
  const actorSessions = actorSessionProjection(
    run,
    sequence,
    occurrenceGraph,
    limits,
    diagnostics,
    interpretBuiltInEventSemantics,
  );
  if (declarationTopology.state !== 'ready') {
    diagnostics.push(diagnostic(
      'info',
      'declaration_topology_not_published',
      declarationTopology.state === 'partial'
        ? 'Declaration references were retained, but declaration bodies and overlay topology were not published.'
        : 'No declaration or overlay topology carrier was published for this run.',
    ));
  }
  if (actorSessions.interactionDisposition === 'unavailable') {
    diagnostics.push(diagnostic(
      'info',
      'live_actor_session_unavailable',
      'No explicit live session capability and operation pair was admitted; manager shell substitution is forbidden.',
    ));
  }
  return boundedProjection({
    kind: 'visual_graph_projection',
    version: 1,
    generatedAt: new Date().toISOString(),
    state: declarationTopology.state === 'ready'
      && occurrenceGraph.state === 'ready'
      && workspaceObservations.state === 'ready'
      ? 'ready'
      : 'partial',
    run: projectedRun,
    declarationTopology,
    occurrenceGraph,
    workspaceObservations,
    actorSessions,
    diagnostics,
    limits,
  });
}
