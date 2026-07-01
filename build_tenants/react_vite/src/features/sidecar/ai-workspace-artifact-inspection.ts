import type {
  AiWorkspaceArtifactRecord,
  AiWorkspaceObservation,
} from '../../contracts/ai-workspace-observation';

export type AiWorkspaceArtifactParseKind = 'json' | 'jsonl' | 'raw' | 'error';

export interface AiWorkspaceArtifactFact {
  label: string;
  value: string;
}

export interface AiWorkspaceEventKindSummary {
  kind: string;
  count: number;
}

export interface AiWorkspaceArtifactInspection {
  title: string;
  artifactKind: AiWorkspaceArtifactRecord['artifactKind'];
  featureId: AiWorkspaceArtifactRecord['featureId'];
  parseKind: AiWorkspaceArtifactParseKind;
  supported: boolean;
  summary: string;
  facts: AiWorkspaceArtifactFact[];
  topLevelKeys: string[];
  eventKinds: AiWorkspaceEventKindSummary[];
  diagnostics: string[];
}

const INSPECTABLE_ARTIFACT_KINDS = new Set<AiWorkspaceArtifactRecord['artifactKind']>([
  'event_log_jsonl',
  'proof_manifest',
  'proof_artifact',
  'test_run_summary',
  'system_ledger',
  'system_catalog',
]);

const FACT_KEYS = [
  'kind',
  'scenarioId',
  'scenario_id',
  'scenarioKind',
  'status',
  'outcome',
  'result',
  'interpretedDisposition',
  'graphFunctionRef',
  'selectedGraphFunctionRef',
  'graphRef',
  'overlayRef',
  'startupConfigRef',
  'runtimeBindingPath',
  'workspaceRoot',
  'runRoot',
  'sourceRule',
  'authorityRule',
  'eventLogSha256',
  'artifactSha256',
  'durationMs',
  'createdAt',
  'command',
] as const;

const COUNT_KEYS = [
  'runs',
  'proofs',
  'proofRefs',
  'proof_refs',
  'commandProofs',
  'artifactSha256s',
  'events',
  'entries',
] as const;

const MAX_JSON_INSPECTION_BYTES = 1_500_000;
const MAX_JSONL_INSPECTION_LINES = 2000;

export function aiWorkspaceArtifactForRelativePath(
  observation: AiWorkspaceObservation | null | undefined,
  relativePath: string | null | undefined,
) {
  if (!observation || !relativePath) return null;
  const targetPath = canonicalArtifactPath(relativePath);
  return observation.artifacts.find((artifact) => canonicalArtifactPath(artifact.relativePath) === targetPath) ?? null;
}

export function inspectAiWorkspaceArtifact(
  artifact: AiWorkspaceArtifactRecord,
  content: string,
): AiWorkspaceArtifactInspection {
  if (!INSPECTABLE_ARTIFACT_KINDS.has(artifact.artifactKind)) {
    return {
      title: titleForArtifact(artifact),
      artifactKind: artifact.artifactKind,
      featureId: artifact.featureId,
      parseKind: 'raw',
      supported: false,
      summary: 'No generic structured viewer is available for this artifact kind.',
      facts: [],
      topLevelKeys: [],
      eventKinds: [],
      diagnostics: [],
    };
  }
  if (artifact.artifactKind === 'event_log_jsonl') {
    return inspectJsonlArtifact(artifact, content);
  }
  return inspectJsonArtifact(artifact, content);
}

