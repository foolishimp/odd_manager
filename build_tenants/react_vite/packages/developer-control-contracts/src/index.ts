import { z } from 'zod';

const nonEmptyString = z.string().min(1);
const stringList = z.array(nonEmptyString);

export type AssuranceAttentionSourceKind = 'gate' | 'asset';
export type AssuranceAttentionIdentityInput = {
  projectId: string;
  executionId: string | null;
  sourceKind: AssuranceAttentionSourceKind;
  sourceIdentity: string;
};

function utf16IdentityFrame(label: string, value: string) {
  return `${label}:${value.length}:${value}`;
}

export function assuranceAttentionIdentity(
  input: AssuranceAttentionIdentityInput,
) {
  const executionFrame = input.executionId === null
    ? 'execution:none'
    : utf16IdentityFrame('execution', input.executionId);
  return [
    'assurance:v1',
    utf16IdentityFrame('project', input.projectId),
    executionFrame,
    `kind:${input.sourceKind}`,
    utf16IdentityFrame('source', input.sourceIdentity),
  ].join('|');
}

const isoTimestamp = z.string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    'expected a canonical UTC ISO-8601 timestamp',
  )
  .refine((value) => {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) && new Date(parsed).toISOString() === value;
  }, 'expected a valid canonical UTC ISO-8601 timestamp');

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

function sameProjectRevisionIdentity(
  left: z.infer<typeof projectRevisionSchema>,
  right: z.infer<typeof projectRevisionSchema>,
) {
  return (
    left.kind === right.kind
    && left.revision === right.revision
    && left.dirty === right.dirty
    && left.sourceDigest === right.sourceDigest
    && left.specificationDigest === right.specificationDigest
  );
}

export const managerContextSchema = z.object({
  project: projectRefSchema,
  workspaceRef: nonEmptyString.nullable(),
  revision: projectRevisionSchema.nullable(),
}).strict();

export const workspaceProfileSchema = z.object({
  primary_identity: nonEmptyString,
  governance_identities: z.array(nonEmptyString),
  active_domain_pack: nonEmptyString.nullable(),
  shell_title: nonEmptyString,
  confidence: z.enum(['high', 'medium', 'low']),
  markers: z.array(nonEmptyString),
}).strict();

export const fsEntrySchema = z.object({
  name: nonEmptyString,
  absolutePath: nonEmptyString,
  kind: z.enum(['directory', 'file']),
  updatedAt: nonEmptyString,
  hasWorkspace: z.boolean(),
  markers: z.array(nonEmptyString),
  profile: workspaceProfileSchema.nullable(),
}).strict();

export const fsBrowseResultSchema = z.object({
  path: nonEmptyString,
  parent: nonEmptyString.nullable(),
  entries: z.array(fsEntrySchema),
  truncated: z.boolean(),
  state: z.enum(['present', 'missing', 'not_directory']),
}).strict();

export const projectRecordSchema = z.object({
  id: nonEmptyString,
  name: nonEmptyString,
  root: nonEmptyString,
  odd_type: nonEmptyString,
  has_ai_workspace: z.boolean(),
  has_genesis: z.boolean(),
  installed_packages: z.array(nonEmptyString),
  build_tenants: z.array(nonEmptyString),
  registry_source: z.enum(['registry', 'discovery']),
  registered_at: nonEmptyString.nullable(),
  updated_at: nonEmptyString.nullable(),
  tags: z.array(nonEmptyString),
  is_active: z.boolean(),
}).strict();

export const projectSurfaceDiagnosticSchema = z.object({
  registry_root: nonEmptyString,
  manager_workspace_root: nonEmptyString,
  registry_version: z.number().int().nonnegative(),
  active_project_root: nonEmptyString.nullable(),
  candidate_count: z.number().int().nonnegative(),
}).strict();

