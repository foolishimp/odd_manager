export type ThemeMode = "light" | "dark";
export type NavigatorMode = "compressed" | "expanded";
export type PageId =
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
  mutable_default: boolean;
  proof_hints: string[];
  closure_hints: string[];
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

export type BindingView = {
  node: string;
  asset_ids: string[];
};

export type GapView = {
  edge: string;
  delta: number;
  delta_summary: string;
  failing: string[];
  passing: string[];
};

export type WorkOrderView = {
  id: string;
  label: string;
  status: Tone;
  intent: string;
  inputs: string[];
  outputs: string[];
  graph_function_id: string;
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
  kind: "asset_node" | "workorder";
  status: Tone;
  description: string;
  subtitle: string;
  asset_ids: string[];
  ref_kind: "asset" | "workorder" | "binding";
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

export type DomainProjection = {
  workspace_root: string;
  semantic_facets: SemanticFacet[];
  asset_types: AssetTypeProfile[];
  assets: AssetView[];
  bindings: BindingView[];
  functions: Array<{
    name: string;
    intent: string;
    inputs: string[];
    outputs: string[];
    backing_graph_function: string;
  }>;
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
  | { kind: "asset"; id: string }
  | { kind: "binding"; id: string }
  | { kind: "workorder"; id: string }
  | { kind: "run"; id: string }
  | { kind: "graph_call"; id: string }
  | { kind: "continuation"; id: string }
  | { kind: "frame"; id: string }
  | { kind: "event"; id: string }
  | { kind: "graph"; id: string };

