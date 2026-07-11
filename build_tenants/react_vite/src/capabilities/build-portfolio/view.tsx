import type {
  BuildPortfolioRow,
  PortfolioPosture,
} from "@odd-manager/developer-control-contracts";
import type { CapabilityViewProps } from "../../contracts/developer-control";
import { CapabilityAvailability } from "../../components/primitives/CapabilityAvailability";
import type { BuildPortfolioMessage } from "./messages";
import { buildPortfolioAttentionTarget } from "./selectors";
import type { BuildPortfolioState } from "./state";

function postureClass(posture: PortfolioPosture) {
  if (posture.kind === "present") return "is-positive";
  if (posture.kind === "missing" || posture.kind === "unavailable") return "is-blocked";
  if (posture.kind === "partial" || posture.kind === "stale") return "is-warning";
  return "is-muted";
}

function revisionLabel(row: BuildPortfolioRow) {
  if (!row.revision) return "Unobserved";
  return `${row.revision.revision.slice(0, 8)}${row.revision.dirty ? " dirty" : ""}`;
}

function attentionRank(row: BuildPortfolioRow) {
  return row.attention.reduce((rank, item) => {
    if (item.severity === "blocking") return Math.max(rank, 3);
    if (item.severity === "warning") return Math.max(rank, 2);
    return Math.max(rank, 1);
  }, 0);
}

function visibleRows(state: BuildPortfolioState) {
  const rows = state.portfolio?.rows ?? [];
  const filtered = state.scope === "attention"
    ? rows.filter((row) => row.attention.length > 0)
    : rows;
  return [...filtered].sort((left, right) => {
    if (state.sort === "name") return left.project.label.localeCompare(right.project.label);
    if (state.sort === "freshness") {
      return right.freshness.observedAt.localeCompare(left.freshness.observedAt);
    }
    return attentionRank(right) - attentionRank(left)
      || left.project.label.localeCompare(right.project.label);
  });
}

function pathSegments(path: string | null) {
  if (!path) return [];
  const parts = path.split("/").filter(Boolean);
  let current = "";
  return parts.map((part) => {
    current += `/${part}`;
    return { label: part, path: current };
  });
}

function PortfolioPostureCell({ posture }: { posture: PortfolioPosture }) {
  return (
    <span className={`build-portfolio__posture ${postureClass(posture)}`} title={posture.label}>
      {posture.kind}
    </span>
  );
}

function BuildActivityCell({ row }: { row: BuildPortfolioRow }) {
  return (
    <div className="build-portfolio__build-activity" title={row.build.label}>
      <PortfolioPostureCell posture={row.build} />
      {row.buildActivity.runningCount > 0 || row.buildActivity.queuedCount > 0 ? (
        <span>
          <strong>{row.buildActivity.runningCount}</strong> running
          <strong>{row.buildActivity.queuedCount}</strong> queued
        </span>
      ) : row.buildActivity.latestState ? (
        <span>{row.buildActivity.latestState.replace("_", " ")}</span>
      ) : null}
    </div>
  );
}