function addProjectRegistryIssues(
  projects: z.infer<typeof projectRecordSchema>[],
  diagnostic: z.infer<typeof projectSurfaceDiagnosticSchema>,
  context: z.RefinementCtx,
) {
  const active = projects.filter((entry) => entry.is_active);
  if (
    new Set(projects.map((entry) => entry.id)).size !== projects.length
    || new Set(projects.map((entry) => entry.root)).size !== projects.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['projects'],
      message: 'Project registry ids and roots must be unique',
    });
  }
  if (
    active.length > 1
    || (diagnostic.active_project_root === null) !== (active.length === 0)
    || (
      diagnostic.active_project_root !== null
      && active[0]?.root !== diagnostic.active_project_root
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['diagnostic', 'active_project_root'],
      message: 'Project registry active row and diagnostic root are incoherent',
    });
  }
  if (diagnostic.candidate_count !== projects.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['diagnostic', 'candidate_count'],
      message: 'Project registry candidate count does not match rows',
    });
  }
}

export const projectRegistryResponseSchema = z.object({
  projects: z.array(projectRecordSchema),
  diagnostic: projectSurfaceDiagnosticSchema,
}).strict().superRefine((value, context) => {
  addProjectRegistryIssues(value.projects, value.diagnostic, context);
});

export const projectRegistryMutationResponseSchema = z.object({
  ok: z.literal(true),
  project: projectRecordSchema,
  projects: z.array(projectRecordSchema),
  diagnostic: projectSurfaceDiagnosticSchema,
}).strict().superRefine((value, context) => {
  addProjectRegistryIssues(value.projects, value.diagnostic, context);
  const retained = value.projects.find((entry) => entry.id === value.project.id);
  if (!retained || JSON.stringify(retained) !== JSON.stringify(value.project)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['project'],
      message: 'Project mutation result is not present exactly in registry rows',
    });
  }
});

export const projectRegistryRemovalResponseSchema = z.object({
  ok: z.literal(true),
  removed: projectRecordSchema,
  projects: z.array(projectRecordSchema),
  diagnostic: projectSurfaceDiagnosticSchema,
}).strict().superRefine((value, context) => {
  addProjectRegistryIssues(value.projects, value.diagnostic, context);
  if (value.projects.some((entry) => (
    entry.id === value.removed.id || entry.root === value.removed.root
  ))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['removed'],
      message: 'removed Project remains present in registry rows',
    });
  }
});

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
  correlationId: nonEmptyString,
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
}).strict().superRefine((value, context) => {
  const total = (
    value.queuedCount
    + value.runningCount
    + value.waitingHumanCount
    + value.terminalCount
  );
  if (
    (value.latestExecutionId === null) !== (value.latestState === null)
    || (value.latestExecutionId === null && total !== 0)
    || (value.latestState === 'queued' && value.queuedCount === 0)
    || (['starting', 'running'].includes(value.latestState ?? '') && value.runningCount === 0)
    || (value.latestState === 'waiting_human' && value.waitingHumanCount === 0)
    || (
      ['converged', 'failed', 'cancelled'].includes(value.latestState ?? '')
      && value.terminalCount === 0
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['latestExecutionId'],
      message: 'Portfolio activity latest execution identity is incoherent with counts',
    });
  }
});

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
}).strict().superRefine((value, context) => {
  const attentions = value.rows.flatMap((row) => row.attention.map((entry) => entry.attentionId));
  if (
    new Set(value.rows.map((row) => row.project.id)).size !== value.rows.length
    || new Set(value.rows.map((row) => row.project.root)).size !== value.rows.length
    || value.rows.filter((row) => row.active).length > 1
    || new Set(attentions).size !== attentions.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['rows'],
      message: 'Portfolio Project, active Context, or attention identities are incoherent',
    });
  }
});

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
    value: z.unknown(),
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

export const buildExecutionAdapterBindingSchema = z.object({
  adapterRef: nonEmptyString,
  sourceRefs: z.array(nonEmptyString).min(1),
}).strict().superRefine((value, context) => {
  if (new Set(value.sourceRefs).size !== value.sourceRefs.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sourceRefs'],
      message: 'execution adapter binding source refs must be unique',
    });
  }
});

