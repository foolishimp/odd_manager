import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

// Frozen S6/S7 published descriptor; static manager-owned validation data only.
const rc1Bytes = readFileSync(new URL('./abi5-rc1-native-runtime-observation.json', import.meta.url));
if (createHash('sha256').update(rc1Bytes).digest('hex') !== '866eebd2a7cfe2d3aafac965aecb9ba69dfb8611ce86a5288cf354f6ba49f957') throw new Error('manager RC1 validation descriptor changed');
export const ABI5_RC1_PROFILE = Object.freeze(JSON.parse(rc1Bytes).currentDescriptor);
export const ABI5_RC1_EVENT_CONTRACT_DIGEST = JSON.parse(rc1Bytes).currentEventContractDigest;

// Pinned local validation basis for ABIogenesis 5.0 root events.
//
// Source inspected for this registry:
// product://abiogenesis/typescript-tenant@5.0.0-dev.286
// build/code/src/abg/event_store.js
//
// This module intentionally carries a manager-owned, immutable comparison registry.
// Runtime observation must never import an observed Product's executable authority.

const payloadKeys = (value) => Object.freeze(value.trim().split(/\s+/u));
const combinePayloadKeys = (...sets) => Object.freeze([...new Set(sets.flat())]);
const payloadVariant = (allowedPayloadKeys, requiredPayloadKeys = allowedPayloadKeys, expectedPayload, nullablePayloadKeys) => Object.freeze({
    allowedPayloadKeys,
    requiredPayloadKeys,
    ...(expectedPayload === undefined
        ? {}
        : { expectedPayload: Object.freeze(expectedPayload) }),
    ...(nullablePayloadKeys === undefined
        ? {}
        : { nullablePayloadKeys: Object.freeze(nullablePayloadKeys) }),
});
const coupledContractVariant = (variant, payloadVariantIndexes) => Object.freeze({
    ...variant,
    payloadVariantIndexes: Object.freeze(payloadVariantIndexes),
});
const WORKSPACE_EVENT = Object.freeze({
    aggregateType: "workspace",
    scopeClass: "workspace",
    requiredEnvelopeIdentities: Object.freeze([]),
});
const RUN_EVENT = Object.freeze({
    aggregateType: "run",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze(["runId"]),
});
const GRAPH_CALL_EVENT = Object.freeze({
    aggregateType: "graph_call",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze([
        "runId",
        "graphCallId",
    ]),
});
const FRAME_EVENT = Object.freeze({
    aggregateType: "frame",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze([
        "runId",
        "graphCallId",
        "frameId",
    ]),
});
const C_CALL_EVENT = Object.freeze({
    aggregateType: "c_call",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze([
        "runId",
        "graphCallId",
        "frameId",
    ]),
});
const ACTOR_INVOCATION_EVENT = Object.freeze({
    aggregateType: "actor_invocation",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze([
        "runId",
        "graphCallId",
        "frameId",
    ]),
});
const PROCESS_EVENT = Object.freeze({
    aggregateType: "process",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze([
        "runId",
        "graphCallId",
        "frameId",
    ]),
});
const TRANSPORT_BINDING_EVENT = Object.freeze({
    aggregateType: "transport_binding",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze([
        "runId",
        "graphCallId",
        "frameId",
    ]),
});
const CONTINUATION_EVENT = Object.freeze({
    aggregateType: "continuation",
    scopeClass: "run",
    requiredEnvelopeIdentities: Object.freeze([
        "runId",
        "graphCallId",
        "frameId",
    ]),
});
const IMPLEMENTATION_SET_PAYLOAD = payloadKeys("implementationSet implementationSetDigest implementationSetRef interactionSet interactionSetDigest interactionSetRef");
const LEGACY_IMPLEMENTATION_PAYLOAD = payloadKeys("catalogViewDigest catalogViewId computeRegime failureContractRef graphFunctionDigest graphFunctionRef graphValidationDigest graphValidationRef implementationBindingDigest implementationBindingRef implementationDescriptorDigest implementationRef inputContractRef modulePath namedSymbol nodeRef outputContractRef packageName packageVersion programValidationRef publicationDigest refusalContractRef resolutionCandidateDigest resolutionCandidateRef resolutionDigest resolutionRef resolutionValidationDigest resolutionValidationRef");
const BASIS_PAYLOAD = payloadKeys("actionCatalogDigest actionCatalogRef actionCatalogRows actorRef basisClass basisDigest basisRef catalogBasisDigest catalogBasisRef catalogViewDigest catalogViewId closureContractDigest closureContractRef constructionComposition constructionCompositionDigest constructionCompositionRef entryRef evidenceContractRef graphDigest graphFunctionDigest graphFunctionRef graphRef graphValidationRef implementationResolutionRef implementationSetDigest implementationSetRef interactionSetDigest interactionSetRef invocationAdmissionRef invocationDigest invocationRef judgmentContractRef localExecutableLeafKeys localImplementationSubsetDigest localInteractionLeafKeys localInteractionSubsetDigest parentCCallRef parentExecutionBasisRef parentTraversalScopeRef programDigest programRef programValidationRef rawInputAdmissionRef rawInputDigest rawInputValue refusalContractRef refusalValueKind rejectionContractRef replayProjectionRef resultContractRef rootImplementationSetDigest rootImplementationSetRef rootInteractionSetDigest rootInteractionSetRef terminalKind terminalPredicateRef transitionContractRef workspaceBindingDigest workspaceBindingId");
const GRAPH_OPEN_PAYLOAD = payloadKeys("executionBasisRef graphCallDigest graphCallId graphDigest graphFunctionDigest graphFunctionRef graphRef invocationRef runId");
const FRAME_OPEN_PAYLOAD = payloadKeys("admittedInputDigest admittedInputRef attempt executionBasisRef frameDigest frameId frameLineageId graphCallId invocationRef parentFrameId runId");
const C_CALL_OPEN_PAYLOAD = payloadKeys("attempt basisId batchRef cCallDigest cCallRef callClass cursorDigest cursorRef edgeRef frameId graphCallId graphFunctionRef programLocusRef retryPath stageRole taskOrdinal vectorIndex");
const C_CALL_FIBRE_PAYLOAD = payloadKeys("actorCapabilityRef armId cCallRef callClass compositionRef continuationContractRef implementationBindingRef implementationRef implementationRequirementKey implementationSetRef interactionKind interactionRequirementKey interactionSetRef regime requestContractRef responseContractRef");
const PROCESS_STREAM_PAYLOAD = payloadKeys("actorInvocationRef byteLength chunkDigest processRef streamOrdinal");
const ACTOR_TERMINAL_PAYLOAD = payloadKeys("actorInvocationRef cCallRef disposition failureClass processRef transportBindingDigest transportBindingRef");
const ACTOR_OBSERVATION_PAYLOAD = payloadKeys("actorInvocationRef actorRef apiRetryCount artifactDigests cCallRef disposition exitObserved failureClass finalOutput implementationRef inputDigest instructionContractRef materializationPlanRef observedOutputDigest processRef processSignal processStatus progressEventCount promptDigest rendererRef requestDigest requestRef resultContractRef signalSequence stderrByteLength stdoutByteLength structuredEventCount terminationConfirmed timedOut toolCallCount transportBindingDigest transportBindingRef transportDigest transportLane workerBindingRef");
const EVIDENCE_PAYLOAD = payloadKeys("cCallRef contractRef evidenceClass evidenceDigest evidenceRef");
const EVIDENCE_IO_PAYLOAD = combinePayloadKeys(EVIDENCE_PAYLOAD, payloadKeys("implementationRef inputDigest outputDigest"));
const FOLDBACK_PAYLOAD = payloadKeys("childClosureRef childDisposition childExecutionBasisDigest childExecutionBasisRef childFrameId childGraphCallId childJudgmentRef childReasonRef childResultDigest childResultRef childTerminalEventRef foldbackDigest foldbackRef outputDigest parentCCallRef");
const FAN_OUT_PAYLOAD = payloadKeys("applicationRef batchRef completionDigest completionKind completionRef inputMemberContractRef inputVectorRef outputMemberContractRef outputVectorContractRef");
const ROUTE_PAYLOAD = payloadKeys("cCallRef consumedAvailabilityRefs contractRef declarationDigest declarationRef graphSpanReentryProjection graphSpanReentryProjectionDigest graphSpanReentryProjectionRef judgmentRef nextActionProjection nextActionProjectionDigest nextActionProjectionRef replayStateDigest routeDigest routeKind routeRef sourceCursorDigest sourceCursorRef targetCursorDigest targetCursorRef");
const TERMINAL_PAYLOAD = payloadKeys("cCallRef closureContractDigest closureContractRef closureDigest closureRef judgmentRef resultRef routeRef terminalKind");
const RETRY_FAILURE_PROGRESS_PAYLOAD = payloadKeys("attempt attemptRef budget cCallRef completedAttempts failureClass failureSignalRef inputContractRef inputDigest inputRef judgmentRef progressClass progressDigest progressRef remainingBudget resultRef retryBoundaryRef retryPath");
const RETRY_STOPPED_PROGRESS_PAYLOAD = payloadKeys("attempt attemptRef budget cCallRef completedAttempts failureClass failureSignalRef inputContractRef inputDigest inputRef judgmentRef predecessorProgressRef progressClass progressDigest progressRef remainingBudget resultRef retryBoundaryRef retryPath stopReason");
const WITNESSED_ACT_PAYLOAD = payloadKeys("act actorDigest actorRef contentContractDigest contentContractRef contentKind contentValue contentValueDigest contentValueRef context evidence provenance subjectDigest subjectKind subjectRef witnessedActDigest witnessedActRef");
const ROOT_EVENT_CONTRACTS = Object.freeze({
    public_operation_artifact_admitted: {
        variants: [WORKSPACE_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("artifact artifactDigest artifactRef authorityScopeDigest authorityScopeRef causationEventRefs correlationId definitionDigest invocationDigest invocationPayloadDigest invocationRef memberKey operationId ownerAdmittedDisposition productSemanticsBasisDigest publicationDigest resolvedLock workspaceAuthorityBasis"), payloadKeys("operationId artifactRef artifactDigest"))],
    },
    public_operation_admitted: {
        variants: [WORKSPACE_EVENT],
        payloadVariants: [
            payloadVariant(payloadKeys("actorRef authorityDigest authorityRef capabilityGrantRefs catalogApplicationDigests catalogApplicationRefs catalogBasisDigest catalogBasisRef catalogHandle catalogViewId definitionDigest graphFunctionRef gtlEntryCoordinate gtlEntryTerm invocationDigest invocationRef memberKey operationId policyDigest policyRef programRef programValidationDigest programValidationRef selectedDefinitionDigest selectedDefinitionRef variant workspaceBindingId"), payloadKeys("catalogApplicationDigests catalogApplicationRefs operationId invocationRef invocationDigest variant")),
            payloadVariant(payloadKeys("actorRef authorityDigest authorityRef capabilityGrantRefs catalogBasisDigest catalogBasisRef catalogHandle catalogViewId definitionDigest graphFunctionRef gtlEntryCoordinate gtlEntryTerm invocationDigest invocationRef memberKey operationId policyDigest policyRef programRef programValidationDigest programValidationRef selectedDefinitionDigest selectedDefinitionRef variant workspaceBindingId"), payloadKeys("operationId invocationRef invocationDigest variant")),
            payloadVariant(payloadKeys("actorRef authorityDigest authorityRef capabilityGrantRefs capabilityRef catalogBasisDigest catalogBasisRef catalogViewDigest catalogViewId continuationRef definitionDigest graphFunctionDigest graphFunctionRef invocationDigest invocationPayloadDigest invocationRef memberKey operationId policyDigest policyRef programDigest programRef variant workspaceBindingDigest workspaceBindingId"), payloadKeys("actorRef authorityDigest authorityRef capabilityGrantRefs capabilityRef catalogBasisDigest catalogBasisRef catalogViewDigest catalogViewId continuationRef definitionDigest graphFunctionDigest graphFunctionRef invocationDigest invocationPayloadDigest invocationRef memberKey operationId policyDigest policyRef programDigest programRef variant workspaceBindingDigest workspaceBindingId")),
            payloadVariant(payloadKeys("actorDigest actorRef authorityScopeDigest authorityScopeRef capabilityGrantDigest capabilityGrantRef definitionDigest dependencyLockDigest dependencyLockRef executionBasisDigest executionBasisRef invocationDigest invocationPayloadDigest invocationRef memberKey operationId productSetDigest productSetRef workspaceBindingDigest workspaceBindingRef"), undefined, { operationId: "abg.operation.witness.admit" }),
            payloadVariant(payloadKeys("actorDigest actorRef authorityScopeDigest authorityScopeRef capabilityGrantDigest capabilityGrantRef definitionDigest dependencyLockDigest dependencyLockRef invocationDigest invocationPayloadDigest invocationRef memberKey operationId productSetDigest productSetRef workspaceBindingDigest workspaceBindingRef"), undefined, { operationId: "abg.operation.witness.admit" }),
        ],
    },
    invocation_admitted: {
        variants: [WORKSPACE_EVENT],
        payloadVariants: [
            payloadVariant(payloadKeys("actorRef authorityDigest authorityRef capabilityGrantRefs capabilityGrants catalogApplicationDigests catalogApplicationRefs catalogViewDigest catalogViewId graphFunctionDigest graphFunctionRef inputContractDigest inputContractOwner inputContractRef invocationAdmissionDigest invocationAdmissionRef invocationDigest invocationRef invocationVariant outputContractDigest outputContractOwner outputContractRef policyDigest policyRef productExecutionResolutionDigest productExecutionResolutionRef programDigest programRef programValidationDigest programValidationRef publicRequestAdmissionRef publicRequestDigest publicRequestInvocationRef publicStart rawInputAdmissionRef rawInputDigest reentryBasis sourceResultBasis workspaceBindingDigest workspaceBindingId workspaceId"), payloadKeys("catalogApplicationDigests catalogApplicationRefs invocationAdmissionRef invocationAdmissionDigest invocationRef reentryBasis sourceResultBasis"), undefined, payloadKeys("publicStart reentryBasis sourceResultBasis")),
            payloadVariant(payloadKeys("actorRef authorityDigest authorityRef capabilityGrantRefs capabilityGrants catalogApplicationDigests catalogApplicationRefs catalogBasisDigest catalogBasisRef catalogHandle catalogViewDigest catalogViewId graphFunctionDigest graphFunctionRef gtlEntryCoordinate gtlEntryTerm inputContractDigest inputContractOwner inputContractRef invocationAdmissionDigest invocationAdmissionRef invocationDigest invocationRef invocationVariant outputContractDigest outputContractOwner outputContractRef policyDigest policyRef productExecutionResolutionDigest productExecutionResolutionRef programDigest programRef programValidationDigest programValidationRef publicRequestAdmissionRef publicRequestDigest publicRequestInvocationRef publicStart rawInputAdmissionRef rawInputDigest reentryBasis selectedDefinitionDigest selectedDefinitionRef sourceResultBasis workspaceBindingDigest workspaceBindingId workspaceId"), payloadKeys("catalogApplicationDigests catalogApplicationRefs invocationAdmissionRef invocationAdmissionDigest invocationRef reentryBasis sourceResultBasis"), undefined, payloadKeys("publicStart reentryBasis sourceResultBasis")),
        ],
    },
    invocation_refused: {
        variants: [WORKSPACE_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("contractOrDiagnosticRefs invocationAdmissionRef refusalDigest refusalRef stage subjectDigest"), payloadKeys("refusalRef refusalDigest stage"))],
    },
    implementation_admitted: {
        variants: [WORKSPACE_EVENT],
        payloadVariants: [
            payloadVariant(IMPLEMENTATION_SET_PAYLOAD, payloadKeys("implementationSetRef implementationSetDigest interactionSetRef interactionSetDigest")),
            payloadVariant(combinePayloadKeys(IMPLEMENTATION_SET_PAYLOAD, LEGACY_IMPLEMENTATION_PAYLOAD), payloadKeys("implementationSetRef implementationSetDigest interactionSetRef interactionSetDigest implementationBindingRef")),
        ],
    },
    basis_admitted: {
        variants: [
            coupledContractVariant(WORKSPACE_EVENT, [0]),
            coupledContractVariant(FRAME_EVENT, [1]),
        ],
        payloadVariants: [
            payloadVariant(BASIS_PAYLOAD, payloadKeys("basisRef basisDigest basisClass rawInputValue"), { basisClass: "root" }),
            payloadVariant(BASIS_PAYLOAD, payloadKeys("basisRef basisDigest basisClass rawInputValue"), { basisClass: "child" }),
        ],
    },
    declaration_reprice_admitted: {
        variants: [WORKSPACE_EVENT, RUN_EVENT],
        payloadVariants: [payloadVariant(combinePayloadKeys(WITNESSED_ACT_PAYLOAD, payloadKeys("afterDigest beforeDigest changeClass declarationRef operatorActorRef owningTicketRef reason repriceRef")))],
    },
    replay_log_attested: {
        variants: [WORKSPACE_EVENT, RUN_EVENT],
        payloadVariants: [payloadVariant(combinePayloadKeys(WITNESSED_ACT_PAYLOAD, payloadKeys("attestationRef attestedBy chainDigest eventCount")))],
    },
    workspace_hygiene_stamped: {
        variants: [WORKSPACE_EVENT],
        payloadVariants: [payloadVariant(combinePayloadKeys(WITNESSED_ACT_PAYLOAD, payloadKeys("hygieneRef observedBy rows segmentRef")), undefined, undefined, payloadKeys("segmentRef"))],
    },
    defect_intake_admitted: {
        variants: [RUN_EVENT],
        payloadVariants: [payloadVariant(combinePayloadKeys(WITNESSED_ACT_PAYLOAD, payloadKeys("changeClass haltDiagnosisDigest haltDiagnosisRef intakeRef owner reEntryPoint summary triagedBy")))],
    },
    run_resumed: {
        variants: [RUN_EVENT],
        payloadVariants: [payloadVariant(combinePayloadKeys(WITNESSED_ACT_PAYLOAD, payloadKeys("operatorActorRef reasonDetail reasonKind")))],
    },
    run_segment_opened: {
        variants: [RUN_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("executionBasisDigest executionBasisRef graphDigest graphFunctionRef graphRef invocationAdmissionRef invocationRef programRef runDigest runId workspaceBindingId"), payloadKeys("executionBasisDigest executionBasisRef graphDigest graphFunctionRef graphRef invocationAdmissionRef invocationRef programRef runDigest runId workspaceBindingId"))],
    },
    graph_call_opened: {
        variants: [
            coupledContractVariant(GRAPH_CALL_EVENT, [0, 1]),
        ],
        payloadVariants: [
            payloadVariant(GRAPH_OPEN_PAYLOAD, payloadKeys("graphCallId graphCallDigest")),
            payloadVariant(combinePayloadKeys(GRAPH_OPEN_PAYLOAD, payloadKeys("parentFrameId")), payloadKeys("graphCallId graphCallDigest parentFrameId")),
        ],
    },
    frame_opened: {
        variants: [FRAME_EVENT],
        payloadVariants: [payloadVariant(FRAME_OPEN_PAYLOAD, payloadKeys("frameId frameDigest frameLineageId attempt parentFrameId"))],
    },
    traversal_cursor_entered: {
        variants: [FRAME_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("attempt cursorDigest cursorRef executionBasisDigest executionBasisRef graphFunctionDigest graphFunctionRef inputDigest inputRef materializationDigest materializationRef programDigest programRef retryPath taskOrdinal termPath traversalScopeDigest traversalScopeRef"), payloadKeys("cursorRef cursorDigest"))],
    },
    c_call_opened: {
        variants: [C_CALL_EVENT],
        payloadVariants: [
            payloadVariant(C_CALL_OPEN_PAYLOAD, payloadKeys("cCallRef cCallDigest callClass"), { callClass: "leaf" }),
            payloadVariant(combinePayloadKeys(C_CALL_OPEN_PAYLOAD, payloadKeys("childGraphFunctionRef failureContractRef judgmentPredicateRef")), payloadKeys("cCallRef cCallDigest callClass childGraphFunctionRef failureContractRef judgmentPredicateRef"), { callClass: "workflow" }),
        ],
    },
    c_call_fibre_selected: {
        variants: [C_CALL_EVENT],
        payloadVariants: [
            payloadVariant(C_CALL_FIBRE_PAYLOAD, payloadKeys("cCallRef callClass armId regime"), { callClass: "leaf" }),
            payloadVariant(combinePayloadKeys(C_CALL_FIBRE_PAYLOAD, payloadKeys("childGraphFunctionRef")), payloadKeys("cCallRef callClass armId regime childGraphFunctionRef"), { callClass: "workflow" }),
        ],
    },
    actor_transport_binding_admitted: {
        variants: [TRANSPORT_BINDING_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorRef agentKey archiveRoot args cCallRef command cwd dispatchOrdinal environmentDigest environmentPolicyDigest implementationBindingRef implementationRef inputDigest lane parser paths promptDigest promptTransport responseJsonSchemaDigest terminationGraceMs timeoutMs transportBindingDigest transportBindingRef transportContractDigest transportPlanDigest workerBindingRef"), payloadKeys("transportBindingRef transportBindingDigest cCallRef"))],
    },
    actor_invocation_started: {
        variants: [ACTOR_INVOCATION_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorInvocationRef actorRef cCallRef dispatchOrdinal implementationRef inputDigest promptDigest requestDigest requestRef transportBindingDigest transportBindingRef workerBindingRef"), payloadKeys("actorInvocationRef transportBindingRef cCallRef"))],
    },
    actor_process_started: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorInvocationRef cCallRef processId processRef"), payloadKeys("actorInvocationRef processRef processId"))],
    },
    actor_process_spawn_failed: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorInvocationRef diagnosticDigest processRef"), payloadKeys("actorInvocationRef processRef diagnosticDigest"))],
    },
    actor_process_stdout_observed: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(PROCESS_STREAM_PAYLOAD, payloadKeys("actorInvocationRef processRef streamOrdinal chunkDigest"))],
    },
    actor_process_stderr_observed: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(PROCESS_STREAM_PAYLOAD, payloadKeys("actorInvocationRef processRef streamOrdinal chunkDigest"))],
    },
    actor_process_timeout_observed: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorInvocationRef processRef timeoutMs"))],
    },
    actor_process_signal_requested: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorInvocationRef processRef signal"))],
    },
    actor_process_exited: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorInvocationRef processRef signal status"), payloadKeys("processRef status signal"))],
    },
    actor_process_termination_unconfirmed: {
        variants: [PROCESS_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorInvocationRef processRef"))],
    },
    actor_result_artifact_observed: {
        variants: [ACTOR_INVOCATION_EVENT],
        payloadVariants: [payloadVariant(ACTOR_OBSERVATION_PAYLOAD, payloadKeys("actorInvocationRef processRef artifactDigests disposition"))],
    },
    actor_invocation_closed: {
        variants: [ACTOR_INVOCATION_EVENT],
        payloadVariants: [payloadVariant(combinePayloadKeys(ACTOR_TERMINAL_PAYLOAD, payloadKeys("transportDigest consumedTransportBindingRef consumedStdoutEventRefs consumedStderrEventRefs consumedArtifactEventRef")), payloadKeys("actorInvocationRef processRef cCallRef disposition"))],
    },
    actor_invocation_failed: {
        variants: [ACTOR_INVOCATION_EVENT],
        payloadVariants: [
            payloadVariant(combinePayloadKeys(ACTOR_TERMINAL_PAYLOAD, payloadKeys("transportDigest consumedTransportBindingRef consumedStdoutEventRefs consumedStderrEventRefs consumedArtifactEventRef")), payloadKeys("actorInvocationRef processRef cCallRef disposition failureClass transportDigest")),
            payloadVariant(combinePayloadKeys(ACTOR_TERMINAL_PAYLOAD, payloadKeys("diagnosticDigest")), payloadKeys("actorInvocationRef processRef cCallRef disposition failureClass diagnosticDigest"), { failureClass: "transport_exception" }),
        ],
    },
    c_call_evidenced: {
        variants: [C_CALL_EVENT],
        payloadVariants: [
            payloadVariant(EVIDENCE_IO_PAYLOAD, EVIDENCE_IO_PAYLOAD, { evidenceClass: "deterministic" }),
            payloadVariant(combinePayloadKeys(EVIDENCE_IO_PAYLOAD, payloadKeys("actorInvocationRef actorRef apiRetryCount artifactDigests candidateDigest candidateRef exitObserved instructionContractRef materializationPlanRef observedOutputDigest processRef processSignal processStatus progressEventCount promptDigest rawOutputDigest rendererRef requestDigest requestRef resultContractRef signalSequence stderrByteLength stdoutByteLength structuredEventCount terminationConfirmed timedOut toolCallCount transportBindingDigest transportBindingRef transportDigest transportDisposition transportFailureClass transportLane workerBindingRef")), EVIDENCE_IO_PAYLOAD, { evidenceClass: "probabilistic_transport" }),
            payloadVariant(combinePayloadKeys(EVIDENCE_IO_PAYLOAD, payloadKeys("childClosureRef childDisposition childExecutionBasisDigest childExecutionBasisRef childFrameId childGraphCallId childJudgmentRef childOutputDigest childReasonRef childResultDigest childResultRef childTerminalEventRef foldbackDigest foldbackEventRef foldbackRef")), EVIDENCE_IO_PAYLOAD, { evidenceClass: "sub_traversal" }, payloadKeys("implementationRef")),
            payloadVariant(combinePayloadKeys(EVIDENCE_PAYLOAD, payloadKeys("candidateDigest diagnosticRef rejectedContractRef rejectedStage")), EVIDENCE_PAYLOAD, { evidenceClass: "admission_rejection" }),
            payloadVariant(combinePayloadKeys(EVIDENCE_IO_PAYLOAD, payloadKeys("requestDigest requestRef")), EVIDENCE_IO_PAYLOAD, { evidenceClass: "interaction_request" }, payloadKeys("implementationRef")),
        ],
    },
    c_call_result_admitted: {
        variants: [C_CALL_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("cCallRef contractRef evidenceRefs resultClass resultDigest resultRef value valueDigest valueKind"), payloadKeys("resultRef resultDigest cCallRef resultClass"))],
    },
    c_call_judged: {
        variants: [C_CALL_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("cCallRef contractRef judgment judgmentDigest judgmentRef predicateRef reasonRef replayStateDigest resultDigest resultRef retryAttemptRef"), payloadKeys("judgmentRef judgmentDigest cCallRef resultRef judgment retryAttemptRef"), undefined, payloadKeys("retryAttemptRef"))],
    },
    assessed: {
        variants: [C_CALL_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorDigest actorRef assessment assessmentContractDigest assessmentContractRef assessmentDigest assessmentRef assessmentValueDigest assessmentValueRef capabilityGrantDigest capabilityGrantRef closureEligible disposition evidence executionBasisDigest executionBasisRef expectedResultDigest expectedResultRef invocationDigest invocationRef residuals"))],
    },
    retry_attempt_opened: {
        variants: [FRAME_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("attempt attemptDigest attemptManifestRef attemptRef budget inputContractRef inputDigest inputRef inputValue priorJudgmentRef priorRouteRef retryBoundaryRef retryPath retryTermPath retryableFailureClasses taskOrdinal wrappedTermPath"), payloadKeys("attemptRef attemptDigest attemptManifestRef retryBoundaryRef attempt"))],
    },
    retry_progress_recorded: {
        variants: [FRAME_EVENT],
        payloadVariants: [
            payloadVariant(RETRY_FAILURE_PROGRESS_PAYLOAD, RETRY_FAILURE_PROGRESS_PAYLOAD, { progressClass: "retry" }),
            payloadVariant(RETRY_STOPPED_PROGRESS_PAYLOAD, RETRY_STOPPED_PROGRESS_PAYLOAD, { progressClass: "stopped" }, payloadKeys("predecessorProgressRef")),
            payloadVariant(payloadKeys("attempt attemptRef cCallRef completedRetryDepth completionClass completionWitnessEventRef judgmentRef predecessorProgressRef progressClass progressDigest progressRef resultRef retryBoundaryRef retryPath sourceCursorDigest sourceCursorRef"), payloadKeys("progressRef progressDigest progressClass attemptRef retryBoundaryRef retryPath completedRetryDepth completionClass completionWitnessEventRef cCallRef resultRef judgmentRef sourceCursorRef sourceCursorDigest predecessorProgressRef"), { progressClass: "completed" }, payloadKeys("predecessorProgressRef")),
            payloadVariant(payloadKeys("attempt attemptRef cCallRef completedRetryDepth completionClass completionWitnessEventRef judgmentRef predecessorProgressRef progressClass progressDigest progressRef resultRef retryBoundaryRef retryPath sourceCursorDigest sourceCursorRef targetCursorDigest targetCursorRef"), payloadKeys("progressRef progressDigest progressClass attemptRef retryBoundaryRef retryPath completedRetryDepth completionClass completionWitnessEventRef cCallRef resultRef judgmentRef sourceCursorRef sourceCursorDigest targetCursorRef targetCursorDigest predecessorProgressRef"), { progressClass: "completed" }, payloadKeys("predecessorProgressRef")),
            payloadVariant(payloadKeys("attempt attemptRef completedRetryDepth completionClass completionWitnessEventRef predecessorProgressRef progressClass progressDigest progressRef retryBoundaryRef retryPath sourceCursorDigest sourceCursorRef targetCursorDigest targetCursorRef"), payloadKeys("progressRef progressDigest progressClass attemptRef retryBoundaryRef retryPath completedRetryDepth completionClass completionWitnessEventRef sourceCursorRef sourceCursorDigest targetCursorRef targetCursorDigest predecessorProgressRef"), {
                progressClass: "completed",
                completionClass: "structural_identity_success",
            }, payloadKeys("predecessorProgressRef")),
        ],
    },
    child_foldback_admitted: {
        variants: [FRAME_EVENT],
        payloadVariants: [
            payloadVariant(FOLDBACK_PAYLOAD, payloadKeys("foldbackRef foldbackDigest parentCCallRef childDisposition childResultRef")),
            payloadVariant(combinePayloadKeys(FOLDBACK_PAYLOAD, payloadKeys("applicationFoldbackRef applicationRef parentJudgmentRef sourceCursorDigest sourceCursorRef")), payloadKeys("foldbackRef foldbackDigest parentCCallRef childDisposition childResultRef applicationRef")),
        ],
    },
    child_preparation_refused: {
        variants: [
            coupledContractVariant(C_CALL_EVENT, [0]),
            coupledContractVariant(FRAME_EVENT, [1]),
        ],
        payloadVariants: [
            payloadVariant(payloadKeys("candidateDigest childGraphFunctionRef diagnosticRef inputDigest inputRef kind message parentCCallRef schemaVersion stage"), payloadKeys("childGraphFunctionRef stage candidateDigest")),
            payloadVariant(payloadKeys("applicationRef childGraphFunctionRef diagnosticRef inputDigest inputRef message parentCCallRef parentJudgmentRef refusalDigest refusalRef sourceCursorRef stage"), payloadKeys("childGraphFunctionRef stage refusalRef refusalDigest")),
        ],
    },
    fan_out_completion_admitted: {
        variants: [FRAME_EVENT],
        payloadVariants: [
            payloadVariant(combinePayloadKeys(FAN_OUT_PAYLOAD, payloadKeys("outputVector outputVectorDigest outputVectorRef taskRows")), payloadKeys("completionRef completionDigest completionKind outputVector outputVectorDigest outputVectorRef taskRows"), { completionKind: "complete_vector" }),
            payloadVariant(combinePayloadKeys(FAN_OUT_PAYLOAD, payloadKeys("completedRows stoppingRow unstartedRows")), payloadKeys("completionRef completionDigest completionKind completedRows stoppingRow unstartedRows"), { completionKind: "partial_stop" }),
        ],
    },
    traversal_route_admitted: {
        variants: [FRAME_EVENT],
        payloadVariants: [payloadVariant(ROUTE_PAYLOAD, payloadKeys("routeRef routeDigest routeKind"))],
    },
    construction_intent_selected: {
        variants: [FRAME_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actionCatalogDigest actionCatalogRef actionCatalogRowDigest constructionIntent constructionIntentDigest constructionIntentRef nextActionBasis nextActionBasisDigest nextActionBasisRef nextActionProjection nextActionProjectionDigest nextActionProjectionRef routeRef targetCursorDigest targetCursorRef"))],
    },
    construction_delta_observed: {
        variants: [FRAME_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actionEvaluation actionEvaluationAdmission actionEvaluationAdmissionDigest actionEvaluationAdmissionRef actionEvaluationDigest actionEvaluationRef constructionCompositionDigest constructionCompositionRef constructionIntentDigest constructionIntentRef deltaDigest deltaRef edgeClosureDecision edgeClosureDecisionDigest edgeClosureDecisionRef edgeFulfillmentLedger edgeFulfillmentLedgerDigest edgeFulfillmentLedgerRef runtimeEvidenceEventRefs semanticEvidenceAssetRefs sourceCCallRef sourceJudgmentRef sourceResultDigest sourceResultRef targetCursorDigest targetCursorRef targetOutcomeRef workspaceBindingDigest workspaceBindingId"))],
    },
    fh_interaction_opened: {
        variants: [CONTINUATION_EVENT],
        payloadVariants: [
            payloadVariant(payloadKeys("actorCapabilityRef cCall cCallRef causedByEventRef continuationDigest continuationKind continuationRef executionBasisDigest executionBasisRef graphDigest graphFunctionDigest graphFunctionRef graphRef graphValidationRef heldCursor heldCursorDigest heldCursorRef holdRouteRef implementationSetDigest implementationSetRef inputDigest inputRef inputValue installId interactionSetDigest interactionSetRef linkDigest linkRef manifestDigest openedTraversalScope pendingJudgment pendingResult productContentDigest productId programDigest programRef programValidationRef requestContractRef requestDigest requestRef responseContractRef scopeDigest scopeRef workspaceBindingDigest workspaceBindingId catalogViewDigest catalogViewId"), payloadKeys("actorCapabilityRef cCall cCallRef causedByEventRef continuationDigest continuationKind continuationRef executionBasisDigest executionBasisRef graphDigest graphFunctionDigest graphFunctionRef graphRef graphValidationRef heldCursor heldCursorDigest heldCursorRef holdRouteRef implementationSetDigest implementationSetRef inputDigest inputRef inputValue installId interactionSetDigest interactionSetRef manifestDigest openedTraversalScope pendingJudgment pendingResult productContentDigest productId programDigest programRef programValidationRef requestContractRef requestDigest requestRef responseContractRef scopeDigest scopeRef workspaceBindingDigest workspaceBindingId catalogViewDigest catalogViewId")),
            payloadVariant(payloadKeys("actorCapabilityRef cCall cCallRef causedByEventRef constructionIntentDigest constructionIntentRef continuationDigest continuationKind continuationRef executionBasisDigest executionBasisRef graphDigest graphFunctionDigest graphFunctionRef graphRef graphValidationRef heldCursor heldCursorDigest heldCursorRef holdRouteRef implementationSetDigest implementationSetRef inputDigest inputRef inputValue installId interactionSetDigest interactionSetRef linkDigest linkRef manifestDigest openedTraversalScope pendingJudgment pendingResult productContentDigest productId programDigest programRef programValidationRef requestContractRef requestDigest requestRef responseContractRef scopeDigest scopeRef workspaceBindingDigest workspaceBindingId catalogViewDigest catalogViewId"), payloadKeys("continuationRef continuationDigest constructionIntentRef constructionIntentDigest")),
        ],
    },
    fh_interaction_responded: {
        variants: [CONTINUATION_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorRef capabilityRef continuationRef publicOperationEventRef responseContractRef responseDigest responseRef responseValue"))],
    },
    fh_interaction_resume_admitted: {
        variants: [CONTINUATION_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("actorRef capabilityRef closureContract continuationRef durablePrefixDigest openedEventRef publicOperationEventRef respondedEventRef responseDigest responseRef responseValue successorCursor successorCursorDigest successorCursorRef successorInputContractRef successorInputDigest successorInputRef successorInputValue successorInputValueKind"), payloadKeys("actorRef capabilityRef closureContract continuationRef durablePrefixDigest openedEventRef publicOperationEventRef respondedEventRef responseDigest responseRef responseValue successorCursor successorCursorDigest successorCursorRef successorInputContractRef successorInputDigest successorInputRef successorInputValue successorInputValueKind"), undefined, payloadKeys("successorInputContractRef"))],
    },
    continuation_abandoned: {
        variants: [CONTINUATION_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("candidateDigest candidateRef causedByEventRef continuationDigest continuationKind continuationRef terminalDisposition"))],
    },
    continuation_superseded: {
        variants: [CONTINUATION_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("candidateDigest candidateRef causedByEventRef continuationDigest continuationKind continuationRef terminalDisposition"))],
    },
    continuation_reentry_link_admitted: {
        variants: [WORKSPACE_EVENT],
        payloadVariants: [
            payloadVariant(payloadKeys("linkDigest linkRef predecessorContinuationId predecessorDisposition predecessorRunId successorKind successorRunId workspaceBindingDigest workspaceBindingId"), undefined, { successorKind: "none" }),
            payloadVariant(payloadKeys("continuationKind linkDigest linkRef plannedContinuationId plannedOpeningBasisDigest plannedOpeningBasisRef predecessorContinuationId predecessorDisposition predecessorRunId successorKind successorRunId workspaceBindingDigest workspaceBindingId"), undefined, { successorKind: "some" }),
        ],
    },
    runtime_failure_observed: {
        variants: [
            coupledContractVariant(RUN_EVENT, [0]),
            coupledContractVariant(FRAME_EVENT, [1]),
        ],
        payloadVariants: [
            payloadVariant(payloadKeys("basisId diagnosticRef failureDigest failureRef frameId graphCallId runId stage subjectDigest"), payloadKeys("failureRef failureDigest stage subjectDigest")),
            payloadVariant(payloadKeys("cCallRef code failureClass subjectDigest"), payloadKeys("failureClass code subjectDigest cCallRef")),
        ],
    },
    run_stopped: {
        variants: [RUN_EVENT],
        payloadVariants: [
            payloadVariant(payloadKeys("cCallRef disposition judgmentRef reasonRef routeRef"), payloadKeys("disposition routeRef reasonRef")),
            payloadVariant(payloadKeys("act actorDigest actorRef contentContractDigest contentContractRef contentKind contentValue contentValueDigest contentValueRef context evidence operatorActorRef provenance reasonDetail reasonKind subjectDigest subjectKind subjectRef witnessedActDigest witnessedActRef")),
        ],
    },
    terminal_reached: {
        variants: [FRAME_EVENT],
        payloadVariants: [
            payloadVariant(TERMINAL_PAYLOAD, payloadKeys("closureRef closureDigest routeRef terminalKind")),
            payloadVariant(combinePayloadKeys(TERMINAL_PAYLOAD, payloadKeys("childFrameId childGraphCallId")), payloadKeys("closureRef closureDigest routeRef terminalKind childFrameId childGraphCallId")),
        ],
    },
    frame_closed: {
        variants: [FRAME_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("closureContractRef frameId terminalReachedEventRef"), payloadKeys("frameId terminalReachedEventRef"))],
    },
    graph_call_closed: {
        variants: [GRAPH_CALL_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("closureContractRef frameClosedEventRef graphCallId"), payloadKeys("graphCallId frameClosedEventRef"))],
    },
    run_closed: {
        variants: [RUN_EVENT],
        payloadVariants: [payloadVariant(payloadKeys("closureContractRef graphCallClosedEventRef runId"), payloadKeys("runId graphCallClosedEventRef"))],
    },
});

