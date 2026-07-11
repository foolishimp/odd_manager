import { z } from 'zod';

const nonEmptyString = z.string().min(1);
const stringList = z.array(nonEmptyString);

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
export const jsonValueSchema: z.ZodType<JsonValue> = z.lazy(() => z.union([
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
  z.array(jsonValueSchema),
  z.record(z.string(), jsonValueSchema),
]));

export const projectRefSchema = z.object({
  id: nonEmptyString,
  root: nonEmptyString,
  label: nonEmptyString,
  publishedProductRef: nonEmptyString.nullable(),
}).strict();

export const projectRevisionSchema = z.object({
  kind: z.enum(['commit', 'worktree', 'snapshot']),
  revision: nonEmptyString,
  dirty: z.boolean(),
  sourceDigest: nonEmptyString.nullable(),
  specificationDigest: nonEmptyString.nullable(),
  observedAt: nonEmptyString,
}).strict();

export const managerContextSchema = z.object({
  project: projectRefSchema,
  workspaceRef: nonEmptyString.nullable(),
  revision: projectRevisionSchema.nullable(),
}).strict();

export const portfolioPostureSchema = z.object({
  kind: z.enum([
    'present',
    'partial',
    'missing',
    'unavailable',
    'unsupported',
    'unobserved',
    'stale',
  ]),
  label: nonEmptyString,
  sourceRefs: z.array(nonEmptyString),
}).strict();

export const portfolioAttentionSummarySchema = z.object({
  attentionId: nonEmptyString,
  severity: z.enum(['info', 'warning', 'blocking']),
  sourceKind: nonEmptyString,
  sourceRef: nonEmptyString,
  reason: nonEmptyString,
}).strict();

export const buildExecutionStateSchema = z.enum([
  'queued',
  'starting',
  'running',
  'waiting_human',
  'converged',
  'failed',
  'cancelled',
  'stale',
  'disconnected',
]);

export const buildPortfolioActivitySchema = z.object({
  queuedCount: z.number().int().nonnegative(),
  runningCount: z.number().int().nonnegative(),
  waitingHumanCount: z.number().int().nonnegative(),
  terminalCount: z.number().int().nonnegative(),
  latestExecutionId: nonEmptyString.nullable(),
  latestState: buildExecutionStateSchema.nullable(),
  sourceRefs: z.array(z.string()),
}).strict();

export const buildPortfolioRowSchema = z.object({
  project: projectRefSchema,
  revision: projectRevisionSchema.nullable(),
  active: z.boolean(),
  specification: portfolioPostureSchema,
  build: portfolioPostureSchema,
  buildActivity: buildPortfolioActivitySchema,
  run: portfolioPostureSchema,
  assurance: portfolioPostureSchema,
  participants: z.object({
    kind: z.enum(['observed', 'unobserved', 'unsupported']),
    count: z.number().int().nonnegative().nullable(),
    sourceRefs: z.array(nonEmptyString),
  }).strict(),
  features: z.object({
    hasAiWorkspace: z.boolean(),
    hasGenesis: z.boolean(),
    buildTenants: z.array(nonEmptyString),
  }).strict(),
  freshness: z.object({
    observedAt: nonEmptyString,
    sourceRefs: z.array(nonEmptyString),
  }).strict(),
  attention: z.array(portfolioAttentionSummarySchema),
  sourceRefs: stringList,
}).strict();

export const buildPortfolioSchema = z.object({
  schemaVersion: z.literal('1'),
  rows: z.array(buildPortfolioRowSchema),
  browseRoot: nonEmptyString,
  observedAt: nonEmptyString,
  sourceRefs: stringList,
}).strict();

export const capabilityIdSchema = z.enum([
  'build-portfolio',
  'project-workbench',
  'specification-proposal',
  'build-control',
  'assurance-attention',
  'run-observation',
]);

export const capabilitySubscriptionSchema = z.object({
  schemaVersion: z.literal('1'),
  subscriptionId: nonEmptyString,
  capabilityId: capabilityIdSchema,
  projectRoot: nonEmptyString,
  basisRevision: nonEmptyString.nullable(),
  sourceRef: nonEmptyString,
  eventKind: nonEmptyString,
}).strict();