function inspectJsonArtifact(artifact: AiWorkspaceArtifactRecord, content: string): AiWorkspaceArtifactInspection {
  if (content.length > MAX_JSON_INSPECTION_BYTES) {
    return boundedInspection(artifact, 'json', content.length, MAX_JSON_INSPECTION_BYTES);
  }
  const parsed = parseJson(content);
  if (!parsed.ok) {
    return parseErrorInspection(artifact, 'json', parsed.error);
  }
  if (!isRecord(parsed.value)) {
    return {
      title: titleForArtifact(artifact),
      artifactKind: artifact.artifactKind,
      featureId: artifact.featureId,
      parseKind: 'json',
      supported: true,
      summary: 'JSON artifact parsed, but its top-level value is not an object.',
      facts: [['Value kind', Array.isArray(parsed.value) ? 'array' : typeof parsed.value]].map(([label, value]) => ({ label, value })),
      topLevelKeys: [],
      eventKinds: [],
      diagnostics: [],
    };
  }

  const facts = jsonFacts(parsed.value);
  const topLevelKeys = Object.keys(parsed.value).sort();
  return {
    title: titleForArtifact(artifact),
    artifactKind: artifact.artifactKind,
    featureId: artifact.featureId,
    parseKind: 'json',
    supported: true,
    summary: summaryForJsonArtifact(artifact, parsed.value, facts),
    facts,
    topLevelKeys,
    eventKinds: [],
    diagnostics: [],
  };
}

function inspectJsonlArtifact(artifact: AiWorkspaceArtifactRecord, content: string): AiWorkspaceArtifactInspection {
  const { lines, truncated } = collectJsonlInspectionLines(content);
  const eventKindCounts = new Map<string, number>();
  const diagnostics: string[] = [];
  let parsedCount = 0;
  let firstEventTime: string | null = null;
  let lastEventTime: string | null = null;

  lines.forEach((entry) => {
    const parsed = parseJson(entry.text);
    if (!parsed.ok || !isRecord(parsed.value)) {
      if (diagnostics.length < 4) diagnostics.push(`Line ${entry.sourceLineNumber} is not a JSON object.`);
      return;
    }
    parsedCount += 1;
    const kind = stringValue(parsed.value.kind) ?? stringValue(parsed.value.eventKind) ?? 'unknown';
    eventKindCounts.set(kind, (eventKindCounts.get(kind) ?? 0) + 1);
    const eventTime = stringValue(parsed.value.eventTime) ?? stringValue(parsed.value.timestamp);
    if (eventTime) {
      firstEventTime = firstEventTime ?? eventTime;
      lastEventTime = eventTime;
    }
  });

  const eventKinds = [...eventKindCounts.entries()]
    .map(([kind, count]) => ({ kind, count }))
    .sort((left, right) => right.count - left.count || left.kind.localeCompare(right.kind))
    .slice(0, 8);
  const facts: AiWorkspaceArtifactFact[] = [
    { label: truncated ? 'Inspected lines' : 'Lines', value: String(lines.length) },
    { label: 'Parsed events', value: String(parsedCount) },
  ];
  if (firstEventTime) facts.push({ label: 'First event', value: firstEventTime });
  if (lastEventTime && lastEventTime !== firstEventTime) facts.push({ label: 'Last event', value: lastEventTime });
  if (lines.length > parsedCount) facts.push({ label: 'Invalid lines', value: String(lines.length - parsedCount) });
  if (truncated) {
    diagnostics.push(`Inspection truncated to the first ${MAX_JSONL_INSPECTION_LINES} non-empty lines.`);
  }

  return {
    title: titleForArtifact(artifact),
    artifactKind: artifact.artifactKind,
    featureId: artifact.featureId,
    parseKind: 'jsonl',
    supported: true,
    summary: truncated
      ? `${parsedCount} event${parsedCount === 1 ? '' : 's'} parsed from ${lines.length} inspected line${lines.length === 1 ? '' : 's'}.`
      : `${parsedCount} event${parsedCount === 1 ? '' : 's'} parsed from ${lines.length} line${lines.length === 1 ? '' : 's'}.`,
    facts,
    topLevelKeys: [],
    eventKinds,
    diagnostics,
  };
}

function boundedInspection(
  artifact: AiWorkspaceArtifactRecord,
  parseKind: Extract<AiWorkspaceArtifactParseKind, 'json' | 'jsonl'>,
  sizeBytes: number,
  limitBytes: number,
): AiWorkspaceArtifactInspection {
  return {
    title: titleForArtifact(artifact),
    artifactKind: artifact.artifactKind,
    featureId: artifact.featureId,
    parseKind: 'raw',
    supported: true,
    summary: `${parseKind.toUpperCase()} structured inspection skipped because the artifact exceeds the browser inspection limit.`,
    facts: [
      { label: 'Artifact bytes', value: String(sizeBytes) },
      { label: 'Inspection limit bytes', value: String(limitBytes) },
    ],
    topLevelKeys: [],
    eventKinds: [],
    diagnostics: ['Open the raw document surface for the full artifact content.'],
  };
}

