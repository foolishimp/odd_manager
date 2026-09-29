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

const visualGraphPublishedRefSchema = z.string()
  .min(1)
  .max(4096)
  .regex(
    /^(?:[a-z][a-z0-9+.-]*:(?:\/\/)?[^\s]+|[a-z][a-z0-9._-]+@[0-9]+)$/iu,
    'expected a logical published reference',
  )
  .refine(
    (value) => !value.startsWith('/') && !/^file:/iu.test(value),
    'filesystem paths and file URIs are not visual graph references',
  )
  .refine(
    (value) => !/[\u0000-\u001f\u007f]/u.test(value),
    'control characters are not visual graph references',
  );
const visualGraphDigestSchema = z.string().regex(/^sha256:[0-9a-f]{64}$/u);
const visualGraphIdentifierTokenSchema = z.string()
  .min(1)
  .max(240)
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:-]*$/u);
const visualGraphStatusTokenSchema = z.string()
  .min(1)
  .max(80)
  .regex(/^[a-z][a-z0-9_]*$/u);
const visualGraphEventKindTokenSchema = z.string()
  .min(1)
  .max(160)
  .regex(/^[a-z][a-z0-9_]*$/u);
const visualGraphEventCoordinateSchema = z.object({
  eventId: visualGraphPublishedRefSchema,
  ordinal: z.number().int().nonnegative(),
  kind: visualGraphEventKindTokenSchema,
}).strict();
const visualGraphDiagnosticSchema = z.object({
  severity: z.enum(['info', 'warning', 'error']),
  code: visualGraphStatusTokenSchema.max(160),
  message: z.string().min(1).max(600),
  sourceEvent: visualGraphEventCoordinateSchema.nullable(),
}).strict();
const visualGraphDeclarationReferenceSchema = z.object({
  kind: z.enum(['graph', 'graph_function', 'overlay', 'materialization']),
  ref: visualGraphPublishedRefSchema,
  sourceEvent: visualGraphEventCoordinateSchema.nullable(),
}).strict();
const visualGraphDeclarationNodeSchema = z.object({
  id: visualGraphPublishedRefSchema,
  kind: z.enum(['graph', 'node', 'graph_vector', 'graph_function', 'overlay']),
  label: z.string().min(1).max(160),
  declarationRef: visualGraphPublishedRefSchema,
}).strict();
const visualGraphDeclarationEdgeSchema = z.object({
  id: visualGraphPublishedRefSchema,
  kind: z.enum(['declared_vector', 'overlay_application']),
  sourceNodeId: visualGraphPublishedRefSchema,
  targetNodeId: visualGraphPublishedRefSchema,
  declarationRef: visualGraphPublishedRefSchema,
}).strict();
const visualGraphOccurrenceNodeSchema = z.object({
  id: visualGraphPublishedRefSchema,
  aggregateType: z.enum([
    'run', 'graph_call', 'frame', 'c_call', 'actor_invocation', 'process',
  ]),
  aggregateId: visualGraphPublishedRefSchema,
  label: z.string().min(1).max(160),
  state: z.enum(['open', 'closed', 'failed', 'unknown']),
  firstObserved: visualGraphEventCoordinateSchema,
  lastObserved: visualGraphEventCoordinateSchema,
}).strict();
const visualGraphOccurrenceEdgeSchema = z.object({
  id: visualGraphPublishedRefSchema,
  kind: z.enum(['aggregate_parent', 'event_causation']),
  sourceNodeId: visualGraphPublishedRefSchema,
  targetNodeId: visualGraphPublishedRefSchema,
  sourceEvent: visualGraphEventCoordinateSchema,
  targetEvent: visualGraphEventCoordinateSchema,
}).strict();
const visualGraphWorkspaceSnapshotSchema = z.object({
  observationRef: visualGraphPublishedRefSchema.nullable(),
  observationDigest: visualGraphDigestSchema.nullable(),
  subjectRef: visualGraphPublishedRefSchema.nullable(),
  subjectDigest: visualGraphDigestSchema.nullable(),
  bindingRef: visualGraphPublishedRefSchema.nullable(),
  state: visualGraphStatusTokenSchema.nullable(),
  byteLength: z.number().int().nonnegative().nullable(),
  fileDigest: visualGraphDigestSchema.nullable(),
}).strict();
const visualGraphWorkspaceReceiptSchema = z.object({
  receiptRef: visualGraphPublishedRefSchema.nullable(),
  receiptDigest: visualGraphDigestSchema.nullable(),
  authorizationRef: visualGraphPublishedRefSchema.nullable(),
  authorizationDigest: visualGraphDigestSchema.nullable(),
  beforeObservationRef: visualGraphPublishedRefSchema.nullable(),
  beforeObservationDigest: visualGraphDigestSchema.nullable(),
  afterObservationRef: visualGraphPublishedRefSchema.nullable(),
  afterObservationDigest: visualGraphDigestSchema.nullable(),
  writtenDigest: visualGraphDigestSchema.nullable(),
  committed: z.boolean().nullable(),
}).strict();
const visualGraphWorkspaceCurrentnessSchema = z.object({
  state: z.enum(['present', 'missing', 'unreadable', 'unobserved']),
  byteLength: z.number().int().nonnegative().nullable(),
  digest: visualGraphDigestSchema.nullable(),
  posture: z.enum(['matches_retained', 'changed', 'unavailable']),
}).strict();
const visualGraphWorkspaceObservationSchema = z.object({
  ordinal: z.number().int().nonnegative(),
  sourceEvent: visualGraphEventCoordinateSchema.nullable(),
  predecessor: visualGraphWorkspaceSnapshotSchema,
  successor: visualGraphWorkspaceSnapshotSchema,
  receipt: visualGraphWorkspaceReceiptSchema,
  current: visualGraphWorkspaceCurrentnessSchema,
}).strict();
const visualGraphTerminalDispositionSchema = z.enum([
  'live_interactive', 'live_output_only', 'archive_available',
  'archive_candidate', 'completed', 'revoked', 'unavailable', 'unknown',
]);
const visualGraphEventContractPostureSchema = z.enum([
  'built_in_registry_envelope_validated_unpublished',
  'published_contract_distinct_from_builtin_registry',
  'published_contract_registry_kind_conflict',
  'published_contract_matches_builtin_registry',
  'legacy_envelope_verified',
  'invalid',
  'unknown',
]);
const visualGraphActorSessionSchema = z.object({
  id: visualGraphPublishedRefSchema,
  actorInvocationId: visualGraphPublishedRefSchema,
  processAggregateId: visualGraphPublishedRefSchema.nullable(),
  actorRef: visualGraphPublishedRefSchema.nullable(),
  lifecycleState: z.enum(['running', 'completed', 'failed', 'unknown']),
  terminalDisposition: visualGraphTerminalDispositionSchema,
  capabilityRefs: z.array(visualGraphPublishedRefSchema).max(12),
  operationRefs: z.array(visualGraphPublishedRefSchema).max(12),
  archiveRefs: z.array(visualGraphPublishedRefSchema).max(12),
  canAttach: z.boolean(),
  firstObserved: visualGraphEventCoordinateSchema,
  lastObserved: visualGraphEventCoordinateSchema,
}).strict().superRefine((value, context) => {
  const live = value.terminalDisposition === 'live_interactive'
    || value.terminalDisposition === 'live_output_only';
  if (live && (value.capabilityRefs.length === 0 || value.operationRefs.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminalDisposition'],
      message: 'live actor-session disposition requires published capability and operation references',
    });
  }
  if (value.canAttach !== (value.terminalDisposition === 'live_interactive')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['canAttach'],
      message: 'attach is admitted only for a live_interactive actor session',
    });
  }
  if ((value.terminalDisposition === 'live_interactive'
    || value.terminalDisposition === 'live_output_only')
    && value.lifecycleState !== 'running') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lifecycleState'],
      message: 'live actor-session disposition requires an explicitly running lifecycle',
    });
  }
  if ((value.terminalDisposition === 'archive_available'
    || value.terminalDisposition === 'archive_candidate')
    && (value.lifecycleState !== 'completed' || value.archiveRefs.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['archiveRefs'],
      message: 'archive disposition requires a completed lifecycle and published archive references',
    });
  }
  if (value.terminalDisposition === 'archive_available'
    && (value.capabilityRefs.length === 0 || value.operationRefs.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['terminalDisposition'],
      message: 'available archive disposition requires an admitted resolver capability and operation',
    });
  }
  if (value.terminalDisposition === 'completed' && value.lifecycleState !== 'completed') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['lifecycleState'],
      message: 'completed terminal disposition requires an explicitly completed lifecycle',
    });
  }
});