export function BuildPortfolioView({
  state,
  contribution,
  dispatch,
}: CapabilityViewProps<BuildPortfolioState, BuildPortfolioMessage>) {
  const rows = visibleRows(state);
  const registeredRoots = new Set((state.portfolio?.rows ?? []).map((row) => row.project.root));
  const selected = state.portfolio?.rows.find(
    (row) => row.project.id === state.selectedProjectId,
  ) ?? null;
  const busy = state.status === "loading";

  return (
    <section className="developer-capability build-portfolio" aria-labelledby="build-portfolio-heading">
      <header className="developer-capability__header build-portfolio__header">
        <div>
          <span className="developer-capability__kicker">Review</span>
          <h2 id="build-portfolio-heading">Build Portfolio</h2>
        </div>
        <div className="build-portfolio__header-actions">
          <CapabilityAvailability contribution={contribution} showDetail={false} />
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: "portfolio/refresh-requested" })}
            disabled={busy}
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => dispatch({ type: "portfolio/browser-toggled" })}
            aria-expanded={state.browser.open}
            disabled={busy}
          >
            Add Project
          </button>
        </div>
      </header>

      {state.error ? <div className="build-portfolio__error" role="alert">{state.error}</div> : null}
      {state.actionError ? <div className="build-portfolio__error" role="alert">{state.actionError}</div> : null}

      <div className="build-portfolio__controls">
        <div className="build-portfolio__scope" role="group" aria-label="Portfolio filter">
          <button
            type="button"
            className={state.scope === "all-projects" ? "is-active" : ""}
            onClick={() => dispatch({ type: "portfolio/scope-selected", scope: "all-projects" })}
          >
            All {state.portfolio?.rows.length ?? 0}
          </button>
          <button
            type="button"
            className={state.scope === "attention" ? "is-active" : ""}
            onClick={() => dispatch({ type: "portfolio/scope-selected", scope: "attention" })}
          >
            Attention {(state.portfolio?.rows ?? []).filter((row) => row.attention.length > 0).length}
          </button>
        </div>
        <label className="build-portfolio__sort">
          <span>Order</span>
          <select
            value={state.sort}
            onChange={(event) => dispatch({
              type: "portfolio/sort-selected",
              sort: event.currentTarget.value as BuildPortfolioState["sort"],
            })}
          >
            <option value="attention">Attention</option>
            <option value="name">Project name</option>
            <option value="freshness">Freshness</option>
          </select>
        </label>
      </div>

      <div className="build-portfolio__table-wrap" aria-busy={busy}>
        <table className="build-portfolio__table" aria-label="Build Portfolio Projects">
          <thead>
            <tr>
              <th>Project</th>
              <th>Revision</th>
              <th>Specification</th>
              <th>Build</th>
              <th>Assurance</th>
              <th>Runtime</th>
              <th>Attention</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.project.id}
                className={`${row.active ? "is-active" : ""}${row.project.id === state.selectedProjectId ? " is-selected" : ""}`}
              >
                <td>
                  <button
                    type="button"
                    className="build-portfolio__project-select"
                    onClick={() => dispatch({ type: "portfolio/project-selected", projectId: row.project.id })}
                  >
                    <strong>{row.project.label}</strong>
                    <span>{row.project.publishedProductRef ?? "Unpublished product"}</span>
                  </button>
                </td>
                <td title={row.revision?.revision ?? "Revision is not observable"}>
                  <code>{revisionLabel(row)}</code>
                </td>
                <td><PortfolioPostureCell posture={row.specification} /></td>
                <td><BuildActivityCell row={row} /></td>
                <td><PortfolioPostureCell posture={row.assurance} /></td>
                <td><PortfolioPostureCell posture={row.run} /></td>
                <td>
                  <span className={attentionRank(row) >= 3 ? "build-portfolio__attention is-blocking" : "build-portfolio__attention"}>
                    {row.attention.length}
                  </span>
                </td>
                <td>
                  <div className="build-portfolio__row-actions">
                    <button
                      type="button"
                      className="secondary"
                      disabled={row.active}
                      onClick={() => dispatch({
                        type: "portfolio/project-activate-requested",
                        projectId: row.project.id,
                      })}
                    >
                      {row.active ? "Active" : "Open"}
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={row.active}
                      onClick={() => dispatch({
                        type: "portfolio/project-unregister-requested",
                        projectId: row.project.id,
                      })}
                    >
                      Remove
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!busy && rows.length === 0 ? (
          <div className="build-portfolio__empty">No Projects match this portfolio filter.</div>
        ) : null}
      </div>

      {selected ? (
        <section className="build-portfolio__selection" aria-label="Selected portfolio Project">
          <div>
            <span className="developer-capability__kicker">Selected Project</span>
            <strong>{selected.project.label}</strong>
            <code>{selected.project.root}</code>
          </div>
          <dl>
            <div><dt>Build tenants</dt><dd>{selected.features.buildTenants.join(", ") || "None observed"}</dd></div>
            <div><dt>Participants</dt><dd>{selected.participants.kind}</dd></div>
            <div><dt>Observed</dt><dd>{new Date(selected.freshness.observedAt).toLocaleString()}</dd></div>
          </dl>
          <div className="build-portfolio__attention-list">
            {selected.attention.map((item) => {
              const target = buildPortfolioAttentionTarget(item.sourceKind);
              return (
                <button
                  type="button"
                  key={item.attentionId}
                  data-severity={item.severity}
                  data-target-capability={target.capabilityId}
                  title={item.sourceRef}
                  onClick={() => dispatch({
                    type: "portfolio/attention-open-requested",
                    projectId: selected.project.id,
                    attentionId: item.attentionId,
                  })}
                >
                  <span>{item.severity}</span>
                  <strong>{item.reason}</strong>
                  <small>{target.actionLabel}</small>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {state.browser.open ? (
        <section className="build-portfolio__browser" aria-label="Add Project browser">
          <header>
            <div>
              <span className="developer-capability__kicker">Project Registry</span>
              <h3>Add Project</h3>
            </div>
            <div className="build-portfolio__header-actions">
              <button
                type="button"
                className="secondary"
                disabled={!state.browser.currentPath || state.browser.status === "loading"}
                onClick={() => {
                  if (state.browser.currentPath) dispatch({
                    type: "portfolio/browser-navigate-requested",
                    path: state.browser.currentPath,
                  });
                }}
              >
                Refresh
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => dispatch({ type: "portfolio/browser-toggled", open: false })}
              >
                Close
              </button>
            </div>
          </header>
          <nav className="build-portfolio__breadcrumbs" aria-label="Project directory path">
            <button
              type="button"
              onClick={() => dispatch({ type: "portfolio/browser-navigate-requested", path: "/" })}
            >
              /
            </button>
            {pathSegments(state.browser.currentPath).map((segment) => (
              <button
                type="button"
                key={segment.path}
                onClick={() => dispatch({
                  type: "portfolio/browser-navigate-requested",
                  path: segment.path,
                })}
              >
                {segment.label}
              </button>
            ))}
          </nav>
          {state.browser.error ? <div className="build-portfolio__error" role="alert">{state.browser.error}</div> : null}
          <div className="build-portfolio__directory-list" aria-busy={state.browser.status === "loading"}>
            {state.browser.parent ? (
              <button
                type="button"
                className="build-portfolio__directory-up"
                onClick={() => dispatch({
                  type: "portfolio/browser-navigate-requested",
                  path: state.browser.parent as string,
                })}
              >
                Parent directory
              </button>
            ) : null}
            {state.browser.entries.filter((entry) => entry.kind !== "file").map((entry) => {
              const registered = registeredRoots.has(entry.absolutePath);
              return (
                <div key={entry.absolutePath} className="build-portfolio__directory-row">
                  <button
                    type="button"
                    className="build-portfolio__directory-open"
                    onClick={() => dispatch({
                      type: "portfolio/browser-navigate-requested",
                      path: entry.absolutePath,
                    })}
                  >
                    <strong>{entry.name}</strong>
                    <span>{entry.absolutePath}</span>
                  </button>
                  <span>{entry.hasWorkspace ? "Project" : "Folder"}</span>
                  <button
                    type="button"
                    className="secondary"
                    disabled={registered || !entry.hasWorkspace}
                    onClick={() => dispatch({
                      type: "portfolio/project-register-requested",
                      path: entry.absolutePath,
                    })}
                  >
                    {registered ? "Registered" : "Register"}
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </section>
  );
}