export const buildRequestSchema = z.object({
  schemaVersion: z.literal('1'),
  requestId: nonEmptyString,
  correlationId: nonEmptyString,
  project: projectRefSchema,
  revision: projectRevisionSchema,
  descriptorBinding: buildCarrierDescriptorSchema,
  adapterBinding: buildExecutionAdapterBindingSchema,
  descriptorRef: nonEmptyString,
  carrierRef: nonEmptyString,
  startupConfigRef: nonEmptyString,
  publicStartTarget: nonEmptyString,
  inputs: jsonValueSchema,
  requestedBy: nonEmptyString,
  requestedAt: isoTimestamp,
  resourcePolicyRef: nonEmptyString,
  authorityRefs: stringList,
}).strict().superRefine((value, context) => {
  const descriptorFields = [
    ['descriptorRef', value.descriptorBinding.descriptorRef],
    ['carrierRef', value.descriptorBinding.carrierRef],
    ['startupConfigRef', value.descriptorBinding.startupConfigRef],
    ['publicStartTarget', value.descriptorBinding.publicStartTarget],
  ] as const;
  for (const [field, expected] of descriptorFields) {
    if (value[field] !== expected) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [field],
        message: `${field} must match the immutable descriptor binding`,
      });
    }
  }
  if (value.adapterBinding.adapterRef !== value.descriptorBinding.executionAdapterRef) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['adapterBinding', 'adapterRef'],
      message: 'execution adapter binding must match the immutable descriptor binding',
    });
  }
});

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
  heartbeatAt: isoTimestamp,
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
  observedAt: isoTimestamp,
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
  startedAt: isoTimestamp.nullable(),
  updatedAt: isoTimestamp,
  completedAt: isoTimestamp.nullable(),
  heartbeatAt: isoTimestamp.nullable(),
  resumedAt: isoTimestamp.nullable().default(null),
  resumedBy: nonEmptyString.nullable().default(null),
  processOutcome: buildProcessOutcomeSchema.nullable(),
  cancelRequestedAt: isoTimestamp.nullable(),
  cancelledBy: nonEmptyString.nullable(),
  assuranceSummaryRef: nonEmptyString.nullable(),
  sourceRefs: z.array(z.string()),
}).strict().superRefine((value, context) => {
  const terminalLike = ['waiting_human', 'converged', 'failed', 'cancelled'].includes(value.state);
  const nonTerminal = ['queued', 'starting', 'running', 'stale', 'disconnected'].includes(value.state);
  if ((value.state === 'queued') !== (value.queuePosition !== null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['queuePosition'],
      message: 'only a queued execution may carry queue position',
    });
  }
  if (terminalLike !== (value.completedAt !== null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['completedAt'],
      message: 'terminal or waiting-human execution must carry completion time',
    });
  }
  if (nonTerminal && value.processOutcome !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processOutcome'],
      message: 'non-terminal execution cannot carry process outcome',
    });
  }
  if (terminalLike && value.processOutcome === null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processOutcome'],
      message: 'terminal or waiting-human execution requires process outcome',
    });
  }
  if (value.state === 'running' && (!value.processRef || !value.heartbeatAt)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processRef'],
      message: 'running execution requires process and heartbeat identity',
    });
  }
  if (
    (value.cancelRequestedAt === null) !== (value.cancelledBy === null)
    || (
      value.state === 'cancelled'
      && (
        value.cancelRequestedAt === null
        || value.cancelledBy === null
        || value.processOutcome?.kind !== 'cancelled'
      )
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['cancelRequestedAt'],
      message: 'cancellation requires paired attribution and a cancelled outcome',
    });
  }
  const terminalResult = value.processOutcome?.terminalResult ?? null;
  if (
    (value.state === 'waiting_human' && terminalResult?.kind !== 'waiting_human')
    || (value.state === 'converged' && terminalResult?.kind !== 'converged')
    || (value.state === 'failed' && terminalResult && terminalResult.kind !== 'failed')
    || (value.state === 'cancelled' && terminalResult !== null)
    || (value.processOutcome?.kind === 'cancelled' && value.state !== 'cancelled')
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['processOutcome', 'terminalResult'],
      message: 'process outcome does not match execution lifecycle state',
    });
  }
});

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
}).strict().superRefine((value, context) => {
  if (
    value.runningCount > value.maxConcurrent
    || value.queuedCount > value.maxQueued
    || value.availableSlots !== Math.max(0, value.maxConcurrent - value.runningCount)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Build scheduler counts exceed limits or available slots are incoherent',
    });
  }
});

