import type {
  BuildAttachResponse,
  BuildControlSnapshot,
  BuildExecution,
  BuildSubmitResponse,
  ProjectRef,
  ProjectRevision,
} from "@odd-manager/developer-control-contracts";

export type BuildControlMessage =
  | { type: "build/context-changed"; project: ProjectRef; revision: ProjectRevision | null }
  | { type: "build/input-edited"; value: string }
  | { type: "build/refresh-requested" }
  | { type: "build/poll-ticked" }
  | { type: "build/submit-requested"; actorRef: string }
  | { type: "build/execution-selected"; executionId: string }
  | { type: "build/attach-requested"; actorRef: string }
  | { type: "build/resume-requested"; actorRef: string }
  | { type: "build/cancel-requested"; actorRef: string }
  | {
      type: "build/snapshot-loaded";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      snapshot: BuildControlSnapshot;
    }
  | {
      type: "build/submitted";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      result: BuildSubmitResponse;
    }
  | {
      type: "build/attached";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      attached: BuildAttachResponse;
    }
  | {
      type: "build/resumed";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      execution: BuildExecution;
    }
  | {
      type: "build/cancelled";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      execution: BuildExecution;
    }
  | {
      type: "build/cancellation-acknowledged";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      execution: BuildExecution;
    }
  | {
      type: "build/command-failed";
      commandId: string;
      correlationId: string;
      error: string;
      execution: BuildExecution | null;
    };