function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSha256Digest(value) {
    return typeof value === "string" && /^sha256:[0-9a-f]{64}$/u.test(value);
}

function canonicalJson(value) {
    if (value === null || typeof value === "boolean" || typeof value === "string") {
        return JSON.stringify(value);
    }
    if (typeof value === "number") {
        if (!Number.isFinite(value)) {
            throw new TypeError("canonical JSON does not admit non-finite numbers");
        }
        return Object.is(value, -0) ? "0" : JSON.stringify(value);
    }
    if (Array.isArray(value)) {
        return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
    }
    if (!isRecord(value)) {
        throw new TypeError("canonical JSON value is unsupported");
    }
    return `{${Object.entries(value)
        .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
        .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
        .join(",")}}`;
}

function sha256Canonical(value) {
    return `sha256:${createHash("sha256").update(canonicalJson(value)).digest("hex")}`;
}

const ABI5_ROOT_AGGREGATE_TYPE_VALUES = Object.freeze([
    "actor_invocation",
    "c_call",
    "continuation",
    "frame",
    "graph_call",
    "process",
    "run",
    "transport_binding",
    "workspace",
]);
const PINNED_ABI5_ROOT_EVENT_CONTRACT_DIGEST = "sha256:b47319edc2fe4c50d65579cbbe8d19952199a69b993b91d5f8888e511c96bd6d";
export const ABI5_ROOT_EVENT_CONTRACT_DIGEST = sha256Canonical({
    schemaVersion: "5.0.0",
    aggregateTypes: ABI5_ROOT_AGGREGATE_TYPE_VALUES,
    eventKinds: Object.keys(ROOT_EVENT_CONTRACTS),
    eventContracts: ROOT_EVENT_CONTRACTS,
});
if (ABI5_ROOT_EVENT_CONTRACT_DIGEST !== PINNED_ABI5_ROOT_EVENT_CONTRACT_DIGEST) {
    throw new TypeError("local ABIogenesis 5 root event registry differs from its pinned contract digest");
}