export const capabilitySubscriptionEventSchema = z.object({
  schemaVersion: z.literal('1'),
  eventId: nonEmptyString,
  subscriptionId: nonEmptyString,
  capabilityId: capabilityIdSchema,
  projectRoot: nonEmptyString,
  basisRevision: nonEmptyString.nullable(),
  observedAt: nonEmptyString,
  payload: z.unknown(),
}).strict();

export const capabilityAvailabilitySchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('unavailable'),
    reason: nonEmptyString,
    missingRefs: stringList,
  }).strict(),
  z.object({ kind: z.literal('loading') }).strict(),
  z.object({
    kind: z.literal('ready'),
    contractRefs: stringList,
  }).strict(),
  z.object({
    kind: z.literal('stale'),
    reason: nonEmptyString,
    observedAt: nonEmptyString,
  }).strict(),
  z.object({
    kind: z.literal('unsupported'),
    reason: nonEmptyString,
    sourceRefs: stringList,
  }).strict(),
  z.object({
    kind: z.literal('error'),
    error: nonEmptyString,
    sourceRefs: z.array(z.string()),
  }).strict(),
]);

export const capabilityContributionSchema = z.object({
  id: capabilityIdSchema,
  label: nonEmptyString,
  summary: nonEmptyString,
  implementationStage: z.enum(['structural', 'mvp']),
  requiredContractRefs: z.array(z.string()),
  availability: capabilityAvailabilitySchema,
  defaultRoute: nonEmptyString,
  attentionCount: z.number().int().nonnegative(),
}).strict();

export const developerControlBootstrapSchema = z.object({
  schemaVersion: z.literal('1'),
  context: managerContextSchema,
  capabilities: z.array(capabilityContributionSchema).length(6),
  observedAt: nonEmptyString,
  sourceRefs: stringList,
}).strict();

export const commandEnvelopeSchema = z.object({
  schemaVersion: z.literal('1'),
  commandId: nonEmptyString,
  correlationId: nonEmptyString,
  capabilityId: capabilityIdSchema,
  kind: nonEmptyString,
  context: managerContextSchema,
  requestedBy: nonEmptyString,
  requestedAt: nonEmptyString,
  payload: z.unknown(),
}).strict();

const commandResultBaseSchema = z.object({
  commandId: nonEmptyString,
  correlationId: nonEmptyString,
  completedAt: nonEmptyString,
  sourceRefs: z.array(z.string()),
});

export const commandResultSchema = z.discriminatedUnion('status', [
  commandResultBaseSchema.extend({
    status: z.literal('succeeded'),
    value: z.unknown(),
  }).strict(),
  commandResultBaseSchema.extend({
    status: z.literal('failed'),
    failureKind: nonEmptyString,
    error: nonEmptyString,
    retryable: z.boolean(),
  }).strict(),
]);

export const buildCarrierDescriptorSchema = z.object({
  schemaVersion: z.literal('1'),
  descriptorRef: nonEmptyString,
  productRef: nonEmptyString,
  productVersion: nonEmptyString,
  carrierKind: z.enum(['job', 'graph_function', 'workorder']),
  carrierRef: nonEmptyString,
  startupConfigRef: nonEmptyString,
  publicStartTarget: nonEmptyString,
  inputSchemaRef: nonEmptyString,
  worksiteProvisionerRef: nonEmptyString,
  executionAdapterRef: nonEmptyString,
  supportedCommands: z.array(z.enum(['submit', 'attach', 'cancel', 'resume'])),
  requirementCatalogRefs: z.array(z.string()),
  expectedAssetCatalogRefs: z.array(z.string()),
  proofRefs: z.array(z.string()),
}).strict();

export const buildExecutionAdapterRegistryEntrySchema = z.object({
  adapterRef: nonEmptyString,
  modulePath: nonEmptyString,
  moduleSha256: z.string().regex(/^[a-f0-9]{64}$/),
  exportName: z.string().regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/),
  sourceRefs: z.array(nonEmptyString),
}).strict();

