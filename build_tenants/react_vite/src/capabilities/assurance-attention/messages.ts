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
      projectRoot: string;
      snapshot: AssuranceSnapshot;
    }
  | { type: "assurance/load-failed"; commandId: string; error: string }
  | { type: "assurance/supporting-command-consumed"; commandId: string };
