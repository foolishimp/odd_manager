export type ThemeMode = "light" | "dark";
export type NavigatorMode = "compressed" | "expanded";
export type PageId =
  | "requirements"
  | "process"
  | "home"
  | "graphs"
  | "runtime"
  | "continuations"
  | "evidence"
  | "builder"
  | "provenance";
export type CommandName = "gaps" | "iterate" | "start";
export type Tone = "converged" | "pending" | "active" | "gated" | "blocked" | "attention";

export type BoundaryInfo = {
  runtime_source: string;
  runtime_aggregate_provider: string;
  domain_source: string;
  graph_derivation: string;
  query_cadence: string;
};

export type Overview = {
  status: Tone;
  headline: string;
  summary: string;
  total_delta: number;
  total_assets: number;
  total_workorders: number;
  total_gaps: number;
  active_runs: number;
  open_continuations: number;
  latest_event_time: string | null;
};

export type SemanticFacet = {
  name: string;
  description: string;
};

export type AssetTypeProfile = {
  name: string;
  description: string;
  semantic_facets: string[];
  fd_evaluator: string;
  fp_gap_description: string;
  fp_descriptive_framing: string;
  specializes: string[];
  library_level: string;
  mutable_default: boolean;
  proof_hints: string[];
  closure_hints: string[];
};

export type QueryContractView = {
  name: string;
  version: string;
  top_level_keys: string[];
  runtime_model: string;
  query_model: string;
};

export type AssetFamilyView = {
  name: string;
  description: string;
  lifecycle_role: string;
  representative_asset_types: string[];
  realization_status: string;
};

export type AssetCheckpoint = {
  exists: boolean;
  path_kind: string;
  content_digest: string | null;
  bytes: number | null;
};

export type AssetProvenance = {
  model: string;
  source: string;
  mutable: boolean;
  history_basis: string;
  last_event_id?: string;
};

export type AssetView = {
  asset_id: string;
  uri: string;
  declared_type: string;
  kind: string;
  metadata: Record<string, string>;
  provenance: AssetProvenance | null;
  checkpoint: AssetCheckpoint | null;
  projection_source?: string;
  update_count?: number;
};

export type RequirementView = {
  requirement_id: string;
  title: string;
  summary: string;
  family: string;
  family_title: string;
  family_status: string | null;
  priority: string | null;
  type: string | null;
  status: string | null;
  delivery_status: Tone;
  traces_to: string[];
  derives_from: string[];
  authority_refs: string[];
  current_requirement_refs: string[];
  implementation_claim_refs: string[];
  planned_test_claim_refs: string[];
  test_claim_refs: string[];
  code_refs: string[];
  test_refs: string[];
  testcase_authority_refs: string[];
  acceptance_criteria: string[];
  source_path: string;
};

export type TicketView = {
  id: string;
  title: string;
  summary: string;
  type: string | null;
  status: string | null;
  goal: string | null;
  priority: string | null;
  created_at: string | null;
  updated_at: string | null;
  dependencies: string[];
  links: string[];
  linked_requirement_ids: string[];
  linked_surfaces: string[];
  source_path: string;
};

export type CommentView = {
  id: string;
  title: string;
  summary: string;
  author: string | null;
  date: string | null;
  status: string | null;
  source: string | null;
  addresses: string[];
  linked_requirement_ids: string[];
  linked_surfaces: string[];
  source_path: string;
};

export type CollectionView = {
  name: string;
  assets: AssetView[];
};

export type BindingView = {
  node: string;
  asset_ids: string[];
};

export type EdgeContractView = {
  name: string;
  description: string;
  source_asset_families: string[];
  target_asset_family: string;
  configured_fp_role: string;
  preflight_fd_layers: string[];
  postflight_fd_layers: string[];
  work_report_contract: string;
  representative_functions: string[];
  realization_status: string;
};

export type ProgramView = {
  name: string;
  intent: string;
  steps: string[];
  outputs: string[];
  kind: string;
};

export type WorkActTypeView = {
  name: string;
  description: string;
  mutates_workspace: boolean;
  produces_governed_evidence: boolean;
  typical_asset_families: string[];
  realization_status: string;
};