export const buildExecutionAdapterRegistrySchema = z.object({
  schemaVersion: z.literal('1'),
  adapters: z.array(buildExecutionAdapterRegistryEntrySchema),
}).strict().superRefine((value, context) => {
  const seen = new Set<string>();
  value.adapters.forEach((entry, index) => {
    if (seen.has(entry.adapterRef)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['adapters', index, 'adapterRef'],
        message: `duplicate execution adapter ref: ${entry.adapterRef}`,
      });
    }
    seen.add(entry.adapterRef);
  });
});

export const buildInternalProcessPlanSchema = z.object({
  executable: nonEmptyString,
  args: z.array(z.string().max(16 * 1024)).max(256),
  cwd: nonEmptyString,
  env: z.record(z.string(), z.string()),
  resultPath: nonEmptyString,
  adapterSourceRefs: z.array(nonEmptyString),
}).strict().superRefine((value, context) => {
  if (Object.keys(value.env).length > 128) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['env'],
      message: 'internal process plan environment exceeds 128 entries',
    });
  }
});

export const buildRequestSchema = z.object({
  schemaVersion: z.literal('1'),
  requestId: nonEmptyString,
  correlationId: nonEmptyString,
  project: projectRefSchema,
  revision: projectRevisionSchema,
  descriptorRef: nonEmptyString,
  carrierRef: nonEmptyString,
  startupConfigRef: nonEmptyString,
  publicStartTarget: nonEmptyString,
  inputs: jsonValueSchema,
  requestedBy: nonEmptyString,
  requestedAt: nonEmptyString,
  resourcePolicyRef: nonEmptyString,
  authorityRefs: stringList,
}).strict();

export const buildTerminalResultSchema = z.object({
  kind: z.enum(['converged', 'failed', 'waiting_human']),
  resultRef: nonEmptyString,
  detail: nonEmptyString,
  runRefs: z.array(nonEmptyString),
  sourceRefs: stringList,
}).strict();

export const buildExecutionObservationSchema = z.object({
  schemaVersion: z.literal('1'),
  executionId: nonEmptyString,
  state: z.enum(['running', 'waiting_human', 'converged', 'failed', 'stale', 'disconnected']),
  processRef: nonEmptyString.nullable(),
  heartbeatAt: nonEmptyString,
  runRefs: z.array(nonEmptyString),
  terminalResult: buildTerminalResultSchema.nullable(),
  sourceRefs: stringList,
}).strict().superRefine((value, context) => {
  const resultState = value.terminalResult?.kind ?? null;
  if (['waiting_human', 'converged', 'failed'].includes(value.state) && resultState !== value.state) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminalResult'],
      message: `terminal observation ${value.state} requires a matching typed result`,
    });
  }
  if (['running', 'stale', 'disconnected'].includes(value.state) && value.terminalResult) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminalResult'],
      message: `non-terminal observation ${value.state} cannot carry a typed result`,
    });
  }
  if (value.state === 'running' && !value.processRef) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processRef'],
      message: 'running observation requires process identity',
    });
  }
});

export const buildExternalCancelResultSchema = z.object({
  schemaVersion: z.literal('1'),
  executionId: nonEmptyString,
  cancelled: z.literal(true),
  sourceRefs: stringList,
}).strict();

export const buildProcessOutcomeSchema = z.object({
  kind: z.enum(['typed_result', 'process_exit', 'spawn_error', 'cancelled', 'adapter_observation']),
  exitCode: z.number().int().nullable(),
  signal: z.string().nullable(),
  terminalResult: buildTerminalResultSchema.nullable(),
  stdoutRef: nonEmptyString,
  stderrRef: nonEmptyString,
  observedAt: nonEmptyString,
}).strict();