function parseErrorInspection(
  artifact: AiWorkspaceArtifactRecord,
  parseKind: Extract<AiWorkspaceArtifactParseKind, 'json' | 'jsonl'>,
  error: string,
): AiWorkspaceArtifactInspection {
  return {
    title: titleForArtifact(artifact),
    artifactKind: artifact.artifactKind,
    featureId: artifact.featureId,
    parseKind: 'error',
    supported: true,
    summary: `${parseKind.toUpperCase()} artifact could not be parsed.`,
    facts: [],
    topLevelKeys: [],
    eventKinds: [],
    diagnostics: [error],
  };
}

function collectJsonlInspectionLines(content: string) {
  const lines: Array<{ text: string; sourceLineNumber: number }> = [];
  let start = 0;
  let sourceLineNumber = 1;
  let truncated = false;
  for (let index = 0; index <= content.length; index += 1) {
    const atEnd = index === content.length;
    if (!atEnd && content[index] !== '\n') continue;
    let text = content.slice(start, index);
    if (text.endsWith('\r')) text = text.slice(0, -1);
    if (text.trim().length > 0) {
      if (lines.length >= MAX_JSONL_INSPECTION_LINES) {
        truncated = true;
        break;
      }
      lines.push({ text, sourceLineNumber });
    }
    start = index + 1;
    sourceLineNumber += 1;
  }
  return { lines, truncated };
}

function jsonFacts(value: Record<string, unknown>) {
  const facts: AiWorkspaceArtifactFact[] = [];
  for (const key of FACT_KEYS) {
    const factValue = scalarDisplayValue(value[key]);
    if (factValue) facts.push({ label: labelForKey(key), value: factValue });
  }
  for (const key of COUNT_KEYS) {
    const count = countValue(value[key]);
    if (count !== null) facts.push({ label: `${labelForKey(key)} count`, value: String(count) });
  }
  return facts.slice(0, 18);
}

function summaryForJsonArtifact(
  artifact: AiWorkspaceArtifactRecord,
  value: Record<string, unknown>,
  facts: AiWorkspaceArtifactFact[],
) {
  const scenario = scalarDisplayValue(value.scenarioId) ?? scalarDisplayValue(value.scenario_id);
  const graphFunction = scalarDisplayValue(value.graphFunctionRef) ?? scalarDisplayValue(value.selectedGraphFunctionRef);
  const disposition = scalarDisplayValue(value.interpretedDisposition) ??
    scalarDisplayValue(value.status) ??
    scalarDisplayValue(value.outcome) ??
    scalarDisplayValue(value.result);
  const anchor = [scenario, disposition, graphFunction].filter(Boolean).join(' / ');
  if (anchor) return anchor;
  if (facts.length > 0) return `${facts.length} structured fact${facts.length === 1 ? '' : 's'} extracted.`;
  return `${Object.keys(value).length} top-level key${Object.keys(value).length === 1 ? '' : 's'} parsed.`;
}

function titleForArtifact(artifact: AiWorkspaceArtifactRecord) {
  return `${artifact.artifactKind.replace(/_/g, ' ')} / ${artifact.featureId.replace(/_/g, ' ')}`;
}

function canonicalArtifactPath(value: string) {
  return String(value).replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+$/, '');
}

function parseJson(value: string): { ok: true; value: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, value: JSON.parse(value) as unknown };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function scalarDisplayValue(value: unknown) {
  if (typeof value === 'string') return truncateValue(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  return null;
}

function stringValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

function countValue(value: unknown) {
  if (Array.isArray(value)) return value.length;
  if (isRecord(value)) return Object.keys(value).length;
  return null;
}

function labelForKey(key: string) {
  return key
    .replace(/_/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function truncateValue(value: string) {
  return value.length > 160 ? `${value.slice(0, 157)}...` : value;
}