export const buildControlSnapshotSchema = z.object({
  schemaVersion: z.literal('1'),
  projectRoot: nonEmptyString,
  revision: projectRevisionSchema.nullable(),
  descriptorAdmission: buildDescriptorAdmissionSchema,
  requests: z.array(buildRequestSchema),
  executions: z.array(buildExecutionSchema),
  scheduler: buildSchedulerProjectionSchema,
  observedAt: isoTimestamp,
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
  observedAt: isoTimestamp,
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
}).strict().superRefine((value, context) => {
  const allValidationPassed = (
    value.validation.length > 0
    && value.validation.every((entry) => entry.status === 'passed')
  );
  if (value.status === 'draft' && value.validation.length > 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validation'],
      message: 'draft proposal cannot carry validation results',
    });
  }
  if (value.status === 'valid' && !allValidationPassed) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validation'],
      message: 'valid proposal requires complete passing validation',
    });
  }
  if (
    ['invalid', 'stale'].includes(value.status)
    && (
      value.validation.length === 0
      || value.validation.every((entry) => entry.status === 'passed')
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['validation'],
      message: `${value.status} proposal requires a non-passing validation result`,
    });
  }
  if (value.status === 'accepted') {
    if (
      value.decision?.kind !== 'accepted'
      || !value.resultingRevision
      || !allValidationPassed
      || !sameProjectRevisionIdentity(value.decision.basisRevision, value.basisRevision)
      || sameProjectRevisionIdentity(value.resultingRevision, value.basisRevision)
      || JSON.stringify(value.decision.changedSurfaceRefs) !== JSON.stringify(value.affectedSurfaceRefs)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['decision'],
        message: 'accepted proposal requires passing validation and a coherent accepted decision/result',
      });
    }
    return;
  }
  if (value.status === 'rejected') {
    if (
      value.decision?.kind !== 'rejected'
      || value.resultingRevision !== null
      || !sameProjectRevisionIdentity(value.decision.basisRevision, value.basisRevision)
      || value.decision.changedSurfaceRefs.length > 0
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['decision'],
        message: 'rejected proposal requires a coherent non-mutating rejection decision',
      });
    }
    return;
  }
  if (value.decision !== null || value.resultingRevision !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decision'],
      message: 'non-decided proposal cannot carry decision or resulting revision',
    });
  }
});

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
}).strict().superRefine((value, context) => {
  const byId = new Map(value.proposals.map((proposal) => [proposal.proposalId, proposal]));
  if (
    byId.size !== value.proposals.length
    || value.proposals.length > value.retentionLimit
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['proposals'],
      message: 'proposal history identities must be unique and within its retention limit',
    });
  }
  for (const [index, proposal] of value.proposals.entries()) {
    const predecessorId = proposal.predecessorProposalId;
    if (
      predecessorId === proposal.proposalId
      || (predecessorId !== null && !value.truncated && !byId.has(predecessorId))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['proposals', index, 'predecessorProposalId'],
        message: 'proposal history predecessor is self-referential or missing',
      });
    }
    const visited = new Set<string>();
    let cursor: z.infer<typeof specificationProposalSchema> | undefined = proposal;
    while (cursor?.predecessorProposalId) {
      if (visited.has(cursor.proposalId)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['proposals', index, 'predecessorProposalId'],
          message: 'proposal history predecessor lineage contains a cycle',
        });
        break;
      }
      visited.add(cursor.proposalId);
      cursor = byId.get(cursor.predecessorProposalId);
    }
  }
});

const authorityBasisFields = {
  authorityRef: nonEmptyString,
  basisRefs: z.array(nonEmptyString).min(1),
};

export const gatePositiveDecisionRequirementSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('probabilistic'),
    evaluatorRef: nonEmptyString,
    ...authorityBasisFields,
    requiredFactRefs: z.array(nonEmptyString).min(1),
  }).strict(),
  z.object({
    kind: z.literal('human'),
    decisionRef: nonEmptyString,
    requiredOutcome: z.literal('approved'),
    ...authorityBasisFields,
  }).strict(),
]).superRefine((value, context) => {
  for (const [path, values] of [
    ['basisRefs', value.basisRefs],
    ...(value.kind === 'probabilistic'
      ? [['requiredFactRefs', value.requiredFactRefs] as const]
      : []),
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [path],
        message: `${path} must contain unique identities`,
      });
    }
  }
});

