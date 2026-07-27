const PROJECT_PARAMETER = "project";
const RUN_FOCUS_PARAMETERS = [
  "execution",
  "runRef",
  "revision",
  "source",
] as const;

export function normalizeProjectRoot(value: string) {
  const trimmed = value.trim();
  return trimmed === "/" ? trimmed : trimmed.replace(/\/+$/, "");
}

export function activatedProjectMatches(
  expected: { projectId: string; projectRoot: string },
  returned: { id: string; root: string },
) {
  return (
    returned.id === expected.projectId
    && normalizeProjectRoot(returned.root) === normalizeProjectRoot(expected.projectRoot)
  );
}

/**
 * Project activation is projected over the URL that exists at interpretation
 * time. Host-owned surface navigation may have changed that URL after shell
 * bootstrap, so a reducer-captured href is not an admissible projection basis.
 */
export function projectUrl(currentHref: string, workspaceRoot: string) {
  const url = new URL(currentHref);
  const projectValues = url.searchParams.getAll(PROJECT_PARAMETER);
  const normalizedRoot = normalizeProjectRoot(workspaceRoot);
  const sameProject = projectValues.length === 1
    && normalizeProjectRoot(projectValues[0] ?? "") === normalizedRoot;

  url.searchParams.set(PROJECT_PARAMETER, normalizedRoot);
  if (!sameProject) {
    for (const parameter of RUN_FOCUS_PARAMETERS) {
      url.searchParams.delete(parameter);
    }
  }
  return `${url.pathname}${url.search}${url.hash}`;
}
