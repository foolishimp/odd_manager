import { useMemo, useState } from "react";
import {
  approveSessionServiceRun,
  rejectSessionServiceRun,
} from "../../lib/api";
import {
  describeCanonicalTerm,
  labelDeliveryStatus,
  presentAmbiguity,
} from "../../lib/presentation";
import { buildSituationModel } from "../../lib/situation";
import type {
  ManagerWorld,
  Selection,
  SessionServiceRunView,
  SessionServiceState,
} from "../../lib/types";
import { useSessionServiceState } from "./useSessionServiceState";

type RuntimePanelProps = {
  projectRoot: string;
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
};

export function RuntimePanel({ projectRoot, world, onSelectSelection }: RuntimePanelProps) {
  const { serviceState, loading, error, refreshService } = useSessionServiceState(projectRoot);
  const [serviceAction, setServiceAction] = useState<string | null>(null);
  const [serviceActionError, setServiceActionError] = useState<string | null>(null);

  const gateRuns = useMemo(
    () => (serviceState?.runs ?? []).filter(isGateRun),
    [serviceState?.runs],
  );

  async function handleApprove(run: SessionServiceRunView) {
    setServiceAction(`approve:${run.run_id}`);
    setServiceActionError(null);
    try {
      await approveSessionServiceRun(projectRoot, run.run_id, run.edge);
      await refreshService({ background: true });
    } catch (caught) {
      setServiceActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setServiceAction(null);
    }
  }

  async function handleReject(run: SessionServiceRunView) {
    const reason = window.prompt(
      `Reject ${run.edge ?? run.run_id}. Provide a reason for the service gate record:`,
    );
    if (reason === null) {
      return;
    }
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      setServiceActionError("Reject requires a non-empty reason.");
      return;
    }
    setServiceAction(`reject:${run.run_id}`);
    setServiceActionError(null);
    try {
      await rejectSessionServiceRun(projectRoot, run.run_id, trimmedReason, run.edge);
      await refreshService({ background: true });
    } catch (caught) {
      setServiceActionError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setServiceAction(null);
    }
  }

  return (
    <div className="odd-grid odd-grid--three">
      <SessionServicePanel
        serviceState={serviceState}
        loading={loading}
        error={error}
        actionError={serviceActionError}
      />

      <BuilderGovernancePanel world={world} onSelectSelection={onSelectSelection} />

      <ServiceGateInbox
        runs={gateRuns}
        serviceState={serviceState}
        action={serviceAction}
        onApprove={handleApprove}
        onReject={handleReject}
        onSelectSelection={onSelectSelection}
        world={world}
      />

      <ServiceWorkerPanel serviceState={serviceState} loading={loading} error={error} />

      <ServiceRunPanel
        serviceState={serviceState}
        loading={loading}
        error={error}
        onSelectSelection={onSelectSelection}
        world={world}
      />

      <RuntimeList
        eyebrow="Automation Runs"
        title="Replay-derived automation runs"
        emptyTitle="No ABG runs yet."
        emptySummary="Start published work to project run aggregates from event truth."
        items={world.runtime.runs.map((run) => ({
          id: run.instance_id,
          label: run.edge ?? run.instance_id,
          summary: `${labelDeliveryStatus(run.status)} · worker ${run.selected_worker_id ?? run.worker_id ?? "unknown"}`,
          tone: run.status === "failed" ? "blocked" : run.status === "completed" ? "converged" : "active",
          selection: { kind: "run", id: run.instance_id } as const,
        }))}
        onSelectSelection={onSelectSelection}
      />

      <RuntimeList
        eyebrow="Graph Calls"
        title="Workflow call boundaries"
        emptyTitle="No graph calls yet."
        emptySummary="Callable truth appears here once the current run materializes graph functions."
        items={world.runtime.graph_calls.map((call) => ({
          id: call.instance_id,
          label: call.graph_function_id ?? call.instance_id,
          summary: `${labelDeliveryStatus(call.status)} · run ${call.run_id ?? "unknown"}`,
          tone: call.status === "failed" ? "blocked" : call.status === "closed" ? "converged" : "active",
          selection: { kind: "graph_call", id: call.instance_id } as const,
        }))}
        onSelectSelection={onSelectSelection}
      />

      <RuntimeList
        eyebrow="Frames"
        title="Recursive execution frames"
        emptyTitle="No recursive frames yet."
        emptySummary="Recursive graph-function expansion will surface here when the current run opens frames."
        items={world.runtime.frames.map((frame) => ({
          id: frame.instance_id,
          label: frame.parent_edge ?? frame.instance_id,
          summary: `${labelDeliveryStatus(frame.status)} · depth ${frame.stack_depth ?? 0}`,
          tone: frame.status === "closed" ? "converged" : frame.status === "open" ? "active" : "pending",
          selection: { kind: "frame", id: frame.instance_id } as const,
        }))}
        onSelectSelection={onSelectSelection}
      />
    </div>
  );
}