const WORKER_TRANSPORT_FAILURE_CLASS_VALUES = Object.freeze([
    "contract_failure",
    "no_output",
    "transport_failure",
]);

function isExactReferenceDigestSet(value) {
    return Array.isArray(value) &&
        value.length > 0 &&
        value.every((entry) => isRecord(entry) &&
            Object.keys(entry).length === 2 &&
            Object.hasOwn(entry, "ref") &&
            Object.hasOwn(entry, "digest") &&
            typeof entry.ref === "string" &&
            entry.ref.length > 0 &&
            isSha256Digest(entry.digest)) &&
        new Set(value.map((entry) => entry.ref))
            .size === value.length;
}
function exactStringKeys(value, expected) {
    const actual = Object.keys(value).sort();
    const required = [...expected].sort();
    return actual.length === required.length &&
        actual.every((key, index) => key === required[index]);
}
function assertRuntimeEventContract(candidate, registry = ROOT_EVENT_CONTRACTS) {
    const contract = registry[candidate.kind];
    const envelope = candidate;
    const envelopeVariants = contract.variants.filter((entry) => entry.aggregateType === candidate.aggregateType &&
        entry.scopeClass === candidate.scopeClass &&
        entry.requiredEnvelopeIdentities.every((key) => typeof envelope[key] === "string" && envelope[key] !== ""));
    if (envelopeVariants.length === 0) {
        throw new TypeError("runtime event kind, aggregate type, and scope class do not form an admitted variant");
    }
    if (candidate.scopeClass === "workspace" &&
        (candidate.runId !== undefined ||
            candidate.graphCallId !== undefined ||
            candidate.frameId !== undefined ||
            candidate.frameLineageId !== undefined)) {
        throw new TypeError("workspace runtime event cannot carry run-local scope identities");
    }
    if ((candidate.aggregateType === "run" &&
        candidate.aggregateId !== candidate.runId) ||
        (candidate.aggregateType === "graph_call" &&
            candidate.aggregateId !== candidate.graphCallId) ||
        (candidate.aggregateType === "frame" &&
            candidate.aggregateId !== candidate.frameId)) {
        throw new TypeError("runtime event aggregate identity differs from its scope identity");
    }
    const payload = candidate.payload;
    if (!isRecord(payload)) {
        throw new TypeError("runtime event payload must be one closed object");
    }
    const payloadKeysPresent = Object.keys(payload);
    const contractMatches = envelopeVariants.flatMap((envelopeVariant) => contract.payloadVariants.flatMap((payloadVariant, payloadVariantIndex) => {
        const admittedIndexes = envelopeVariant.payloadVariantIndexes ??
            contract.payloadVariants.map((_, index) => index);
        return admittedIndexes.includes(payloadVariantIndex) &&
            payloadVariant.requiredPayloadKeys.every((key) => Object.hasOwn(payload, key)) &&
            payloadKeysPresent.every((key) => payloadVariant.allowedPayloadKeys.includes(key)) &&
            Object.entries(payloadVariant.expectedPayload ?? {}).every(([key, expected]) => payload[key] === expected)
            ? [{ envelopeVariant, payloadVariant }]
            : [];
    }));
    if (contractMatches.length !== 1) {
        throw new TypeError("runtime event payload matches no admitted event-contract variant");
    }
    const selectedPayloadVariant = contractMatches[0].payloadVariant;
    for (const key of selectedPayloadVariant.requiredPayloadKeys) {
        const value = payload[key];
        if (key.endsWith("Digest") &&
            !isSha256Digest(value)) {
            throw new TypeError("runtime event payload carries an invalid required digest");
        }
        if ((key.endsWith("Ref") || key.endsWith("Id")) &&
            key !== "processId" &&
            !(key === "parentFrameId" && value === null) &&
            !(value === null &&
                selectedPayloadVariant.nullablePayloadKeys?.includes(key) === true) &&
            (typeof value !== "string" || value.length === 0)) {
            throw new TypeError("runtime event payload carries an invalid required identity");
        }
    }
    if (candidate.kind === "retry_progress_recorded") {
        const positiveInteger = (value) => Number.isSafeInteger(value) && Number(value) > 0;
        const positiveIntegerArray = (value) => Array.isArray(value) && value.length > 0 && value.every(positiveInteger);
        const retryPath = Array.isArray(payload.retryPath) ? payload.retryPath : [];
        if (!positiveInteger(payload.attempt) ||
            !positiveIntegerArray(payload.retryPath) ||
            payload.attempt !== retryPath.at(-1) ||
            ((payload.progressClass === "retry" ||
                payload.progressClass === "stopped") && (!positiveInteger(payload.budget) ||
                !positiveIntegerArray(payload.completedAttempts) ||
                !Number.isSafeInteger(payload.remainingBudget) ||
                Number(payload.remainingBudget) < 0 ||
                !WORKER_TRANSPORT_FAILURE_CLASS_VALUES.includes(String(payload.failureClass)))) ||
            (payload.progressClass === "stopped" &&
                !((payload.stopReason === "boundary_terminal" &&
                    payload.predecessorProgressRef === null) ||
                    (payload.stopReason === "propagated_inner_stop" &&
                        typeof payload.predecessorProgressRef === "string" &&
                        payload.predecessorProgressRef.length > 0))) ||
            (payload.progressClass === "completed" &&
                (!positiveInteger(payload.completedRetryDepth) ||
                    payload.completedRetryDepth !== retryPath.length ||
                    ![
                        "judged_success",
                        "fan_out_success",
                        "fh_resume_success",
                        "structural_identity_success",
                    ].includes(String(payload.completionClass)) ||
                    (payload.completionClass === "structural_identity_success" &&
                        (Object.hasOwn(payload, "cCallRef") ||
                            Object.hasOwn(payload, "resultRef") ||
                            Object.hasOwn(payload, "judgmentRef"))) ||
                    (payload.completionClass !== "structural_identity_success" &&
                        (!Object.hasOwn(payload, "cCallRef") ||
                            !Object.hasOwn(payload, "resultRef") ||
                            !Object.hasOwn(payload, "judgmentRef")))))) {
            throw new TypeError("retry progress payload carries invalid required value types");
        }
    }
    for (const [payloadKey, envelopeValue] of [
        ["runId", candidate.runId],
        ["graphCallId", candidate.graphCallId],
        ["frameId", candidate.frameId],
    ]) {
        if (Object.hasOwn(payload, payloadKey) &&
            payload[payloadKey] !== envelopeValue) {
            throw new TypeError("runtime event payload identity differs from its envelope");
        }
    }
    if ((candidate.aggregateType === "c_call" &&
        Object.hasOwn(payload, "cCallRef") &&
        payload.cCallRef !== candidate.aggregateId) ||
        (candidate.aggregateType === "actor_invocation" &&
            payload.actorInvocationRef !== candidate.aggregateId) ||
        (candidate.aggregateType === "process" &&
            payload.processRef !== candidate.aggregateId) ||
        (candidate.aggregateType === "transport_binding" &&
            payload.transportBindingRef !== candidate.aggregateId)) {
        throw new TypeError("runtime event payload aggregate identity is inconsistent");
    }
    if (candidate.kind === "actor_process_started" &&
        (!Number.isSafeInteger(payload.processId) || Number(payload.processId) <= 0)) {
        throw new TypeError("actor process event carries an invalid process identity");
    }
    if (candidate.kind === "basis_admitted" &&
        (!["root", "child"].includes(String(payload.basisClass)) ||
            (candidate.aggregateType === "workspace" &&
                payload.basisClass !== "root") ||
            (candidate.aggregateType === "frame" &&
                payload.basisClass !== "child"))) {
        throw new TypeError("execution-basis event carries an invalid basis class");
    }
    if ((candidate.kind === "c_call_opened" ||
        candidate.kind === "c_call_fibre_selected") &&
        !["leaf", "workflow"].includes(String(payload.callClass))) {
        throw new TypeError("C-call event carries an unknown call class");
    }
    if (candidate.kind === "c_call_evidenced" &&
        ![
            "deterministic",
            "interaction_request",
            "probabilistic_transport",
            "sub_traversal",
            "admission_rejection",
        ].includes(String(payload.evidenceClass))) {
        throw new TypeError("C-call evidence event carries an unknown evidence class");
    }
    if (candidate.kind === "c_call_result_admitted" &&
        !["success", "failure", "pending", "refusal"].includes(String(payload.resultClass))) {
        throw new TypeError("C-call result event carries an unknown result class");
    }
    if (candidate.kind === "assessed" &&
        !["admitted", "rejected", "retry", "blocked"].includes(String(payload.disposition))) {
        throw new TypeError("result assessment event carries an unknown disposition");
    }
    if ([
        "declaration_reprice_admitted",
        "replay_log_attested",
        "workspace_hygiene_stamped",
        "defect_intake_admitted",
        "run_resumed",
        "run_stopped",
    ].includes(candidate.kind) &&
        Object.hasOwn(payload, "witnessedActRef")) {
        const expectedAct = candidate.kind === "declaration_reprice_admitted"
            ? "reprice"
            : candidate.kind === "replay_log_attested"
                ? "attest"
                : candidate.kind === "workspace_hygiene_stamped"
                    ? "hygiene-stamp"
                    : candidate.kind === "defect_intake_admitted"
                        ? "intake"
                        : candidate.kind === "run_resumed"
                            ? "run-resumed"
                            : "run-stopped";
        const witnessedBody = {
            act: payload.act,
            actor: { ref: payload.actorRef, digest: payload.actorDigest },
            subject: {
                kind: payload.subjectKind,
                ref: payload.subjectRef,
                digest: payload.subjectDigest,
            },
            content: {
                kind: payload.contentKind,
                contractRef: payload.contentContractRef,
                contractDigest: payload.contentContractDigest,
                valueRef: payload.contentValueRef,
                valueDigest: payload.contentValueDigest,
                value: payload.contentValue,
            },
            context: payload.context,
            evidence: payload.evidence,
            provenance: payload.provenance,
        };
        const witnessedActDigest = sha256Canonical(witnessedBody);
        if (payload.act !== expectedAct ||
            !isSha256Digest(payload.actorDigest) ||
            !isSha256Digest(payload.subjectDigest) ||
            !isSha256Digest(payload.contentContractDigest) ||
            !isSha256Digest(payload.contentValueDigest) ||
            payload.contentValueDigest !== sha256Canonical(payload.contentValue) ||
            !isExactReferenceDigestSet(payload.evidence) ||
            !isExactReferenceDigestSet(payload.provenance) ||
            payload.witnessedActDigest !== witnessedActDigest ||
            payload.witnessedActRef !==
                `witnessed-act://abiogenesis/${witnessedActDigest.slice("sha256:".length)}`) {
            throw new TypeError("witness event payload is not one exact self-certified actor-attributed act");
        }
    }
    if (candidate.kind === "declaration_reprice_admitted" &&
        (payload.beforeDigest === payload.afterDigest ||
            ![
                "goal_reprice",
                "intent_reprice",
                "product_reprice",
                "requirement_reprice",
                "design_reframe",
                "realization_refactor",
            ].includes(String(payload.changeClass)) ||
            payload.repriceRef !== `declaration-reprice:${sha256Canonical({
                declarationRef: payload.declarationRef,
                beforeDigest: payload.beforeDigest,
                afterDigest: payload.afterDigest,
                changeClass: payload.changeClass,
                owningTicketRef: payload.owningTicketRef,
            })}`)) {
        throw new TypeError("declaration reprice event carries invalid change truth");
    }
    if (candidate.kind === "replay_log_attested" &&
        (!Number.isSafeInteger(payload.eventCount) ||
            Number(payload.eventCount) < 0 ||
            payload.attestationRef !== `replay-attestation:${sha256Canonical({
                basisId: candidate.basisId,
                chainDigest: payload.chainDigest,
                eventCount: payload.eventCount,
                attestedBy: payload.attestedBy,
            })}`)) {
        throw new TypeError("replay attestation event is not self-certified");
    }
    if (candidate.kind === "defect_intake_admitted" &&
        (![
            "goal_reprice",
            "intent_reprice",
            "product_reprice",
            "requirement_reprice",
            "design_reframe",
            "realization_refactor",
        ].includes(String(payload.changeClass)) ||
            ![
                "goals",
                "intent",
                "product_definition",
                "requirements",
                "design_surface",
                "realization",
                "proof",
            ].includes(String(payload.reEntryPoint)) ||
            payload.intakeRef !== `defect-intake:${sha256Canonical({
                basisId: candidate.basisId,
                haltDiagnosisRef: payload.haltDiagnosisRef,
                owner: payload.owner,
                changeClass: payload.changeClass,
                reEntryPoint: payload.reEntryPoint,
                summary: payload.summary,
                evidenceRefs: payload.evidence.map((row) => row.ref),
                triagedBy: payload.triagedBy,
            })}`)) {
        throw new TypeError("defect intake event carries an invalid re-entry relation");
    }
    if (candidate.kind === "workspace_hygiene_stamped") {
        if (!Array.isArray(payload.rows) || payload.rows.length === 0) {
            throw new TypeError("workspace hygiene event requires non-empty rows");
        }
        for (const row of payload.rows) {
            if (!isRecord(row) ||
                Object.keys(row).length !== 5 ||
                !exactStringKeys(row, [
                    "artifactRef",
                    "observedDigest",
                    "admittedDigest",
                    "classification",
                    "copyOutRef",
                ])) {
                throw new TypeError("workspace hygiene event carries an invalid row");
            }
            const expected = row.observedDigest === null && row.admittedDigest === null
                ? null
                : row.observedDigest === null
                    ? "missing"
                    : row.admittedDigest === null
                        ? "untracked"
                        : row.observedDigest === row.admittedDigest
                            ? "clean"
                            : "foreign_write";
            if (expected === null ||
                row.classification !== expected ||
                (expected === "foreign_write" &&
                    (typeof row.copyOutRef !== "string" || row.copyOutRef.length === 0))) {
                throw new TypeError("workspace hygiene row differs from digest-pair truth");
            }
        }
        const hygieneDigest = sha256Canonical({
            basisId: candidate.basisId,
            segmentRef: payload.segmentRef,
            observedBy: payload.observedBy,
            rows: payload.rows,
        });
        if (payload.hygieneRef !== `workspace-hygiene:${hygieneDigest}`) {
            throw new TypeError("workspace hygiene event is not self-certified");
        }
    }
    if (candidate.kind === "traversal_route_admitted" &&
        ![
            "advance",
            "re_enter",
            "retry",
            "terminal",
            "hold",
            "gap_stop",
            "blocked",
            "failed",
        ].includes(String(payload.routeKind))) {
        throw new TypeError(`traversal route event carries unknown route kind ${String(payload.routeKind)}`);
    }
    if (candidate.kind === "fan_out_completion_admitted" &&
        !["complete_vector", "partial_stop"].includes(String(payload.completionKind))) {
        throw new TypeError("fan-out completion event carries an unknown completion kind");
    }
    if (candidate.kind === "c_call_fibre_selected" &&
        !["F_D", "F_P", "F_H"].includes(String(payload.regime))) {
        throw new TypeError("C-call fibre event carries an unknown compute regime");
    }
    if (candidate.kind === "child_foldback_admitted" &&
        !["closed", "blocked", "failed"].includes(String(payload.childDisposition))) {
        throw new TypeError("child foldback event carries an unknown disposition");
    }
    if (candidate.kind === "run_stopped" &&
        Object.hasOwn(payload, "disposition") &&
        ![
            "blocked",
            "failed",
            "gap_stop",
            "reprice_required",
            "repair",
            "inspect_runtime_archive",
            "reprice",
            "escalate",
            "operator_abort",
            "campaign_close",
        ].includes(String(payload.disposition))) {
        throw new TypeError("run stop event carries an unknown disposition");
    }
    if (candidate.kind === "run_stopped" &&
        Object.hasOwn(payload, "reasonKind") &&
        ![
            "operator_stop",
            "operator_abort",
            "external_interruption",
            "campaign_close",
        ].includes(String(payload.reasonKind))) {
        throw new TypeError("operator run stop event carries an unknown reason kind");
    }
    if (candidate.kind === "run_resumed" &&
        ![
            "operator_resume",
            "reprice_reentry",
            "external_recovery",
            "campaign_continue",
        ].includes(String(payload.reasonKind))) {
        throw new TypeError("operator run resume event carries an unknown reason kind");
    }
}

/**
 * Apply the complete pinned dev.286 root-event admission function locally.
 * The observed Product runtime is never imported as execution authority.
 */
export function validateAbi5RootKindContract(candidate) {
    if (!Object.hasOwn(ROOT_EVENT_CONTRACTS, candidate.kind)) {
        return "ABIogenesis 5.0 event kind is outside the exact built-in root registry";
    }
    try {
        assertRuntimeEventContract(candidate);
        return null;
    }
    catch (error) {
        return `ABIogenesis 5.0 built-in root contract refusal: ${error instanceof Error
            ? error.message
            : String(error)}`;
    }
}

export function validateAbi5Rc1KindContract(candidate) {
    if (!Object.hasOwn(ABI5_RC1_PROFILE.eventContracts, candidate.kind)) return 'ABIogenesis RC1 kind is outside the selected profile';
    try { assertRuntimeEventContract(candidate, ABI5_RC1_PROFILE.eventContracts); return null; }
    catch (error) { return `ABIogenesis RC1 contract refusal: ${error.message}`; }
}
