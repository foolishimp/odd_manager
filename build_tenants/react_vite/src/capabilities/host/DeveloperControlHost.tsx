import { useEffect, useReducer, useRef, useState } from "react";
import type {
  CapabilityContribution,
  CapabilityId,
} from "@odd-manager/developer-control-contracts";
import {
  buildPortfolioModule,
  BuildPortfolioView,
  createBuildPortfolioState,
  selectBuildPortfolioContribution,
  updateBuildPortfolio,
  type BuildPortfolioMessage,
  type BuildPortfolioAttentionFocus,
} from "../build-portfolio";
import {
  buildControlModule,
  BuildControlView,
  createBuildControlState,
  selectBuildControlContribution,
  updateBuildControl,
  type BuildControlMessage,
} from "../build-control";
import {
  AssuranceAttentionView,
  createAssuranceAttentionState,
  selectAssuranceAttentionContribution,
  updateAssuranceAttention,
  type AssuranceAttentionMessage,
} from "../assurance-attention";
import {
  INITIAL_PROJECT_WORKBENCH_STATE,
  ProjectWorkbenchView,
  selectProjectWorkbenchContribution,
  updateProjectWorkbench,
  type ProjectWorkbenchMessage,
} from "../project-workbench";
import {
  INITIAL_RUN_OBSERVATION_STATE,
  RunObservationView,
  selectRunObservationContribution,
  updateRunObservation,
  type RunObservationMessage,
} from "../run-observation";
import {
  createSpecificationProposalState,
  selectSpecificationProposalContribution,
  SpecificationProposalView,
  updateSpecificationProposal,
  type SpecificationProposalMessage,
} from "../specification-proposal";
import type {
  DeveloperControlHostMessage,
  DeveloperControlSurface,
  SupportingSurfaceCommand,
} from "../../contracts/developer-control";
import {
  interpretBuildPortfolioCommand,
  interpretBuildControlCommand,
  interpretDeveloperControlCommand,
  interpretAssuranceAttentionCommand,
  interpretSpecificationProposalCommand,
} from "../../effects/command-runtime";
import { SidecarPanel } from "../../features/sidecar/SidecarPanel";
import { PROJECT_REGISTRY_CHANGED_EVENT } from "../../lib/collaboration";
import {
  runInspectorFocus,
  type RunInspectorFocus,
} from "../../lib/projectDeepLink";
import {
  createDeveloperControlHostState,
  updateDeveloperControlHost,
} from "./state";

type DeveloperControlHostProps = {
  projectRoot: string;
  initialSurface: DeveloperControlSurface | null;
  onProjectRootChange: (projectRoot: string) => void;
};

const SURFACES: Array<{ id: DeveloperControlSurface; label: string }> = [
  { id: "project-workbench", label: "Workbench" },
  { id: "ai-workspace", label: "AI Workspace" },
  { id: "run-inspector", label: "Run Inspector" },
  { id: "ticket-board", label: "Tickets" },
];

function hostReducer(
  state: ReturnType<typeof createDeveloperControlHostState>,
  message: DeveloperControlHostMessage,
) {
  return updateDeveloperControlHost(state, message).state;
}

function capabilityById(contributions: CapabilityContribution[], capabilityId: CapabilityId) {
  return contributions.find((entry) => entry.id === capabilityId) ?? null;
}

