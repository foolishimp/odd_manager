import {
  useCallback,
  useEffect,
  useReducer,
  useRef,
  type KeyboardEvent,
} from "react";
import type {
  CapabilityContribution,
  CapabilityId,
  DeveloperControlBootstrap,
} from "@odd-manager/developer-control-contracts";
import {
  BuildPortfolioView,
  selectBuildPortfolioContribution,
  type BuildPortfolioMessage,
} from "../build-portfolio";
import {
  BuildControlView,
  selectBuildControlContribution,
  type BuildControlMessage,
} from "../build-control";
import {
  AssuranceAttentionView,
  selectAssuranceAttentionContribution,
  type AssuranceAttentionMessage,
} from "../assurance-attention";
import {
  ProjectWorkbenchView,
  selectProjectWorkbenchContribution,
  type ProjectWorkbenchMessage,
} from "../project-workbench";
import {
  RunObservationView,
  selectRunObservationContribution,
  type RunObservationMessage,
} from "../run-observation";
import {
  selectSpecificationProposalContribution,
  SpecificationProposalView,
  type SpecificationProposalMessage,
} from "../specification-proposal";
import type { DeveloperControlSurface } from "../../contracts/developer-control";
import { interpretDeveloperControlAggregateCommand } from "../../effects/command-runtime";
import { SidecarPanel } from "../../features/sidecar/SidecarPanel";
import type { ContextRecord } from "../../features/sidecar/sidecar-state";
import { PROJECT_REGISTRY_CHANGED_EVENT } from "../../lib/collaboration";
import type { RunInspectorFocus } from "../../lib/projectDeepLink";
import {
  createDeveloperControlAggregateState,
  selectDeveloperControlAggregateSubscriptions,
  selectDeveloperControlPresentedSurface,
  updateDeveloperControlAggregate,
  type DeveloperControlAggregateCommand,
  type DeveloperControlAggregateMessage,
  type DeveloperControlAggregateState,
  type DeveloperControlAggregateSubscription,
} from "./aggregate";

type DeveloperControlHostProps = {
  projectRoot: string;
  initialSurface: DeveloperControlSurface | null;
  initialRunFocus: RunInspectorFocus | null;
  onProjectRootChange: (projectRoot: string) => void;
};

const SURFACES: Array<{ id: DeveloperControlSurface; label: string }> = [
  { id: "project-workbench", label: "Workbench" },
  { id: "ai-workspace", label: "AI Workspace" },
  { id: "run-inspector", label: "Run Inspector" },
  { id: "ticket-board", label: "Tickets" },
];

function surfaceFromKeyboard(
  event: KeyboardEvent<HTMLButtonElement>,
  current: DeveloperControlSurface,
) {
  const currentIndex = SURFACES.findIndex((surface) => surface.id === current);
  if (event.key === "Home") return SURFACES[0];
  if (event.key === "End") return SURFACES[SURFACES.length - 1];
  if (event.key === "ArrowRight" || event.key === "ArrowDown") {
    return SURFACES[(currentIndex + 1) % SURFACES.length];
  }
  if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    return SURFACES[(currentIndex - 1 + SURFACES.length) % SURFACES.length];
  }
  return null;
}

function aggregateReducer(
  state: DeveloperControlAggregateState,
  message: DeveloperControlAggregateMessage,
) {
  return updateDeveloperControlAggregate(state, message).state;
}

function AggregateCommandInterpreter({
  command,
  dispatch,
  activateProject,
}: {
  command: DeveloperControlAggregateCommand;
  dispatch: (message: DeveloperControlAggregateMessage) => void;
  activateProject: (projectRoot: string) => void;
}) {
  const activateProjectRef = useRef(activateProject);
  const interpretedCommandIdRef = useRef<string | null>(null);
  activateProjectRef.current = activateProject;

  useEffect(() => {
    if (command.status === "queued") {
      dispatch({
        type: "aggregate/command-started",
        aggregateCommandId: command.aggregateCommandId,
      });
      return undefined;
    }
    if (interpretedCommandIdRef.current === command.aggregateCommandId) {
      return undefined;
    }
    interpretedCommandIdRef.current = command.aggregateCommandId;
    void interpretDeveloperControlAggregateCommand(
      command,
      (projectRoot) => activateProjectRef.current(projectRoot),
    )
      .then((message) => {
        dispatch(message);
      });
    return undefined;
  }, [
    command.aggregateCommandId,
    command.status,
    dispatch,
  ]);
  return null;
}

