import type {
  BuildPortfolio,
  CapabilityId,
} from "@odd-manager/developer-control-contracts";
import type { FsEntry } from "../../lib/collaboration";

export type BuildPortfolioCommand =
  | {
      type: "portfolio.load";
      commandId: string;
      correlationId: string;
      contextProjectRoot: string;
    }
  | {
      type: "portfolio.browse";
      commandId: string;
      correlationId: string;
      contextProjectRoot: string;
      path: string;
    }
  | {
      type: "portfolio.register";
      commandId: string;
      correlationId: string;
      contextProjectRoot: string;
      path: string;
    }
  | {
      type: "portfolio.unregister";
      commandId: string;
      correlationId: string;
      contextProjectRoot: string;
      projectId: string;
    }
  | {
      type: "portfolio.activate";
      commandId: string;
      correlationId: string;
      contextProjectRoot: string;
      projectId: string;
    }
  | {
      type: "portfolio.open-attention";
      commandId: string;
      correlationId: string;
      contextProjectRoot: string;
      projectId: string;
      projectRoot: string;
      attentionId: string;
      sourceKind: string;
      sourceRef: string;
      targetCapabilityId: CapabilityId;
    };

export type BuildPortfolioCommandInput =
  | { type: "portfolio.load" }
  | { type: "portfolio.browse"; path: string }
  | { type: "portfolio.register"; path: string }
  | { type: "portfolio.unregister"; projectId: string }
  | { type: "portfolio.activate"; projectId: string }
  | {
      type: "portfolio.open-attention";
      projectId: string;
      projectRoot: string;
      attentionId: string;
      sourceKind: string;
      sourceRef: string;
      targetCapabilityId: CapabilityId;
    };

export type BuildPortfolioAttentionFocus = {
  projectRoot: string;
  attentionId: string;
  sourceKind: string;
  sourceRef: string;
  targetCapabilityId: CapabilityId;
};

export type BuildPortfolioBrowserState = {
  open: boolean;
  status: "idle" | "loading" | "ready" | "error";
  currentPath: string | null;
  requestedPath: string | null;
  parent: string | null;
  entries: FsEntry[];
  error: string | null;
};

export type BuildPortfolioState = {
  status: "idle" | "loading" | "ready" | "error";
  contextProjectRoot: string | null;
  portfolio: BuildPortfolio | null;
  scope: "all-projects" | "attention";
  sort: "attention" | "name" | "freshness";
  selectedProjectId: string | null;
  browser: BuildPortfolioBrowserState;
  pendingCommands: BuildPortfolioCommand[];
  commandSequence: number;
  activatedProjectRoot: string | null;
  openedAttention: BuildPortfolioAttentionFocus | null;
  error: string | null;
  actionError: string | null;
};

export function createBuildPortfolioState(): BuildPortfolioState {
  return {
    status: "idle",
    contextProjectRoot: null,
    portfolio: null,
    scope: "all-projects",
    sort: "attention",
    selectedProjectId: null,
    browser: {
      open: false,
      status: "idle",
      currentPath: null,
      requestedPath: null,
      parent: null,
      entries: [],
      error: null,
    },
    pendingCommands: [],
    commandSequence: 0,
    activatedProjectRoot: null,
    openedAttention: null,
    error: null,
    actionError: null,
  };
}

export const INITIAL_BUILD_PORTFOLIO_STATE = createBuildPortfolioState();
export type BuildPortfolioSubscription = {
  type: "portfolio.poll";
  projectRoot: string;
  intervalMs: number;
};
