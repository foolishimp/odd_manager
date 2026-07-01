import type {
  AiWorkspaceArtifactKind,
  AiWorkspaceArtifactRecord,
  AiWorkspaceDiagnostic,
  AiWorkspaceFeatureId,
  AiWorkspaceFeatureRecord,
  AiWorkspaceFeatureState,
  AiWorkspaceObservation,
  AiWorkspaceObservationDiagnostic,
  AiWorkspaceViewerCapability,
} from '../../contracts/ai-workspace-observation';

const FEATURE_IDS: readonly AiWorkspaceFeatureId[] = [
  'ai_workspace',
  'context',
  'tickets',
  'comments',
  'runtime',
  'events',
  'ledgers',
  'catalogs',
  'proofs',
  'test_runs',
  'domain_overlays',
];

const FEATURE_STATES: readonly AiWorkspaceFeatureState[] = [
  'present',
  'missing',
  'incomplete',
  'unsupported',
  'error',
];

const ARTIFACT_KINDS: readonly AiWorkspaceArtifactKind[] = [
  'context_document',
  'ticket',
  'comment',
  'runtime_json',
  'event_log_jsonl',
  'system_ledger',
  'system_catalog',
  'proof_manifest',
  'proof_artifact',
  'test_run_summary',
  'domain_overlay',
  'raw_file',
];

const VIEWER_CAPABILITIES: readonly AiWorkspaceViewerCapability[] = [
  'browse.raw',
  'context.read',
  'tickets.inspect',
  'comments.inspect',
  'runtime.inspect',
  'events.inspect',
  'abg.system.inspect',
  'proof.inspect',
  'test_run.inspect',
  'domain_overlay.inspect',
];

const FEATURE_ID_SET = new Set<string>(FEATURE_IDS);
const FEATURE_STATE_SET = new Set<string>(FEATURE_STATES);
const ARTIFACT_KIND_SET = new Set<string>(ARTIFACT_KINDS);
const VIEWER_CAPABILITY_SET = new Set<string>(VIEWER_CAPABILITIES);
const DIAGNOSTIC_SEVERITY_SET = new Set<string>(['info', 'warning', 'error']);

export function asAiWorkspaceObservation(value: unknown): AiWorkspaceObservation {
  const payload = asRecord(value, 'ai-workspace observation');
  if (payload.kind !== 'ai_workspace_observation') {
    throw new Error('ai-workspace observation kind is unsupported');
  }
  if (payload.version !== 1 || payload.readOnly !== true) {
    throw new Error('ai-workspace observation version or readOnly flag is unsupported');
  }
  const projectRoot = requiredString(payload.projectRoot, 'ai-workspace observation projectRoot');
  const aiWorkspaceRoot = requiredString(payload.aiWorkspaceRoot, 'ai-workspace observation aiWorkspaceRoot');
  return {
    kind: 'ai_workspace_observation',
    version: 1,
    generatedAt: requiredString(payload.generatedAt, 'ai-workspace observation generatedAt'),
    projectRoot,
    aiWorkspaceRoot,
    readOnly: true,
    features: requiredArray(payload.features, 'ai-workspace observation features')
      .map((feature, index) => asAiWorkspaceFeature(feature, index)),
    artifacts: requiredArray(payload.artifacts, 'ai-workspace observation artifacts')
      .map((artifact, index) => asAiWorkspaceArtifact(artifact, index)),
    capabilities: asViewerCapabilities(payload.capabilities, 'ai-workspace observation capabilities'),
    diagnostics: asObservationDiagnostics(payload.diagnostics, projectRoot, aiWorkspaceRoot),
  };
}

function asAiWorkspaceFeature(value: unknown, index: number): AiWorkspaceFeatureRecord {
  const source = `ai-workspace observation features[${index}]`;
  const payload = asRecord(value, source);
  return {
    id: requiredLiteral(payload.id, FEATURE_ID_SET, `${source}.id`) as AiWorkspaceFeatureId,
    label: requiredString(payload.label, `${source}.label`),
    state: requiredLiteral(payload.state, FEATURE_STATE_SET, `${source}.state`) as AiWorkspaceFeatureState,
    relativePath: nullableString(payload.relativePath, `${source}.relativePath`),
    sourceRefs: stringArray(payload.sourceRefs, `${source}.sourceRefs`),
    artifactCount: nonNegativeNumber(payload.artifactCount, `${source}.artifactCount`),
    capabilities: asViewerCapabilities(payload.capabilities, `${source}.capabilities`),
    diagnostics: asDiagnostics(payload.diagnostics, `${source}.diagnostics`),
  };
}