export const buildExecutionSchema = z.object({
  schemaVersion: z.literal('1'),
  executionId: nonEmptyString,
  requestId: nonEmptyString,
  correlationId: nonEmptyString,
  project: projectRefSchema,
  revision: projectRevisionSchema,
  state: buildExecutionStateSchema,
  attempt: z.number().int().positive(),
  queuePosition: z.number().int().nonnegative().nullable(),
  processRef: nonEmptyString.nullable(),
  worksiteRef: nonEmptyString,
  runRefs: z.array(z.string()),
  startedAt: nonEmptyString.nullable(),
  updatedAt: nonEmptyString,
  completedAt: nonEmptyString.nullable(),
  heartbeatAt: nonEmptyString.nullable(),
  resumedAt: nonEmptyString.nullable().default(null),
  resumedBy: nonEmptyString.nullable().default(null),
  processOutcome: buildProcessOutcomeSchema.nullable(),
  cancelRequestedAt: nonEmptyString.nullable(),
  cancelledBy: nonEmptyString.nullable(),
  assuranceSummaryRef: nonEmptyString.nullable(),
  sourceRefs: z.array(z.string()),
}).strict();

export const buildDescriptorAdmissionSchema = z.object({
  schemaVersion: z.literal('1'),
  projectRoot: nonEmptyString,
  status: z.enum(['ready', 'unavailable', 'unsupported', 'error']),
  descriptor: buildCarrierDescriptorSchema.nullable(),
  reason: nonEmptyString.nullable(),
  sourceRefs: stringList,
}).strict().superRefine((value, context) => {
  if (value.status === 'ready' && !value.descriptor) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'ready descriptor admission requires a descriptor' });
  }
  if (value.status !== 'ready' && !value.reason) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'non-ready descriptor admission requires a reason' });
  }
});

export const buildSchedulerProjectionSchema = z.object({
  maxConcurrent: z.number().int().positive(),
  maxQueued: z.number().int().positive(),
  runningCount: z.number().int().nonnegative(),
  queuedCount: z.number().int().nonnegative(),
  availableSlots: z.number().int().nonnegative(),
}).strict();

export const buildControlSnapshotSchema = z.object({
  schemaVersion: z.literal('1'),
  projectRoot: nonEmptyString,
  revision: projectRevisionSchema.nullable(),
  descriptorAdmission: buildDescriptorAdmissionSchema,
  requests: z.array(buildRequestSchema),
  executions: z.array(buildExecutionSchema),
  scheduler: buildSchedulerProjectionSchema,
  observedAt: nonEmptyString,
  sourceRefs: stringList,
}).strict();

export const buildSubmitRequestSchema = z.object({
  project: projectRefSchema,
  revision: projectRevisionSchema,
  inputs: jsonValueSchema,
  requestedBy: nonEmptyString,
}).strict();

export const buildExecutionIdentityRequestSchema = z.object({
  projectRoot: nonEmptyString,
  executionId: nonEmptyString,
  actorRef: nonEmptyString,
}).strict();

export const buildOutputTailSchema = z.object({
  schemaVersion: z.literal('1'),
  executionId: nonEmptyString,
  stdout: z.string(),
  stderr: z.string(),
  stdoutTruncated: z.boolean(),
  stderrTruncated: z.boolean(),
  observedAt: nonEmptyString,
  sourceRefs: stringList,
}).strict();

export const buildAttachResponseSchema = z.object({
  schemaVersion: z.literal('1'),
  execution: buildExecutionSchema,
  output: buildOutputTailSchema,
  sourceRefs: stringList,
}).strict();

export const buildSubmitResponseSchema = z.object({
  request: buildRequestSchema,
  execution: buildExecutionSchema,
  snapshot: buildControlSnapshotSchema,
}).strict();

export const specificationProposalStatusSchema = z.enum([
  'draft',
  'validating',
  'valid',
  'invalid',
  'stale',
  'accepted',
  'rejected',
  'superseded',
]);

const proposalContextAttachmentSchema = z.object({
  sourceRef: nonEmptyString,
  kind: z.enum(['requirement', 'design', 'ticket', 'evidence', 'run', 'gate', 'asset', 'file', 'external']),
  label: nonEmptyString,
  digest: nonEmptyString,
}).strict();

const proposalValidationResultSchema = z.object({
  checkRef: nonEmptyString,
  status: z.enum(['passed', 'failed', 'unavailable']),
  detail: nonEmptyString,
  sourceRefs: z.array(z.string()),
}).strict();