function AggregateSubscriptionInterpreter({
  subscription,
  dispatch,
}: {
  subscription: DeveloperControlAggregateSubscription;
  dispatch: (message: DeveloperControlAggregateMessage) => void;
}) {
  const projectRoot = subscription.type === "aggregate.project-registry"
    ? null
    : subscription.projectRoot;
  const intervalMs = subscription.type === "aggregate.project-registry"
    ? null
    : subscription.intervalMs;
  useEffect(() => {
    try {
      if (subscription.type === "aggregate.project-registry") {
        const handleRegistryChange = () => dispatch({ type: "aggregate/registry-changed" });
        window.addEventListener(PROJECT_REGISTRY_CHANGED_EVENT, handleRegistryChange);
        return () => window.removeEventListener(PROJECT_REGISTRY_CHANGED_EVENT, handleRegistryChange);
      }
      const timer = window.setInterval(() => {
        try {
          dispatch({
            type: "aggregate/subscription-ticked",
            subscription,
          });
        } catch (caught) {
          dispatch({
            type: "aggregate/subscription-failed",
            subscription,
            error: caught instanceof Error ? caught.message : String(caught),
          });
        }
      }, subscription.intervalMs);
      return () => window.clearInterval(timer);
    } catch (caught) {
      dispatch({
        type: "aggregate/subscription-failed",
        subscription,
        error: caught instanceof Error ? caught.message : String(caught),
      });
      return undefined;
    }
  }, [
    dispatch,
    intervalMs,
    projectRoot,
    subscription.subscriptionId,
    subscription.type,
  ]);
  return null;
}

function capabilityById(contributions: CapabilityContribution[], capabilityId: CapabilityId) {
  return contributions.find((entry) => entry.id === capabilityId) ?? null;
}

export function DeveloperControlHost({
  projectRoot,
  initialSurface,
  initialRunFocus,
  onProjectRootChange,
}: DeveloperControlHostProps) {
  const [state, dispatch] = useReducer(
    aggregateReducer,
    {
      projectRoot,
      initialSurface: initialSurface ?? "project-workbench",
      initialRunFocus,
    },
    (initial) => createDeveloperControlAggregateState(
      initial.projectRoot,
      initial.initialSurface,
      initial.initialRunFocus,
    ),
  );

  useEffect(() => {
    dispatch({ type: "aggregate/project-observed", projectRoot });
  }, [projectRoot]);

  const subscriptions = selectDeveloperControlAggregateSubscriptions(state);
  const activeSurface = selectDeveloperControlPresentedSurface(state);
  const bootstrap = state.host.bootstrap?.context.project.root === state.projectRoot
    ? state.host.bootstrap
    : null;
  const dispatchWorkbench = (message: ProjectWorkbenchMessage) => {
    dispatch({ type: "aggregate/workbench-message", message });
  };
  const dispatchPortfolio = (message: BuildPortfolioMessage) => {
    dispatch({ type: "aggregate/portfolio-message", message });
  };
  const dispatchProposal = (message: SpecificationProposalMessage) => {
    dispatch({ type: "aggregate/proposal-message", message });
  };
  const dispatchBuild = (message: BuildControlMessage) => {
    dispatch({ type: "aggregate/build-message", message });
  };
  const dispatchAssurance = (message: AssuranceAttentionMessage) => {
    dispatch({ type: "aggregate/assurance-message", message });
  };
  const dispatchRunObservation = (message: RunObservationMessage) => {
    dispatch({ type: "aggregate/run-observation-message", message });
  };
  const handleSidecarContextChange = useCallback((context: ContextRecord) => {
    dispatch({
      type: "aggregate/project-activation-requested",
      projectRoot: context.project.root,
    });
  }, []);

  return (
    <section className="developer-control-host" aria-label="Developer control host">
      {state.pendingCommands.map((command) => (
        <AggregateCommandInterpreter
          key={command.aggregateCommandId}
          command={command}
          dispatch={dispatch}
          activateProject={onProjectRootChange}
        />
      ))}
      {subscriptions.map((subscription) => (
        <AggregateSubscriptionInterpreter
          key={subscription.subscriptionId}
          subscription={subscription}
          dispatch={dispatch}
        />
      ))}

      <nav className="developer-control-host__navigation" aria-label="Developer control surfaces">
        <div role="tablist" aria-label="Developer control surfaces">
          {SURFACES.map((surface) => (
            <button
              key={surface.id}
              id={`developer-control-tab-${surface.id}`}
              type="button"
              role="tab"
              aria-selected={activeSurface === surface.id}
              aria-controls={`developer-control-panel-${surface.id}`}
              tabIndex={activeSurface === surface.id ? 0 : -1}
              className={activeSurface === surface.id ? "is-active" : ""}
              onClick={() => dispatch({
                type: "aggregate/surface-requested",
                surface: surface.id,
              })}
              onKeyDown={(event) => {
                const next = surfaceFromKeyboard(event, surface.id);
                if (!next) return;
                event.preventDefault();
                dispatch({
                  type: "aggregate/surface-requested",
                  surface: next.id,
                });
                const tab = event.currentTarget.parentElement?.querySelector<HTMLButtonElement>(
                  `#developer-control-tab-${next.id}`,
                );
                tab?.focus();
              }}
            >
              {surface.label}
            </button>
          ))}
        </div>
        <span
          className={`developer-control-host__context-state developer-control-host__context-state--${state.host.contextStatus}`}
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {state.host.contextStatus === "ready" ? "Context admitted" : state.host.contextStatus}
        </span>
      </nav>

      {state.host.error ? (
        <div className="developer-control-host__error" role="alert">
          <span>{state.host.error}</span>
          <button
            type="button"
            className="secondary"
            onClick={() => dispatch({ type: "aggregate/context-retry-requested" })}
          >
            Retry Context
          </button>
        </div>
      ) : null}

      <div
        id={`developer-control-panel-${activeSurface}`}
        className="developer-control-host__surface"
        role="tabpanel"
        aria-labelledby={`developer-control-tab-${activeSurface}`}
        tabIndex={0}
      >
        {activeSurface !== "project-workbench" ? (
          <div className="workspace-view workspace-view--sidecar">
            <SidecarPanel
              projectRoot={state.projectRoot}
              initialSurface={activeSurface}
              runFocus={state.runFocus}
              onContextChange={handleSidecarContextChange}
            />
          </div>
        ) : bootstrap ? (
          <WorkbenchComposition
            bootstrap={bootstrap}
            workbenchState={state.workbench}
            dispatchWorkbench={dispatchWorkbench}
            portfolioState={state.portfolio}
            dispatchPortfolio={dispatchPortfolio}
            proposalState={state.proposal}
            dispatchProposal={dispatchProposal}
            buildState={state.build}
            dispatchBuild={dispatchBuild}
            assuranceState={state.assurance}
            dispatchAssurance={dispatchAssurance}
            runObservationState={state.runObservation}
            dispatchRunObservation={dispatchRunObservation}
          />
        ) : (
          <div
            className="developer-control-host__loading"
            aria-busy={state.host.contextStatus === "loading"}
            aria-label="Resolving Project Workbench context"
          >
            <span>{state.host.contextStatus === "error" ? "Project Context unavailable" : "Resolving Project Context"}</span>
            <code>{state.projectRoot}</code>
          </div>
        )}
      </div>
    </section>
  );
}