function asAiWorkspaceArtifact(value: unknown, index: number): AiWorkspaceArtifactRecord {
  const source = `ai-workspace observation artifacts[${index}]`;
  const payload = asRecord(value, source);
  if (payload.kind !== 'ai_workspace_artifact') {
    throw new Error(`${source}.kind is unsupported`);
  }
  return {
    kind: 'ai_workspace_artifact',
    artifactId: requiredString(payload.artifactId, `${source}.artifactId`),
    featureId: requiredLiteral(payload.featureId, FEATURE_ID_SET, `${source}.featureId`) as AiWorkspaceFeatureId,
    artifactKind: requiredLiteral(payload.artifactKind, ARTIFACT_KIND_SET, `${source}.artifactKind`) as AiWorkspaceArtifactKind,
    state: requiredLiteral(payload.state, FEATURE_STATE_SET, `${source}.state`) as AiWorkspaceFeatureState,
    relativePath: requiredString(payload.relativePath, `${source}.relativePath`),
    absolutePath: requiredString(payload.absolutePath, `${source}.absolutePath`),
    sizeBytes: nonNegativeNumber(payload.sizeBytes, `${source}.sizeBytes`),
    modifiedAt: nullableString(payload.modifiedAt, `${source}.modifiedAt`),
    viewerCapabilities: asViewerCapabilities(payload.viewerCapabilities, `${source}.viewerCapabilities`),
    diagnostics: asDiagnostics(payload.diagnostics, `${source}.diagnostics`),
  };
}

function asDiagnostics(value: unknown, source: string): AiWorkspaceDiagnostic[] {
  return requiredArray(value, source).map((entry, index) => {
    const payload = asRecord(entry, `${source}[${index}]`);
    return {
      severity: requiredLiteral(payload.severity, DIAGNOSTIC_SEVERITY_SET, `${source}[${index}].severity`) as AiWorkspaceDiagnostic['severity'],
      code: requiredString(payload.code, `${source}[${index}].code`),
      message: requiredString(payload.message, `${source}[${index}].message`),
      ...(payload.sourceRef === undefined ? {} : { sourceRef: requiredString(payload.sourceRef, `${source}[${index}].sourceRef`) }),
    };
  });
}

function asObservationDiagnostics(
  value: unknown,
  projectRoot: string,
  aiWorkspaceRoot: string,
): AiWorkspaceObservationDiagnostic {
  const payload = asRecord(value, 'ai-workspace observation diagnostics');
  const diagnosticProjectRoot = requiredString(payload.projectRoot, 'ai-workspace observation diagnostics.projectRoot');
  const diagnosticAiWorkspaceRoot = requiredString(payload.aiWorkspaceRoot, 'ai-workspace observation diagnostics.aiWorkspaceRoot');
  if (diagnosticProjectRoot !== projectRoot || diagnosticAiWorkspaceRoot !== aiWorkspaceRoot) {
    throw new Error('ai-workspace observation diagnostics paths do not match observation paths');
  }
  return {
    projectRoot: diagnosticProjectRoot,
    aiWorkspaceRoot: diagnosticAiWorkspaceRoot,
    scannedDirectoryCount: nonNegativeNumber(payload.scannedDirectoryCount, 'ai-workspace observation diagnostics.scannedDirectoryCount'),
    scannedFileCount: nonNegativeNumber(payload.scannedFileCount, 'ai-workspace observation diagnostics.scannedFileCount'),
    maxDirectories: nonNegativeNumber(payload.maxDirectories, 'ai-workspace observation diagnostics.maxDirectories'),
    maxArtifacts: nonNegativeNumber(payload.maxArtifacts, 'ai-workspace observation diagnostics.maxArtifacts'),
    truncated: requiredBoolean(payload.truncated, 'ai-workspace observation diagnostics.truncated'),
    ignoredNames: stringArray(payload.ignoredNames, 'ai-workspace observation diagnostics.ignoredNames'),
  };
}

function asViewerCapabilities(value: unknown, source: string): AiWorkspaceViewerCapability[] {
  return requiredArray(value, source).map((capability, index) => (
    requiredLiteral(capability, VIEWER_CAPABILITY_SET, `${source}[${index}]`) as AiWorkspaceViewerCapability
  ));
}

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} payload is not an object`);
  }
  return value as Record<string, unknown>;
}

function requiredArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is not an array`);
  }
  return value;
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== 'string') {
    throw new Error(`${label} is not a string`);
  }
  return value;
}

function nullableString(value: unknown, label: string) {
  if (value === null) return null;
  return requiredString(value, label);
}

function requiredBoolean(value: unknown, label: string) {
  if (typeof value !== 'boolean') {
    throw new Error(`${label} is not a boolean`);
  }
  return value;
}

function nonNegativeNumber(value: unknown, label: string) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`${label} is not a non-negative number`);
  }
  return value;
}

function stringArray(value: unknown, label: string) {
  return requiredArray(value, label).map((entry, index) => requiredString(entry, `${label}[${index}]`));
}

function requiredLiteral(value: unknown, allowed: ReadonlySet<string>, label: string) {
  const text = requiredString(value, label);
  if (!allowed.has(text)) {
    throw new Error(`${label} is unsupported: ${text}`);
  }
  return text;
}
