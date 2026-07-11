import type {
  BuildPortfolio,
  CapabilityId,
} from "@odd-manager/developer-control-contracts";
import type { FsEntry } from "../../lib/collaboration";

export type BuildPortfolioMessage =
  | { type: "portfolio/context-changed"; projectRoot: string }
  | { type: "portfolio/refresh-requested" }
  | {
      type: "portfolio/load-succeeded";
      commandId: string;
      contextProjectRoot: string;
      portfolio: BuildPortfolio;
    }
  | { type: "portfolio/scope-selected"; scope: "all-projects" | "attention" }
  | { type: "portfolio/sort-selected"; sort: "attention" | "name" | "freshness" }
  | { type: "portfolio/project-selected"; projectId: string }
  | { type: "portfolio/project-activate-requested"; projectId: string }
  | { type: "portfolio/project-activated"; commandId: string; projectRoot: string }
  | { type: "portfolio/project-activation-consumed" }
  | { type: "portfolio/attention-open-requested"; projectId: string; attentionId: string }
  | {
      type: "portfolio/attention-opened";
      commandId: string;
      projectRoot: string;
      attentionId: string;
      sourceKind: string;
      sourceRef: string;
      targetCapabilityId: CapabilityId;
    }
  | { type: "portfolio/attention-focus-consumed" }
  | { type: "portfolio/project-unregister-requested"; projectId: string }
  | { type: "portfolio/project-unregistered"; commandId: string }
  | { type: "portfolio/browser-toggled"; open?: boolean }
  | { type: "portfolio/browser-navigate-requested"; path: string }
  | {
      type: "portfolio/browser-loaded";
      commandId: string;
      path: string;
      parent: string | null;
      entries: FsEntry[];
    }
  | { type: "portfolio/project-register-requested"; path: string }
  | { type: "portfolio/project-registered"; commandId: string }
  | { type: "portfolio/command-failed"; commandId: string; error: string };
