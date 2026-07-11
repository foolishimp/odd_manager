export type RunObservationMessage = {
  type: "run-observation/surface-requested";
  surface: "ai-workspace" | "run-inspector";
};