const proposalDecisionSchema = z.object({
  kind: z.enum(['accepted', 'rejected']),
  actorRef: nonEmptyString,
  decidedAt: nonEmptyString,
  basisRevision: projectRevisionSchema,
  changedSurfaceRefs: z.array(nonEmptyString),
}).strict();

export const specificationProposalSchema = z.object({
  schemaVersion: z.literal('1'),
  proposalId: nonEmptyString,
  project: projectRefSchema,
  basisRevision: projectRevisionSchema,
  participantRef: nonEmptyString,
  createdAt: nonEmptyString,
  status: specificationProposalStatusSchema,
  prompt: nonEmptyString,
  summary: nonEmptyString,
  contextAttachments: z.array(proposalContextAttachmentSchema).max(12),
  patch: nonEmptyString.max(524288),
  validation: z.array(proposalValidationResultSchema),
  affectedSurfaceRefs: z.array(nonEmptyString),
  predecessorProposalId: nonEmptyString.nullable(),
  resultingRevision: projectRevisionSchema.nullable(),
  decision: proposalDecisionSchema.nullable(),
  sourceRefs: stringList,
}).strict();

export const specificationProposalProviderResponseSchema = z.object({
  summary: nonEmptyString,
  patch: nonEmptyString.max(524288),
  affectedSurfaceRefs: z.array(nonEmptyString),
}).strict();

export const specificationProposalGenerateRequestSchema = z.object({
  project: projectRefSchema,
  basisRevision: projectRevisionSchema,
  prompt: nonEmptyString.max(20000),
  contextAttachmentRefs: z.array(nonEmptyString).max(12),
  predecessorProposalId: nonEmptyString.nullable(),
}).strict();

export const specificationProposalIdentityRequestSchema = z.object({
  projectRoot: nonEmptyString,
  proposalId: nonEmptyString,
}).strict();

export const specificationProposalDecisionRequestSchema = specificationProposalIdentityRequestSchema.extend({
  actorRef: nonEmptyString,
}).strict();

export const specificationProposalHistorySchema = z.object({
  schemaVersion: z.literal('1'),
  projectRoot: nonEmptyString,
  proposals: z.array(specificationProposalSchema),
  retentionLimit: z.number().int().positive(),
  truncated: z.boolean(),
  sourceRefs: stringList,
}).strict();

export const gateAssessmentSchema = z.object({
  gateRef: nonEmptyString,
  label: nonEmptyString,
  requirementRef: nonEmptyString,
  project: projectRefSchema,
  revision: projectRevisionSchema,
  executionId: nonEmptyString.nullable(),
  regime: z.enum(['F_D', 'F_P', 'F_H']),
  status: z.enum(['required', 'satisfied', 'failed', 'missing', 'stale', 'unsupported', 'waiting_human']),
  detail: nonEmptyString,
  producerRef: nonEmptyString.nullable(),
  evidenceDigest: nonEmptyString.nullable(),
  evidenceRefs: z.array(z.string()),
  sourceRefs: stringList,
  assessedAt: nonEmptyString,
}).strict();

export const assetDeliverySchema = z.object({
  requirementRef: nonEmptyString,
  label: nonEmptyString,
  artifactRef: nonEmptyString.nullable(),
  project: projectRefSchema,
  revision: projectRevisionSchema,
  executionId: nonEmptyString.nullable(),
  status: z.enum(['expected', 'delivered', 'failed', 'missing', 'stale', 'unsupported']),
  detail: nonEmptyString,
  producerRef: nonEmptyString.nullable(),
  digest: nonEmptyString.nullable(),
  evidenceRefs: z.array(z.string()),
  sourceRefs: stringList,
}).strict();

export const attentionItemSchema = z.object({
  attentionId: nonEmptyString,
  correlationId: nonEmptyString,
  project: projectRefSchema,
  executionId: nonEmptyString.nullable(),
  sourceKind: nonEmptyString,
  sourceRef: nonEmptyString,
  severity: z.enum(['info', 'warning', 'blocking']),
  reason: nonEmptyString,
  observedAt: nonEmptyString,
  reactionRefs: z.array(z.string()),
}).strict();

