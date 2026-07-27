import type {
  AssuranceSnapshot,
  ProjectRef,
  ProjectRevision,
} from "@odd-manager/developer-control-contracts";
import type { AssuranceFilter } from "./state";

export type AssuranceAttentionMessage =
  | {
      type: "assurance/context-changed";
      project: ProjectRef;
      revision: ProjectRevision | null;
      executionId: string | null;
    }
  | { type: "assurance/refresh-requested" }
  | { type: "assurance/filter-selected"; filter: AssuranceFilter }
  | { type: "assurance/assessment-selected"; assessmentRef: string }
  | { type: "attention/item-selected"; attentionId: string }
  | { type: "attention/reaction-requested"; attentionId: string; reactionRef: string }
  | { type: "assurance/run-inspector-requested" }
  | {
      type: "assurance/load-succeeded";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      snapshot: AssuranceSnapshot;
    }
  | {
      type: "assurance/command-failed";
      commandId: string;
      correlationId: string;
      failureKind: "stale_basis" | "identity_mismatch";
      error: string;
    }
  | { type: "assurance/load-failed"; commandId: string; correlationId: string; error: string }
  | {
      type: "assurance/inspector-focus-resolved";
      commandId: string;
      correlationId: string;
      projectRoot: string;
      executionId: string;
      runRef: string;
      revision: string;
      sourceRef: string;
    }
  | {
      type: "assurance/inspector-focus-failed";
      commandId: string;
      correlationId: string;
      error: string;
    };
