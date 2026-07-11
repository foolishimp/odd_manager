import type { ProjectRecord } from "../contracts/project";
import type { DeveloperControlSurface } from "../contracts/developer-control";

export const PROJECT_DEEP_LINK_PARAM = "project";
export const PROJECT_VIEW_DEEP_LINK_PARAM = "view";
export const RUN_FOCUS_EXECUTION_PARAM = "execution";
export const RUN_FOCUS_RUN_REF_PARAM = "runRef";
export const RUN_FOCUS_REVISION_PARAM = "revision";
export const RUN_FOCUS_SOURCE_PARAM = "source";

export type ProjectLandingSurface = DeveloperControlSurface;

export type RunInspectorFocus = {
  projectRoot: string;
  executionId: string;
  runRef: string | null;
  revision: string;
  sourceRef: string;
};

export type ProjectDeepLinkRequest =
  | { state: "absent" }
  | { state: "invalid"; error: string }
  | { state: "ready"; projectRoot: string };

function normalizeProjectRoot(value: string) {
  const trimmed = value.trim();
  return trimmed === "/" ? trimmed : trimmed.replace(/\/+$/, "");
}

export function parseProjectDeepLink(search: string): ProjectDeepLinkRequest {
  const parameters = new URLSearchParams(search);
  const values = parameters.getAll(PROJECT_DEEP_LINK_PARAM);
  if (values.length === 0) return { state: "absent" };
  if (values.length > 1) {
    return { state: "invalid", error: "Project deep link must contain one project path." };
  }
  const projectRoot = normalizeProjectRoot(values[0] ?? "");
  if (!projectRoot) {
    return { state: "invalid", error: "Project deep link path is empty." };
  }
  if (!projectRoot.startsWith("/") || projectRoot.includes("\0") || projectRoot.length > 4096) {
    return { state: "invalid", error: "Project deep link must be an absolute local path." };
  }
  return { state: "ready", projectRoot };
}

export function registeredProjectForDeepLink(
  projectRoot: string,
  projects: ProjectRecord[],
) {
  const normalizedRoot = normalizeProjectRoot(projectRoot);
  return projects.find((project) => normalizeProjectRoot(project.root) === normalizedRoot) ?? null;
}

export function projectDeepLinkUrl(currentHref: string, projectRoot: string) {
  const url = new URL(currentHref);
  url.searchParams.set(PROJECT_DEEP_LINK_PARAM, normalizeProjectRoot(projectRoot));
  return `${url.pathname}${url.search}${url.hash}`;
}

export function projectLandingSurface(search: string): ProjectLandingSurface {
  const requestedView = new URLSearchParams(search).get(PROJECT_VIEW_DEEP_LINK_PARAM);
  if (
    requestedView === "ai-workspace"
    || requestedView === "run-inspector"
    || requestedView === "ticket-board"
  ) return requestedView;
  return "project-workbench";
}

function boundedParameter(parameters: URLSearchParams, name: string, maxLength = 4096) {
  const values = parameters.getAll(name);
  if (values.length !== 1) return null;
  const value = values[0]?.trim() ?? "";
  return value && value.length <= maxLength && !value.includes("\0") ? value : null;
}

export function runInspectorFocus(search: string, projectRoot: string): RunInspectorFocus | null {
  const parameters = new URLSearchParams(search);
  const executionId = boundedParameter(parameters, RUN_FOCUS_EXECUTION_PARAM, 512);
  const revision = boundedParameter(parameters, RUN_FOCUS_REVISION_PARAM, 512);
  const sourceRef = boundedParameter(parameters, RUN_FOCUS_SOURCE_PARAM);
  if (!executionId || !revision || !sourceRef) return null;
  return {
    projectRoot: normalizeProjectRoot(projectRoot),
    executionId,
    runRef: boundedParameter(parameters, RUN_FOCUS_RUN_REF_PARAM),
    revision,
    sourceRef,
  };
}
