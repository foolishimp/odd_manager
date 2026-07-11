import type { WorkbenchPhase } from "./state";

export type ProjectWorkbenchMessage = {
  type: "workbench/phase-selected";
  phase: WorkbenchPhase;
};