function BuilderGovernancePanel({
  world,
  onSelectSelection,
}: {
  world: ManagerWorld;
  onSelectSelection: (selection: Selection) => void;
}) {
  const situation = buildSituationModel(world);
  const summary = world.domain.ambiguity_register.summary;
  const highlightedAmbiguities = [...world.domain.ambiguity_register.ambiguities]
    .sort((left, right) => Number(Boolean(right.blocking)) - Number(Boolean(left.blocking)))
    .slice(0, 4);

  return (
    <section className="panel panel--governance">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">Delivery Blockers</span>
          <h2>Capability readiness and open decisions constrain what the automation lane can do next.</h2>
        </div>
        <p>These are project-model signals. They are not the same thing as live service approvals.</p>
      </div>
      <div className="odd-card-grid odd-card-grid--two">
        <div className="odd-card">
          <span className="panel__eyebrow">Project Model</span>
          <strong>{world.domain.query_contract.version}</strong>
          <p>{world.domain.query_contract.name}</p>
        </div>
        <div className="odd-card">
          <span className="panel__eyebrow">Blocker Register</span>
          <strong>{summary.total ?? world.domain.ambiguity_register.ambiguities.length}</strong>
          <p>{world.domain.ambiguity_register.register_kind}</p>
        </div>
        <div className="odd-card">
          <span className="panel__eyebrow">Active Blockers</span>
          <strong>{situation.blockerCount}</strong>
          <p>Hard-stop or blocking items currently shaping the delivery lane.</p>
        </div>
        <div className="odd-card">
          <span className="panel__eyebrow">Missing Capabilities</span>
          <strong>{situation.missingCapabilityCount}</strong>
          <p>Items waiting on declared or ratified delivery support.</p>
        </div>
      </div>
      {situation.capabilityGaps.length ? (
        <div className="inline-pills">
          {situation.capabilityGaps.slice(0, 4).map((gap) => (
            <span key={gap.canonicalName} className="status-chip attention">
              {gap.label} {gap.count}
            </span>
          ))}
        </div>
      ) : null}
      <div className="list-stack">
        {highlightedAmbiguities.length ? (
          highlightedAmbiguities.map((entry) => (
            <div key={entry.ambiguity_id} className="list-row">
              <div className="list-row__meta">
                <span className="panel__eyebrow">{presentAmbiguity(entry).classificationLabel}</span>
                <span className={`status-chip ${ambiguityTone(entry)}`}>
                  {presentAmbiguity(entry).statusLabel}
                </span>
              </div>
              <strong className="list-row__title">{entry.ambiguity_id}</strong>
              <p className="list-row__summary">{presentAmbiguity(entry).summary}</p>
              <div className="inline-pills">
                {presentAmbiguity(entry).capabilityLabel ? (
                  <span className="status-chip pending">{presentAmbiguity(entry).capabilityLabel}</span>
                ) : null}
                {entry.expected_resolving_edge ? (
                  <button
                    type="button"
                    className="status-chip active"
                    onClick={() =>
                      onSelectSelection(resolveEdgeSelection(world, entry.expected_resolving_edge))
                    }
                  >
                    {describeCanonicalTerm(entry.expected_resolving_edge)}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="status-chip attention"
                  onClick={() => onSelectSelection({ kind: "ambiguity", id: entry.ambiguity_id })}
                >
                  inspect next step
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <strong>No active blockers.</strong>
            <p>The current project model is not reporting blocker-driven stop state.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function SessionServicePanel({
  serviceState,
  loading,
  error,
  actionError,
}: {
  serviceState: SessionServiceState | null;
  loading: boolean;
  error: string | null;
  actionError: string | null;
}) {
  const tone = !serviceState?.configured
    ? "pending"
    : serviceState.available
      ? "converged"
      : "blocked";

  return (
    <section className="panel panel--governance">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">Automation Service</span>
          <h2>The managed session service owns worker sessions and approvals.</h2>
        </div>
        <p>`odd_manager` reads service projections; local shells stay local operator tooling.</p>
      </div>
      <div className="list-stack">
        <div className="odd-card">
          <div className="list-row__meta">
            <span className="panel__eyebrow">Service</span>
            <span className={`status-chip ${tone}`}>{labelDeliveryStatus(tone)}</span>
          </div>
          <strong>
            {serviceState?.base_url ?? "No odd_sdlc_service configured for this odd_manager server."}
          </strong>
          <p>
            {error
              ? error
              : serviceState?.error ??
                (loading
                  ? "Loading automation service snapshot…"
                  : "Automation service status will appear here once odd_sdlc_service is reachable.")}
          </p>
          <div className="inline-pills">
            <span className="status-chip active">runs {serviceState?.runs.length ?? 0}</span>
            <span className="status-chip attention">workers {serviceState?.workers.length ?? 0}</span>
            <span className="status-chip pending">
              observed {serviceState?.observed_at ?? "pending"}
            </span>
          </div>
          {actionError ? <p>{actionError}</p> : null}
        </div>
      </div>
    </section>
  );
}

function ServiceGateInbox({
  runs,
  serviceState,
  action,
  onApprove,
  onReject,
  onSelectSelection,
  world,
}: {
  runs: SessionServiceRunView[];
  serviceState: SessionServiceState | null;
  action: string | null;
  onApprove: (run: SessionServiceRunView) => Promise<void>;
  onReject: (run: SessionServiceRunView) => Promise<void>;
  onSelectSelection: (selection: Selection) => void;
  world: ManagerWorld;
}) {
  return (
    <section className="panel panel--dispatch">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">Gate Inbox</span>
          <h2>Service-reported F_H pauses waiting on operator action.</h2>
        </div>
        <p>Approve or reject the service gate without turning odd_manager into session authority.</p>
      </div>
      <div className="list-stack">
        {!serviceState?.configured ? (
          <div className="empty-state">
            <strong>No service gate surface yet.</strong>
            <p>Configure odd_sdlc_service to surface pending approvals here.</p>
          </div>
        ) : !serviceState.available ? (
          <div className="empty-state">
            <strong>Service gates unavailable.</strong>
            <p>{serviceState.error ?? "odd_sdlc_service could not be reached."}</p>
          </div>
        ) : runs.length ? (
          runs.map((run) => {
            const matchingRun = resolveWorldRunId(world, run.run_id);
            const gateKey = `approve:${run.run_id}`;
            const rejectKey = `reject:${run.run_id}`;
            return (
              <div key={run.run_id} className="list-row">
                <div className="list-row__meta">
                  <span className="panel__eyebrow">F_H Gate</span>
                  <span className="status-chip gated">gated</span>
                </div>
                <strong className="list-row__title">{run.edge ?? run.graph_function ?? run.run_id}</strong>
                <p className="list-row__summary">
                  {run.blocking_reason ?? "Awaiting operator decision."}
                </p>
                <div className="inline-pills">
                  <span className="status-chip active">{run.status}</span>
                  {run.selected_worker ? (
                    <span className="status-chip attention">{run.selected_worker}</span>
                  ) : null}
                  <span className="status-chip pending">{run.run_id}</span>
                </div>
                <div className="agent-console__resource-actions">
                  {matchingRun ? (
                    <button
                      type="button"
                      className="ghost"
                      onClick={() => onSelectSelection({ kind: "run", id: matchingRun })}
                    >
                      Inspect Run
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="ghost"
                    onClick={() => void onReject(run)}
                    disabled={action === gateKey || action === rejectKey}
                  >
                    {action === rejectKey ? "Rejecting..." : "Reject"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void onApprove(run)}
                    disabled={action === gateKey || action === rejectKey}
                  >
                    {action === gateKey ? "Approving..." : "Approve"}
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="empty-state">
            <strong>No pending service gates.</strong>
            <p>When odd_sdlc_service pauses at F_H, the blocking runs will surface here.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ServiceWorkerPanel({
  serviceState,
  loading,
  error,
}: {
  serviceState: SessionServiceState | null;
  loading: boolean;
  error: string | null;
}) {
  return (
    <section className="panel panel--context">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">Service Workers</span>
          <h2>Registered workers owned by odd_sdlc_service.</h2>
        </div>
        <p>These are the dispatch targets the service manages, not local oddterm shells.</p>
      </div>
      <div className="list-stack">
        {!serviceState?.configured ? (
          <div className="empty-state">
            <strong>No service worker registry yet.</strong>
            <p>Once configured, this panel will list persistent named workers and transports.</p>
          </div>
        ) : !serviceState.available ? (
          <div className="empty-state">
            <strong>Worker registry unavailable.</strong>
            <p>{error ?? serviceState.error ?? "odd_sdlc_service could not be reached."}</p>
          </div>
        ) : serviceState.workers.length ? (
          serviceState.workers.map((worker) => (
            <div key={worker.name} className="list-row">
              <div className="list-row__meta">
                <span className="panel__eyebrow">Worker</span>
                <span className={`status-chip ${serviceWorkerTone(worker.status)}`}>
                  {worker.status ?? "unknown"}
                </span>
              </div>
              <strong className="list-row__title">{worker.name}</strong>
              <p className="list-row__summary">
                {worker.agent ?? "agent unknown"} · {worker.transport ?? "transport unknown"}
              </p>
              <div className="inline-pills">
                {worker.remote_host ? (
                  <span className="status-chip attention">{worker.remote_host}</span>
                ) : null}
                <span className="status-chip pending">
                  history {worker.history_bytes ?? 0}
                </span>
                <span className="status-chip active">
                  {worker.last_activity_at ?? "no activity"}
                </span>
              </div>
            </div>
          ))
        ) : (
          <div className="empty-state">
            <strong>No registered workers.</strong>
            <p>Attach workers in odd_sdlc_service and they will appear here.</p>
          </div>
        )}
        {loading && !serviceState ? (
          <div className="empty-state">
            <strong>Loading service workers.</strong>
            <p>Polling odd_sdlc_service for the current worker registry.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function ServiceRunPanel({
  serviceState,
  loading,
  error,
  onSelectSelection,
  world,
}: {
  serviceState: SessionServiceState | null;
  loading: boolean;
  error: string | null;
  onSelectSelection: (selection: Selection) => void;
  world: ManagerWorld;
}) {
  return (
    <section className="panel panel--context">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">Service Runs</span>
          <h2>odd_sdlc_service session view over active runs.</h2>
        </div>
        <p>Use this to compare service orchestration state with the ABG replay projection below.</p>
      </div>
      <div className="list-stack">
        {!serviceState?.configured ? (
          <div className="empty-state">
            <strong>No service run view yet.</strong>
            <p>Set the service endpoint on odd_manager to surface orchestrated run state here.</p>
          </div>
        ) : !serviceState.available ? (
          <div className="empty-state">
            <strong>Service runs unavailable.</strong>
            <p>{error ?? serviceState.error ?? "odd_sdlc_service could not be reached."}</p>
          </div>
        ) : serviceState.runs.length ? (
          serviceState.runs.map((run) => {
            const matchingRun = resolveWorldRunId(world, run.run_id);
            return (
              <button
                key={run.run_id}
                type="button"
                className="list-row"
                onClick={() => {
                  if (matchingRun) {
                    onSelectSelection({ kind: "run", id: matchingRun });
                  }
                }}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">Service Run</span>
                  <span className={`status-chip ${serviceRunTone(run)}`}>{run.status}</span>
                </div>
                <strong className="list-row__title">{run.edge ?? run.graph_function ?? run.run_id}</strong>
                <p className="list-row__summary">
                  {(run.graph_function ?? run.module ?? "graph function unknown") +
                    (run.blocking_reason ? ` · ${run.blocking_reason}` : "")}
                </p>
                <div className="inline-pills">
                  {run.selected_worker ? (
                    <span className="status-chip attention">{run.selected_worker}</span>
                  ) : null}
                  {matchingRun ? <span className="status-chip active">inspectable</span> : null}
                  <span className="status-chip pending">{run.run_id}</span>
                </div>
              </button>
            );
          })
        ) : (
          <div className="empty-state">
            <strong>No service runs currently active.</strong>
            <p>Start or resume a run through odd_sdlc_service to populate this view.</p>
          </div>
        )}
        {loading && !serviceState ? (
          <div className="empty-state">
            <strong>Loading service runs.</strong>
            <p>Polling odd_sdlc_service for active run state.</p>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function RuntimeList({
  eyebrow,
  title,
  emptyTitle,
  emptySummary,
  items,
  onSelectSelection,
}: {
  eyebrow: string;
  title: string;
  emptyTitle: string;
  emptySummary: string;
  items: Array<{
    id: string;
    label: string;
    summary: string;
    tone: "converged" | "pending" | "active" | "gated" | "blocked" | "attention";
    selection: Selection;
  }>;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <section className="panel panel--context">
      <div className="panel__heading">
        <div>
          <span className="panel__eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>
      <div className="list-stack">
        {items.length ? (
          items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="list-row"
              onClick={() => onSelectSelection(item.selection)}
            >
              <div className="list-row__meta">
                <span className="panel__eyebrow">{eyebrow}</span>
                <span className={`status-chip ${item.tone}`}>{item.tone}</span>
              </div>
              <strong className="list-row__title">{item.label}</strong>
              <p className="list-row__summary">{item.summary}</p>
            </button>
          ))
        ) : (
          <div className="empty-state">
            <strong>{emptyTitle}</strong>
            <p>{emptySummary}</p>
          </div>
        )}
      </div>
    </section>
  );
}

function resolveWorldRunId(world: ManagerWorld, runId: string) {
  const matchingRun = world.runtime.runs.find(
    (run) => run.instance_id === runId || run.run_id === runId,
  );
  return matchingRun?.instance_id ?? null;
}

function isGateRun(run: SessionServiceRunView) {
  const status = String(run.status ?? "").toLowerCase();
  const blockingReason = String(run.blocking_reason ?? "").toLowerCase();
  return (
    status.includes("gate") ||
    status.includes("fh") ||
    blockingReason.includes("gate") ||
    blockingReason.includes("approval") ||
    blockingReason.includes("fh")
  );
}

function serviceRunTone(run: SessionServiceRunView) {
  const status = String(run.status ?? "").toLowerCase();
  const blockingReason = String(run.blocking_reason ?? "").toLowerCase();
  if (status.includes("fail") || status.includes("error")) {
    return "blocked";
  }
  if (status.includes("complete") || status.includes("closed") || status.includes("converged")) {
    return "converged";
  }
  if (status.includes("gate") || status.includes("fh") || blockingReason.includes("gate")) {
    return "gated";
  }
  if (status.includes("pending") || status.includes("queued")) {
    return "pending";
  }
  return "active";
}

function serviceWorkerTone(status: string | null) {
  const normalized = String(status ?? "").toLowerCase();
  if (normalized.includes("fail") || normalized.includes("error")) {
    return "blocked";
  }
  if (normalized.includes("idle") || normalized.includes("ready")) {
    return "pending";
  }
  if (normalized.includes("live") || normalized.includes("active") || normalized.includes("running")) {
    return "active";
  }
  return "attention";
}

function ambiguityTone(entry: ManagerWorld["domain"]["ambiguity_register"]["ambiguities"][number]) {
  if (entry.blocking || entry.hard_stop || entry.policy_action === "hard_block") {
    return "blocked" as const;
  }
  if (entry.policy_action === "escalate_fh") {
    return "gated" as const;
  }
  if (entry.policy_action === "carry" || entry.policy_action === "observe") {
    return "active" as const;
  }
  return "attention" as const;
}

function resolveEdgeSelection(world: ManagerWorld, edge: string): Selection {
  const functionEntry = world.domain.functions.find((entry) => entry.id === edge);
  if (functionEntry) {
    return { kind: "function", id: functionEntry.id };
  }
  const workorder = world.domain.workorders.find(
    (entry) => entry.id === edge || entry.graph_function_name === edge,
  );
  if (workorder) {
    return { kind: "workorder", id: workorder.id };
  }
  return { kind: "graph", id: world.graph_set.graphs[0]?.id ?? "graph.bootstrap" };
}