type WorkbenchCompositionProps = {
  bootstrap: DeveloperControlBootstrap;
  workbenchState: DeveloperControlAggregateState["workbench"];
  dispatchWorkbench: (message: ProjectWorkbenchMessage) => void;
  portfolioState: DeveloperControlAggregateState["portfolio"];
  dispatchPortfolio: (message: BuildPortfolioMessage) => void;
  proposalState: DeveloperControlAggregateState["proposal"];
  dispatchProposal: (message: SpecificationProposalMessage) => void;
  buildState: DeveloperControlAggregateState["build"];
  dispatchBuild: (message: BuildControlMessage) => void;
  assuranceState: DeveloperControlAggregateState["assurance"];
  dispatchAssurance: (message: AssuranceAttentionMessage) => void;
  runObservationState: DeveloperControlAggregateState["runObservation"];
  dispatchRunObservation: (message: RunObservationMessage) => void;
};

function WorkbenchComposition({
  bootstrap,
  workbenchState,
  dispatchWorkbench,
  portfolioState,
  dispatchPortfolio,
  proposalState,
  dispatchProposal,
  buildState,
  dispatchBuild,
  assuranceState,
  dispatchAssurance,
  runObservationState,
  dispatchRunObservation,
}: WorkbenchCompositionProps) {
  const contributions = bootstrap.capabilities;
  const workbenchContribution = selectProjectWorkbenchContribution(contributions);
  const activeContribution = capabilityById(contributions, workbenchState.activeCapabilityId);
  const runContribution = selectRunObservationContribution(contributions);
  if (!workbenchContribution || !activeContribution || !runContribution) {
    return <div className="developer-control-host__loading" role="alert">Capability composition is incomplete.</div>;
  }

  let activeCapability = null;
  if (activeContribution.id === "build-portfolio") {
    const contribution = selectBuildPortfolioContribution(contributions);
    if (contribution) {
      activeCapability = (
        <BuildPortfolioView
          state={portfolioState}
          context={bootstrap.context}
          contribution={contribution}
          dispatch={dispatchPortfolio}
        />
      );
    }
  } else if (activeContribution.id === "specification-proposal") {
    const contribution = selectSpecificationProposalContribution(contributions);
    if (contribution) {
      activeCapability = (
        <SpecificationProposalView
          state={proposalState}
          context={bootstrap.context}
          contribution={contribution}
          dispatch={dispatchProposal}
        />
      );
    }
  } else if (activeContribution.id === "build-control") {
    const contribution = selectBuildControlContribution(contributions);
    if (contribution) {
      activeCapability = (
        <BuildControlView
          state={buildState}
          context={bootstrap.context}
          contribution={contribution}
          dispatch={dispatchBuild}
        />
      );
    }
  } else {
    const contribution = selectAssuranceAttentionContribution(contributions);
    if (contribution) {
      activeCapability = (
        <AssuranceAttentionView
          state={assuranceState}
          context={bootstrap.context}
          contribution={contribution}
          dispatch={dispatchAssurance}
        />
      );
    }
  }

  return (
    <ProjectWorkbenchView
      state={workbenchState}
      context={bootstrap.context}
      contribution={workbenchContribution}
      dispatch={dispatchWorkbench}
      activeCapability={activeCapability}
      phaseContributions={contributions}
      supportingCapability={(
        <RunObservationView
          state={runObservationState}
          context={bootstrap.context}
          contribution={runContribution}
          dispatch={dispatchRunObservation}
        />
      )}
    />
  );
}
