import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { WidgetFrame } from "../../components/WidgetFrame";
import { GraphWorkspace } from "../graphs/GraphWorkspace";
import { InspectorPanel } from "../inspector/InspectorPanel";
import {
  describeCanonicalTerm,
  labelDeliveryStatus,
  labelSelectionKind,
} from "../../lib/presentation";
import type {
  AmbiguityEntryView,
  AssetView,
  BindingView,
  CommandName,
  CommentView,
  FunctionView,
  GraphNodeView,
  GraphView,
  ManagerWorld,
  NavigatorMode,
  RequirementView,
  RuntimeRunView,
  Selection,
  TicketView,
  Tone,
  WorkOrderView,
} from "../../lib/types";

type ProcessWorkspaceProps = {
  world: ManagerWorld;
  selection: Selection | null;
  selectedNodeId: string | null;
  navigatorMode: NavigatorMode;
  onChangeNavigatorMode: (mode: NavigatorMode) => void;
  onSelectNode: (node: GraphNodeView) => void;
  onSelectSelection: (selection: Selection) => void;
  runningCommand: CommandName | null;
  onRefresh: () => void;
  onIterate: () => void;
  onStartAuto: () => void;
};

type ProcessFilter = {
  id:
    | "observed_surfaces"
    | "active_work"
    | "blocked"
    | "ready_handoff"
    | "recent_failures"
    | "recent_activity"
    | "tests";
  label: string;
  tone: Tone;
  description: string;
  matches: (record: ProcessRecord) => boolean;
};

type ProcessRecord = {
  key: string;
  selection: Selection;
  recordClass: "observed_surface" | "workflow_step" | "work_order" | "blocker" | "run";
  eyebrow: string;
  tone: Tone;
  title: string;
  summary: string;
  queryText: string;
  runtimeCount: number;
  inputCount: number;
  outputCount: number;
  requirementCount: number;
  hasFailure: boolean;
  testRelevant: boolean;
};

type ProcessContext = {
  key: string;
  selection: Selection;
  eyebrow: string;
  title: string;
  summary: string;
  tone: Tone;
  category: string;
  nextAction: string;
  inputTitle: string;
  inputs: string[];
  outputTitle: string;
  outputs: string[];
  requirementIds: string[];
  governingRefs: string[];
  implementationRefs: string[];
  testRefs: string[];
  moduleAreas: string[];
  tickets: TicketView[];
  comments: CommentView[];
  ambiguities: AmbiguityEntryView[];
  runs: RuntimeRunView[];
  callIds: string[];
  continuationIds: string[];
  gapSummary: string | null;
};

type TrackedProcessLens = {
  id: "accounting_ledger" | "transformation_provenance";
  title: string;
  summary: string;
  primaryRequirementId: string;
  relatedRequirementIds: string[];
  governingAssetIds: string[];
  outputAssetIds: string[];
};

type ProcessBuilderLens = "now" | "blocked" | "done" | "map";

type ProcessStageId =
  | "bootstrap"
  | "design"
  | "scenarios"
  | "build"
  | "test"
  | "release"
  | "runtime";

type ProcessLaneId = "upstream" | "in_flight" | "carried" | "blocked" | "handoff";

const PROCESS_EXPLORER_LIST_ID = "process-explorer-list";

const OBSERVED_PROCESS_ASSET_TYPES = new Set([
  "ambiguity_register_surface",
  "requirement_closure_register_surface",
  "requirement_surface",
  "feature_decomp_surface",
  "uat_testcases_surface",
  "design_surface",
  "review_assessment_surface",
  "consensus_decision_surface",
  "reviewed_design_surface",
  "testcase_authority_surface",
  "scenario_surface",
  "implementation_design_surface",
  "implementation_stack_profile",
  "implementation_module_surface",
  "test_design_surface",
  "test_stack_profile",
  "test_module_surface",
  "test_run_archive_surface",
  "release_surface",
  "work_request_surface",
  "operational_evidence_surface",
  "deployment_record_surface",
  "runtime_observation_surface",
  "maintenance_plan_surface",
]);

const PREFERRED_PROCESS_RECORD_KEYS = [
  "requirement:REQ-ACC-002",
  "requirement:REQ-TRV-005",
  "asset:requirement_surface",
  "asset:testcase_authority_surface",
  "asset:design_surface",
  "asset:scenario_surface",
  "asset:implementation_design_surface",
  "asset:test_design_surface",
  "asset:test_run_archive_surface",
  "asset:release_surface",
  "asset:runtime_observation_surface",
];

const TRACKED_PROCESS_LENSES: TrackedProcessLens[] = [
  {
    id: "accounting_ledger",
    title: "Accounting Ledger",
    summary: "Track ledger output, accounting invariants, and run completion gates across edge traversal.",
    primaryRequirementId: "REQ-ACC-002",
    relatedRequirementIds: ["REQ-ACC-001", "REQ-ACC-004", "REQ-ENG-004"],
    governingAssetIds: ["requirement_surface", "testcase_authority_surface"],
    outputAssetIds: ["test_run_archive_surface", "release_surface"],
  },
  {
    id: "transformation_provenance",
    title: "Transformation Provenance",
    summary: "Track run manifest, lineage, and audit traceability through transformation and replay.",
    primaryRequirementId: "REQ-TRV-005",
    relatedRequirementIds: ["REQ-TRV-005-A", "REQ-TRV-005-B", "REQ-INT-003"],
    governingAssetIds: ["requirement_surface", "design_surface", "scenario_surface"],
    outputAssetIds: ["test_run_archive_surface", "runtime_observation_surface", "release_surface"],
  },
];

const PROCESS_STAGE_DEFINITIONS: Array<{
  id: ProcessStageId;
  number: string;
  label: string;
  summary: string;
  keywords: string[];
}> = [
  {
    id: "bootstrap",
    number: "01",
    label: "Bootstrap",
    summary: "intent, product, goals, requirements",
    keywords: ["bootstrap", "intent", "product", "goal", "requirement", "ambiguity_register", "closure"],
  },
  {
    id: "design",
    number: "02",
    label: "Design",
    summary: "features, review, consensus",
    keywords: ["design", "feature", "review", "consensus", "decomp"],
  },
  {
    id: "scenarios",
    number: "03",
    label: "Scenarios",
    summary: "uat, scenarios, testcase authority",
    keywords: ["scenario", "uat", "testcase_authority", "acceptance"],
  },
  {
    id: "build",
    number: "04",
    label: "Build",
    summary: "implementation design and modules",
    keywords: ["build", "implementation", "impl", "module", "stack", "code"],
  },
  {
    id: "test",
    number: "05",
    label: "Test",
    summary: "proof, test modules, run archive",
    keywords: ["test", "qualification", "proof", "archive"],
  },
  {
    id: "release",
    number: "06",
    label: "Release",
    summary: "release and deployment records",
    keywords: ["release", "deployment", "handoff"],
  },
  {
    id: "runtime",
    number: "07",
    label: "Runtime",
    summary: "runs, continuations, observations",
    keywords: ["runtime", "run", "continuation", "observation", "operational", "maintenance"],
  },
];

const PROCESS_BUILDER_LENSES: Array<{
  id: ProcessBuilderLens;
  label: string;
  summary: string;
}> = [
  { id: "now", label: "Now", summary: "Current movable work in the selected pipeline stage." },
  { id: "blocked", label: "Blocked", summary: "Fail-closed, hard-stop, or intervention-bearing process objects." },
  { id: "done", label: "Done", summary: "Converged or handoff-ready process objects." },
  { id: "map", label: "Map", summary: "The existing process graph remains available as a direct map lens." },
];

const PROCESS_LANE_DEFINITIONS: Array<{
  id: ProcessLaneId;
  label: string;
  summary: string;
}> = [
  { id: "upstream", label: "Upstream Inputs", summary: "Settled carriers feeding the selected stage." },
  { id: "in_flight", label: "In Flight", summary: "Active, pending, or currently moving process objects." },
  { id: "carried", label: "Carried", summary: "Attention or gated items that are carried forward." },
  { id: "blocked", label: "Blocked", summary: "Fail-closed or hard-stop conditions." },
  { id: "handoff", label: "Handoff Ready", summary: "Produced outputs that can move to the next lane." },
];

const PROCESS_FILTERS: ProcessFilter[] = [
  {
    id: "observed_surfaces",
    label: "Observed SDLC Surfaces",
    tone: "active",
    description: "Generated odd_sdlc requirement, design, qualification, execution, release, and runtime surfaces published by the selected workspace.",
    matches: (record) => record.recordClass === "observed_surface",
  },
  {
    id: "active_work",
    label: "Active Work",
    tone: "active",
    description: "Workflow steps, workorders, and runs that are currently moving through the technical lane.",
    matches: (record) =>
      record.recordClass !== "blocker" &&
      (record.tone === "active" || record.tone === "pending" || record.tone === "gated"),
  },
  {
    id: "blocked",
    label: "Blocked / Waiting",
    tone: "blocked",
    description: "Blockers, fail-closed steps, and waiting runtime state requiring intervention.",
    matches: (record) => record.tone === "blocked" || record.selection.kind === "ambiguity",
  },
  {
    id: "ready_handoff",
    label: "Ready for Handoff",
    tone: "converged",
    description: "Process objects that already expose downstream outputs or produced artifacts.",
    matches: (record) =>
      record.outputCount > 0 && (record.tone === "converged" || record.tone === "active"),
  },
  {
    id: "recent_failures",
    label: "Recent Failures",
    tone: "blocked",
    description: "Recent failing runs and fail-closed technical process records.",
    matches: (record) => record.hasFailure || (record.selection.kind === "run" && record.tone === "blocked"),
  },
  {
    id: "recent_activity",
    label: "Recent Activity",
    tone: "active",
    description: "Technical process records with current runtime activity, calls, or work-order movement.",
    matches: (record) => record.runtimeCount > 0,
  },
  {
    id: "tests",
    label: "Tests / Qualification",
    tone: "pending",
    description: "Process records carrying explicit test, qualification, or proving relevance.",
    matches: (record) => record.testRelevant,
  },
];