export const visualGraphProjectionSchema = z.object({
  kind: z.literal('visual_graph_projection'),
  version: z.literal(1),
  generatedAt: isoTimestamp,
  state: z.enum(['ready', 'partial', 'missing', 'unsupported', 'invalid']),
  run: z.object({
    runId: visualGraphPublishedRefSchema,
    runDigest: visualGraphDigestSchema.nullable(),
    scenarioKey: visualGraphIdentifierTokenSchema.max(160).nullable(),
    scenarioId: visualGraphIdentifierTokenSchema.nullable(),
    eventGeneration: visualGraphDigestSchema,
    eventCount: z.number().int().nonnegative(),
    firstOrdinal: z.number().int().nonnegative().nullable(),
    lastOrdinal: z.number().int().nonnegative().nullable(),
    eventPosture: visualGraphStatusTokenSchema,
    closed: z.boolean(),
    eventContract: z.object({
      publishedDigest: visualGraphDigestSchema.nullable(),
      builtInRegistryDigest: z.literal(
        'sha256:b47319edc2fe4c50d65579cbbe8d19952199a69b993b91d5f8888e511c96bd6d',
      ).nullable(),
      posture: visualGraphEventContractPostureSchema,
      bindingPosture: visualGraphStatusTokenSchema.nullable(),
    }).strict(),
    evidence: z.object({
      authority: visualGraphStatusTokenSchema.nullable(),
      disposition: visualGraphStatusTokenSchema.nullable(),
      validationDisposition: visualGraphStatusTokenSchema.nullable(),
    }).strict(),
  }).strict().nullable(),
  declarationTopology: z.object({
    state: z.enum(['ready', 'partial', 'missing']),
    reason: z.enum([
      'published_bodies_admitted', 'references_without_bodies', 'no_declaration_carrier',
    ]),
    references: z.array(visualGraphDeclarationReferenceSchema).max(240),
    nodes: z.array(visualGraphDeclarationNodeSchema).max(240),
    edges: z.array(visualGraphDeclarationEdgeSchema).max(480),
  }).strict(),
  occurrenceGraph: z.object({
    state: z.enum(['ready', 'partial', 'missing']),
    nodes: z.array(visualGraphOccurrenceNodeSchema).max(240),
    edges: z.array(visualGraphOccurrenceEdgeSchema).max(480),
    activeNodeIds: z.array(visualGraphPublishedRefSchema).max(240),
    lastObservedNodeId: visualGraphPublishedRefSchema.nullable(),
  }).strict(),
  workspaceObservations: z.object({
    state: z.enum(['ready', 'partial', 'missing']),
    currentness: z.enum([
      'matches_retained_observations', 'workspace_changed', 'unobserved',
    ]),
    observations: z.array(visualGraphWorkspaceObservationSchema).max(80),
  }).strict(),
  actorSessions: z.object({
    state: z.enum(['ready', 'partial', 'missing']),
    interactionDisposition: visualGraphTerminalDispositionSchema,
    sessions: z.array(visualGraphActorSessionSchema).max(80),
  }).strict(),
  diagnostics: z.array(visualGraphDiagnosticSchema).max(80),
  limits: z.object({
    maxNodes: z.literal(240),
    maxEdges: z.literal(480),
    maxWorkspaceObservations: z.literal(80),
    maxActorSessions: z.literal(80),
    maxDiagnostics: z.literal(80),
    nodesTruncated: z.boolean(),
    edgesTruncated: z.boolean(),
    workspaceObservationsTruncated: z.boolean(),
    actorSessionsTruncated: z.boolean(),
    diagnosticsTruncated: z.boolean(),
  }).strict(),
}).strict().superRefine((value, context) => {
  if (value.run !== null) {
    const { eventCount, firstOrdinal, lastOrdinal } = value.run;
    const hasFirstOrdinal = firstOrdinal !== null;
    const hasLastOrdinal = lastOrdinal !== null;
    if (hasFirstOrdinal !== hasLastOrdinal
      || (eventCount === 0 && hasFirstOrdinal)
      || (eventCount > 0 && !hasFirstOrdinal)
      || (firstOrdinal !== null && lastOrdinal !== null && firstOrdinal > lastOrdinal)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['run', 'firstOrdinal'],
        message: 'run ordinal bounds must be a complete non-reversed range exactly when events are retained',
      });
    }
  }
  const occurrenceNodeIds = new Set(value.occurrenceGraph.nodes.map((node) => node.id));
  if (occurrenceNodeIds.size !== value.occurrenceGraph.nodes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['occurrenceGraph', 'nodes'], message: 'occurrence node ids must be unique' });
  }
  for (const [index, node] of value.occurrenceGraph.nodes.entries()) {
    if (node.firstObserved.ordinal > node.lastObserved.ordinal) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['occurrenceGraph', 'nodes', index, 'firstObserved', 'ordinal'],
        message: 'an occurrence node first-observed ordinal cannot follow its last-observed ordinal',
      });
    }
  }
  for (const [index, edge] of value.occurrenceGraph.edges.entries()) {
    if (!occurrenceNodeIds.has(edge.sourceNodeId) || !occurrenceNodeIds.has(edge.targetNodeId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['occurrenceGraph', 'edges', index], message: 'occurrence edges must bind retained occurrence nodes' });
    }
  }
  const occurrenceEdgeIds = new Set(value.occurrenceGraph.edges.map((edge) => edge.id));
  if (occurrenceEdgeIds.size !== value.occurrenceGraph.edges.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['occurrenceGraph', 'edges'], message: 'occurrence edge ids must be unique' });
  }
  const activeOccurrenceNodeIds = new Set(value.occurrenceGraph.activeNodeIds);
  if (activeOccurrenceNodeIds.size !== value.occurrenceGraph.activeNodeIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['occurrenceGraph', 'activeNodeIds'],
      message: 'active occurrence identities must be unique',
    });
  }
  for (const [index, nodeId] of value.occurrenceGraph.activeNodeIds.entries()) {
    if (!occurrenceNodeIds.has(nodeId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['occurrenceGraph', 'activeNodeIds', index], message: 'active occurrence identity must bind a retained node' });
    }
  }
  for (const [index, node] of value.occurrenceGraph.nodes.entries()) {
    const active = activeOccurrenceNodeIds.has(node.id);
    if ((node.state === 'open') !== active) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['occurrenceGraph', 'nodes', index, 'state'],
        message: 'active occurrence identities must exactly equal retained nodes whose lifecycle state is open',
      });
    }
  }
  if (value.occurrenceGraph.lastObservedNodeId !== null
    && !occurrenceNodeIds.has(value.occurrenceGraph.lastObservedNodeId)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['occurrenceGraph', 'lastObservedNodeId'], message: 'last-observed occurrence identity must bind a retained node' });
  }
  if (value.run?.closed === true
    && value.occurrenceGraph.activeNodeIds.length > 0
    && value.occurrenceGraph.state !== 'partial') {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['occurrenceGraph', 'state'],
      message: 'a closed run with explicitly open retained children requires a partial occurrence posture',
    });
  }
  if (value.occurrenceGraph.state === 'missing'
    && (
      value.occurrenceGraph.nodes.length > 0
      || value.occurrenceGraph.edges.length > 0
      || value.occurrenceGraph.activeNodeIds.length > 0
      || value.occurrenceGraph.lastObservedNodeId !== null
    )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['occurrenceGraph'],
      message: 'a missing occurrence plane cannot retain nodes, edges, active identities, or a last-observed identity',
    });
  }
  if (value.occurrenceGraph.state !== 'missing' && value.occurrenceGraph.nodes.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['occurrenceGraph', 'nodes'],
      message: 'a retained occurrence plane requires at least one exact occurrence node',
    });
  }
  if (value.workspaceObservations.state === 'missing'
    && (
      value.workspaceObservations.observations.length > 0
      || value.workspaceObservations.currentness !== 'unobserved'
    )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workspaceObservations'],
      message: 'a missing workspace-observation plane cannot retain rows or a currentness claim',
    });
  }
  if (value.workspaceObservations.state !== 'missing'
    && value.workspaceObservations.observations.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workspaceObservations', 'observations'],
      message: 'a retained workspace-observation plane requires at least one exact observation row',
    });
  }
  const workspaceOrdinals = new Set(
    value.workspaceObservations.observations.map((observation) => observation.ordinal),
  );
  if (workspaceOrdinals.size !== value.workspaceObservations.observations.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workspaceObservations', 'observations'],
      message: 'workspace-observation ordinals must be unique within the retained construction coordinate',
    });
  }
  for (const [index, observation] of value.workspaceObservations.observations.entries()) {
    const { predecessor, successor, receipt, current } = observation;
    const workspacePath = ['workspaceObservations', 'observations', index];
    for (const [snapshotName, snapshot] of [
      ['predecessor', predecessor],
      ['successor', successor],
    ] as const) {
      const hasExactIdentity = snapshot.observationRef !== null
        && snapshot.observationDigest !== null
        && snapshot.subjectRef !== null
        && snapshot.subjectDigest !== null
        && snapshot.bindingRef !== null;
      const hasExactFileState = snapshot.state === 'file'
        && snapshot.byteLength !== null
        && snapshot.fileDigest !== null;
      const hasExactAbsentState = snapshot.state === 'absent'
        && snapshot.byteLength === null
        && snapshot.fileDigest === null;
      if (!hasExactIdentity || (!hasExactFileState && !hasExactAbsentState)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...workspacePath, snapshotName],
          message: 'a retained workspace snapshot requires exact identity and coherent file or absence facts',
        });
      }
    }
    if (
      receipt.receiptRef === null
      || receipt.receiptDigest === null
      || receipt.authorizationRef === null
      || receipt.authorizationDigest === null
      || receipt.beforeObservationRef === null
      || receipt.beforeObservationDigest === null
      || receipt.afterObservationRef === null
      || receipt.afterObservationDigest === null
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'receipt'],
        message: 'a retained workspace effect receipt requires exact identity, authorization, and observation facts',
      });
    }
    if (predecessor.subjectRef !== successor.subjectRef
      || predecessor.subjectDigest !== successor.subjectDigest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'successor', 'subjectRef'],
        message: 'workspace O0 and O1 must bind the same subject reference and digest',
      });
    }
    if (predecessor.bindingRef !== successor.bindingRef) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'successor', 'bindingRef'],
        message: 'workspace O0 and O1 must bind the same workspace identity',
      });
    }
    if (receipt.committed !== true) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'receipt', 'committed'],
        message: 'a retained workspace effect receipt must be explicitly committed',
      });
    }
    if (receipt.beforeObservationRef !== predecessor.observationRef
      || receipt.beforeObservationDigest !== predecessor.observationDigest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'receipt', 'beforeObservationRef'],
        message: 'a workspace effect receipt must bind the exact O0 reference and digest',
      });
    }
    if (receipt.afterObservationRef !== successor.observationRef
      || receipt.afterObservationDigest !== successor.observationDigest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'receipt', 'afterObservationRef'],
        message: 'a workspace effect receipt must bind the exact O1 reference and digest',
      });
    }
    if (receipt.writtenDigest !== successor.fileDigest) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'receipt', 'writtenDigest'],
        message: 'a workspace effect receipt written digest must equal the retained O1 file digest',
      });
    }
    if (current.posture === 'matches_retained') {
      const matchesRetainedFile = successor.state === 'file'
        && successor.fileDigest !== null
        && successor.byteLength !== null
        && current.state === 'present'
        && current.digest === successor.fileDigest
        && current.byteLength === successor.byteLength;
      const matchesRetainedAbsence = successor.state === 'absent'
        && successor.fileDigest === null
        && successor.byteLength === null
        && current.state === 'missing'
        && current.digest === null
        && current.byteLength === null;
      if (!matchesRetainedFile && !matchesRetainedAbsence) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...workspacePath, 'current', 'posture'],
          message: 'matches-retained currentness requires an exact retained file match or coherent retained absence',
        });
      }
    }
    const currentHasExactPresentFacts = current.state === 'present'
      && current.byteLength !== null
      && current.digest !== null;
    const currentHasExactNonPresentFacts = current.state !== 'present'
      && current.byteLength === null
      && current.digest === null;
    if (!currentHasExactPresentFacts && !currentHasExactNonPresentFacts) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'current'],
        message: 'workspace current byte facts must be complete exactly when the subject is present',
      });
    }
    if (current.posture === 'changed') {
      const changedFromFile = successor.state === 'file'
        && (
          current.state === 'missing'
          || currentHasExactPresentFacts
            && (current.digest !== successor.fileDigest || current.byteLength !== successor.byteLength)
        );
      const changedFromAbsence = successor.state === 'absent' && currentHasExactPresentFacts;
      if (!changedFromFile && !changedFromAbsence) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...workspacePath, 'current', 'posture'],
          message: 'changed workspace currentness requires an exact present difference, creation, or deletion',
        });
      }
    }
    if (current.posture === 'unavailable'
      && (!['unreadable', 'unobserved'].includes(current.state)
        || current.byteLength !== null
        || current.digest !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'current'],
        message: 'unavailable workspace currentness requires an unreadable or unobserved state without byte facts',
      });
    }
    if (current.state === 'unobserved'
      && (current.posture !== 'unavailable'
        || current.byteLength !== null
        || current.digest !== null)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: [...workspacePath, 'current'],
        message: 'an unobserved workspace subject cannot carry current byte facts or an observed posture',
      });
    }
  }
  const currentPostures = value.workspaceObservations.observations.map((row) => row.current.posture);
  if (value.workspaceObservations.currentness === 'matches_retained_observations'
    && currentPostures.some((posture) => posture !== 'matches_retained')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workspaceObservations', 'currentness'],
      message: 'matches-retained workspace currentness requires every retained row to match',
    });
  }
  if (value.workspaceObservations.currentness === 'workspace_changed'
    && !currentPostures.includes('changed')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workspaceObservations', 'currentness'],
      message: 'workspace-changed currentness requires at least one changed retained row',
    });
  }
  if (value.workspaceObservations.currentness === 'unobserved'
    && currentPostures.some((posture) => posture === 'matches_retained' || posture === 'changed')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workspaceObservations', 'currentness'],
      message: 'unobserved workspace currentness cannot contain observed match or change claims',
    });
  }
  if (value.state === 'ready'
    && (
      value.run === null
      || value.declarationTopology.state !== 'ready'
      || value.occurrenceGraph.state !== 'ready'
      || value.workspaceObservations.state !== 'ready'
    )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['state'],
      message: 'ready composition requires an exact run and ready declaration, occurrence, and workspace-observation planes',
    });
  }
  const graphRowsTruncated = value.limits.nodesTruncated || value.limits.edgesTruncated;
  if (value.workspaceObservations.state === 'ready'
    && value.limits.workspaceObservationsTruncated) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['workspaceObservations', 'state'],
      message: 'a ready workspace-observation plane cannot carry a workspace truncation receipt',
    });
  }
  if (value.actorSessions.state === 'ready' && value.limits.actorSessionsTruncated) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['actorSessions', 'state'],
      message: 'a ready actor-session plane cannot carry an actor-session truncation receipt',
    });
  }
  const anyProjectionRowsTruncated = graphRowsTruncated
    || value.limits.workspaceObservationsTruncated
    || value.limits.actorSessionsTruncated
    || value.limits.diagnosticsTruncated;
  if (value.state === 'ready' && anyProjectionRowsTruncated) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['state'],
      message: 'a ready visual graph composition cannot carry any truncation receipt',
    });
  }
  const hasRetainedPlaneRows = value.declarationTopology.references.length > 0
    || value.declarationTopology.nodes.length > 0
    || value.declarationTopology.edges.length > 0
    || value.occurrenceGraph.nodes.length > 0
    || value.occurrenceGraph.edges.length > 0
    || value.occurrenceGraph.activeNodeIds.length > 0
    || value.occurrenceGraph.lastObservedNodeId !== null
    || value.workspaceObservations.observations.length > 0
    || value.actorSessions.sessions.length > 0;
  if (value.run === null && hasRetainedPlaneRows) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['run'],
      message: 'retained visual graph rows require one exact run basis',
    });
  }
  if (['missing', 'unsupported', 'invalid'].includes(value.state) && hasRetainedPlaneRows) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['state'],
      message: 'missing, unsupported, or invalid composition cannot retain visual graph rows',
    });
  }
  const actorSessionIds = new Set(value.actorSessions.sessions.map((session) => session.id));
  if (actorSessionIds.size !== value.actorSessions.sessions.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['actorSessions', 'sessions'], message: 'actor-session ids must be unique' });
  }
  const actorInvocationNodeIdsByAggregateId = new Map<string, string[]>();
  const processNodeIdsByAggregateId = new Map<string, string[]>();
  for (const node of value.occurrenceGraph.nodes) {
    const index = node.aggregateType === 'actor_invocation'
      ? actorInvocationNodeIdsByAggregateId
      : node.aggregateType === 'process'
        ? processNodeIdsByAggregateId
        : null;
    if (index === null) continue;
    const nodeIds = index.get(node.aggregateId) ?? [];
    nodeIds.push(node.id);
    index.set(node.aggregateId, nodeIds);
  }
  const actorInvocationAggregateIds = new Set(actorInvocationNodeIdsByAggregateId.keys());
  const processAggregateIds = new Set(processNodeIdsByAggregateId.keys());
  for (const [index, session] of value.actorSessions.sessions.entries()) {
    const actorInvocationBound = actorInvocationAggregateIds.has(session.actorInvocationId);
    if (!actorInvocationBound) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['actorSessions', 'sessions', index, 'actorInvocationId'],
        message: 'actor-session invocation identity must bind a retained actor-invocation occurrence',
      });
    }
    if (session.processAggregateId !== null) {
      const processBound = processAggregateIds.has(session.processAggregateId);
      if (!processBound) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['actorSessions', 'sessions', index, 'processAggregateId'],
          message: 'actor-session process identity must bind a retained process occurrence',
        });
      }
      if (actorInvocationBound && processBound) {
        const actorNodeIds = actorInvocationNodeIdsByAggregateId.get(session.actorInvocationId) ?? [];
        const processNodeIds = processNodeIdsByAggregateId.get(session.processAggregateId) ?? [];
        const exactParentBinding = actorNodeIds.length === 1
          && processNodeIds.length === 1
          && value.occurrenceGraph.edges.some((edge) => (
            edge.kind === 'aggregate_parent'
            && edge.sourceNodeId === actorNodeIds[0]
            && edge.targetNodeId === processNodeIds[0]
          ));
        if (!exactParentBinding) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['actorSessions', 'sessions', index, 'processAggregateId'],
            message: 'actor-session process identity requires its exact actor-invocation to process aggregate-parent edge',
          });
        }
      }
    }
  }
  if (value.actorSessions.state === 'missing'
    && (value.actorSessions.sessions.length > 0 || value.actorSessions.interactionDisposition !== 'unavailable')) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['actorSessions'],
      message: 'a missing actor-session plane cannot retain sessions or an interaction disposition',
    });
  }
  if (value.actorSessions.state !== 'missing' && value.actorSessions.sessions.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['actorSessions', 'sessions'],
      message: 'a retained actor-session plane requires at least one exact session',
    });
  }
  if (value.actorSessions.interactionDisposition !== 'unavailable'
    && !value.actorSessions.sessions.some((session) => (
      session.terminalDisposition === value.actorSessions.interactionDisposition
    ))) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['actorSessions', 'interactionDisposition'],
      message: 'an actor-plane interaction disposition must be carried by an exact retained session',
    });
  }
  if (value.run !== null) {
    const contract = value.run.eventContract;
    const issue = (message: string) => context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['run', 'eventContract'],
      message,
    });
    if (contract.publishedDigest === null && contract.bindingPosture !== null) {
      issue('an unpublished event contract cannot carry a binding posture');
    }
    if (contract.publishedDigest !== null && contract.bindingPosture === null) {
      issue('a published event contract requires an exact binding posture');
    }
    if (contract.posture === 'built_in_registry_envelope_validated_unpublished'
      && (contract.publishedDigest !== null || contract.builtInRegistryDigest === null)) {
      issue('built-in unpublished posture requires only a built-in registry digest');
    }
    if (contract.posture === 'published_contract_distinct_from_builtin_registry'
      && (
        contract.publishedDigest === null
        || contract.builtInRegistryDigest === null
        || contract.publishedDigest === contract.builtInRegistryDigest
        || contract.bindingPosture === null
      )) {
      issue('distinct published posture requires unequal published and built-in digests plus an exact binding posture');
    }
    if ((contract.posture === 'published_contract_registry_kind_conflict'
      || contract.posture === 'published_contract_matches_builtin_registry')
      && (
        contract.publishedDigest === null
        || contract.builtInRegistryDigest === null
        || contract.publishedDigest !== contract.builtInRegistryDigest
      )) {
      issue('registry match or conflict posture requires equal published and built-in digests');
    }
    if (contract.posture === 'legacy_envelope_verified'
      && (contract.publishedDigest !== null || contract.builtInRegistryDigest !== null)) {
      issue('legacy envelope posture cannot claim ABIogenesis 5 event-contract digests');
    }
    const lifecycleSemanticsUninterpreted = value.run.eventPosture === 'external_contract_uninterpreted'
      || contract.posture === 'published_contract_distinct_from_builtin_registry'
      || contract.posture === 'published_contract_registry_kind_conflict';
    if (contract.posture === 'published_contract_distinct_from_builtin_registry'
      && value.run.eventPosture !== 'external_contract_uninterpreted') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['run', 'eventPosture'],
        message: 'a distinct external event contract must remain lifecycle-uninterpreted',
      });
    }
    if (lifecycleSemanticsUninterpreted) {
      if (value.run.closed) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['run', 'closed'],
          message: 'an uninterpreted external event contract cannot close the run',
        });
      }
      if (value.occurrenceGraph.activeNodeIds.length > 0) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['occurrenceGraph', 'activeNodeIds'],
          message: 'an uninterpreted external event contract cannot identify active occurrences',
        });
      }
      for (const [index, node] of value.occurrenceGraph.nodes.entries()) {
        if (node.state !== 'unknown') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['occurrenceGraph', 'nodes', index, 'state'],
            message: 'occurrence lifecycle state must remain unknown for an uninterpreted external event contract',
          });
        }
      }
      for (const [index, session] of value.actorSessions.sessions.entries()) {
        if (session.lifecycleState !== 'unknown') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['actorSessions', 'sessions', index, 'lifecycleState'],
            message: 'actor lifecycle state must remain unknown for an uninterpreted external event contract',
          });
        }
        if (session.terminalDisposition !== 'unknown') {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['actorSessions', 'sessions', index, 'terminalDisposition'],
            message: 'actor terminal disposition must remain unknown for an uninterpreted external event contract',
          });
        }
      }
    }
  }
  const declarationNodeIds = new Set(value.declarationTopology.nodes.map((node) => node.id));
  if (declarationNodeIds.size !== value.declarationTopology.nodes.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['declarationTopology', 'nodes'], message: 'declaration node ids must be unique' });
  }
  for (const [index, edge] of value.declarationTopology.edges.entries()) {
    if (!declarationNodeIds.has(edge.sourceNodeId) || !declarationNodeIds.has(edge.targetNodeId)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ['declarationTopology', 'edges', index], message: 'declaration edges must bind retained declaration nodes' });
    }
  }
  const declarationEdgeIds = new Set(value.declarationTopology.edges.map((edge) => edge.id));
  if (declarationEdgeIds.size !== value.declarationTopology.edges.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['declarationTopology', 'edges'], message: 'declaration edge ids must be unique' });
  }
  const declaration = value.declarationTopology;
  if (declaration.state === 'ready'
    && (declaration.reason !== 'published_bodies_admitted' || declaration.nodes.length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['declarationTopology'],
      message: 'ready declaration topology requires admitted published bodies and at least one retained node',
    });
  }
  if (declaration.state === 'partial'
    && (
      declaration.reason !== 'references_without_bodies'
      || declaration.references.length === 0
      || declaration.nodes.length > 0
      || declaration.edges.length > 0
    )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['declarationTopology'],
      message: 'partial declaration topology is references without bodies and cannot retain declaration nodes or edges',
    });
  }
  if (declaration.state === 'missing'
    && (
      declaration.reason !== 'no_declaration_carrier'
      || declaration.references.length > 0
      || declaration.nodes.length > 0
      || declaration.edges.length > 0
    )) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['declarationTopology'],
      message: 'missing declaration topology cannot retain declaration references, nodes, or edges',
    });
  }
});

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
export type VisualGraphProjection = z.infer<typeof visualGraphProjectionSchema>;