export type AmbiguityEntryView = {
  ambiguity_id: string;
  description: string;
  class: string;
  status: string;
  policy_action: string;
  decision_status: string;
  governance_posture: string;
  operator_headline: string;
  next_lawful_action: string;
  capability_surface: string | null;
  tenant_name: string | null;
  expected_resolving_edge: string | null;
  blocking: boolean;
  hard_stop: boolean;
  affected_assets: string[];
  evidence_refs: string[];
  invariant_refs: string[];
  competing_interpretations: string[];
  current_resolution: string;
  decision_basis: string;
  decision_owner: string;
  decision_event_refs: string[];
  observed_state: Record<string, unknown>;
  risk_appetite: string | null;
  [key: string]: unknown;
};

export type AmbiguityRegisterView = {
  register_kind: string;
  schema_version: string;
  workspace_root: string;
  stage: string;
  project_profile: Record<string, unknown>;
  summary: {
    total?: number;
    blocking?: number;
    hard_stop?: number;
    fh_required?: number;
    pending_capability?: number;
    status_counts: Record<string, number>;
    [key: string]: unknown;
  };
  ambiguities: AmbiguityEntryView[];
};

export type GapView = {
  edge: string;
  delta: number;
  delta_summary: string;
  failing: string[];
  passing: string[];
};

export type GraphFunctionVectorView = {
  name: string;
  source: string[];
  target: string;
};

export type GraphFunctionView = {
  id: string;
  name: string;
  label: string;
  status: Tone;
  intent: string;
  function_kind: string | null;
  inputs: string[];
  outputs: string[];
  environment: {
    requires: string[];
    provides: string[];
    carries: string[];
  };
  vectors: GraphFunctionVectorView[];
  job_names: string[];
  workorder_ids: string[];
};

export type FunctionView = {
  id: string;
  label: string;
  status: Tone;
  intent: string;
  inputs: string[];
  outputs: string[];
  backing_graph_function: string;
  published_graph_function_id: string | null;
  gap: GapView | null;
  run_ids: string[];
  call_ids: string[];
  open_continuation_ids: string[];
};

export type JobView = {
  name: string;
  contracts: Array<{
    kind: string;
    target_id: string;
  }>;
};

export type WorkOrderView = {
  id: string;
  label: string;
  status: Tone;
  intent: string;
  inputs: string[];
  outputs: string[];
  graph_function_id: string;
  graph_function_name: string;
  gap: GapView | null;
  run_ids: string[];
  call_ids: string[];
  open_continuation_ids: string[];
  source: string;
};

export type GraphNodeView = {
  id: string;
  node_name: string;
  label: string;
  kind: "asset_node" | "function" | "catalog" | "governance";
  status: Tone;
  description: string;
  subtitle: string;
  asset_ids: string[];
  ref_kind:
    | "requirement"
    | "surface"
    | "asset"
    | "asset_family"
    | "binding"
    | "collection"
    | "ambiguity"
    | "edge_contract"
    | "function"
    | "program"
    | "work_act_type"
    | "workorder";
  ref_id: string;
  input_node_ids: string[];
  output_node_ids: string[];
};

export type GraphSegmentView = {
  id: string;
  from: string;
  to: string;
  label: string;
  status: Tone;
  ref_id: string | null;
};

export type GraphView = {
  id: string;
  label: string;
  status: Tone;
  derivation: string;
  nodes: GraphNodeView[];
  segments: GraphSegmentView[];
};

export type GraphSetView = {
  id: string;
  label: string;
  status: Tone;
  graphs: GraphView[];
};

export type RuntimeRunView = {
  asset_type: string;
  instance_id: string;
  status: string;
  work_key?: string | null;
  run_id?: string | null;
  edge?: string | null;
  vector_id?: string | null;
  job_id?: string | null;
  worker_id?: string | null;
  role_id?: string | null;
  authority_ref?: string | null;
  selected_worker_id?: string | null;
  selected_backend?: string | null;
  assignment_source?: string | null;
  resolved_runtime_ref?: string | null;
  failure_class?: string | null;
  attempt_number?: number;
  superseded_by?: string | null;
  event_count: number;
};

export type GraphCallView = {
  asset_type: string;
  instance_id: string;
  status: string;
  call_id?: string | null;
  run_id?: string | null;
  graph_function_id?: string | null;
  materialization_id?: string | null;
  failure_class?: string | null;
  event_count: number;
};

export type ContinuationView = {
  asset_type: string;
  instance_id: string;
  status: string;
  continuation_id?: string | null;
  continuation_kind?: string | null;
  run_id?: string | null;
  caused_by_event_id?: string | null;
  call_id?: string | null;
  frame_attempt_id?: string | null;
  event_count: number;
};

