import type {
  BuildAttachResponse,
  BuildControlSnapshot,
  ProjectRef,
  ProjectRevision,
} from "@odd-manager/developer-control-contracts";

type BuildCommandIdentity = {
  commandId: string;
  correlationId: string;
  projectRoot: string;
  basisRevision: ProjectRevision;
};

export type BuildControlCommand =
  | ({ type: "build.load" } & BuildCommandIdentity)
  | ({
      type: "build.submit";
      project: ProjectRef;
      inputs: unknown;
      requestedBy: string;
    } & BuildCommandIdentity)
  | ({
      type: "build.attach" | "build.cancel" | "build.resume";
      executionId: string;
      actorRef: string;
    } & BuildCommandIdentity);

export type BuildControlState = {
  status: "idle" | "loading" | "ready" | "submitting" | "cancelling" | "resuming" | "stale" | "error";
  project: ProjectRef | null;
  basisRevision: ProjectRevision | null;
  snapshot: BuildControlSnapshot | null;
  inputDraft: string;
  selectedExecutionId: string | null;
  attached: BuildAttachResponse | null;
  pendingCommands: BuildControlCommand[];
  commandSequence: number;
  error: string | null;
};

export function createBuildControlState(): BuildControlState {
  return {
    status: "idle",
    project: null,
    basisRevision: null,
    snapshot: null,
    inputDraft: "{}",
    selectedExecutionId: null,
    attached: null,
    pendingCommands: [],
    commandSequence: 0,
    error: null,
  };
}

export const INITIAL_BUILD_CONTROL_STATE = createBuildControlState();

export type BuildControlSubscription = {
  type: "build.poll";
  projectRoot: string;
  intervalMs: number;
};