const assuranceCatalogGateSchema = z.object({
  gateRef: nonEmptyString,
  label: nonEmptyString,
  requirementRef: nonEmptyString,
  regime: z.enum(['F_D', 'F_P', 'F_H']),
  evidenceKey: nonEmptyString,
  reactionRefs: z.array(nonEmptyString),
  sourceRefs: stringList,
}).strict();

const assuranceCatalogAssetSchema = z.object({
  requirementRef: nonEmptyString,
  label: nonEmptyString,
  evidenceKey: nonEmptyString,
  reactionRefs: z.array(nonEmptyString),
  sourceRefs: stringList,
}).strict();

export const assuranceCatalogSchema = z.object({
  schemaVersion: z.literal('1'),
  catalogRef: nonEmptyString,
  productRef: nonEmptyString,
  requirementCatalogRef: nonEmptyString,
  assetCatalogRef: nonEmptyString,
  gates: z.array(assuranceCatalogGateSchema),
  assets: z.array(assuranceCatalogAssetSchema),
  sourceRefs: stringList,
}).strict();

const buildGateEvidenceResultSchema = z.object({
  gateRef: nonEmptyString,
  status: z.enum(['passed', 'failed', 'waiting_human', 'unsupported']),
  evidenceKey: nonEmptyString,
  digest: nonEmptyString.nullable(),
  evidenceRefs: z.array(nonEmptyString),
  sourceRefs: stringList,
}).strict();

const buildAssetEvidenceResultSchema = z.object({
  requirementRef: nonEmptyString,
  status: z.enum(['delivered', 'failed', 'unsupported']),
  evidenceKey: nonEmptyString,
  artifactRef: nonEmptyString.nullable(),
  producerRef: nonEmptyString,
  digest: nonEmptyString.nullable(),
  evidenceRefs: z.array(nonEmptyString),
  sourceRefs: stringList,
}).strict();

export const buildEvidenceBundleSchema = z.object({
  schemaVersion: z.literal('1'),
  evidenceBundleRef: nonEmptyString,
  executionId: nonEmptyString,
  projectRoot: nonEmptyString,
  revision: projectRevisionSchema,
  producerRef: nonEmptyString,
  observedAt: nonEmptyString,
  gateResults: z.array(buildGateEvidenceResultSchema),
  assetResults: z.array(buildAssetEvidenceResultSchema),
  sourceRefs: stringList,
}).strict();

export const assuranceCatalogAdmissionSchema = z.object({
  schemaVersion: z.literal('1'),
  projectRoot: nonEmptyString,
  status: z.enum(['ready', 'unavailable', 'unsupported', 'error']),
  catalog: assuranceCatalogSchema.nullable(),
  reason: nonEmptyString.nullable(),
  sourceRefs: stringList,
}).strict();

export const assuranceSummarySchema = z.object({
  posture: z.enum(['unassessed', 'partial', 'verified', 'failed', 'stale', 'unsupported', 'waiting_human']),
  gateCounts: z.object({
    total: z.number().int().nonnegative(),
    satisfied: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
    waitingHuman: z.number().int().nonnegative(),
  }).strict(),
  assetCounts: z.object({
    total: z.number().int().nonnegative(),
    delivered: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    missing: z.number().int().nonnegative(),
    stale: z.number().int().nonnegative(),
  }).strict(),
  blockingAttentionCount: z.number().int().nonnegative(),
}).strict();

export const assuranceSnapshotSchema = z.object({
  schemaVersion: z.literal('1'),
  projectRoot: nonEmptyString,
  revision: projectRevisionSchema.nullable(),
  execution: buildExecutionSchema.nullable(),
  catalogAdmission: assuranceCatalogAdmissionSchema,
  evidenceBundleRef: nonEmptyString.nullable(),
  gateAssessments: z.array(gateAssessmentSchema),
  assetDeliveries: z.array(assetDeliverySchema),
  attentionItems: z.array(attentionItemSchema),
  summary: assuranceSummarySchema,
  observedAt: nonEmptyString,
  sourceRefs: stringList,
}).strict();

export const assuranceLoadRequestSchema = z.object({
  project: projectRefSchema,
  revision: projectRevisionSchema,
  executionId: nonEmptyString.nullable(),
}).strict();

