import type {
  AssetDelivery,
  GateAssessment,
} from "@odd-manager/developer-control-contracts";
import type { CapabilityViewProps } from "../../contracts/developer-control";
import { CapabilityAvailability } from "../../components/primitives/CapabilityAvailability";
import type { AssuranceAttentionMessage } from "./messages";
import type { AssuranceAttentionState } from "./state";

const INSPECT_REACTION = "reaction://odd_manager/open-run-inspector";

function timeLabel(value: string | null | undefined) {
  if (!value) return "Not observed";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function shortIdentity(value: string | null | undefined) {
  if (!value) return "Not admitted";
  return value.length > 44 ? `${value.slice(0, 22)}...${value.slice(-16)}` : value;
}

function EvidenceDetail({ row }: { row: GateAssessment | AssetDelivery }) {
  const isGate = "gateRef" in row;
  return (
    <section className="assurance-attention__detail" aria-label="Selected assurance assessment">
      <header>
        <div>
          <span className="developer-capability__kicker">Selected Assessment</span>
          <h3>{row.label}</h3>
        </div>
        <strong data-status={row.status}>{row.status.replace("_", " ")}</strong>
      </header>
      <p>{row.detail}</p>
      <dl>
        <div><dt>Requirement</dt><dd>{row.requirementRef}</dd></div>
        {isGate ? <div><dt>Gate</dt><dd>{row.gateRef}</dd></div> : <div><dt>Artifact</dt><dd>{row.artifactRef ?? "Not delivered"}</dd></div>}
        {isGate ? <div><dt>Regime</dt><dd>{row.regime}</dd></div> : null}
        <div><dt>Producer</dt><dd>{row.producerRef ?? "Not admitted"}</dd></div>
        <div><dt>Digest</dt><dd>{isGate ? row.evidenceDigest ?? "Not admitted" : row.digest ?? "Not admitted"}</dd></div>
        <div><dt>Revision</dt><dd>{row.revision.revision.slice(0, 12)}</dd></div>
      </dl>
      <div className="assurance-attention__refs">
        <span>Evidence and source refs</span>
        <ul>
          {[...new Set([...row.evidenceRefs, ...row.sourceRefs])].map((sourceRef) => (
            <li key={sourceRef}><code>{sourceRef}</code></li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function AssuranceAttentionView({
  state,
  contribution,
  dispatch,
}: CapabilityViewProps<AssuranceAttentionState, AssuranceAttentionMessage>) {
  const snapshot = state.snapshot;
  const selectedGate = snapshot?.gateAssessments.find((entry) => entry.gateRef === state.selectedAssessmentRef) ?? null;
  const selectedAsset = snapshot?.assetDeliveries.find((entry) => entry.requirementRef === state.selectedAssessmentRef) ?? null;
  const selectedAttention = snapshot?.attentionItems.find((entry) => entry.attentionId === state.selectedAttentionId) ?? null;
  const busy = state.status === "loading";

  return (
    <section className="developer-capability assurance-attention" aria-labelledby="assurance-attention-heading">
      <header className="developer-capability__header assurance-attention__header">
        <div>
          <span className="developer-capability__kicker">Assure</span>
          <h2 id="assurance-attention-heading">Assurance &amp; Attention</h2>
        </div>
        <div className="assurance-attention__header-actions">
          <CapabilityAvailability contribution={contribution} showDetail={false} />
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: "assurance/refresh-requested" })}
            disabled={busy || !state.basisRevision}
          >
            Refresh
          </button>
        </div>
      </header>

      {state.error ? <div className="assurance-attention__error" role="alert">{state.error}</div> : null}
      {snapshot?.catalogAdmission.status !== "ready" ? (
        <div className="assurance-attention__catalog-state" role="status">
          <strong>{snapshot?.catalogAdmission.status ?? "loading"}</strong>
          <span>{snapshot?.catalogAdmission.reason ?? "Resolving assurance catalog."}</span>
          <code>{snapshot?.catalogAdmission.sourceRefs[0] ?? contribution.requiredContractRefs[0]}</code>
        </div>
      ) : null}

      <section className="assurance-attention__basis" aria-label="Assurance basis">
        <div><span>Execution</span><strong title={snapshot?.execution?.executionId}>{shortIdentity(snapshot?.execution?.executionId)}</strong></div>
        <div><span>Revision</span><strong>{snapshot?.revision?.revision.slice(0, 12) ?? "Not observed"}</strong></div>
        <div><span>Evidence bundle</span><strong title={snapshot?.evidenceBundleRef ?? undefined}>{shortIdentity(snapshot?.evidenceBundleRef)}</strong></div>
        <div><span>Assessed</span><strong>{timeLabel(snapshot?.observedAt)}</strong></div>
      </section>

      <section className="assurance-attention__summary" aria-label="Assurance summary">
        <div data-posture={snapshot?.summary.posture ?? "unassessed"}>
          <span>Posture</span><strong>{snapshot?.summary.posture.replace("_", " ") ?? "unassessed"}</strong>
        </div>
        <div><span>Gates satisfied</span><strong>{snapshot?.summary.gateCounts.satisfied ?? 0}/{snapshot?.summary.gateCounts.total ?? 0}</strong></div>
        <div><span>Assets delivered</span><strong>{snapshot?.summary.assetCounts.delivered ?? 0}/{snapshot?.summary.assetCounts.total ?? 0}</strong></div>
        <div><span>Blocking attention</span><strong>{snapshot?.summary.blockingAttentionCount ?? 0}</strong></div>
      </section>

      <div className="assurance-attention__modes" role="group" aria-label="Assurance view">
        <button
          type="button"
          className={state.filter === "all" ? "is-active" : ""}
          onClick={() => dispatch({ type: "assurance/filter-selected", filter: "all" })}
        >
          Matrix
        </button>
        <button
          type="button"
          className={state.filter === "attention" ? "is-active" : ""}
          onClick={() => dispatch({ type: "assurance/filter-selected", filter: "attention" })}
        >
          Attention {snapshot?.attentionItems.length ?? 0}
        </button>
      </div>

      {state.filter === "all" ? (
        <div className="assurance-attention__matrix-workspace">
          <div className="assurance-attention__matrices">
            <section aria-label="Required gate assurance">
              <header><h3>Required Gates</h3><span>{snapshot?.gateAssessments.length ?? 0}</span></header>
              <div className="assurance-attention__table-wrap">
                <table>
                  <thead><tr><th>Gate</th><th>Regime</th><th>Status</th><th>Evidence</th></tr></thead>
                  <tbody>
                    {snapshot?.gateAssessments.map((gate) => (
                      <tr key={gate.gateRef} className={state.selectedAssessmentRef === gate.gateRef ? "is-selected" : ""}>
                        <td><button type="button" onClick={() => dispatch({ type: "assurance/assessment-selected", assessmentRef: gate.gateRef })}><strong>{gate.label}</strong><code>{gate.requirementRef}</code></button></td>
                        <td><span className="assurance-attention__regime">{gate.regime}</span></td>
                        <td><span data-status={gate.status}>{gate.status.replace("_", " ")}</span></td>
                        <td>{gate.evidenceRefs.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section aria-label="Expected asset delivery">
              <header><h3>Expected Assets</h3><span>{snapshot?.assetDeliveries.length ?? 0}</span></header>
              <div className="assurance-attention__table-wrap">
                <table>
                  <thead><tr><th>Asset</th><th>Status</th><th>Producer</th><th>Evidence</th></tr></thead>
                  <tbody>
                    {snapshot?.assetDeliveries.map((asset) => (
                      <tr key={asset.requirementRef} className={state.selectedAssessmentRef === asset.requirementRef ? "is-selected" : ""}>
                        <td><button type="button" onClick={() => dispatch({ type: "assurance/assessment-selected", assessmentRef: asset.requirementRef })}><strong>{asset.label}</strong><code>{asset.requirementRef}</code></button></td>
                        <td><span data-status={asset.status}>{asset.status}</span></td>
                        <td title={asset.producerRef ?? undefined}>{shortIdentity(asset.producerRef)}</td>
                        <td>{asset.evidenceRefs.length}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
          {selectedGate ? <EvidenceDetail row={selectedGate} /> : selectedAsset ? <EvidenceDetail row={selectedAsset} /> : null}
        </div>
      ) : (
        <div className="assurance-attention__attention-workspace">
          <section className="assurance-attention__attention-list" aria-label="Attention Items">
            <header><h3>Attention Items</h3><span>{snapshot?.attentionItems.length ?? 0}</span></header>
            {snapshot?.attentionItems.length ? (
              <ol>
                {snapshot.attentionItems.map((item) => (
                  <li key={item.attentionId}>
                    <button
                      type="button"
                      className={state.selectedAttentionId === item.attentionId ? "is-selected" : ""}
                      data-severity={item.severity}
                      onClick={() => dispatch({ type: "attention/item-selected", attentionId: item.attentionId })}
                    >
                      <span>{item.severity}</span>
                      <strong>{item.reason}</strong>
                      <code>{item.sourceRef}</code>
                    </button>
                  </li>
                ))}
              </ol>
            ) : <p>No unresolved assurance conditions.</p>}
          </section>
          {selectedAttention ? (
            <section className="assurance-attention__attention-detail" aria-label="Selected Attention Item">
              <header><span className="developer-capability__kicker">Selected Attention</span><strong data-severity={selectedAttention.severity}>{selectedAttention.severity}</strong></header>
              <h3>{selectedAttention.reason}</h3>
              <dl>
                <div><dt>Source</dt><dd>{selectedAttention.sourceRef}</dd></div>
                <div><dt>Correlation</dt><dd>{selectedAttention.correlationId}</dd></div>
                <div><dt>Observed</dt><dd>{timeLabel(selectedAttention.observedAt)}</dd></div>
              </dl>
              {selectedAttention.reactionRefs.includes(INSPECT_REACTION) ? (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => dispatch({
                    type: "attention/reaction-requested",
                    attentionId: selectedAttention.attentionId,
                    reactionRef: INSPECT_REACTION,
                  })}
                >
                  Open Run Inspector
                </button>
              ) : null}
            </section>
          ) : null}
        </div>
      )}

      <div className="assurance-attention__footer-actions">
        <button
          type="button"
          className="secondary"
          onClick={() => dispatch({ type: "assurance/run-inspector-requested" })}
          disabled={!snapshot?.execution}
        >
          Open Run Inspector
        </button>
      </div>
    </section>
  );
}