export function DeveloperControlHost({
  projectRoot,
  initialSurface,
  onProjectRootChange,
}: DeveloperControlHostProps) {
  const [hostState, dispatchHost] = useReducer(
    hostReducer,
    initialSurface ?? "project-workbench",
    createDeveloperControlHostState,
  );
  const [workbenchState, setWorkbenchState] = useState(INITIAL_PROJECT_WORKBENCH_STATE);
  const [portfolioState, dispatchPortfolio] = useReducer(
    (state: ReturnType<typeof createBuildPortfolioState>, message: BuildPortfolioMessage) => (
      updateBuildPortfolio(state, message).state
    ),
    undefined,
    createBuildPortfolioState,
  );
  const [proposalState, dispatchProposal] = useReducer(
    (state: ReturnType<typeof createSpecificationProposalState>, message: SpecificationProposalMessage) => (
      updateSpecificationProposal(state, message).state
    ),
    undefined,
    createSpecificationProposalState,
  );
  const [buildState, dispatchBuild] = useReducer(
    (state: ReturnType<typeof createBuildControlState>, message: BuildControlMessage) => (
      updateBuildControl(state, message).state
    ),
    undefined,
    createBuildControlState,
  );
  const [assuranceState, dispatchAssurance] = useReducer(
    (state: ReturnType<typeof createAssuranceAttentionState>, message: AssuranceAttentionMessage) => (
      updateAssuranceAttention(state, message).state
    ),
    undefined,
    createAssuranceAttentionState,
  );
  const [runObservationState, setRunObservationState] = useState(INITIAL_RUN_OBSERVATION_STATE);
  const [portfolioAttentionFocus, setPortfolioAttentionFocus] = useState<BuildPortfolioAttentionFocus | null>(null);
  const requestedProjectRoot = useRef<string | null>(null);
  const processedCommandIds = useRef(new Set<string>());
  const processedPortfolioCommandIds = useRef(new Set<string>());
  const processedProposalCommandIds = useRef(new Set<string>());
  const processedBuildCommandIds = useRef(new Set<string>());
  const processedAssuranceCommandIds = useRef(new Set<string>());
  const commandSequence = useRef(0);

  function nextCommandIdentity(kind: string) {
    commandSequence.current += 1;
    return {
      commandId: `developer-control-${kind}-${commandSequence.current}`,
      correlationId: `project:${projectRoot}:${kind}:${commandSequence.current}`,
    };
  }

  function requestSurface(surface: DeveloperControlSurface, runFocus: RunInspectorFocus | null = null) {
    const identity = nextCommandIdentity("navigate");
    dispatchHost({
      type: "host/navigation-requested",
      command: {
        type: "host.project-navigation",
        ...identity,
        projectRoot,
        surface,
        runFocus,
      },
    });
  }

  function interpretSupportingCommands(commands: SupportingSurfaceCommand[]) {
    for (const command of commands) requestSurface(command.surface);
  }

  function dispatchWorkbench(message: ProjectWorkbenchMessage) {
    setWorkbenchState((current) => updateProjectWorkbench(current, message).state);
  }

  function dispatchRunObservation(message: RunObservationMessage) {
    const result = updateRunObservation(runObservationState, message);
    setRunObservationState(result.state);
    interpretSupportingCommands(result.commands);
  }

  function requestContext(root: string) {
    const identity = nextCommandIdentity("context");
    dispatchHost({
      type: "host/context-requested",
      command: {
        type: "host.resolve-context",
        ...identity,
        projectRoot: root,
      },
    });
  }

  useEffect(() => {
    if (!projectRoot || requestedProjectRoot.current === projectRoot) return;
    requestedProjectRoot.current = projectRoot;
    requestContext(projectRoot);
  }, [projectRoot]);

  useEffect(() => {
    dispatchPortfolio({ type: "portfolio/context-changed", projectRoot });
  }, [projectRoot]);

  useEffect(() => {
    const context = hostState.bootstrap?.context;
    if (!context || context.project.root !== projectRoot) return;
    dispatchProposal({
      type: "proposal/context-changed",
      project: context.project,
      revision: context.revision,
    });
    dispatchBuild({
      type: "build/context-changed",
      project: context.project,
      revision: context.revision,
    });
  }, [
    hostState.bootstrap?.context.project.root,
    hostState.bootstrap?.context.revision?.sourceDigest,
    hostState.bootstrap?.context.revision?.specificationDigest,
    projectRoot,
  ]);

  useEffect(() => {
    const handleRegistryChange = () => dispatchPortfolio({ type: "portfolio/refresh-requested" });
    window.addEventListener(PROJECT_REGISTRY_CHANGED_EVENT, handleRegistryChange);
    return () => window.removeEventListener(PROJECT_REGISTRY_CHANGED_EVENT, handleRegistryChange);
  }, []);

  useEffect(() => {
    for (const command of hostState.pendingCommands) {
      if (processedCommandIds.current.has(command.commandId)) continue;
      processedCommandIds.current.add(command.commandId);
      void interpretDeveloperControlCommand(command).then(dispatchHost);
    }
  }, [hostState.pendingCommands]);

  useEffect(() => {
    for (const command of portfolioState.pendingCommands) {
      if (processedPortfolioCommandIds.current.has(command.commandId)) continue;
      processedPortfolioCommandIds.current.add(command.commandId);
      void interpretBuildPortfolioCommand(command).then(dispatchPortfolio);
    }
  }, [portfolioState.pendingCommands]);

  useEffect(() => {
    for (const command of proposalState.pendingCommands) {
      if (processedProposalCommandIds.current.has(command.commandId)) continue;
      processedProposalCommandIds.current.add(command.commandId);
      if (command.type === "proposal.refresh-context") {
        requestContext(command.projectRoot);
        dispatchProposal({ type: "proposal/supporting-command-consumed", commandId: command.commandId });
      } else {
        void interpretSpecificationProposalCommand(command).then(dispatchProposal);
      }
    }
  }, [proposalState.pendingCommands]);

  useEffect(() => {
    for (const command of buildState.pendingCommands) {
      if (processedBuildCommandIds.current.has(command.commandId)) continue;
      processedBuildCommandIds.current.add(command.commandId);
      void interpretBuildControlCommand(command).then(dispatchBuild);
    }
  }, [buildState.pendingCommands]);

  useEffect(() => {
    for (const command of assuranceState.pendingCommands) {
      if (processedAssuranceCommandIds.current.has(command.commandId)) continue;
      processedAssuranceCommandIds.current.add(command.commandId);
      if (command.type === "assurance.open-run-inspector") {
        if (!command.executionId) {
          dispatchAssurance({ type: "assurance/supporting-command-consumed", commandId: command.commandId });
          continue;
        }
        requestSurface("run-inspector", {
          projectRoot: command.projectRoot,
          executionId: command.executionId,
          runRef: command.runRef,
          revision: command.revision,
          sourceRef: command.sourceRef,
        });
        dispatchAssurance({ type: "assurance/supporting-command-consumed", commandId: command.commandId });
      } else {
        void interpretAssuranceAttentionCommand(command).then(dispatchAssurance);
      }
    }
  }, [assuranceState.pendingCommands]);

  const buildPollSubscription = hostState.bootstrap?.context.project.root === projectRoot
    ? buildControlModule.subscriptions(buildState, hostState.bootstrap.context)[0] ?? null
    : null;

  useEffect(() => {
    if (!buildPollSubscription) return undefined;
    const timer = window.setInterval(() => {
      dispatchBuild({ type: "build/refresh-requested" });
    }, buildPollSubscription.intervalMs);
    return () => window.clearInterval(timer);
  }, [buildPollSubscription?.projectRoot, buildPollSubscription?.intervalMs]);

  const portfolioPollSubscription = hostState.bootstrap?.context.project.root === projectRoot
    ? buildPortfolioModule.subscriptions(portfolioState, hostState.bootstrap.context)[0] ?? null
    : null;

  useEffect(() => {
    if (!portfolioPollSubscription) return undefined;
    const timer = window.setInterval(() => {
      dispatchPortfolio({ type: "portfolio/refresh-requested" });
    }, portfolioPollSubscription.intervalMs);
    return () => window.clearInterval(timer);
  }, [portfolioPollSubscription?.projectRoot, portfolioPollSubscription?.intervalMs]);

  const buildProjectionSignature = (buildState.snapshot?.executions ?? [])
    .map((execution) => `${execution.executionId}:${execution.state}:${execution.updatedAt}`)
    .join("|");

  useEffect(() => {
    if (!buildState.snapshot) return;
    dispatchPortfolio({ type: "portfolio/refresh-requested" });
  }, [buildState.snapshot?.projectRoot, buildProjectionSignature]);

  const selectedBuildExecution = buildState.snapshot?.executions.find(
    (execution) => execution.executionId === buildState.selectedExecutionId,
  ) ?? null;

  useEffect(() => {
    const context = hostState.bootstrap?.context;
    if (!context || context.project.root !== projectRoot) return;
    dispatchAssurance({
      type: "assurance/context-changed",
      project: context.project,
      revision: context.revision,
      executionId: selectedBuildExecution?.executionId ?? null,
    });
  }, [
    hostState.bootstrap?.context.project.root,
    hostState.bootstrap?.context.revision?.sourceDigest,
    hostState.bootstrap?.context.revision?.specificationDigest,
    selectedBuildExecution?.executionId,
    projectRoot,
  ]);

  useEffect(() => {
    if (!selectedBuildExecution || assuranceState.executionId !== selectedBuildExecution.executionId) return;
    dispatchAssurance({ type: "assurance/refresh-requested" });
  }, [selectedBuildExecution?.executionId, selectedBuildExecution?.updatedAt]);

  useEffect(() => {
    if (!portfolioState.activatedProjectRoot) return;
    const nextRoot = portfolioState.activatedProjectRoot;
    dispatchPortfolio({ type: "portfolio/project-activation-consumed" });
    if (nextRoot !== projectRoot) onProjectRootChange(nextRoot);
  }, [onProjectRootChange, portfolioState.activatedProjectRoot, projectRoot]);

  useEffect(() => {
    if (!portfolioState.openedAttention) return;
    const focus = portfolioState.openedAttention;
    dispatchPortfolio({ type: "portfolio/attention-focus-consumed" });
    setPortfolioAttentionFocus(focus);
    if (focus.projectRoot !== projectRoot) onProjectRootChange(focus.projectRoot);
  }, [onProjectRootChange, portfolioState.openedAttention, projectRoot]);

  useEffect(() => {
    const focus = portfolioAttentionFocus;
    const context = hostState.bootstrap?.context;
    if (!focus || !context || context.project.root !== focus.projectRoot || projectRoot !== focus.projectRoot) return;

    if (focus.targetCapabilityId === "specification-proposal") {
      dispatchWorkbench({ type: "workbench/phase-selected", phase: "tune" });
      dispatchProposal({ type: "proposal/context-attached", sourceRef: focus.sourceRef });
      setPortfolioAttentionFocus(null);
      return;
    }

    if (focus.targetCapabilityId === "build-control") {
      dispatchWorkbench({ type: "workbench/phase-selected", phase: "build" });
      if (focus.sourceKind !== "build-execution") {
        setPortfolioAttentionFocus(null);
        return;
      }
      const executionId = focus.sourceRef.startsWith("build-execution://")
        ? focus.sourceRef.slice("build-execution://".length)
        : null;
      if (executionId && buildState.snapshot?.executions.some((entry) => entry.executionId === executionId)) {
        dispatchBuild({ type: "build/execution-selected", executionId });
        setPortfolioAttentionFocus(null);
      } else if (buildState.snapshot && buildState.status !== "loading") {
        setPortfolioAttentionFocus(null);
      }
      return;
    }

    dispatchWorkbench({ type: "workbench/phase-selected", phase: "assure" });
    dispatchAssurance({ type: "assurance/filter-selected", filter: "attention" });
    if (assuranceState.snapshot?.attentionItems.some((entry) => entry.attentionId === focus.attentionId)) {
      dispatchAssurance({ type: "attention/item-selected", attentionId: focus.attentionId });
      setPortfolioAttentionFocus(null);
    } else if (assuranceState.snapshot && assuranceState.status !== "loading") {
      setPortfolioAttentionFocus(null);
    }
  }, [
    assuranceState.snapshot,
    assuranceState.status,
    buildState.snapshot,
    buildState.status,
    hostState.bootstrap?.context.project.root,
    portfolioAttentionFocus,
    projectRoot,
  ]);

  const activeSurface = hostState.requestedSurface ?? hostState.activeSurface;
  const bootstrap = hostState.bootstrap?.context.project.root === projectRoot
    ? hostState.bootstrap
    : null;

  return (
    <section className="developer-control-host" aria-label="Developer control host">
      <nav className="developer-control-host__navigation" aria-label="Developer control surfaces">
        <div role="tablist" aria-label="Developer control surfaces">
          {SURFACES.map((surface) => (
            <button
              key={surface.id}
              type="button"
              role="tab"
              aria-selected={activeSurface === surface.id}
              className={activeSurface === surface.id ? "is-active" : ""}
              onClick={() => requestSurface(surface.id)}
            >
              {surface.label}
            </button>
          ))}
        </div>
        <span
          className={`developer-control-host__context-state developer-control-host__context-state--${hostState.contextStatus}`}
          role="status"
        >
          {hostState.contextStatus === "ready" ? "Context admitted" : hostState.contextStatus}
        </span>
      </nav>

      {hostState.error ? (
        <div className="developer-control-host__error" role="alert">
          <span>{hostState.error}</span>
          <button type="button" className="secondary" onClick={() => requestContext(projectRoot)}>
            Retry Context
          </button>
        </div>
      ) : null}

      <div className="developer-control-host__surface">
        {activeSurface !== "project-workbench" ? (
          <div className="workspace-view workspace-view--sidecar">
            <SidecarPanel
              projectRoot={projectRoot}
              initialSurface={activeSurface}
              runFocus={runInspectorFocus(window.location.search, projectRoot)}
              onContextChange={(context) => {
                if (context.project.root !== projectRoot) {
                  onProjectRootChange(context.project.root);
                }
              }}
            />
          </div>
        ) : bootstrap ? (
          <WorkbenchComposition
            bootstrap={bootstrap}
            workbenchState={workbenchState}
            dispatchWorkbench={dispatchWorkbench}
            portfolioState={portfolioState}
            dispatchPortfolio={dispatchPortfolio}
            proposalState={proposalState}
            dispatchProposal={dispatchProposal}
            buildState={buildState}
            dispatchBuild={dispatchBuild}
            assuranceState={assuranceState}
            dispatchAssurance={dispatchAssurance}
            runObservationState={runObservationState}
            dispatchRunObservation={dispatchRunObservation}
          />
        ) : (
          <div
            className="developer-control-host__loading"
            aria-busy={hostState.contextStatus === "loading"}
            aria-label="Resolving Project Workbench context"
          >
            <span>{hostState.contextStatus === "error" ? "Project Context unavailable" : "Resolving Project Context"}</span>
            <code>{projectRoot}</code>
          </div>
        )}
      </div>
    </section>
  );
}

type WorkbenchCompositionProps = {
  bootstrap: NonNullable<ReturnType<typeof createDeveloperControlHostState>["bootstrap"]>;
  workbenchState: typeof INITIAL_PROJECT_WORKBENCH_STATE;
  dispatchWorkbench: (message: ProjectWorkbenchMessage) => void;
  portfolioState: ReturnType<typeof createBuildPortfolioState>;
  dispatchPortfolio: (message: BuildPortfolioMessage) => void;
  proposalState: ReturnType<typeof createSpecificationProposalState>;
  dispatchProposal: (message: SpecificationProposalMessage) => void;
  buildState: ReturnType<typeof createBuildControlState>;
  dispatchBuild: (message: BuildControlMessage) => void;
  assuranceState: ReturnType<typeof createAssuranceAttentionState>;
  dispatchAssurance: (message: AssuranceAttentionMessage) => void;
  runObservationState: typeof INITIAL_RUN_OBSERVATION_STATE;
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
