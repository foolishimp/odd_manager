export function projectDisplayNameFromRoot(projectRoot: string) {
  const trimmed = projectRoot.trim().replace(/\/+$/, "");
  const parts = trimmed.split("/").filter(Boolean);
  const sandboxName = sandboxWorkspaceName(parts);
  if (sandboxName) return sandboxName;
  return parts[parts.length - 1] ?? "Project";
}

function sandboxWorkspaceName(parts: string[]) {
  const leaf = parts[parts.length - 1];
  const runFolder = parts[parts.length - 2];
  const browserFolder = parts[parts.length - 3];
  if (leaf !== "workspace" || !runFolder || !browserFolder) return null;
  const match = runFolder.match(/(?:^|_)pid([A-Za-z0-9]+)$/);
  if (!match) return null;
  return `${browserFolder}.pid${match[1]}.workspace`;
}
