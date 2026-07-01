// .ai-workspace observation contract.
//
// Shared boundary for the read-only Project observability inventory introduced
// by T-031. The server validates filesystem artifacts before the UX renders
// capability-specific viewers.

export type AiWorkspaceFeatureState =
  | 'present'
  | 'missing'
  | 'incomplete'
  | 'unsupported'
  | 'error';

export type AiWorkspaceFeatureId =
  | 'ai_workspace'
  | 'context'
  | 'tickets'
  | 'comments'
  | 'runtime'
  | 'events'
  | 'ledgers'
  | 'catalogs'
  | 'proofs'
  | 'test_runs'
  | 'domain_overlays';

export type AiWorkspaceArtifactKind =
  | 'context_document'
  | 'ticket'
  | 'comment'
  | 'runtime_json'
  | 'event_log_jsonl'
  | 'system_ledger'
  | 'system_catalog'
  | 'proof_manifest'
  | 'proof_artifact'
  | 'test_run_summary'
  | 'domain_overlay'
  | 'raw_file';

export type AiWorkspaceViewerCapability =
  | 'browse.raw'
  | 'context.read'
  | 'tickets.inspect'
  | 'comments.inspect'
  | 'runtime.inspect'
  | 'events.inspect'
  | 'abg.system.inspect'
  | 'proof.inspect'
  | 'test_run.inspect'
  | 'domain_overlay.inspect';

export interface AiWorkspaceDiagnostic {
  severity: 'info' | 'warning' | 'error';
  code: string;
  message: string;
  sourceRef?: string;
}

export interface AiWorkspaceFeatureRecord {
  id: AiWorkspaceFeatureId;
  label: string;
  state: AiWorkspaceFeatureState;
  relativePath: string | null;
  sourceRefs: string[];
  artifactCount: number;
  capabilities: AiWorkspaceViewerCapability[];
  diagnostics: AiWorkspaceDiagnostic[];
}

export interface AiWorkspaceArtifactRecord {
  kind: 'ai_workspace_artifact';
  artifactId: string;
  featureId: AiWorkspaceFeatureId;
  artifactKind: AiWorkspaceArtifactKind;
  state: AiWorkspaceFeatureState;
  relativePath: string;
  absolutePath: string;
  sizeBytes: number;
  modifiedAt: string | null;
  viewerCapabilities: AiWorkspaceViewerCapability[];
  diagnostics: AiWorkspaceDiagnostic[];
}

export interface AiWorkspaceObservationDiagnostic {
  projectRoot: string;
  aiWorkspaceRoot: string;
  scannedDirectoryCount: number;
  scannedFileCount: number;
  maxDirectories: number;
  maxArtifacts: number;
  truncated: boolean;
  ignoredNames: string[];
}

export interface AiWorkspaceObservation {
  kind: 'ai_workspace_observation';
  version: 1;
  generatedAt: string;
  projectRoot: string;
  aiWorkspaceRoot: string;
  readOnly: true;
  features: AiWorkspaceFeatureRecord[];
  artifacts: AiWorkspaceArtifactRecord[];
  capabilities: AiWorkspaceViewerCapability[];
  diagnostics: AiWorkspaceObservationDiagnostic;
}
