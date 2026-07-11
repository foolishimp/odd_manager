import type {
  BuildExecution,
  BuildRequest,
} from "@odd-manager/developer-control-contracts";
import type { CapabilityViewProps } from "../../contracts/developer-control";
import { CapabilityAvailability } from "../../components/primitives/CapabilityAvailability";
import type { BuildControlMessage } from "./messages";
import type { BuildControlState } from "./state";

const ACTIVE_STATES = new Set(["queued", "starting", "running", "waiting_human", "stale", "disconnected"]);

function timeLabel(value: string | null) {
  if (!value) return "Not observed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortIdentity(value: string | null) {
  if (!value) return "Not assigned";
  return value.length > 34 ? `${value.slice(0, 16)}...${value.slice(-12)}` : value;
}

function executionRequest(state: BuildControlState, execution: BuildExecution | null) {
  return execution
    ? state.snapshot?.requests.find((entry) => entry.requestId === execution.requestId) ?? null
    : null;
}

function orderedExecutions(state: BuildControlState) {
  return [...(state.snapshot?.executions ?? [])]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
}

function UnavailableBuildControl({
  state,
  contribution,
  dispatch,
}: CapabilityViewProps<BuildControlState, BuildControlMessage>) {
  const descriptorRefs = contribution.availability.kind === "unavailable"
    ? contribution.availability.missingRefs
    : contribution.requiredContractRefs;
  return (
    <section className="developer-capability build-control" aria-labelledby="build-control-heading">
      <header className="developer-capability__header">
        <div>
          <span className="developer-capability__kicker">Build</span>
          <h2 id="build-control-heading">Build Control</h2>
        </div>
        <CapabilityAvailability contribution={contribution} showDetail={false} />
      </header>
      <CapabilityAvailability contribution={contribution} />
      <dl className="developer-capability__facts">
        <div><dt>Descriptor</dt><dd>{descriptorRefs.join(", ")}</dd></div>
        <div><dt>Submit command</dt><dd>Not admitted</dd></div>
        <div><dt>Shell fallback</dt><dd>Prohibited</dd></div>
      </dl>
      {state.error ? <div className="build-control__error" role="alert">{state.error}</div> : null}
      <button
        type="button"
        className="secondary"
        onClick={() => dispatch({ type: "build/refresh-requested" })}
        disabled={!state.basisRevision || state.status === "loading"}
      >
        Refresh Carrier
      </button>
    </section>
  );
}

function ExecutionIdentity({ execution, request }: { execution: BuildExecution; request: BuildRequest | null }) {
  const terminal = execution.processOutcome?.terminalResult ?? null;
  return (
    <dl className="build-control__identity">
      <div><dt>Execution</dt><dd title={execution.executionId}>{shortIdentity(execution.executionId)}</dd></div>
      <div><dt>Request</dt><dd title={execution.requestId}>{shortIdentity(execution.requestId)}</dd></div>
      <div><dt>Correlation</dt><dd title={execution.correlationId}>{shortIdentity(execution.correlationId)}</dd></div>
      <div><dt>Requester</dt><dd>{request?.requestedBy ?? "Unavailable"}</dd></div>
      <div><dt>Revision</dt><dd><code>{execution.revision.revision.slice(0, 12)}</code></dd></div>
      <div><dt>Worksite</dt><dd title={execution.worksiteRef}>{shortIdentity(execution.worksiteRef)}</dd></div>
      <div><dt>Process</dt><dd title={execution.processRef ?? undefined}>{shortIdentity(execution.processRef)}</dd></div>
      <div><dt>Run</dt><dd title={execution.runRefs.join(", ")}>{execution.runRefs.length ? execution.runRefs.map(shortIdentity).join(", ") : "Not admitted"}</dd></div>
      <div><dt>Started</dt><dd>{timeLabel(execution.startedAt)}</dd></div>
      <div><dt>Heartbeat</dt><dd>{timeLabel(execution.heartbeatAt)}</dd></div>
      <div><dt>Reconnected</dt><dd>{timeLabel(execution.resumedAt)}</dd></div>
      <div><dt>Reconnect actor</dt><dd>{execution.resumedBy ?? "Not reconnected"}</dd></div>
      <div><dt>Process outcome</dt><dd>{execution.processOutcome?.kind ?? "Pending"}</dd></div>
      <div><dt>Carrier result</dt><dd>{terminal?.kind ?? "Not admitted"}</dd></div>
      <div><dt>Assurance</dt><dd>{execution.assuranceSummaryRef ?? "Not established"}</dd></div>
    </dl>
  );
}

