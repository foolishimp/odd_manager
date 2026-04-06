import type { CommandName, CommandResult, ManagerWorld, SurfaceData } from "./types";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let detail = `${response.status} ${response.statusText}`;
    try {
      const payload = await response.json();
      if (payload && typeof payload.error === "string") {
        detail = payload.error;
      }
    } catch {
      // ignore secondary parse failures
    }
    throw new Error(detail);
  }
  return (await response.json()) as T;
}

export async function loadWorld(workspaceRoot: string): Promise<ManagerWorld> {
  const params = new URLSearchParams({ workspaceRoot });
  return parseJson<ManagerWorld>(await fetch(`/api/world?${params.toString()}`));
}

export async function loadSurface(
  workspaceRoot: string,
  relativePath: string,
): Promise<SurfaceData> {
  const params = new URLSearchParams({
    workspaceRoot,
    relativePath,
  });
  return parseJson<SurfaceData>(await fetch(`/api/surface?${params.toString()}`));
}

export async function runCommand(
  workspaceRoot: string,
  command: CommandName,
  options?: { auto?: boolean },
): Promise<CommandResult> {
  return parseJson<CommandResult>(
    await fetch("/api/commands/run", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workspaceRoot,
        command,
        auto: options?.auto ?? false,
      }),
    }),
  );
}