export type FrameView = {
  asset_type: string;
  instance_id: string;
  status: string;
  frame_lineage_id?: string | null;
  frame_attempt_id?: string | null;
  call_id?: string | null;
  parent_key?: string | null;
  parent_edge?: string | null;
  graph_function?: string | null;
  materialization_id?: string | null;
  rebound?: boolean;
  stack_depth?: number;
  checkpoint_id?: string | null;
  suspended?: boolean;
  child_steps?: Array<{
    child_key: string;
    edge: string;
    target: string;
    status: string;
  }>;
  event_count: number;
};

export type RecentEventView = {
  event_id: string | null;
  event_time: string | null;
  event_type: string | null;
  aggregate_type: string | null;
  aggregate_id: string | null;
  run_id: string | null;
  call_id: string | null;
  continuation_id: string | null;
  frame_id: string | null;
};

export type RuntimeProjection = {
  runs: RuntimeRunView[];
  graph_calls: GraphCallView[];
  continuations: ContinuationView[];
  frames: FrameView[];
  recent_events: RecentEventView[];
  event_count: number;
  latest_event_time: string | null;
};

export type SessionServiceRunView = {
  run_id: string;
  status: string;
  graph_function: string | null;
  module: string | null;
  edge: string | null;
  blocking_reason: string | null;
  selected_worker: string | null;
  updated_at: string | null;
};

export type SessionServiceWorkerView = {
  name: string;
  agent: string | null;
  transport: string | null;
  status: string | null;
  remote_host: string | null;
  history_bytes: number | null;
  last_activity_at: string | null;
};

export type SessionServiceState = {
  configured: boolean;
  available: boolean;
  base_url: string | null;
  observed_at: string | null;
  error: string | null;
  runs: SessionServiceRunView[];
  workers: SessionServiceWorkerView[];
};

export type DomainProjection = {
  workspace_root: string;
  query_contract: QueryContractView;
  semantic_facets: SemanticFacet[];
  asset_types: AssetTypeProfile[];
  asset_families: AssetFamilyView[];
  assets: AssetView[];
  requirements: RequirementView[];
  tickets: TicketView[];
  comments: CommentView[];
  ambiguity_register: AmbiguityRegisterView;
  collections: CollectionView[];
  bindings: BindingView[];
  functions: FunctionView[];
  edge_contracts: EdgeContractView[];
  programs: ProgramView[];
  work_act_types: WorkActTypeView[];
  jobs: JobView[];
  graph_functions: GraphFunctionView[];
  workorders: WorkOrderView[];
  gaps: {
    converged: boolean;
    gaps: GapView[];
    jobs_considered: number;
    open_frames: number;
    total_delta: number;
  };
};

export type ManagerWorld = {
  workspace_root: string;
  generated_at: string;
  boundary: BoundaryInfo;
  overview: Overview;
  graph_set: GraphSetView;
  domain: DomainProjection;
  runtime: RuntimeProjection;
};

export type CommandResult = Record<string, unknown>;

export type SurfaceEntry = {
  name: string;
  kind: "file" | "directory";
  relative_path: string;
};

export type SurfaceData =
  | {
      kind: "file";
      relative_path: string;
      path: string;
      content: string;
    }
  | {
      kind: "directory";
      relative_path: string;
      path: string;
      entries: SurfaceEntry[];
      truncated: boolean;
    }
  | {
      kind: "missing";
      relative_path: string;
      path: string;
    };

export type Selection =
  | { kind: "requirement"; id: string }
  | { kind: "surface"; id: string }
  | { kind: "asset"; id: string }
  | { kind: "asset_family"; id: string }
  | { kind: "binding"; id: string }
  | { kind: "collection"; id: string }
  | { kind: "ambiguity"; id: string }
  | { kind: "edge_contract"; id: string }
  | { kind: "function"; id: string }
  | { kind: "program"; id: string }
  | { kind: "workorder"; id: string }
  | { kind: "work_act_type"; id: string }
  | { kind: "graph_function"; id: string }
  | { kind: "run"; id: string }
  | { kind: "graph_call"; id: string }
  | { kind: "continuation"; id: string }
  | { kind: "frame"; id: string }
  | { kind: "event"; id: string }
  | { kind: "graph"; id: string };