export function BuildControlView(props: CapabilityViewProps<BuildControlState, BuildControlMessage>) {
  const { state, contribution, dispatch } = props;
  if (contribution.availability.kind !== "ready") return <UnavailableBuildControl {...props} />;

  const descriptor = state.snapshot?.descriptorAdmission.descriptor ?? null;
  const executions = orderedExecutions(state);
  const selected = executions.find((entry) => entry.executionId === state.selectedExecutionId) ?? null;
  const request = executionRequest(state, selected);
  const busy = state.status === "loading" || state.status === "submitting" || state.status === "cancelling" || state.status === "resuming";
  const canCancel = Boolean(
    selected
    && ACTIVE_STATES.has(selected.state)
    && descriptor?.supportedCommands.includes("cancel"),
  );
  const canResume = Boolean(
    selected
    && ["stale", "disconnected"].includes(selected.state)
    && descriptor?.supportedCommands.includes("resume"),
  );

  return (
    <section className="developer-capability build-control" aria-labelledby="build-control-heading">
      <header className="developer-capability__header build-control__header">
        <div>
          <span className="developer-capability__kicker">Build</span>
          <h2 id="build-control-heading">Build Control</h2>
        </div>
        <div className="build-control__header-actions">
          <CapabilityAvailability contribution={contribution} showDetail={false} />
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: "build/refresh-requested" })}
            disabled={busy}
          >
            Refresh
          </button>
        </div>
      </header>

      {state.error ? <div className="build-control__error" role="alert">{state.error}</div> : null}

      <section className="build-control__admission" aria-label="Build carrier admission">
        <div>
          <span className="developer-capability__kicker">Admitted Carrier</span>
          <strong>{descriptor?.carrierRef ?? "Descriptor loading"}</strong>
          <code>{descriptor?.descriptorRef ?? contribution.requiredContractRefs[0]}</code>
        </div>
        <dl>
          <div><dt>Start target</dt><dd>{descriptor?.publicStartTarget ?? "Unavailable"}</dd></div>
          <div><dt>Input schema</dt><dd>{descriptor?.inputSchemaRef ?? "Unavailable"}</dd></div>
          <div><dt>Revision basis</dt><dd><code>{state.basisRevision?.revision.slice(0, 12) ?? "Unobserved"}</code></dd></div>
        </dl>
      </section>

      <section className="build-control__submit" aria-label="Submit Build Request">
        <label>
          <span>Build inputs</span>
          <textarea
            value={state.inputDraft}
            onChange={(event) => dispatch({ type: "build/input-edited", value: event.currentTarget.value })}
            rows={5}
            spellCheck={false}
            disabled={busy || state.status === "stale"}
          />
        </label>
        <div>
          <span>Inputs are validated by the installed carrier adapter.</span>
          <button
            type="button"
            onClick={() => dispatch({ type: "build/submit-requested", actorRef: "actor://operator/current" })}
            disabled={busy || state.status === "stale" || !descriptor}
          >
            {state.status === "submitting" ? "Submitting" : "Submit Build"}
          </button>
        </div>
      </section>

      <section className="build-control__scheduler" aria-label="Build scheduler">
        <div><span>Running</span><strong>{state.snapshot?.scheduler.runningCount ?? 0}</strong></div>
        <div><span>Queued</span><strong>{state.snapshot?.scheduler.queuedCount ?? 0}</strong></div>
        <div><span>Available slots</span><strong>{state.snapshot?.scheduler.availableSlots ?? 0}</strong></div>
        <div><span>Concurrency limit</span><strong>{state.snapshot?.scheduler.maxConcurrent ?? 0}</strong></div>
      </section>

      <div className="build-control__workspace">
        <section className="build-control__executions" aria-label="Build Executions">
          <header>
            <h3>Executions</h3>
            <span>{executions.length}</span>
          </header>
          {executions.length ? (
            <ol>
              {executions.map((execution) => {
                const executionRequestRecord = executionRequest(state, execution);
                return (
                  <li key={execution.executionId}>
                    <button
                      type="button"
                      className={state.selectedExecutionId === execution.executionId ? "is-selected" : ""}
                      onClick={() => dispatch({ type: "build/execution-selected", executionId: execution.executionId })}
                    >
                      <span>
                        <strong>{execution.state.replace("_", " ")}</strong>
                        <small>{executionRequestRecord?.requestedBy ?? execution.project.label}</small>
                      </span>
                      <code>{execution.executionId}</code>
                      <time>{timeLabel(execution.updatedAt)}</time>
                    </button>
                  </li>
                );
              })}
            </ol>
          ) : <p className="build-control__empty">No Build Requests have been submitted for this Project.</p>}
        </section>

        <main className="build-control__detail">
          {selected ? (
            <>
              <header>
                <div>
                  <span className="developer-capability__kicker">Selected Execution</span>
                  <h3 data-state={selected.state}>{selected.state.replace("_", " ")}</h3>
                </div>
                <div className="build-control__header-actions">
                  {canResume ? (
                    <button
                      type="button"
                      onClick={() => dispatch({ type: "build/resume-requested", actorRef: "actor://operator/current" })}
                      disabled={busy}
                    >
                      {state.status === "resuming" ? "Reconnecting" : "Reconnect"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => dispatch({ type: "build/attach-requested", actorRef: "actor://operator/current" })}
                    disabled={busy}
                  >
                    {selected.state === "stale" || selected.state === "disconnected" ? "Read Stored Output" : "Attach Output"}
                  </button>
                  <button
                    type="button"
                    className="danger"
                    onClick={() => dispatch({ type: "build/cancel-requested", actorRef: "actor://operator/current" })}
                    disabled={!canCancel || busy}
                  >
                    Cancel
                  </button>
                </div>
              </header>
              <ExecutionIdentity execution={selected} request={request} />
              <section className="build-control__output" aria-label="Build output">
                <div>
                  <header><h4>Standard output</h4>{state.attached?.output.stdoutTruncated ? <span>Tail</span> : null}</header>
                  <pre>{state.attached?.output.stdout || "No standard output observed."}</pre>
                </div>
                <div>
                  <header><h4>Standard error</h4>{state.attached?.output.stderrTruncated ? <span>Tail</span> : null}</header>
                  <pre>{state.attached?.output.stderr || "No standard error observed."}</pre>
                </div>
              </section>
            </>
          ) : <p className="build-control__empty">Select an execution to inspect lifecycle, correlation, and output.</p>}
        </main>
      </div>
    </section>
  );
}
