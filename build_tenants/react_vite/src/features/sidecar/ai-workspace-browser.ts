import type {
  AiWorkspaceArtifactKind,
  AiWorkspaceArtifactRecord,
  AiWorkspaceFeatureId,
  AiWorkspaceFeatureRecord,
  AiWorkspaceObservation,
  AiWorkspaceViewerCapability,
} from '../../contracts/ai-workspace-observation';

export const AI_WORKSPACE_SUMMARY_FEATURE_IDS: AiWorkspaceFeatureId[] = [
  'ai_workspace',
  'context',
  'tickets',
  'comments',
  'runtime',
  'events',
  'proofs',
  'test_runs',
  'ledgers',
  'catalogs',
  'domain_overlays',
];

const FEATURE_ORDER = new Map(AI_WORKSPACE_SUMMARY_FEATURE_IDS.map((id, index) => [id, index]));

export interface AiWorkspaceFeatureSummary {
  id: AiWorkspaceFeatureId;
  label: string;
  state: AiWorkspaceFeatureRecord['state'];
  artifactCount: number;
  capabilities: AiWorkspaceViewerCapability[];
}

export interface AiWorkspaceArtifactGroup {
  featureId: AiWorkspaceFeatureId;
  label: string;
  state: AiWorkspaceFeatureRecord['state'];
  artifactCount: number;
  artifactKinds: AiWorkspaceArtifactKind[];
  capabilities: AiWorkspaceViewerCapability[];
  artifacts: AiWorkspaceArtifactRecord[];
}

export interface AiWorkspaceBrowserSummary {
  projectRoot: string;
  aiWorkspaceRoot: string;
  presentFeatureCount: number;
  artifactCount: number;
  capabilityCount: number;
  features: AiWorkspaceFeatureSummary[];
  artifactGroups: AiWorkspaceArtifactGroup[];
}

export function normalizeWorkspaceRoot(value: string | null | undefined) {
  return String(value ?? '').replace(/\/+$/, '');
}

export function isAiWorkspaceObservationForProject(
  observation: AiWorkspaceObservation | null | undefined,
  projectRoot: string | null | undefined,
) {
  if (!observation || !projectRoot) return false;
  return normalizeWorkspaceRoot(observation.projectRoot) === normalizeWorkspaceRoot(projectRoot);
}

export function aiWorkspaceBrowserSummary(observation: AiWorkspaceObservation): AiWorkspaceBrowserSummary {
  const featuresById = new Map(observation.features.map((feature) => [feature.id, feature]));
  const artifactsByFeature = new Map<AiWorkspaceFeatureId, AiWorkspaceArtifactRecord[]>();
  for (const artifact of observation.artifacts) {
    const artifacts = artifactsByFeature.get(artifact.featureId) ?? [];
    artifacts.push(artifact);
    artifactsByFeature.set(artifact.featureId, artifacts);
  }

  const features = AI_WORKSPACE_SUMMARY_FEATURE_IDS.map((id) => {
    const feature = featuresById.get(id);
    return {
      id,
      label: feature?.label ?? id.replace(/_/g, ' '),
      state: feature?.state ?? 'missing',
      artifactCount: feature?.artifactCount ?? 0,
      capabilities: feature?.capabilities ?? [],
    };
  });

  const artifactGroups = features
    .map((feature) => {
      const artifacts = (artifactsByFeature.get(feature.id) ?? [])
        .slice()
        .sort((left, right) => left.relativePath.localeCompare(right.relativePath));
      return {
        featureId: feature.id,
        label: feature.label,
        state: feature.state,
        artifactCount: artifacts.length,
        artifactKinds: uniqueStrings(artifacts.map((artifact) => artifact.artifactKind)) as AiWorkspaceArtifactKind[],
        capabilities: uniqueStrings(artifacts.flatMap((artifact) => artifact.viewerCapabilities)) as AiWorkspaceViewerCapability[],
        artifacts,
      };
    })
    .filter((group) => group.artifactCount > 0)
    .sort((left, right) => {
      const leftOrder = FEATURE_ORDER.get(left.featureId) ?? Number.MAX_SAFE_INTEGER;
      const rightOrder = FEATURE_ORDER.get(right.featureId) ?? Number.MAX_SAFE_INTEGER;
      if (leftOrder !== rightOrder) return leftOrder - rightOrder;
      return left.label.localeCompare(right.label);
    });

  return {
    projectRoot: observation.projectRoot,
    aiWorkspaceRoot: observation.aiWorkspaceRoot,
    presentFeatureCount: observation.features.filter((feature) => feature.state === 'present').length,
    artifactCount: observation.artifacts.length,
    capabilityCount: observation.capabilities.length,
    features,
    artifactGroups,
  };
}

export function aiWorkspaceArtifactLabel(artifact: AiWorkspaceArtifactRecord) {
  const parts = artifact.relativePath.split('/').filter(Boolean);
  return parts[parts.length - 1] || artifact.relativePath;
}

export function aiWorkspacePrimaryCapability(artifact: AiWorkspaceArtifactRecord) {
  return artifact.viewerCapabilities.find((capability) => capability !== 'browse.raw') ?? 'browse.raw';
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.filter((value) => typeof value === 'string' && value.trim()))];
}