export type ProjectRef = z.infer<typeof projectRefSchema>;
export type ProjectRevision = z.infer<typeof projectRevisionSchema>;
export type ManagerContext = z.infer<typeof managerContextSchema>;
export type PortfolioPosture = z.infer<typeof portfolioPostureSchema>;
export type PortfolioAttentionSummary = z.infer<typeof portfolioAttentionSummarySchema>;
export type BuildPortfolioActivity = z.infer<typeof buildPortfolioActivitySchema>;
export type BuildPortfolioRow = z.infer<typeof buildPortfolioRowSchema>;
export type BuildPortfolio = z.infer<typeof buildPortfolioSchema>;
export type CapabilityId = z.infer<typeof capabilityIdSchema>;
export type CapabilitySubscription = z.infer<typeof capabilitySubscriptionSchema>;
export type CapabilitySubscriptionEvent = z.infer<typeof capabilitySubscriptionEventSchema>;
export type CapabilityAvailability = z.infer<typeof capabilityAvailabilitySchema>;
export type CapabilityContribution = z.infer<typeof capabilityContributionSchema>;
export type DeveloperControlBootstrap = z.infer<typeof developerControlBootstrapSchema>;
export type CommandEnvelope = z.infer<typeof commandEnvelopeSchema>;
export type CommandResult = z.infer<typeof commandResultSchema>;
export type BuildCarrierDescriptor = z.infer<typeof buildCarrierDescriptorSchema>;
export type BuildRequest = z.infer<typeof buildRequestSchema>;
export type BuildExecution = z.infer<typeof buildExecutionSchema>;
export type BuildTerminalResult = z.infer<typeof buildTerminalResultSchema>;
export type BuildExecutionObservation = z.infer<typeof buildExecutionObservationSchema>;
export type BuildExternalCancelResult = z.infer<typeof buildExternalCancelResultSchema>;
export type BuildProcessOutcome = z.infer<typeof buildProcessOutcomeSchema>;
export type BuildDescriptorAdmission = z.infer<typeof buildDescriptorAdmissionSchema>;
export type BuildSchedulerProjection = z.infer<typeof buildSchedulerProjectionSchema>;
export type BuildControlSnapshot = z.infer<typeof buildControlSnapshotSchema>;
export type BuildSubmitRequest = z.infer<typeof buildSubmitRequestSchema>;
export type BuildExecutionIdentityRequest = z.infer<typeof buildExecutionIdentityRequestSchema>;
export type BuildOutputTail = z.infer<typeof buildOutputTailSchema>;
export type BuildAttachResponse = z.infer<typeof buildAttachResponseSchema>;
export type BuildSubmitResponse = z.infer<typeof buildSubmitResponseSchema>;
export type SpecificationProposal = z.infer<typeof specificationProposalSchema>;
export type SpecificationProposalProviderResponse = z.infer<typeof specificationProposalProviderResponseSchema>;
export type SpecificationProposalGenerateRequest = z.infer<typeof specificationProposalGenerateRequestSchema>;
export type SpecificationProposalIdentityRequest = z.infer<typeof specificationProposalIdentityRequestSchema>;
export type SpecificationProposalDecisionRequest = z.infer<typeof specificationProposalDecisionRequestSchema>;
export type SpecificationProposalHistory = z.infer<typeof specificationProposalHistorySchema>;
export type GateAssessment = z.infer<typeof gateAssessmentSchema>;
export type AssetDelivery = z.infer<typeof assetDeliverySchema>;
export type AttentionItem = z.infer<typeof attentionItemSchema>;
export type AssuranceCatalog = z.infer<typeof assuranceCatalogSchema>;
export type BuildEvidenceBundle = z.infer<typeof buildEvidenceBundleSchema>;
export type AssuranceCatalogAdmission = z.infer<typeof assuranceCatalogAdmissionSchema>;
export type AssuranceSummary = z.infer<typeof assuranceSummarySchema>;
export type AssuranceSnapshot = z.infer<typeof assuranceSnapshotSchema>;
export type AssuranceLoadRequest = z.infer<typeof assuranceLoadRequestSchema>;