const probabilisticDecisionFactSchema = z.object({
  factRef: nonEmptyString,
  outcome: z.enum(['satisfied', 'not_satisfied', 'unknown']),
}).strict();

export const gateDecisionEvidenceSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('probabilistic'),
    outcome: z.enum(['satisfied', 'not_satisfied', 'inconclusive']),
    evaluatorRef: nonEmptyString,
    ...authorityBasisFields,
    facts: z.array(probabilisticDecisionFactSchema).min(1),
  }).strict(),
  z.object({
    kind: z.literal('human'),
    decisionRef: nonEmptyString,
    outcome: z.enum(['approved', 'rejected']),
    actorRef: nonEmptyString,
    ...authorityBasisFields,
  }).strict(),
]).superRefine((value, context) => {
  if (new Set(value.basisRefs).size !== value.basisRefs.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['basisRefs'],
      message: 'basisRefs must contain unique identities',
    });
  }
  if (
    value.kind === 'probabilistic'
    && new Set(value.facts.map((entry) => entry.factRef)).size !== value.facts.length
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['facts'],
      message: 'probabilistic decision fact identities must be unique',
    });
  }
});

export type GatePositiveDecisionRequirement = z.infer<typeof gatePositiveDecisionRequirementSchema>;
export type GateDecisionEvidence = z.infer<typeof gateDecisionEvidenceSchema>;

function sameExactStringList(left: string[], right: string[]) {
  return (
    left.length === right.length
    && left.every((entry, index) => entry === right[index])
  );
}

function decisionSatisfiesRequirement(
  requirement: GatePositiveDecisionRequirement | null,
  decision: GateDecisionEvidence | null,
) {
  if (!requirement || !decision || requirement.kind !== decision.kind) return false;
  if (
    requirement.authorityRef !== decision.authorityRef
    || !sameExactStringList(requirement.basisRefs, decision.basisRefs)
  ) return false;
  if (requirement.kind === 'human' && decision.kind === 'human') {
    return (
      decision.decisionRef === requirement.decisionRef
      && decision.outcome === requirement.requiredOutcome
      && decision.actorRef.length > 0
    );
  }
  if (requirement.kind === 'probabilistic' && decision.kind === 'probabilistic') {
    return (
      decision.evaluatorRef === requirement.evaluatorRef
      && decision.outcome === 'satisfied'
      && decision.facts.length === requirement.requiredFactRefs.length
      && decision.facts.every((fact, index) => (
        fact.factRef === requirement.requiredFactRefs[index]
        && fact.outcome === 'satisfied'
      ))
    );
  }
  return false;
}

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
  decision: gateDecisionEvidenceSchema.nullable(),
  sourceRefs: stringList,
  assessedAt: nonEmptyString,
}).strict().superRefine((value, context) => {
  if (value.regime === 'F_D' && value.decision !== null) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decision'],
      message: 'deterministic gate assessment cannot carry probabilistic or human decision authority',
    });
  }
  if (
    value.status === 'satisfied'
    && (
      (value.regime === 'F_P'
        && (value.decision?.kind !== 'probabilistic' || value.decision.outcome !== 'satisfied'))
      || (value.regime === 'F_H'
        && (value.decision?.kind !== 'human' || value.decision.outcome !== 'approved'))
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['decision'],
      message: `${value.regime} satisfaction requires its structured positive decision`,
    });
  }
});

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
  positiveDecisionRequirement: gatePositiveDecisionRequirementSchema.nullable(),
  reactionRefs: z.array(nonEmptyString),
  sourceRefs: stringList,
}).strict().superRefine((value, context) => {
  const requiredKind = value.regime === 'F_P'
    ? 'probabilistic'
    : value.regime === 'F_H'
      ? 'human'
      : null;
  if (
    (requiredKind === null && value.positiveDecisionRequirement !== null)
    || (
      requiredKind !== null
      && value.positiveDecisionRequirement?.kind !== requiredKind
    )
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['positiveDecisionRequirement'],
      message: `${value.regime} gate has an incoherent positive decision authority requirement`,
    });
  }
});

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
}).strict().superRefine((value, context) => {
  if (value.gates.length + value.assets.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'assurance catalog must declare at least one gate or asset',
    });
  }
  for (const [path, values] of [
    ['gates.gateRef', value.gates.map((entry) => entry.gateRef)],
    ['gates.evidenceKey', value.gates.map((entry) => entry.evidenceKey)],
    ['assets.requirementRef', value.assets.map((entry) => entry.requirementRef)],
    ['assets.evidenceKey', value.assets.map((entry) => entry.evidenceKey)],
  ] as const) {
    if (new Set(values).size !== values.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: path.split('.'),
        message: `duplicate assurance catalog identity: ${path}`,
      });
    }
  }
});

