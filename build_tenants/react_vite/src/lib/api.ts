import type {
  CommandName,
  CommandResult,
  ManagerWorld,
  SessionServiceState,
  SurfaceData,
} from "./types";

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

export async function loadWorld(
  projectRoot: string,
  signal?: AbortSignal,
): Promise<ManagerWorld> {
  const params = new URLSearchParams({ projectRoot });
  return parseJson<ManagerWorld>(
    await fetch(`/api/world?${params.toString()}`, {
      signal,
    }),
  );
}

export async function loadSurface(
  projectRoot: string,
  relativePath: string,
): Promise<SurfaceData> {
  const params = new URLSearchParams({
    projectRoot,
    relativePath,
  });
  return parseJson<SurfaceData>(await fetch(`/api/surface?${params.toString()}`));
}

export async function runCommand(
  projectRoot: string,
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
        projectRoot,
        command,
        auto: options?.auto ?? false,
      }),
    }),
  );
}

export async function loadSessionServiceState(projectRoot: string): Promise<SessionServiceState> {
  const params = new URLSearchParams({ projectRoot });
  return parseJson<SessionServiceState>(await fetch(`/api/session-service?${params.toString()}`));
}

export async function approveSessionServiceRun(
  projectRoot: string,
  runId: string,
  edge?: string | null,
): Promise<Record<string, unknown>> {
  return parseJson<Record<string, unknown>>(
    await fetch("/api/session-service/run/approve", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectRoot,
        runId,
        edge: edge ?? null,
      }),
    }),
  );
}

export async function rejectSessionServiceRun(
  projectRoot: string,
  runId: string,
  reason: string,
  edge?: string | null,
): Promise<Record<string, unknown>> {
  return parseJson<Record<string, unknown>>(
    await fetch("/api/session-service/run/reject", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        projectRoot,
        runId,
        edge: edge ?? null,
        reason,
      }),
    }),
  );
}
