import type {
  AssuranceSnapshot,
  ProjectRef,
  ProjectRevision,
} from "@odd-manager/developer-control-contracts";

type AssuranceCommandIdentity = {
  commandId: string;
  correlationId: string;
  projectRoot: string;
  basisRevision: ProjectRevision;
};

export type AssuranceAttentionCommand =
  | ({
      type: "assurance.load";
      project: ProjectRef;
      executionId: string | null;
    } & AssuranceCommandIdentity)
  | ({
      type: "assurance.open-run-inspector";
      executionId: string | null;
      runRef: string | null;
      revision: string;
      sourceRef: string;
    } & AssuranceCommandIdentity);

export type AssuranceFilter = "all" | "attention";

export type AssuranceAttentionState = {
  status: "idle" | "loading" | "ready" | "stale" | "error";
  project: ProjectRef | null;
  basisRevision: ProjectRevision | null;
  executionId: string | null;
  snapshot: AssuranceSnapshot | null;
  filter: AssuranceFilter;
  selectedAssessmentRef: string | null;
  selectedAttentionId: string | null;
  pendingCommands: AssuranceAttentionCommand[];
  commandSequence: number;
  error: string | null;
};

export function createAssuranceAttentionState(): AssuranceAttentionState {
  return {
    status: "idle",
    project: null,
    basisRevision: null,
    executionId: null,
    snapshot: null,
    filter: "all",
    selectedAssessmentRef: null,
    selectedAttentionId: null,
    pendingCommands: [],
    commandSequence: 0,
    error: null,
  };
}

export const INITIAL_ASSURANCE_ATTENTION_STATE = createAssuranceAttentionState();
export type AssuranceAttentionSubscription = never;
