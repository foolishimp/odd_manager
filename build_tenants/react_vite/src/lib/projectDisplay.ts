export function projectDisplayNameFromRoot(projectRoot: string) {
  const trimmed = projectRoot.trim().replace(/\/+$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  const sandboxName = sandboxWorkspaceName(parts);
  if (sandboxName) return sandboxName;
  return parts.at(-1) ?? "Project";
}

function sandboxWorkspaceName(parts: string[]) {
  const leaf = parts.at(-1);
  const runFolder = parts.at(-2);
  const browserFolder = parts.at(-3);
  if (leaf !== "workspace" || !runFolder || !browserFolder) return null;
  const match = runFolder.match(/(?:^|_)pid([A-Za-z0-9]+)$/);
  if (!match) return null;
  return `${browserFolder}.pid${match[1]}.workspace`;
}
