import { useId } from "react";
import type { SpecificationProposal } from "@odd-manager/developer-control-contracts";
import type { CapabilityViewProps } from "../../contracts/developer-control";
import { CapabilityAvailability } from "../../components/primitives/CapabilityAvailability";
import type { SpecificationProposalMessage } from "./messages";
import {
  selectProposalCanAccept,
  selectProposalDiff,
  selectProposalIsCurrent,
  type ProposalDiffLine,
} from "./selectors";
import type { SpecificationProposalState } from "./state";

const OPERATOR_REF = "actor://odd_manager/local-operator";

function shortRevision(value: string | null | undefined) {
  if (!value) return "unavailable";
  return value.length > 14 ? value.slice(0, 14) : value;
}

function displayTimestamp(value: string) {
  return value.replace("T", " ").replace(/\.\d{3}Z$/, " UTC");
}

function statusLabel(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function diffLineLabel(line: ProposalDiffLine) {
  if (line.kind === "addition") return "+";
  if (line.kind === "removal") return "-";
  if (line.kind === "meta") return "";
  return " ";
}

function ProposalDiff({ proposal }: { proposal: SpecificationProposal }) {
  const files = selectProposalDiff(proposal);
  return (
    <section className="specification-proposal__diff" aria-labelledby="proposal-diff-heading">
      <header>
        <div>
          <span>Candidate change</span>
          <h3 id="proposal-diff-heading">Structured Diff</h3>
        </div>
        <strong>{files.length} file{files.length === 1 ? "" : "s"}</strong>
      </header>
      {files.map((file) => (
        <section className="specification-proposal__diff-file" key={file.path} aria-label={`Diff for ${file.path}`}>
          <header><code>{file.path}</code></header>
          <div className="specification-proposal__diff-lines" role="table" aria-label={`Changed lines in ${file.path}`}>
            {file.lines.map((line, index) => (
              <div
                className={`specification-proposal__diff-line is-${line.kind}`}
                role="row"
                key={`${line.kind}-${line.oldLine ?? "x"}-${line.newLine ?? "x"}-${index}`}
              >
                <span role="cell" aria-label="Old line">{line.oldLine ?? ""}</span>
                <span role="cell" aria-label="New line">{line.newLine ?? ""}</span>
                <span role="cell" aria-hidden="true">{diffLineLabel(line)}</span>
                <code role="cell">{line.content || " "}</code>
              </div>
            ))}
          </div>
        </section>
      ))}
    </section>
  );
}

function ProposalFacts({ proposal }: { proposal: SpecificationProposal }) {
  return (
    <dl className="specification-proposal__facts">
      <div><dt>Status</dt><dd data-status={proposal.status}>{statusLabel(proposal.status)}</dd></div>
      <div><dt>Proposal</dt><dd><code>{proposal.proposalId}</code></dd></div>
      <div><dt>Basis</dt><dd><code>{shortRevision(proposal.basisRevision.specificationDigest)}</code></dd></div>
      <div><dt>Participant</dt><dd><code>{proposal.participantRef}</code></dd></div>
      <div><dt>Created</dt><dd>{displayTimestamp(proposal.createdAt)}</dd></div>
      <div><dt>Predecessor</dt><dd>{proposal.predecessorProposalId ? <code>{proposal.predecessorProposalId}</code> : "None"}</dd></div>
    </dl>
  );
}

function ValidationResults({ proposal }: { proposal: SpecificationProposal }) {
  return (
    <section className="specification-proposal__validation" aria-labelledby="proposal-validation-heading">
      <header>
        <h3 id="proposal-validation-heading">Deterministic Validation</h3>
        <span>{proposal.validation.length} checks</span>
      </header>
      {proposal.validation.length > 0 ? (
        <ul>
          {proposal.validation.map((entry) => (
            <li key={entry.checkRef} data-status={entry.status}>
              <span>{statusLabel(entry.status)}</span>
              <div>
                <strong>{entry.checkRef.split("/").slice(-1)[0]}</strong>
                <p>{entry.detail}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="specification-proposal__empty">Not yet validated.</p>
      )}
    </section>
  );
}

export function SpecificationProposalView({
  state,
  context,
  contribution,
  dispatch,
}: CapabilityViewProps<SpecificationProposalState, SpecificationProposalMessage>) {
  const attachmentInputId = useId();
  const promptInputId = useId();
  const refinementInputId = useId();
  const unavailable = contribution.availability.kind !== "ready";
  const busy = ["loading", "generating", "validating", "accepting", "rejecting"].includes(state.status);
  const proposal = state.currentProposal;
  const terminal = proposal
    ? ["accepted", "rejected", "superseded"].includes(proposal.status)
    : false;
  const canAccept = selectProposalCanAccept(proposal);
  const currentBasis = selectProposalIsCurrent(proposal, state.basisRevision);
  const participantRef = contribution.availability.kind === "ready"
    ? contribution.availability.contractRefs.find((entry) => entry.startsWith("participant://")) ?? "participant unavailable"
    : "participant unavailable";

  return (
    <section className="developer-capability specification-proposal" aria-labelledby="specification-proposal-heading">
      <header className="developer-capability__header specification-proposal__header">
        <div>
          <span className="developer-capability__kicker">Tune</span>
          <h2 id="specification-proposal-heading">Specification Proposal</h2>
        </div>
        <CapabilityAvailability contribution={contribution} showDetail={false} />
      </header>

      {unavailable ? <CapabilityAvailability contribution={contribution} /> : (
        <>
          <section className="specification-proposal__composer" aria-labelledby="proposal-composer-heading">
            <header>
              <div>
                <span>Candidate truth</span>
                <h3 id="proposal-composer-heading">Propose Specification Change</h3>
              </div>
              <dl>
                <div><dt>Project</dt><dd>{context.project.label}</dd></div>
                <div><dt>Basis</dt><dd><code>{shortRevision(context.revision?.specificationDigest)}</code></dd></div>
                <div><dt>Participant</dt><dd><code>{participantRef}</code></dd></div>
              </dl>
            </header>

            <div className="specification-proposal__context">
              <label htmlFor={attachmentInputId}>Context reference</label>
              <div>
                <input
                  id={attachmentInputId}
                  value={state.contextAttachmentDraft}
                  onChange={(event) => dispatch({ type: "proposal/context-attachment-edited", value: event.target.value })}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      dispatch({ type: "proposal/context-attached" });
                    }
                  }}
                  placeholder="specification/requirements/12-change-control.md"
                  disabled={busy}
                />
                <button
                  type="button"
                  className="secondary"
                  onClick={() => dispatch({ type: "proposal/context-attached" })}
                  disabled={busy || !state.contextAttachmentDraft.trim() || state.contextAttachmentRefs.length >= 12}
                >
                  Attach
                </button>
              </div>
              {state.contextAttachmentRefs.length > 0 ? (
                <ul aria-label="Attached proposal context">
                  {state.contextAttachmentRefs.map((sourceRef) => (
                    <li key={sourceRef}>
                      <code>{sourceRef}</code>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => dispatch({ type: "proposal/context-removed", sourceRef })}
                        disabled={busy}
                        aria-label={`Remove ${sourceRef}`}
                      >
                        Remove
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <label htmlFor={promptInputId}>Proposal request</label>
            <textarea
              id={promptInputId}
              value={state.promptDraft}
              onChange={(event) => dispatch({ type: "proposal/prompt-edited", value: event.target.value })}
              rows={5}
              disabled={busy}
            />
            <div className="specification-proposal__commands">
              <button
                type="button"
                onClick={() => dispatch({ type: "proposal/generate-requested" })}
                disabled={busy || !state.promptDraft.trim() || !context.revision}
              >
                {state.status === "generating" ? "Generating" : "Generate Proposal"}
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => dispatch({ type: "proposal/history-requested" })}
                disabled={busy}
              >
                Refresh History
              </button>
            </div>
          </section>

          {state.error ? <div className="specification-proposal__error" role="alert">{state.error}</div> : null}

          <div className="specification-proposal__workspace">
            <main>
              {proposal ? (
                <>
                  <section className="specification-proposal__summary" aria-labelledby="proposal-summary-heading">
                    <header>
                      <div>
                        <span>Selected proposal</span>
                        <h3 id="proposal-summary-heading">{proposal.summary}</h3>
                      </div>
                      <strong data-status={proposal.status}>{statusLabel(proposal.status)}</strong>
                    </header>
                    <p>{proposal.prompt}</p>
                    <ProposalFacts proposal={proposal} />
                    {!currentBasis && !terminal ? (
                      <div className="specification-proposal__error" role="status">
                        <span>This proposal is based on an earlier Project Revision.</span>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => dispatch({ type: "proposal/regenerate-requested" })}
                          disabled={busy || !state.basisRevision}
                        >
                          Regenerate on Current Revision
                        </button>
                      </div>
                    ) : null}
                    {proposal.contextAttachments.length > 0 ? (
                      <div className="specification-proposal__used-context">
                        <span>Context used</span>
                        <ul>
                          {proposal.contextAttachments.map((attachment) => (
                            <li key={attachment.sourceRef}>
                              <code>{attachment.sourceRef}</code>
                              <span>{attachment.kind}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                  </section>

                  <ProposalDiff proposal={proposal} />
                  <ValidationResults proposal={proposal} />

                  {proposal.resultingRevision ? (
                    <dl className="specification-proposal__result">
                      <div><dt>Resulting revision</dt><dd><code>{shortRevision(proposal.resultingRevision.sourceDigest)}</code></dd></div>
                      <div><dt>Specification digest</dt><dd><code>{shortRevision(proposal.resultingRevision.specificationDigest)}</code></dd></div>
                      <div><dt>Decision actor</dt><dd><code>{proposal.decision?.actorRef}</code></dd></div>
                    </dl>
                  ) : null}

                  {!terminal ? (
                    <section className="specification-proposal__decision" aria-labelledby="proposal-decision-heading">
                      <header>
                        <h3 id="proposal-decision-heading">Decision</h3>
                        <span>{OPERATOR_REF}</span>
                      </header>
                      <div className="specification-proposal__commands">
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => dispatch({ type: "proposal/validate-requested" })}
                          disabled={busy || !currentBasis}
                        >
                          {state.status === "validating" ? "Validating" : "Validate"}
                        </button>
                        <button
                          type="button"
                          onClick={() => dispatch({ type: "proposal/accept-requested", actorRef: OPERATOR_REF })}
                          disabled={busy || !canAccept || !currentBasis}
                        >
                          {state.status === "accepting" ? "Accepting" : "Accept"}
                        </button>
                        <button
                          type="button"
                          className="secondary"
                          onClick={() => dispatch({ type: "proposal/reject-requested", actorRef: OPERATOR_REF })}
                          disabled={busy}
                        >
                          {state.status === "rejecting" ? "Rejecting" : "Reject"}
                        </button>
                      </div>
                      <label htmlFor={refinementInputId}>Refinement request</label>
                      <textarea
                        id={refinementInputId}
                        value={state.refinementDraft}
                        onChange={(event) => dispatch({ type: "proposal/refinement-edited", value: event.target.value })}
                        rows={3}
                        disabled={busy}
                      />
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => dispatch({ type: "proposal/refine-requested" })}
                        disabled={busy || !state.refinementDraft.trim()}
                      >
                        Refine Proposal
                      </button>
                    </section>
                  ) : null}
                </>
              ) : (
                <div className="specification-proposal__empty" role="status">
                  {state.status === "loading" ? "Loading proposal history" : "No proposal selected"}
                </div>
              )}
            </main>

            <aside className="specification-proposal__history" aria-labelledby="proposal-history-heading">
              <header>
                <h3 id="proposal-history-heading">History</h3>
                <span>{state.history.length}/{state.retentionLimit}</span>
              </header>
              {state.historyTruncated ? <p>Oldest records truncated by retention policy.</p> : null}
              {state.history.length > 0 ? (
                <ol>
                  {state.history.map((entry) => (
                    <li key={entry.proposalId}>
                      <button
                        type="button"
                        className={entry.proposalId === state.selectedProposalId ? "is-selected" : ""}
                        onClick={() => dispatch({ type: "proposal/selected", proposalId: entry.proposalId })}
                      >
                        <span>{entry.summary}</span>
                        <small>{statusLabel(entry.status)} · {displayTimestamp(entry.createdAt)}</small>
                      </button>
                    </li>
                  ))}
                </ol>
              ) : <p>No proposal history.</p>}
            </aside>
          </div>
        </>
      )}
    </section>
  );
}