const buildGateEvidenceResultSchema = z.object({
  gateRef: nonEmptyString,
  status: z.enum(['passed', 'failed', 'waiting_human', 'unsupported']),
  evidenceKey: nonEmptyString,
  digest: nonEmptyString.nullable(),
  evidenceRefs: z.array(nonEmptyString),
  decision: gateDecisionEvidenceSchema.nullable(),
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
}).strict().superRefine((value, context) => {
  if (
    (value.status === 'ready' && (!value.catalog || value.reason !== null))
    || (value.status !== 'ready' && value.reason === null)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['catalog'],
      message: 'assurance catalog admission status, catalog, and reason are incoherent',
    });
  }
});

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
}).strict().superRefine((value, context) => {
  for (const [index, item] of value.attentionItems.entries()) {
    const projectBound = item.sourceKind === 'assurance-catalog'
      ? item.attentionId === `assurance-catalog:${item.project.id}`
      : item.sourceKind === 'gate'
        ? value.gateAssessments.some((assessment) => (
            assessment.project.id === item.project.id
            && assessment.executionId === item.executionId
            && item.attentionId === assuranceAttentionIdentity({
              projectId: assessment.project.id,
              executionId: assessment.executionId,
              sourceKind: 'gate',
              sourceIdentity: assessment.gateRef,
            })
          ))
        : item.sourceKind === 'asset'
          ? value.assetDeliveries.some((delivery) => (
              delivery.project.id === item.project.id
              && delivery.executionId === item.executionId
              && item.attentionId === assuranceAttentionIdentity({
                projectId: delivery.project.id,
                executionId: delivery.executionId,
                sourceKind: 'asset',
                sourceIdentity: delivery.requirementRef,
              })
            ))
          : false;
    if (!projectBound) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['attentionItems', index, 'attentionId'],
        message: 'Assurance attention identity is not bound to its exact Project, execution, source kind, and assessment',
      });
    }
  }
  const catalog = value.catalogAdmission.status === 'ready'
    ? value.catalogAdmission.catalog
    : null;
  if (!catalog) return;
  for (const [index, assessment] of value.gateAssessments.entries()) {
    if (assessment.status !== 'satisfied' || assessment.regime === 'F_D') continue;
    const definition = catalog.gates.find((entry) => entry.gateRef === assessment.gateRef);
    if (
      !definition
      || definition.regime !== assessment.regime
      || !decisionSatisfiesRequirement(
        definition.positiveDecisionRequirement,
        assessment.decision,
      )
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['gateAssessments', index, 'decision'],
        message: `${assessment.regime} satisfaction does not match catalog-admitted decision authority and basis`,
      });
    }
  }
});

export const assuranceLoadRequestSchema = z.object({
  project: projectRefSchema,
  revision: projectRevisionSchema,
  executionId: nonEmptyString.nullable(),
}).strict();

export type ProjectRef = z.infer<typeof projectRefSchema>;
export type ProjectRevision = z.infer<typeof projectRevisionSchema>;
export type ManagerContext = z.infer<typeof managerContextSchema>;
export type WorkspaceProfile = z.infer<typeof workspaceProfileSchema>;
export type FsEntry = z.infer<typeof fsEntrySchema>;
export type FsBrowseResult = z.infer<typeof fsBrowseResultSchema>;
export type ProjectRecord = z.infer<typeof projectRecordSchema>;
export type ProjectSurfaceDiagnostic = z.infer<typeof projectSurfaceDiagnosticSchema>;
export type ProjectRegistryResponse = z.infer<typeof projectRegistryResponseSchema>;
export type ProjectRegistryMutationResponse = z.infer<typeof projectRegistryMutationResponseSchema>;
export type ProjectRegistryRemovalResponse = z.infer<typeof projectRegistryRemovalResponseSchema>;
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