export function ProcessWorkspace({
  world,
  selection,
  selectedNodeId,
  navigatorMode,
  onChangeNavigatorMode,
  onSelectNode,
  onSelectSelection,
  runningCommand,
  onRefresh,
  onIterate,
  onStartAuto,
}: ProcessWorkspaceProps) {
  const graphs = world.graph_set.graphs;
  const processGraph =
    graphs.find((graph) => graph.id === "graph.bootstrap") ??
    graphs[0] ??
    null;
  const processRecords = useMemo(() => buildProcessRecords(world), [world]);
  const [search, setSearch] = useState("");
  const [activeFilterId, setActiveFilterId] = useState<ProcessFilter["id"]>("observed_surfaces");
  const [focusedProcessKey, setFocusedProcessKey] = useState<string | null>(null);
  const [explorerFocusToken, setExplorerFocusToken] = useState(0);
  const [selectedProcessGraphId, setSelectedProcessGraphId] = useState<string>(
    processGraph?.id ?? "",
  );

  const selectedProcessSelection =
    selection && isProcessPrimarySelection(world, selection) ? selection : null;

  useEffect(() => {
    if (selectedProcessSelection) {
      setFocusedProcessKey(selectionKey(selectedProcessSelection));
    }
  }, [selectedProcessSelection]);

  useEffect(() => {
    if (!processGraph) {
      return;
    }
    setSelectedProcessGraphId((current) =>
      graphs.some((graph) => graph.id === current) ? current : processGraph.id,
    );
  }, [graphs, processGraph]);

  const activeFilter =
    PROCESS_FILTERS.find((filter) => filter.id === activeFilterId) ?? PROCESS_FILTERS[0];
  const visibleRecords = useMemo(
    () =>
      processRecords.filter(
        (record) =>
          activeFilter.matches(record) && record.queryText.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [activeFilter, processRecords, search],
  );
  const preferredVisibleRecord = useMemo(
    () => pickDefaultProcessRecord(visibleRecords) ?? visibleRecords[0] ?? null,
    [visibleRecords],
  );

  useEffect(() => {
    if (selectedProcessSelection) {
      return;
    }
    if (!focusedProcessKey && preferredVisibleRecord) {
      setFocusedProcessKey(preferredVisibleRecord.key);
      return;
    }
    if (
      focusedProcessKey &&
      visibleRecords.length &&
      !visibleRecords.some((record) => record.key === focusedProcessKey)
    ) {
      setFocusedProcessKey(preferredVisibleRecord?.key ?? visibleRecords[0].key);
    }
  }, [focusedProcessKey, preferredVisibleRecord, selectedProcessSelection, visibleRecords]);

  const focusedSelection =
    selectedProcessSelection ??
    processRecords.find((record) => record.key === focusedProcessKey)?.selection ??
    preferredVisibleRecord?.selection ??
    processRecords[0]?.selection ??
    null;
  const focusedContext = focusedSelection ? resolveProcessContext(world, focusedSelection) : null;
  const focusedRecord =
    focusedContext && processRecords.find((record) => record.key === focusedContext.key)
      ? processRecords.find((record) => record.key === focusedContext.key) ?? null
      : focusedContext
        ? contextToRecord(focusedContext)
        : null;
  const drilldownSelection =
    selection &&
    focusedSelection &&
    selectionKey(selection) !== selectionKey(focusedSelection) &&
    !isProcessPrimarySelection(world, selection)
      ? selection
      : null;
  const processMap = (
    <GraphWorkspace
      graphs={graphs}
      selectedGraphId={selectedProcessGraphId}
      onSelectGraph={setSelectedProcessGraphId}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      mode={navigatorMode}
      onChangeMode={onChangeNavigatorMode}
      runningCommand={runningCommand}
      onRefresh={onRefresh}
      onIterate={onIterate}
      onStartAuto={onStartAuto}
      showOverviewSections={false}
      detailPane={
        <div className="graph-detail-stack">
          <InspectorPanel
            world={world}
            selection={selection ?? { kind: "graph", id: selectedProcessGraphId }}
            selectedGraphId={selectedProcessGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      }
    />
  );

  const focusExplorer = () => {
    setExplorerFocusToken((current) => current + 1);
  };

  if (!processGraph) {
    return (
      <div className="workspace-view process-page">
        <section className="panel panel--context">
          <div className="empty-state">
            <strong>No process graph is projected.</strong>
            <p>The current workspace did not publish a process-flow map.</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="workspace-view process-page">
      <div className="workspace-stack process-page__main">
        <ProcessNavigatorWidget
          allRecords={processRecords}
          records={visibleRecords}
          activeFilter={activeFilter}
          search={search}
          focusToken={explorerFocusToken}
          focusedRecord={focusedRecord}
          onSelectFilter={(filterId) => {
            setActiveFilterId(filterId);
            focusExplorer();
          }}
          onSearchChange={setSearch}
          onClearFilter={() => {
            setActiveFilterId("observed_surfaces");
            focusExplorer();
          }}
          onClearSearch={() => {
            setSearch("");
            focusExplorer();
          }}
          onSelectRecord={(nextSelection) => {
            setFocusedProcessKey(selectionKey(nextSelection));
            onSelectSelection(nextSelection);
          }}
          map={processMap}
        >
          <ProcessWorkbench
            world={world}
            context={focusedContext}
            drilldownSelection={drilldownSelection}
            selectedGraphId={selectedProcessGraphId}
            onSelectSelection={onSelectSelection}
          />
        </ProcessNavigatorWidget>
      </div>
    </div>
  );
}

export function ProcessKanbanWorkspace({
  world,
  selection,
  selectedNodeId,
  navigatorMode,
  onChangeNavigatorMode,
  onSelectNode,
  onSelectSelection,
  runningCommand,
  onRefresh,
  onIterate,
  onStartAuto,
}: ProcessWorkspaceProps) {
  const graphs = world.graph_set.graphs;
  const processGraph =
    graphs.find((graph) => graph.id === "graph.bootstrap") ??
    graphs[0] ??
    null;
  const processRecords = useMemo(() => buildProcessRecords(world), [world]);
  const [focusedProcessKey, setFocusedProcessKey] = useState<string | null>(null);
  const [selectedProcessGraphId, setSelectedProcessGraphId] = useState<string>(
    processGraph?.id ?? "",
  );
  const [builderLens, setBuilderLens] = useState<ProcessBuilderLens>("now");
  const [activeBuilderStageId, setActiveBuilderStageId] = useState<ProcessStageId>("scenarios");

  const selectedProcessSelection =
    selection && isProcessPrimarySelection(world, selection) ? selection : null;

  useEffect(() => {
    if (selectedProcessSelection) {
      setFocusedProcessKey(selectionKey(selectedProcessSelection));
    }
  }, [selectedProcessSelection]);

  useEffect(() => {
    if (!processGraph) {
      return;
    }
    setSelectedProcessGraphId((current) =>
      graphs.some((graph) => graph.id === current) ? current : processGraph.id,
    );
  }, [graphs, processGraph]);

  const preferredRecord = pickDefaultProcessRecord(processRecords) ?? processRecords[0] ?? null;
  const focusedSelection =
    selectedProcessSelection ??
    processRecords.find((record) => record.key === focusedProcessKey)?.selection ??
    preferredRecord?.selection ??
    null;
  const focusedContext = focusedSelection ? resolveProcessContext(world, focusedSelection) : null;
  const focusedRecord =
    focusedContext && processRecords.find((record) => record.key === focusedContext.key)
      ? processRecords.find((record) => record.key === focusedContext.key) ?? null
      : focusedContext
        ? contextToRecord(focusedContext)
        : preferredRecord;

  if (!processGraph) {
    return (
      <div className="workspace-view process-page">
        <section className="panel panel--context">
          <div className="empty-state">
            <strong>No process graph is projected.</strong>
            <p>The current workspace did not publish a process-flow map for the Kanban View.</p>
          </div>
        </section>
      </div>
    );
  }

  const processMap = (
    <GraphWorkspace
      graphs={graphs}
      selectedGraphId={selectedProcessGraphId}
      onSelectGraph={setSelectedProcessGraphId}
      selectedNodeId={selectedNodeId}
      onSelectNode={onSelectNode}
      mode={navigatorMode}
      onChangeMode={onChangeNavigatorMode}
      runningCommand={runningCommand}
      onRefresh={onRefresh}
      onIterate={onIterate}
      onStartAuto={onStartAuto}
      showOverviewSections={false}
      detailPane={
        <div className="graph-detail-stack">
          <InspectorPanel
            world={world}
            selection={selection ?? { kind: "graph", id: selectedProcessGraphId }}
            selectedGraphId={selectedProcessGraphId}
            onSelectSelection={onSelectSelection}
          />
        </div>
      }
    />
  );

  return (
    <div className="workspace-view process-page">
      <ProcessBuilderView
        world={world}
        records={processRecords}
        focusedRecord={focusedRecord}
        focusedContext={focusedContext}
        activeStageId={activeBuilderStageId}
        lens={builderLens}
        map={processMap}
        onChangeStage={setActiveBuilderStageId}
        onChangeLens={setBuilderLens}
        onSelectRecord={(nextSelection) => {
          setFocusedProcessKey(selectionKey(nextSelection));
          onSelectSelection(nextSelection);
        }}
        onSelectSelection={onSelectSelection}
      />
    </div>
  );
}

function ProcessBuilderView({
  world,
  records,
  focusedRecord,
  focusedContext,
  activeStageId,
  lens,
  map,
  onChangeStage,
  onChangeLens,
  onSelectRecord,
  onSelectSelection,
}: {
  world: ManagerWorld;
  records: ProcessRecord[];
  focusedRecord: ProcessRecord | null;
  focusedContext: ProcessContext | null;
  activeStageId: ProcessStageId;
  lens: ProcessBuilderLens;
  map: ReactNode;
  onChangeStage: (stageId: ProcessStageId) => void;
  onChangeLens: (lens: ProcessBuilderLens) => void;
  onSelectRecord: (selection: Selection) => void;
  onSelectSelection: (selection: Selection) => void;
}) {
  const stageStats = useMemo(() => buildProcessStageStats(records), [records]);
  const fallbackStageId = useMemo(() => pickDefaultBuilderStage(records), [records]);
  const activeStageHasRecords = stageStats.some((stage) => stage.id === activeStageId && stage.count > 0);
  const effectiveStageId = activeStageHasRecords ? activeStageId : fallbackStageId;

  useEffect(() => {
    if (!activeStageHasRecords && activeStageId !== fallbackStageId) {
      onChangeStage(fallbackStageId);
    }
  }, [activeStageHasRecords, activeStageId, fallbackStageId, onChangeStage]);

  const lensRecords = useMemo(
    () => filterProcessRecordsForBuilderLens(records, lens, effectiveStageId),
    [effectiveStageId, lens, records],
  );
  const laneGroups = useMemo(() => groupProcessRecordsByLane(lensRecords), [lensRecords]);
  const fallbackRecord = focusedRecord ?? lensRecords[0] ?? records[0] ?? null;
  const displayContext =
    focusedContext ??
    (fallbackRecord ? resolveProcessContext(world, fallbackRecord.selection) : null);
  const displayRecord =
    displayContext && records.find((record) => record.key === displayContext.key)
      ? records.find((record) => record.key === displayContext.key) ?? null
      : fallbackRecord;
  const activeStage = PROCESS_STAGE_DEFINITIONS.find((stage) => stage.id === effectiveStageId);
  const workspaceName = workspaceDisplayName(world.workspace_root);
  const domainLabel = labelWorkspacePack(world.workspace_profile.active_domain_pack);

  return (
    <div className="workspace-stack process-page__main">
      <section className="process-builder">
        <header className="process-builder__header">
          <div>
            <span className="panel__eyebrow">Kanban View</span>
            <h2>{workspaceName}</h2>
            <p>
              A board-oriented view over the same live projection: pipeline stage, state lens,
              movable cards, and focused process-object detail.
            </p>
          </div>
          <div className="process-builder__identity">
            <span>{domainLabel}</span>
            <strong>{world.workspace_profile.primary_identity}</strong>
            <small>{records.length} process records projected</small>
          </div>
        </header>

        <div className="process-builder__spine" role="tablist" aria-label="Pipeline stages">
          {stageStats.map((stage) => (
            <button
              key={stage.id}
              type="button"
              role="tab"
              aria-selected={stage.id === effectiveStageId}
              className={`process-builder-stage process-builder-stage--${stage.tone} ${
                stage.id === effectiveStageId ? "is-active" : ""
              }`}
              onClick={() => onChangeStage(stage.id)}
            >
              <span>Stage {stage.number}</span>
              <strong>{stage.label}</strong>
              <small>{stage.summary}</small>
              <em>
                {stage.count ? `${stage.count} object${stage.count === 1 ? "" : "s"}` : "not projected"}
              </em>
            </button>
          ))}
        </div>

        <div className="process-builder__lensbar">
          <div>
            <span className="panel__eyebrow">Lens</span>
            <strong>{activeStage?.label ?? "Pipeline"} · {PROCESS_BUILDER_LENSES.find((item) => item.id === lens)?.label}</strong>
          </div>
          <div className="process-builder__lenses" role="tablist" aria-label="Process state lenses">
            {PROCESS_BUILDER_LENSES.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={item.id === lens}
                className={`process-builder-lens ${item.id === lens ? "is-active" : ""}`}
                onClick={() => onChangeLens(item.id)}
                title={item.summary}
              >
                {item.label}
                <span>{countProcessBuilderLensRecords(records, item.id, effectiveStageId)}</span>
              </button>
            ))}
          </div>
        </div>

        {lens === "map" ? (
          <div className="process-builder__map-layout">
            <div className="process-builder__map">{map}</div>
            <ProcessBuilderFocusPanel
              context={displayContext}
              record={displayRecord}
              world={world}
              onSelectSelection={onSelectSelection}
            />
          </div>
        ) : (
          <div className="process-builder__body">
            <ProcessBuilderBoard
              laneGroups={laneGroups}
              focusedRecord={displayRecord}
              onSelectRecord={onSelectRecord}
            />
            <ProcessBuilderFocusPanel
              context={displayContext}
              record={displayRecord}
              world={world}
              onSelectSelection={onSelectSelection}
            />
          </div>
        )}
      </section>
    </div>
  );
}

function ProcessBuilderBoard({
  laneGroups,
  focusedRecord,
  onSelectRecord,
}: {
  laneGroups: Map<ProcessLaneId, ProcessRecord[]>;
  focusedRecord: ProcessRecord | null;
  onSelectRecord: (selection: Selection) => void;
}) {
  return (
    <div className="process-builder-board">
      {PROCESS_LANE_DEFINITIONS.map((lane) => {
        const laneRecords = laneGroups.get(lane.id) ?? [];
        return (
          <section key={lane.id} className={`process-builder-lane process-builder-lane--${lane.id}`}>
            <div className="process-builder-lane__header">
              <div>
                <strong>{lane.label}</strong>
                <p>{lane.summary}</p>
              </div>
              <span>{laneRecords.length}</span>
            </div>
            <div className="process-builder-lane__cards">
              {laneRecords.length ? (
                laneRecords.slice(0, 8).map((record) => (
                  <button
                    key={record.key}
                    type="button"
                    className={`process-builder-card process-builder-card--${record.tone} ${
                      focusedRecord?.key === record.key ? "is-selected" : ""
                    }`}
                    onClick={() => onSelectRecord(record.selection)}
                  >
                    <span className="panel__eyebrow">{record.eyebrow}</span>
                    <strong>{record.title}</strong>
                    <p>{record.summary}</p>
                    <div className="process-builder-card__meta">
                      <span>{record.inputCount}/{record.outputCount} io</span>
                      <span>{record.requirementCount} req</span>
                      {record.runtimeCount ? <span>{record.runtimeCount} runtime</span> : null}
                    </div>
                  </button>
                ))
              ) : (
                <div className="process-builder-lane__empty">No records in this lane for the active lens.</div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function ProcessBuilderFocusPanel({
  context,
  record,
  world,
  onSelectSelection,
}: {
  context: ProcessContext | null;
  record: ProcessRecord | null;
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!context) {
    return (
      <aside className="process-builder-focus">
        <div className="empty-state">
          <strong>No process object is focused.</strong>
          <p>Select a card or map object to populate this panel.</p>
        </div>
      </aside>
    );
  }

  const stage = PROCESS_STAGE_DEFINITIONS.find((item) => item.id === processStageForRecord(record ?? contextToRecord(context)));
  const deliveryRecords = buildActivityItems(context.tickets, context.comments);

  return (
    <aside className="process-builder-focus">
      <div className="process-builder-focus__crumb">
        <span>{stage?.label ?? "Process"}</span>
        <span>{context.category}</span>
        <span className={`status-chip ${context.tone}`}>{context.tone}</span>
      </div>
      <h3>{context.title}</h3>
      <p className="process-builder-focus__summary">{context.summary}</p>

      <div className="process-builder-focus__metrics">
        <div>
          <span>{context.inputTitle}</span>
          <strong>{context.inputs.length}</strong>
        </div>
        <div>
          <span>{context.outputTitle}</span>
          <strong>{context.outputs.length}</strong>
        </div>
        <div>
          <span>Requirements</span>
          <strong>{context.requirementIds.length}</strong>
        </div>
        <div>
          <span>Runtime</span>
          <strong>{context.runs.length + context.callIds.length + context.continuationIds.length}</strong>
        </div>
      </div>

      <section className="process-builder-focus__section process-builder-focus__section--action">
        <span className="panel__eyebrow">Next Lawful Action</span>
        <strong>{context.nextAction}</strong>
      </section>

      <ProcessBuilderReferenceGroup
        title={context.inputTitle}
        items={context.inputs}
        world={world}
        onSelectSelection={onSelectSelection}
      />
      <ProcessBuilderReferenceGroup
        title={context.outputTitle}
        items={context.outputs}
        world={world}
        onSelectSelection={onSelectSelection}
      />
      <ProcessBuilderReferenceGroup
        title="Requirement Impact"
        items={context.requirementIds}
        world={world}
        onSelectSelection={onSelectSelection}
      />
      <ProcessBuilderReferenceGroup
        title="Governing Context"
        items={context.governingRefs}
        world={world}
        onSelectSelection={onSelectSelection}
        collapsedAfter={6}
      />

      {context.ambiguities.length || context.gapSummary ? (
        <section className="process-builder-focus__section process-builder-focus__section--blocked">
          <span className="panel__eyebrow">Open Blockers</span>
          {context.gapSummary ? <strong>{context.gapSummary}</strong> : null}
          {context.ambiguities.slice(0, 3).map((entry) => (
            <button
              key={entry.ambiguity_id}
              type="button"
              className="process-builder-blocker"
              onClick={() => onSelectSelection({ kind: "ambiguity", id: entry.ambiguity_id })}
            >
              <strong>{entry.ambiguity_id}</strong>
              <span>{entry.next_lawful_action || entry.operator_headline}</span>
            </button>
          ))}
        </section>
      ) : null}

      {context.runs.length ? (
        <section className="process-builder-focus__section">
          <span className="panel__eyebrow">Latest Execution</span>
          {context.runs.slice(0, 3).map((run) => (
            <button
              key={run.instance_id}
              type="button"
              className="process-builder-run"
              onClick={() => onSelectSelection({ kind: "run", id: run.instance_id })}
            >
              <strong>{run.run_id ?? run.instance_id}</strong>
              <span>{[run.status, run.edge, run.failure_class].filter(Boolean).join(" · ")}</span>
            </button>
          ))}
        </section>
      ) : null}

      {deliveryRecords.length ? (
        <section className="process-builder-focus__section">
          <span className="panel__eyebrow">Delivery Records</span>
          {deliveryRecords.slice(0, 3).map((item) => (
            <button
              key={item.id}
              type="button"
              className="process-builder-run"
              onClick={() => onSelectSelection({ kind: "surface", id: item.sourcePath })}
            >
              <strong>{item.title}</strong>
              <span>{item.summary}</span>
            </button>
          ))}
        </section>
      ) : null}
    </aside>
  );
}

function ProcessBuilderReferenceGroup({
  title,
  items,
  world,
  onSelectSelection,
  collapsedAfter = 5,
}: {
  title: string;
  items: string[];
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
  collapsedAfter?: number;
}) {
  const visibleItems = items.slice(0, collapsedAfter);
  if (!items.length) {
    return null;
  }
  return (
    <section className="process-builder-focus__section">
      <span className="panel__eyebrow">{title}</span>
      <div className="process-builder-ref-list">
        {visibleItems.map((item) => {
          const nextSelection = selectionForProcessReference(item, world);
          return nextSelection ? (
            <button key={`${title}:${item}`} type="button" onClick={() => onSelectSelection(nextSelection)}>
              {item}
            </button>
          ) : (
            <span key={`${title}:${item}`}>{item}</span>
          );
        })}
        {items.length > visibleItems.length ? <span>+ {items.length - visibleItems.length} more</span> : null}
      </div>
    </section>
  );
}

function ProcessNavigatorWidget({
  allRecords,
  records,
  activeFilter,
  search,
  focusToken,
  focusedRecord,
  onSelectFilter,
  onSearchChange,
  onClearFilter,
  onClearSearch,
  onSelectRecord,
  map,
  children,
}: {
  allRecords: ProcessRecord[];
  records: ProcessRecord[];
  activeFilter: ProcessFilter;
  search: string;
  focusToken: number;
  focusedRecord: ProcessRecord | null;
  onSelectFilter: (filterId: ProcessFilter["id"]) => void;
  onSearchChange: (value: string) => void;
  onClearFilter: () => void;
  onClearSearch: () => void;
  onSelectRecord: (selection: Selection) => void;
  map: ReactNode;
  children: ReactNode;
}) {
  const activeQueryRef = useRef<HTMLDivElement | null>(null);
  const normalizedSearch = search.trim();

  useEffect(() => {
    if (focusToken === 0) {
      return;
    }
    activeQueryRef.current?.scrollIntoView({ block: "nearest" });
    activeQueryRef.current?.focus();
  }, [focusToken]);

  const querySummary = describeProcessQuery({
    activeFilter,
    focusedRecord,
    visibleCount: records.length,
    totalCount: allRecords.length,
    search: normalizedSearch,
  });

  return (
    <WidgetFrame
      eyebrow="Process Navigator"
      title="Saved views govern the technical process lane below."
      summary="This navigator owns the process flow map, active query, explorer, and process workbench because they operate over the same technical execution lane."
      badge={
        <span className="status-chip active">
          {records.length} of {allRecords.length}
        </span>
      }
    >
      <div className="process-navigator">
        <div className="process-map-host">{map}</div>

        <div className="process-navigator__views">
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">Saved Views</span>
            <p>These views scope the technical process lane for the explorer and workbench.</p>
          </div>
          <div className="process-tab-grid" role="tablist" aria-label="Process views">
            {PROCESS_FILTERS.map((filter) => {
              const count = allRecords.filter(filter.matches).length;
              const isSelected = activeFilter.id === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  aria-controls={PROCESS_EXPLORER_LIST_ID}
                  className={`process-tab ${isSelected ? "is-selected" : ""}`}
                  onClick={() => onSelectFilter(filter.id)}
                >
                  <div className="process-tab__meta">
                    <strong>{filter.label}</strong>
                    <span className={`status-chip ${filter.tone}`}>{count}</span>
                  </div>
                  <p>{filter.description}</p>
                </button>
              );
            })}
          </div>
        </div>

        <div
          ref={activeQueryRef}
          tabIndex={-1}
          className="process-explorer__query"
          aria-live="polite"
        >
          <div className="process-explorer__query-heading">
            <span className="panel__eyebrow">Active Query</span>
            <span className={`status-chip ${activeFilter.tone}`}>{activeFilter.label}</span>
          </div>
          <strong>{querySummary.headline}</strong>
          <p>{querySummary.summary}</p>
          <div className="inline-pills">
            {normalizedSearch ? (
              <span className="status-chip attention">Search: {normalizedSearch}</span>
            ) : null}
            {focusedRecord ? (
              <span className={`status-chip ${focusedRecord.tone}`}>
                Focused: {focusedRecord.title}
              </span>
            ) : null}
            {activeFilter.id !== "observed_surfaces" ? (
              <button type="button" className="status-chip converged" onClick={onClearFilter}>
                Clear Filter
              </button>
            ) : null}
            {normalizedSearch ? (
              <button type="button" className="status-chip converged" onClick={onClearSearch}>
                Clear Search
              </button>
            ) : null}
          </div>
        </div>

        <div className="process-page__lens">
          <div className="process-page__explorer">
            <div className="process-explorer__controls">
              <div className="requirements-explorer__section-heading">
                <span className="panel__eyebrow">Process Explorer</span>
                <p>Select a process object to anchor the workbench.</p>
              </div>
              <input
                value={search}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Search workflow steps, workorders, blockers, runs, and technical process records"
                aria-label="Search process objects"
              />
            </div>

            <div id={PROCESS_EXPLORER_LIST_ID} className="process-explorer__list">
              <div className="list-stack">
                {records.length ? (
                  records.map((record) => (
                    <button
                      key={record.key}
                      type="button"
                      className={`list-row ${focusedRecord?.key === record.key ? "is-selected" : ""}`}
                      onClick={() => onSelectRecord(record.selection)}
                    >
                      <div className="list-row__meta">
                        <span className="panel__eyebrow">{record.eyebrow}</span>
                        <span className={`status-chip ${record.tone}`}>
                          {record.selection.kind === "run"
                            ? `${record.runtimeCount} event${record.runtimeCount === 1 ? "" : "s"}`
                            : `${record.inputCount}/${record.outputCount}`}
                        </span>
                      </div>
                      <strong className="list-row__title">{record.title}</strong>
                      <p className="list-row__summary">{record.summary}</p>
                    </button>
                  ))
                ) : (
                  <div className="empty-state">
                    <strong>No process records match the current query.</strong>
                    <p>Clear the active filter or widen the search to restore the technical lane.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="process-page__workbench">{children}</div>
        </div>
      </div>
    </WidgetFrame>
  );
}

function ProcessWorkbench({
  world,
  context,
  drilldownSelection,
  selectedGraphId,
  onSelectSelection,
}: {
  world: ManagerWorld;
  context: ProcessContext | null;
  drilldownSelection: Selection | null;
  selectedGraphId: string;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!context) {
    return (
      <WidgetFrame
        eyebrow="Process Workbench"
        title="No process object is currently focused."
        summary="Select a process record from the explorer or process flow map to populate the downstream workbench."
      >
        <div className="empty-state">
          <strong>No focused process object.</strong>
          <p>The process workbench populates once a technical process record is selected.</p>
        </div>
      </WidgetFrame>
    );
  }

  const deliveryRecords = buildActivityItems(context.tickets, context.comments);

  return (
    <div className="workspace-stack">
      <WidgetFrame
        eyebrow="Process Workbench"
        title={context.title}
        summary={context.summary}
        badge={<span className={`status-chip ${context.tone}`}>{context.category}</span>}
      >
        <div className="odd-card-grid odd-card-grid--two">
          <div className="odd-card">
            <span className="panel__eyebrow">Category</span>
            <strong>{context.category}</strong>
            <p>{labelSelectionKind(context.selection.kind)}</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Status</span>
            <strong>{context.tone}</strong>
            <p>{labelDeliveryStatus(context.tone)}</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">{context.inputTitle}</span>
            <strong>{context.inputs.length}</strong>
            <p>Required upstream technical surfaces or carriers visible from this process object.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">{context.outputTitle}</span>
            <strong>{context.outputs.length}</strong>
            <p>Produced or downstream-facing process surfaces visible from this process object.</p>
          </div>
        </div>

        <div className="odd-card">
          <span className="panel__eyebrow">Next Lawful Action</span>
          <strong>{context.nextAction}</strong>
        </div>
      </WidgetFrame>

      {drilldownSelection ? (
        <div className="requirements-inline-detail">
          <WidgetFrame
            eyebrow="Artifact Detail"
            title={`${labelSelectionKind(drilldownSelection.kind)} · ${drilldownSelection.id}`}
            summary="This drilldown stays inside the process workbench so the selected technical process object remains visible in context."
            actions={
              <button
                type="button"
                className="requirements-inline-detail__hide"
                onClick={() => onSelectSelection(context.selection)}
              >
                Hide Detail
              </button>
            }
          >
            <div className="requirements-inline-detail__body">
              <InspectorPanel
                world={world}
                selection={drilldownSelection}
                selectedGraphId={selectedGraphId}
                onSelectSelection={onSelectSelection}
              />
            </div>
          </WidgetFrame>
        </div>
      ) : null}

      <WidgetFrame
        eyebrow="Inputs / Outputs"
        title="Technical handoffs and produced surfaces"
        summary="These are the carriers currently flowing through the selected technical process object."
      >
        <ProcessReferenceStrip
          title={context.inputTitle}
          items={context.inputs}
          emptyLabel={`No ${context.inputTitle.toLowerCase()} are currently projected.`}
          world={world}
          onSelectSelection={onSelectSelection}
        />
        <ProcessReferenceStrip
          title={context.outputTitle}
          items={context.outputs}
          emptyLabel={`No ${context.outputTitle.toLowerCase()} are currently projected.`}
          world={world}
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Requirement Impact"
        title="Requirements affected by this process object"
        summary="The technical process lane remains traceable back to the backlog it realizes or blocks."
        defaultCollapsed={context.requirementIds.length === 0}
      >
        <ProcessReferenceStrip
          title="Linked Requirements"
          items={context.requirementIds}
          emptyLabel="No linked requirements are currently projected."
          world={world}
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Governing Surfaces"
        title="Intent, product, goals, requirements, and design surfaces"
        summary="These are the governing surfaces currently constraining the selected technical process object."
      >
        <ProcessReferenceStrip
          title="Governing References"
          items={context.governingRefs}
          emptyLabel="No governing surfaces are currently linked."
          world={world}
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Implementation Surface"
        title="Modules and implementation carriers"
        summary="Implementation stays readable as modules first, then implementation surfaces."
      >
        <ProcessReferenceStrip
          title="Module Areas"
          items={context.moduleAreas}
          emptyLabel="No module areas are currently derivable from the selected process object."
          world={world}
          onSelectSelection={onSelectSelection}
        />
        <ProcessReferenceStrip
          title="Implementation Surfaces"
          items={context.implementationRefs}
          emptyLabel="No implementation surfaces are currently linked."
          world={world}
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Test Authority"
        title="Qualification, testcase authority, and proof surfaces"
        summary="This is the proving and qualification surface for the selected technical process object."
      >
        <ProcessReferenceStrip
          title="Test and Qualification Surfaces"
          items={context.testRefs}
          emptyLabel="No test or qualification surfaces are currently linked."
          world={world}
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Latest Execution"
        title="Observed runtime and proving activity"
        summary="Runtime runs, graph calls, and open continuations currently attached to the selected process object."
        defaultCollapsed={context.runs.length === 0 && context.callIds.length === 0 && context.continuationIds.length === 0}
      >
        {context.runs.length ? (
          <div className="list-stack">
            {context.runs.map((run) => (
              <button
                key={run.instance_id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "run", id: run.instance_id })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">Run</span>
                  <span className={`status-chip ${runTone(run.status)}`}>{run.status}</span>
                </div>
                <strong className="list-row__title">{run.run_id ?? run.instance_id}</strong>
                <p className="list-row__summary">
                  {[run.edge, run.job_id, run.failure_class].filter(Boolean).join(" · ") || "Runtime execution aggregate."}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No runtime runs are currently attached.</strong>
            <p>The current process object does not yet expose run-level evidence here.</p>
          </div>
        )}

        {context.callIds.length || context.continuationIds.length ? (
          <div className="inline-pills">
            {context.callIds.map((callId) => (
              <button
                key={`call:${callId}`}
                type="button"
                className="status-chip pending"
                onClick={() => onSelectSelection({ kind: "graph_call", id: callId })}
              >
                call:{callId}
              </button>
            ))}
            {context.continuationIds.map((continuationId) => (
              <button
                key={`continuation:${continuationId}`}
                type="button"
                className="status-chip attention"
                onClick={() => onSelectSelection({ kind: "continuation", id: continuationId })}
              >
                continuation:{continuationId}
              </button>
            ))}
          </div>
        ) : null}
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Open Blockers"
        title="Ambiguity, fail-closed conditions, and local technical risk"
        summary="Technical blockers stay explicit instead of being inferred from generic drift."
        defaultCollapsed={context.ambiguities.length === 0 && !context.gapSummary}
      >
        {context.gapSummary ? (
          <div className="odd-card">
            <span className="panel__eyebrow">Gap Overlay</span>
            <strong>{context.gapSummary}</strong>
            <p>The current technical process object still carries unresolved internal gap state.</p>
          </div>
        ) : null}

        {context.ambiguities.length ? (
          <div className="list-stack">
            {context.ambiguities.map((entry) => (
              <button
                key={entry.ambiguity_id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "ambiguity", id: entry.ambiguity_id })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{describeCanonicalTerm(entry.class)}</span>
                  <span className={`status-chip ${entry.blocking || entry.hard_stop ? "blocked" : "attention"}`}>
                    {entry.decision_status || entry.status}
                  </span>
                </div>
                <strong className="list-row__title">{entry.operator_headline}</strong>
                <p className="list-row__summary">
                  {entry.next_lawful_action || entry.current_resolution || entry.description}
                </p>
              </button>
            ))}
          </div>
        ) : context.gapSummary ? null : (
          <div className="empty-state">
            <strong>No local blockers are currently projected.</strong>
            <p>The selected process object is not currently carrying explicit blocker state here.</p>
          </div>
        )}
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Delivery Records"
        title="Tickets, comments, and handoff records"
        summary="Tickets remain durable work authority. Comments remain discussion and publication."
        defaultCollapsed={deliveryRecords.length === 0}
      >
        {deliveryRecords.length ? (
          <div className="list-stack">
            {deliveryRecords.map((item) => (
              <button
                key={item.id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "surface", id: item.sourcePath })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{item.eyebrow}</span>
                  <span className={`status-chip ${item.tone}`}>{item.when ?? "record"}</span>
                </div>
                <strong className="list-row__title">{item.title}</strong>
                <p className="list-row__summary">{item.summary}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No linked delivery records are currently projected.</strong>
            <p>Linked tickets and comments will appear here once the selected process object exposes them.</p>
          </div>
        )}
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Technical Detail"
        title="Underlying selection detail"
        summary="The raw inspector remains available here as a fallback technical detail surface."
        defaultCollapsed
      >
        <InspectorPanel
          world={world}
          selection={context.selection}
          selectedGraphId={selectedGraphId}
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>
    </div>
  );
}

function ProcessReferenceStrip({
  title,
  items,
  emptyLabel,
  world,
  onSelectSelection,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <div>
      <span className="panel__eyebrow">{title}</span>
      <div className="inline-pills">
        {items.length ? (
          items.map((item) => {
            const nextSelection = selectionForProcessReference(item, world);
            return nextSelection ? (
              <button
                key={`${title}:${item}`}
                type="button"
                className="status-chip converged"
                onClick={() => onSelectSelection(nextSelection)}
              >
                {item}
              </button>
            ) : (
              <span key={`${title}:${item}`} className="status-chip attention">
                {item}
              </span>
            );
          })
        ) : (
          <span className="status-chip attention">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

function buildProcessStageStats(records: ProcessRecord[]) {
  return PROCESS_STAGE_DEFINITIONS.map((stage) => {
    const stageRecords = records.filter((record) => processStageForRecord(record) === stage.id);
    const blocked = stageRecords.filter((record) => record.hasFailure || record.tone === "blocked").length;
    const active = stageRecords.filter((record) =>
      record.tone === "active" || record.tone === "pending" || record.tone === "gated" || record.tone === "attention",
    ).length;
    const done = stageRecords.filter((record) => record.tone === "converged").length;
    const tone: Tone = blocked
      ? "blocked"
      : active
        ? "active"
        : stageRecords.length
          ? "converged"
          : "pending";
    return {
      ...stage,
      count: stageRecords.length,
      blocked,
      active,
      done,
      tone,
    };
  });
}

function pickDefaultBuilderStage(records: ProcessRecord[]): ProcessStageId {
  const activeRecord = records.find((record) =>
    record.tone === "active" || record.tone === "pending" || record.tone === "gated" || record.tone === "blocked",
  );
  if (activeRecord) {
    return processStageForRecord(activeRecord);
  }
  return records[0] ? processStageForRecord(records[0]) : "bootstrap";
}

function filterProcessRecordsForBuilderLens(
  records: ProcessRecord[],
  lens: ProcessBuilderLens,
  stageId: ProcessStageId,
) {
  if (lens === "blocked") {
    return records.filter((record) => record.hasFailure || record.tone === "blocked");
  }
  if (lens === "done") {
    return records.filter((record) => record.tone === "converged" || processLaneForRecord(record) === "handoff");
  }
  if (lens === "map") {
    return records;
  }
  const stageRecords = records.filter((record) => processStageForRecord(record) === stageId);
  const movableRecords = stageRecords.filter((record) => record.tone !== "converged");
  return movableRecords.length ? movableRecords : stageRecords;
}

function countProcessBuilderLensRecords(
  records: ProcessRecord[],
  lens: ProcessBuilderLens,
  stageId: ProcessStageId,
) {
  return filterProcessRecordsForBuilderLens(records, lens, stageId).length;
}

function groupProcessRecordsByLane(records: ProcessRecord[]) {
  const groups = new Map<ProcessLaneId, ProcessRecord[]>();
  for (const lane of PROCESS_LANE_DEFINITIONS) {
    groups.set(lane.id, []);
  }
  for (const record of records) {
    groups.get(processLaneForRecord(record))?.push(record);
  }
  return groups;
}

function processLaneForRecord(record: ProcessRecord): ProcessLaneId {
  if (record.hasFailure || record.tone === "blocked") {
    return "blocked";
  }
  if (record.tone === "gated" || record.tone === "attention") {
    return "carried";
  }
  if (record.tone === "active" || record.tone === "pending") {
    return "in_flight";
  }
  if (record.outputCount > 0 || record.tone === "converged") {
    return "handoff";
  }
  return "upstream";
}

function processStageForRecord(record: ProcessRecord): ProcessStageId {
  const source = `${record.title} ${record.summary} ${record.queryText}`.toLowerCase();
  if (record.recordClass === "run" || /\b(runtime|run|continuation|observation|operational|maintenance)\b/.test(source)) {
    return "runtime";
  }
  if (/\b(release|deployment|handoff)\b/.test(source)) {
    return "release";
  }
  if (/\b(test_run|test_module|test_design|qualification|proof|archive)\b/.test(source)) {
    return "test";
  }
  if (/\b(implementation|impl_|impl\b|build|module|stack|code)\b/.test(source)) {
    return "build";
  }
  if (/\b(scenario|uat|testcase_authority|acceptance)\b/.test(source)) {
    return "scenarios";
  }
  if (/\b(design|feature|review|consensus|decomp)\b/.test(source)) {
    return "design";
  }
  if (
    /\b(bootstrap|intent|product|goal|requirement|ambiguity_register|requirement_closure|closure)\b/.test(source) ||
    record.selection.kind === "requirement"
  ) {
    return "bootstrap";
  }
  return "bootstrap";
}

function workspaceDisplayName(workspaceRoot: string) {
  return workspaceRoot.split("/").filter(Boolean).at(-1) ?? workspaceRoot;
}

function labelWorkspacePack(pack: ManagerWorld["workspace_profile"]["active_domain_pack"]) {
  if (!pack) {
    return "Managed workspace";
  }
  return pack
    .split("_")
    .map((segment) => segment.toUpperCase())
    .join(" ");
}

function buildProcessRecords(world: ManagerWorld): ProcessRecord[] {
  const records: ProcessRecord[] = [
    ...TRACKED_PROCESS_LENSES.flatMap((lens) => {
      const context = resolveTrackedRequirementContext(world, lens);
      return context ? [contextToTypedRecord(context, "observed_surface")] : [];
    }),
    ...selectObservedProcessAssets(world.domain.assets).map((asset) =>
      contextToTypedRecord(resolveAssetContext(world, asset), "observed_surface"),
    ),
    ...world.domain.functions.map((fn) =>
      contextToTypedRecord(resolveFunctionContext(world, fn), "workflow_step"),
    ),
    ...world.domain.workorders.map((workorder) =>
      contextToTypedRecord(resolveWorkOrderContext(world, workorder), "work_order"),
    ),
    ...world.domain.ambiguity_register.ambiguities.map((entry) =>
      contextToTypedRecord(resolveAmbiguityContext(world, entry), "blocker"),
    ),
    ...world.runtime.runs.map((run) =>
      contextToTypedRecord(resolveRunContext(world, run), "run"),
    ),
  ];
  return records.sort(compareProcessRecords);
}

function resolveProcessContext(world: ManagerWorld, selection: Selection): ProcessContext | null {
  switch (selection.kind) {
    case "function": {
      const fn = world.domain.functions.find((item) => item.id === selection.id);
      return fn ? resolveFunctionContext(world, fn) : null;
    }
    case "workorder": {
      const workorder = world.domain.workorders.find((item) => item.id === selection.id);
      return workorder ? resolveWorkOrderContext(world, workorder) : null;
    }
    case "ambiguity": {
      const entry = world.domain.ambiguity_register.ambiguities.find(
        (item) => item.ambiguity_id === selection.id,
      );
      return entry ? resolveAmbiguityContext(world, entry) : null;
    }
    case "run": {
      const run = world.runtime.runs.find((item) => item.instance_id === selection.id);
      return run ? resolveRunContext(world, run) : null;
    }
    case "requirement": {
      const trackedLens = TRACKED_PROCESS_LENSES.find(
        (lens) => lens.primaryRequirementId === selection.id,
      );
      if (trackedLens) {
        return resolveTrackedRequirementContext(world, trackedLens);
      }
      const requirement = world.domain.requirements.find(
        (item) => item.requirement_id === selection.id,
      );
      return requirement ? resolveRequirementContext(world, requirement) : null;
    }
    case "asset": {
      const asset = world.domain.assets.find((item) => item.asset_id === selection.id);
      return asset ? resolveAssetContext(world, asset) : null;
    }
    default:
      return null;
  }
}

function resolveFunctionContext(world: ManagerWorld, fn: FunctionView): ProcessContext {
  const assetIds = assetIdsForNodes(world.domain.bindings, [...fn.inputs, ...fn.outputs]);
  const relatedRequirements = resolveRequirementsForAssetIds(world, assetIds);
  return {
    key: selectionKey({ kind: "function", id: fn.id }),
    selection: { kind: "function", id: fn.id },
    eyebrow: "Workflow Step",
    title: fn.label,
    summary: fn.intent,
    tone: fn.status,
    category: "Workflow Step",
    nextAction: fn.status === "blocked"
      ? "Resolve the blocking condition or missing carrier before retrying this step."
      : fn.open_continuation_ids.length
        ? "Continue or close the open continuation before treating this step as settled."
        : fn.gap
          ? "Close the remaining internal gap before treating this step as converged."
          : fn.status === "converged"
            ? "Inspect produced outputs and hand them to the next lawful step."
            : "Continue the active workflow step and verify the downstream handoff.",
    inputTitle: "Inputs",
    inputs: uniqueRefs(fn.inputs),
    outputTitle: "Outputs",
    outputs: uniqueRefs(fn.outputs),
    requirementIds: relatedRequirements.map((requirement) => requirement.requirement_id),
    governingRefs: gatherGoverningRefs(relatedRequirements),
    implementationRefs: gatherImplementationRefs(relatedRequirements),
    testRefs: gatherTestRefs(relatedRequirements),
    moduleAreas: deriveModuleAreas(gatherImplementationRefs(relatedRequirements)),
    tickets: resolveTicketsForRequirements(relatedRequirements, world.domain.tickets),
    comments: resolveCommentsForRequirements(relatedRequirements, world.domain.comments),
    ambiguities: resolveAmbiguitiesForRequirementsAndAssets(
      relatedRequirements,
      assetIds,
      world.domain.ambiguity_register.ambiguities,
    ),
    runs: resolveRunsByIds(world.runtime.runs, fn.run_ids),
    callIds: uniqueRefs(fn.call_ids),
    continuationIds: uniqueRefs(fn.open_continuation_ids),
    gapSummary: fn.gap?.delta_summary ?? null,
  };
}

function resolveWorkOrderContext(world: ManagerWorld, workorder: WorkOrderView): ProcessContext {
  const assetIds = assetIdsForNodes(world.domain.bindings, [...workorder.inputs, ...workorder.outputs]);
  const relatedRequirements = resolveRequirementsForAssetIds(world, assetIds);
  return {
    key: selectionKey({ kind: "workorder", id: workorder.id }),
    selection: { kind: "workorder", id: workorder.id },
    eyebrow: "Work Order",
    title: workorder.label,
    summary: workorder.intent,
    tone: workorder.status,
    category: "Work Order",
    nextAction: workorder.status === "blocked"
      ? "Resolve the blocking condition before advancing this work order."
      : workorder.gap
        ? "Close the remaining work-order gap before treating the handoff as complete."
        : workorder.status === "converged"
          ? "Hand the produced outputs to the next lawful carrier."
          : "Advance this work order and verify the runtime evidence.",
    inputTitle: "Inputs",
    inputs: uniqueRefs(workorder.inputs),
    outputTitle: "Outputs",
    outputs: uniqueRefs(workorder.outputs),
    requirementIds: relatedRequirements.map((requirement) => requirement.requirement_id),
    governingRefs: uniqueRefs([workorder.source, ...gatherGoverningRefs(relatedRequirements)]),
    implementationRefs: gatherImplementationRefs(relatedRequirements),
    testRefs: gatherTestRefs(relatedRequirements),
    moduleAreas: deriveModuleAreas(gatherImplementationRefs(relatedRequirements)),
    tickets: resolveTicketsForRequirements(relatedRequirements, world.domain.tickets),
    comments: resolveCommentsForRequirements(relatedRequirements, world.domain.comments),
    ambiguities: resolveAmbiguitiesForRequirementsAndAssets(
      relatedRequirements,
      assetIds,
      world.domain.ambiguity_register.ambiguities,
    ),
    runs: resolveRunsByIds(world.runtime.runs, workorder.run_ids),
    callIds: uniqueRefs(workorder.call_ids),
    continuationIds: uniqueRefs(workorder.open_continuation_ids),
    gapSummary: workorder.gap?.delta_summary ?? null,
  };
}

function resolveAmbiguityContext(world: ManagerWorld, entry: AmbiguityEntryView): ProcessContext {
  const relatedRequirements = uniqueRequirements([
    ...resolveRequirementsForAssetIds(world, entry.affected_assets),
    ...resolveRequirementsForRefs(world.domain.requirements, [
      ...entry.evidence_refs,
      ...entry.invariant_refs,
      ...entry.decision_event_refs,
    ]),
  ]);
  return {
    key: selectionKey({ kind: "ambiguity", id: entry.ambiguity_id }),
    selection: { kind: "ambiguity", id: entry.ambiguity_id },
    eyebrow: "Blocker",
    title: entry.operator_headline,
    summary: entry.description,
    tone: entry.blocking || entry.hard_stop ? "blocked" : "attention",
    category: "Blocker",
    nextAction: entry.next_lawful_action || entry.current_resolution || "Resolve the ambiguity before advancing the blocked lane.",
    inputTitle: "Affected Assets",
    inputs: uniqueRefs(entry.affected_assets),
    outputTitle: "Resolving Edge",
    outputs: uniqueRefs([
      entry.expected_resolving_edge ?? "",
      entry.capability_surface ?? "",
    ]),
    requirementIds: relatedRequirements.map((requirement) => requirement.requirement_id),
    governingRefs: uniqueRefs([...entry.evidence_refs, ...entry.invariant_refs]),
    implementationRefs: gatherImplementationRefs(relatedRequirements),
    testRefs: gatherTestRefs(relatedRequirements),
    moduleAreas: deriveModuleAreas(gatherImplementationRefs(relatedRequirements)),
    tickets: resolveTicketsForRequirements(relatedRequirements, world.domain.tickets),
    comments: resolveCommentsForRequirements(relatedRequirements, world.domain.comments),
    ambiguities: [entry],
    runs: [],
    callIds: [],
    continuationIds: [],
    gapSummary: null,
  };
}

function resolveRunContext(world: ManagerWorld, run: RuntimeRunView): ProcessContext {
  const relatedFunctions = world.domain.functions.filter((fn) => fn.run_ids.includes(run.instance_id));
  const relatedWorkOrders = world.domain.workorders.filter((workorder) =>
    workorder.run_ids.includes(run.instance_id),
  );
  const assetIds = assetIdsForNodes(world.domain.bindings, [
    ...relatedFunctions.flatMap((fn) => [...fn.inputs, ...fn.outputs]),
    ...relatedWorkOrders.flatMap((workorder) => [...workorder.inputs, ...workorder.outputs]),
  ]);
  const relatedRequirements = uniqueRequirements([
    ...resolveRequirementsForAssetIds(world, assetIds),
    ...resolveRequirementsForRefs(world.domain.requirements, [
      run.authority_ref ?? "",
      run.edge ?? "",
      run.job_id ?? "",
      run.work_key ?? "",
    ]),
  ]);
  return {
    key: selectionKey({ kind: "run", id: run.instance_id }),
    selection: { kind: "run", id: run.instance_id },
    eyebrow: "Runtime Run",
    title: run.run_id ?? run.instance_id,
    summary:
      [run.edge, run.job_id, run.failure_class].filter(Boolean).join(" · ") ||
      "Runtime execution aggregate for the current technical process lane.",
    tone: runTone(run.status),
    category: "Runtime Run",
    nextAction:
      run.failure_class || runTone(run.status) === "blocked"
        ? "Inspect the failing runtime evidence and decide whether to retry, reject, or unblock."
        : runTone(run.status) === "converged"
          ? "Use the produced evidence to confirm the downstream handoff."
          : "Monitor the active run until it resolves or produces actionable evidence.",
    inputTitle: "Bound Inputs",
    inputs: uniqueRefs([
      ...relatedFunctions.flatMap((fn) => fn.inputs),
      ...relatedWorkOrders.flatMap((workorder) => workorder.inputs),
    ]),
    outputTitle: "Bound Outputs",
    outputs: uniqueRefs([
      ...relatedFunctions.flatMap((fn) => fn.outputs),
      ...relatedWorkOrders.flatMap((workorder) => workorder.outputs),
    ]),
    requirementIds: relatedRequirements.map((requirement) => requirement.requirement_id),
    governingRefs: uniqueRefs([
      run.authority_ref ?? "",
      ...gatherGoverningRefs(relatedRequirements),
    ]),
    implementationRefs: gatherImplementationRefs(relatedRequirements),
    testRefs: gatherTestRefs(relatedRequirements),
    moduleAreas: deriveModuleAreas(gatherImplementationRefs(relatedRequirements)),
    tickets: resolveTicketsForRequirements(relatedRequirements, world.domain.tickets),
    comments: resolveCommentsForRequirements(relatedRequirements, world.domain.comments),
    ambiguities: resolveAmbiguitiesForRequirementsAndAssets(
      relatedRequirements,
      assetIds,
      world.domain.ambiguity_register.ambiguities,
    ),
    runs: [run],
    callIds: [],
    continuationIds: [],
    gapSummary: run.failure_class ? `Failure class: ${run.failure_class}` : null,
  };
}

function resolveAssetContext(world: ManagerWorld, asset: AssetView): ProcessContext {
  const boundNodes = world.domain.bindings
    .filter((binding) => binding.asset_ids.includes(asset.asset_id))
    .map((binding) => binding.node);
  const producers = world.domain.functions.filter((fn) => fn.outputs.some((node) => boundNodes.includes(node)));
  const consumers = world.domain.functions.filter((fn) => fn.inputs.some((node) => boundNodes.includes(node)));
  const relatedRequirements = resolveRequirementsForRefs(world.domain.requirements, assetRefs(asset));
  const linkedAmbiguities = resolveAmbiguitiesForRequirementsAndAssets(
    relatedRequirements,
    [asset.asset_id],
    world.domain.ambiguity_register.ambiguities,
  );
  const runIds = uniqueRefs([
    ...producers.flatMap((fn) => fn.run_ids),
    ...consumers.flatMap((fn) => fn.run_ids),
  ]);
  const runtimeTone =
    producers.some((fn) => fn.status === "active" || fn.status === "pending" || fn.status === "gated") ||
    consumers.some((fn) => fn.status === "active" || fn.status === "pending" || fn.status === "gated") ||
    runIds.length > 0
      ? "active"
      : "converged";
  const tone: Tone =
    asset.metadata.exists === "false"
      ? "blocked"
      : linkedAmbiguities.some((entry) => entry.blocking || entry.hard_stop)
        ? "blocked"
        : linkedAmbiguities.length
          ? "attention"
          : runtimeTone;

  return {
    key: selectionKey({ kind: "asset", id: asset.asset_id }),
    selection: { kind: "asset", id: asset.asset_id },
    eyebrow: "Artifact",
    title: asset.asset_id,
    summary: `${describeCanonicalTerm(asset.declared_type)} · ${asset.metadata.relative_path ?? asset.kind}`,
    tone,
    category: "Artifact",
    nextAction:
      asset.metadata.exists === "false"
        ? "Materialize the missing artifact before relying on downstream consumers."
        : linkedAmbiguities[0]?.next_lawful_action ??
          "Inspect the producing and consuming steps to confirm the current handoff.",
    inputTitle: "Upstream Producers",
    inputs: uniqueRefs(producers.map((fn) => fn.label)),
    outputTitle: "Downstream Consumers",
    outputs: uniqueRefs(consumers.map((fn) => fn.label)),
    requirementIds: relatedRequirements.map((requirement) => requirement.requirement_id),
    governingRefs: uniqueRefs([asset.metadata.relative_path ?? "", ...gatherGoverningRefs(relatedRequirements)]),
    implementationRefs: uniqueRefs([
      asset.metadata.relative_path ?? "",
      ...gatherImplementationRefs(relatedRequirements),
    ].filter(Boolean)),
    testRefs: gatherTestRefs(relatedRequirements),
    moduleAreas: deriveModuleAreas(uniqueRefs([
      asset.metadata.relative_path ?? "",
      ...gatherImplementationRefs(relatedRequirements),
    ].filter(Boolean))),
    tickets: resolveTicketsForRequirements(relatedRequirements, world.domain.tickets),
    comments: resolveCommentsForRequirements(relatedRequirements, world.domain.comments),
    ambiguities: linkedAmbiguities,
    runs: resolveRunsByIds(world.runtime.runs, runIds),
    callIds: [],
    continuationIds: [],
    gapSummary: null,
  };
}

function resolveTrackedRequirementContext(
  world: ManagerWorld,
  lens: TrackedProcessLens,
): ProcessContext | null {
  const relatedRequirements = uniqueRequirements(
    [lens.primaryRequirementId, ...lens.relatedRequirementIds]
      .map((requirementId) =>
        world.domain.requirements.find((requirement) => requirement.requirement_id === requirementId),
      )
      .filter((requirement): requirement is RequirementView => Boolean(requirement)),
  );
  if (!relatedRequirements.length) {
    return null;
  }
  const governingPaths = lens.governingAssetIds
    .map((assetId) => surfacePathForAssetId(world, assetId))
    .filter((path): path is string => Boolean(path));
  const outputPaths = lens.outputAssetIds
    .map((assetId) => surfacePathForAssetId(world, assetId))
    .filter((path): path is string => Boolean(path));
  const relatedAssetIds = uniqueRefs([...lens.governingAssetIds, ...lens.outputAssetIds]);
  const linkedAmbiguities = resolveAmbiguitiesForRequirementsAndAssets(
    relatedRequirements,
    relatedAssetIds,
    world.domain.ambiguity_register.ambiguities,
  );
  const tone: Tone =
    linkedAmbiguities.some((entry) => entry.blocking || entry.hard_stop)
      ? "blocked"
      : relatedRequirements.some((requirement) => requirement.delivery_status === "pending")
        ? "pending"
        : relatedRequirements.some((requirement) => requirement.delivery_status === "attention")
          ? "attention"
          : "active";

  return {
    key: selectionKey({ kind: "requirement", id: lens.primaryRequirementId }),
    selection: { kind: "requirement", id: lens.primaryRequirementId },
    eyebrow: "Tracking Asset",
    title: lens.title,
    summary: lens.summary,
    tone,
    category: "Tracking Asset",
    nextAction:
      linkedAmbiguities[0]?.next_lawful_action ??
      "Inspect the governing requirements, testcase authority, and observed evidence surfaces together.",
    inputTitle: "Governing Inputs",
    inputs: uniqueRefs([
      ...governingPaths,
      ...gatherGoverningRefs(relatedRequirements),
    ]),
    outputTitle: "Observed Outputs",
    outputs: uniqueRefs(outputPaths),
    requirementIds: relatedRequirements.map((requirement) => requirement.requirement_id),
    governingRefs: uniqueRefs([
      ...governingPaths,
      ...gatherGoverningRefs(relatedRequirements),
    ]),
    implementationRefs: gatherImplementationRefs(relatedRequirements),
    testRefs: uniqueRefs([
      ...gatherTestRefs(relatedRequirements),
      ...outputPaths,
    ]),
    moduleAreas: deriveModuleAreas(gatherImplementationRefs(relatedRequirements)),
    tickets: resolveTicketsForRequirements(relatedRequirements, world.domain.tickets),
    comments: resolveCommentsForRequirements(relatedRequirements, world.domain.comments),
    ambiguities: linkedAmbiguities,
    runs: [],
    callIds: [],
    continuationIds: [],
    gapSummary: null,
  };
}

function resolveRequirementContext(world: ManagerWorld, requirement: RequirementView): ProcessContext {
  const relatedRequirements = [requirement];
  const linkedAmbiguities = resolveAmbiguitiesForRequirementsAndAssets(
    relatedRequirements,
    [],
    world.domain.ambiguity_register.ambiguities,
  );
  const tone: Tone =
    linkedAmbiguities.some((entry) => entry.blocking || entry.hard_stop)
      ? "blocked"
      : requirement.delivery_status;
  return {
    key: selectionKey({ kind: "requirement", id: requirement.requirement_id }),
    selection: { kind: "requirement", id: requirement.requirement_id },
    eyebrow: "Requirement Trace",
    title: `${requirement.requirement_id} · ${requirement.title}`,
    summary: requirement.summary,
    tone,
    category: "Requirement Trace",
    nextAction:
      linkedAmbiguities[0]?.next_lawful_action ??
      "Inspect the linked implementation, qualification, and evidence surfaces for this requirement.",
    inputTitle: "Governing Inputs",
    inputs: uniqueRefs([
      requirement.source_path,
      ...requirement.traces_to,
      ...requirement.derives_from,
      ...requirement.authority_refs,
      ...requirement.current_requirement_refs,
    ]),
    outputTitle: "Observed Outputs",
    outputs: uniqueRefs([
      ...requirement.implementation_claim_refs,
      ...requirement.code_refs,
      ...requirement.testcase_authority_refs,
      ...requirement.test_refs,
      ...requirement.test_claim_refs,
      ...requirement.planned_test_claim_refs,
    ]),
    requirementIds: [requirement.requirement_id],
    governingRefs: gatherGoverningRefs(relatedRequirements),
    implementationRefs: gatherImplementationRefs(relatedRequirements),
    testRefs: gatherTestRefs(relatedRequirements),
    moduleAreas: deriveModuleAreas(gatherImplementationRefs(relatedRequirements)),
    tickets: resolveTicketsForRequirements(relatedRequirements, world.domain.tickets),
    comments: resolveCommentsForRequirements(relatedRequirements, world.domain.comments),
    ambiguities: linkedAmbiguities,
    runs: [],
    callIds: [],
    continuationIds: [],
    gapSummary: null,
  };
}

function selectionForProcessReference(value: string, world: ManagerWorld): Selection | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (world.domain.bindings.some((binding) => binding.node === trimmed)) {
    return { kind: "binding", id: trimmed };
  }
  if (world.domain.assets.some((asset) => asset.asset_id === trimmed)) {
    return { kind: "asset", id: trimmed };
  }
  if (world.domain.functions.some((fn) => fn.label === trimmed)) {
    const fn = world.domain.functions.find((item) => item.label === trimmed);
    return fn ? { kind: "function", id: fn.id } : null;
  }
  if (world.domain.workorders.some((workorder) => workorder.label === trimmed)) {
    const workorder = world.domain.workorders.find((item) => item.label === trimmed);
    return workorder ? { kind: "workorder", id: workorder.id } : null;
  }
  if (/^REQ-[A-Z0-9-]+$/.test(trimmed)) {
    return { kind: "requirement", id: trimmed };
  }
  if (trimmed.includes("/") || /\.(md|tsx?|jsx?|py|mjs|json|ya?ml|scala|java|kt)$/i.test(trimmed)) {
    return { kind: "surface", id: trimmed.startsWith("./") ? trimmed.slice(2) : trimmed };
  }
  return null;
}

function isProcessPrimarySelection(world: ManagerWorld, selection: Selection) {
  switch (selection.kind) {
    case "requirement":
      return world.domain.requirements.some((item) => item.requirement_id === selection.id);
    case "function":
      return world.domain.functions.some((item) => item.id === selection.id);
    case "workorder":
      return world.domain.workorders.some((item) => item.id === selection.id);
    case "ambiguity":
      return world.domain.ambiguity_register.ambiguities.some((item) => item.ambiguity_id === selection.id);
    case "run":
      return world.runtime.runs.some((item) => item.instance_id === selection.id);
    default:
      return false;
  }
}

function selectionKey(selection: Selection) {
  return `${selection.kind}:${selection.id}`;
}

function contextToRecord(context: ProcessContext): ProcessRecord {
  return contextToTypedRecord(context, defaultRecordClassForSelection(context.selection));
}

function contextToTypedRecord(
  context: ProcessContext,
  recordClass: ProcessRecord["recordClass"],
): ProcessRecord {
  const queryText = [
    context.title,
    context.summary,
    context.category,
    ...context.inputs,
    ...context.outputs,
    ...context.requirementIds,
    ...context.governingRefs,
    ...context.implementationRefs,
    ...context.testRefs,
  ]
    .join(" ")
    .toLowerCase();

  return {
    key: context.key,
    selection: context.selection,
    recordClass,
    eyebrow: context.eyebrow,
    tone: context.tone,
    title: context.title,
    summary: context.summary,
    queryText,
    runtimeCount: context.runs.length + context.callIds.length + context.continuationIds.length,
    inputCount: context.inputs.length,
    outputCount: context.outputs.length,
    requirementCount: context.requirementIds.length,
    hasFailure:
      context.tone === "blocked" ||
      context.runs.some((run) => Boolean(run.failure_class) || runTone(run.status) === "blocked"),
    testRelevant:
      context.testRefs.length > 0 ||
      /test|qualif|qualification|acceptance/i.test(`${context.title} ${context.summary}`),
  };
}

function defaultRecordClassForSelection(selection: Selection): ProcessRecord["recordClass"] {
  switch (selection.kind) {
    case "requirement":
      return "observed_surface";
    case "asset":
      return "observed_surface";
    case "function":
      return "workflow_step";
    case "workorder":
      return "work_order";
    case "ambiguity":
      return "blocker";
    case "run":
      return "run";
    default:
      return "workflow_step";
  }
}

function isObservedProcessAsset(asset: AssetView) {
  return OBSERVED_PROCESS_ASSET_TYPES.has(asset.declared_type);
}

function selectObservedProcessAssets(assets: AssetView[]) {
  return assets.filter(isObservedProcessAsset);
}

function pickDefaultProcessRecord(records: ProcessRecord[]) {
  if (!records.length) {
    return null;
  }
  const byKey = new Map(records.map((record) => [record.key, record]));
  for (const key of PREFERRED_PROCESS_RECORD_KEYS) {
    const match = byKey.get(key);
    if (match) {
      return match;
    }
  }
  return records[0] ?? null;
}

function compareProcessRecords(left: ProcessRecord, right: ProcessRecord) {
  const leftPreferred = PREFERRED_PROCESS_RECORD_KEYS.indexOf(left.key);
  const rightPreferred = PREFERRED_PROCESS_RECORD_KEYS.indexOf(right.key);
  if (leftPreferred !== -1 || rightPreferred !== -1) {
    const normalizedLeft = leftPreferred === -1 ? Number.MAX_SAFE_INTEGER : leftPreferred;
    const normalizedRight = rightPreferred === -1 ? Number.MAX_SAFE_INTEGER : rightPreferred;
    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }
  }
  const byTone = toneRank(left.tone) - toneRank(right.tone);
  if (byTone !== 0) {
    return byTone;
  }
  const byRuntime = right.runtimeCount - left.runtimeCount;
  if (byRuntime !== 0) {
    return byRuntime;
  }
  return left.title.localeCompare(right.title);
}

function surfacePathForAssetId(world: ManagerWorld, assetId: string) {
  return (
    world.domain.assets.find((asset) => asset.asset_id === assetId)?.metadata.relative_path ?? null
  );
}

function toneRank(tone: Tone) {
  if (tone === "blocked") {
    return 0;
  }
  if (tone === "attention") {
    return 1;
  }
  if (tone === "active") {
    return 2;
  }
  if (tone === "pending") {
    return 3;
  }
  if (tone === "gated") {
    return 4;
  }
  return 5;
}

function runTone(status: string | null | undefined): Tone {
  const value = (status ?? "").toLowerCase();
  if (value.includes("fail") || value.includes("error") || value.includes("reject") || value.includes("blocked")) {
    return "blocked";
  }
  if (value.includes("running") || value.includes("active") || value.includes("open")) {
    return "active";
  }
  if (value.includes("pending") || value.includes("queued") || value.includes("waiting")) {
    return "pending";
  }
  if (value.includes("gate")) {
    return "gated";
  }
  if (value.includes("done") || value.includes("pass") || value.includes("complete") || value.includes("converged")) {
    return "converged";
  }
  return "attention";
}

function assetIdsForNodes(bindings: BindingView[], nodes: string[]) {
  return uniqueRefs(
    bindings
      .filter((binding) => nodes.includes(binding.node))
      .flatMap((binding) => binding.asset_ids),
  );
}

function resolveRequirementsForAssetIds(world: ManagerWorld, assetIds: string[]) {
  const refs = world.domain.assets
    .filter((asset) => assetIds.includes(asset.asset_id))
    .flatMap((asset) => assetRefs(asset));
  return resolveRequirementsForRefs(world.domain.requirements, refs);
}

function resolveRequirementsForRefs(requirements: RequirementView[], refs: string[]) {
  const referenceSet = new Set(uniqueRefs(refs));
  if (!referenceSet.size) {
    return [];
  }
  return requirements.filter((requirement) => {
    const requirementRefs = requirementReferenceSet(requirement);
    for (const ref of referenceSet) {
      if (requirementRefs.has(ref)) {
        return true;
      }
    }
    return false;
  });
}

function requirementReferenceSet(requirement: RequirementView) {
  return new Set<string>([
    requirement.requirement_id,
    requirement.source_path,
    ...requirement.traces_to,
    ...requirement.derives_from,
    ...requirement.authority_refs,
    ...requirement.current_requirement_refs,
    ...requirement.implementation_claim_refs,
    ...requirement.code_refs,
    ...requirement.test_refs,
    ...requirement.test_claim_refs,
    ...requirement.planned_test_claim_refs,
    ...requirement.testcase_authority_refs,
  ].map((item) => item.trim()).filter(Boolean));
}

function assetRefs(asset: AssetView) {
  return uniqueRefs([
    asset.asset_id,
    asset.uri,
    asset.metadata.relative_path ?? "",
  ]);
}

function uniqueRefs(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function uniqueRequirements(requirements: RequirementView[]) {
  const seen = new Set<string>();
  return requirements.filter((requirement) => {
    if (seen.has(requirement.requirement_id)) {
      return false;
    }
    seen.add(requirement.requirement_id);
    return true;
  });
}

function gatherGoverningRefs(requirements: RequirementView[]) {
  return uniqueRefs(
    requirements.flatMap((requirement) => [
      requirement.source_path,
      ...requirement.derives_from,
      ...requirement.authority_refs,
      ...requirement.current_requirement_refs,
    ]),
  );
}

function gatherImplementationRefs(requirements: RequirementView[]) {
  return uniqueRefs(
    requirements.flatMap((requirement) => [
      ...requirement.implementation_claim_refs,
      ...requirement.code_refs,
    ]),
  );
}

function gatherTestRefs(requirements: RequirementView[]) {
  return uniqueRefs(
    requirements.flatMap((requirement) => [
      ...requirement.test_refs,
      ...requirement.test_claim_refs,
      ...requirement.planned_test_claim_refs,
      ...requirement.testcase_authority_refs,
    ]),
  );
}

function deriveModuleAreas(items: string[]) {
  return uniqueRefs(
    items.map((item) => {
      if (item.includes("/src/")) {
        return item.split("/src/")[0] ?? item;
      }
      if (item.includes("/tests/")) {
        return item.split("/tests/")[0] ?? item;
      }
      const segments = item.split("/");
      return segments.length > 1 ? segments.slice(0, -1).join("/") : item;
    }),
  );
}

function resolveTicketsForRequirements(requirements: RequirementView[], tickets: TicketView[]) {
  const requirementIds = new Set(requirements.map((requirement) => requirement.requirement_id));
  const surfaceRefs = new Set(requirements.map((requirement) => requirement.source_path));
  return tickets
    .filter((ticket) =>
      ticket.linked_requirement_ids.some((id) => requirementIds.has(id)) ||
      ticket.linked_surfaces.some((surface) => surfaceRefs.has(surface)),
    )
    .sort((left, right) => (right.updated_at ?? right.created_at ?? "").localeCompare(left.updated_at ?? left.created_at ?? ""));
}

function resolveCommentsForRequirements(requirements: RequirementView[], comments: CommentView[]) {
  const requirementIds = new Set(requirements.map((requirement) => requirement.requirement_id));
  const surfaceRefs = new Set(requirements.map((requirement) => requirement.source_path));
  return comments
    .filter((comment) =>
      comment.linked_requirement_ids.some((id) => requirementIds.has(id)) ||
      comment.linked_surfaces.some((surface) => surfaceRefs.has(surface)),
    )
    .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
}

function resolveAmbiguitiesForRequirementsAndAssets(
  requirements: RequirementView[],
  assetIds: string[],
  ambiguities: AmbiguityEntryView[],
) {
  const requirementRefs = new Set(
    requirements.flatMap((requirement) => [...requirementReferenceSet(requirement)]),
  );
  const assetRefSet = new Set(assetIds);
  return ambiguities.filter((entry) => {
    if (entry.affected_assets.some((assetId) => assetRefSet.has(assetId))) {
      return true;
    }
    if (
      entry.evidence_refs.some((ref) => requirementRefs.has(ref)) ||
      entry.invariant_refs.some((ref) => requirementRefs.has(ref))
    ) {
      return true;
    }
    return requirements.some((requirement) =>
      [entry.description, entry.operator_headline, entry.current_resolution]
        .join(" ")
        .toLowerCase()
        .includes(requirement.requirement_id.toLowerCase()),
    );
  });
}

function resolveRunsByIds(runs: RuntimeRunView[], ids: string[]) {
  const idSet = new Set(ids);
  return runs.filter((run) => idSet.has(run.instance_id) || (run.run_id ? idSet.has(run.run_id) : false));
}

function buildActivityItems(tickets: TicketView[], comments: CommentView[]) {
  return [
    ...tickets.map((ticket) => ({
      id: `ticket:${ticket.id}`,
      eyebrow: ticket.type ?? "Ticket",
      tone:
        ticket.status === "completed"
          ? ("converged" as const)
          : ticket.status === "blocked"
            ? ("blocked" as const)
            : ("active" as const),
      title: `${ticket.id} · ${ticket.title}`,
      summary: ticket.summary,
      when: ticket.updated_at ?? ticket.created_at,
      sourcePath: ticket.source_path,
    })),
    ...comments.map((comment) => ({
      id: `comment:${comment.id}`,
      eyebrow: comment.author ?? comment.source ?? "Comment",
      tone: "attention" as const,
      title: comment.title,
      summary: comment.summary,
      when: comment.date,
      sourcePath: comment.source_path,
    })),
  ].sort((left, right) => (right.when ?? "").localeCompare(left.when ?? ""));
}

function describeProcessQuery({
  activeFilter,
  focusedRecord,
  visibleCount,
  totalCount,
  search,
}: {
  activeFilter: ProcessFilter;
  focusedRecord: ProcessRecord | null;
  visibleCount: number;
  totalCount: number;
  search: string;
}) {
  const noun = visibleCount === 1 ? "process record" : "process records";
  const headline =
    activeFilter.id === "active_work"
      ? `Showing ${visibleCount} of ${totalCount} ${noun} in the technical process lane.`
      : `Showing ${visibleCount} ${noun} for ${activeFilter.label.toLowerCase()}.`;

  const summaryParts = [
    activeFilter.description,
    search ? `Search is narrowing the process lane with “${search}”.` : null,
    focusedRecord
      ? `${focusedRecord.title} is currently framing the workbench.`
      : "Select a technical process object to anchor the workbench.",
  ];

  return {
    headline,
    summary: summaryParts.filter(Boolean).join(" "),
  };
}
