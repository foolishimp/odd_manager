import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import {
  attachGChatTopicRecord,
  attachGChatTopicSession,
  createGBoardComment,
  createGChatMessage,
  createGChatTopic,
  createTerminalPromotionComment,
  loadAgentConsoleState,
} from "./odd-console.mjs";
import { subscribeAgentConsoleEvents } from "./odd-console-events.mjs";
import { dispatchAgentReplies } from "./odd-plugin-host.mjs";
import {
  joinShellAgentTopic,
  getRoomParticipantStatus,
  joinRoomParticipant,
  launchShellAgent,
  launchRoomParticipantBootstrap,
  leaveRoomParticipant,
  listOddChatParticipants,
  postRoomParticipantMessage,
  readRoomParticipant,
  waitRoomParticipant,
} from "./oddchat-participant-service.mjs";
import {
  attachGTermServer,
  closeAllGTermSessions,
  closeGTermSession,
  createGTermSession,
  ensureGTermSession,
  renameGTermSession,
  selectGTermSession,
} from "./oddterm-pool-service.mjs";
import { loadRoomMessages } from "./oddchat-room-service.mjs";
import {
  connectIrcGatewayBinding,
  disconnectIrcGatewayBinding,
  getIrcGatewayBindingStatus,
  joinIrcGatewayChannel,
  partIrcGatewayChannel,
  readIrcGatewayRoom,
  sendIrcGatewayChannelMessage,
  sendIrcGatewayDirectMessage,
  whoIrcGatewayChannel,
} from "./irc-gateway-service.mjs";

const serverDir = dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = resolve(serverDir, "../../../../");
const appsRoot = resolve(serverDir, "../../../../../");
const helperScript = resolve(serverDir, "../../runtime/odd_manager_world.py");
const pythonBinary = process.env.OMAN_PYTHON ?? "python";
const port = Number(process.env.OMAN_API_PORT ?? 4173);
const sessionServiceBaseUrl = normalizeBaseUrl(process.env.OMAN_ODD_SDLC_SERVICE_URL ?? null);

function normalizeBaseUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function firstNumber(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

function finiteQueryNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeCollection(payload, keys) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    return [];
  }
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
}

function normalizeServiceRun(entry) {
  return {
    run_id: firstString(entry?.run_id, entry?.runId, entry?.id, entry?.instance_id) ?? "unknown-run",
    status: firstString(entry?.status, entry?.state, entry?.stage) ?? "unknown",
    graph_function: firstString(
      entry?.graph_function,
      entry?.graphFunction,
      entry?.graph_function_id,
      entry?.graphFunctionId,
    ),
    module: firstString(entry?.module, entry?.module_name, entry?.moduleName),
    edge: firstString(entry?.edge, entry?.edge_id, entry?.edgeId),
    blocking_reason: firstString(entry?.blocking_reason, entry?.blockingReason, entry?.reason),
    selected_worker: firstString(
      entry?.selected_worker,
      entry?.selectedWorker,
      entry?.worker,
      entry?.worker_name,
      entry?.workerName,
    ),
    updated_at: firstString(entry?.updated_at, entry?.updatedAt, entry?.event_time, entry?.eventTime),
  };
}

function normalizeServiceWorker(entry) {
  return {
    name: firstString(entry?.name, entry?.worker_name, entry?.workerName, entry?.id) ?? "unknown-worker",
    agent: firstString(entry?.agent, entry?.agent_type, entry?.agentType),
    transport: firstString(entry?.transport, entry?.transport_kind, entry?.transportKind),
    status: firstString(entry?.status, entry?.state),
    remote_host: firstString(entry?.remote_host, entry?.remoteHost, entry?.host),
    history_bytes: firstNumber(entry?.history_bytes, entry?.historyBytes, entry?.history_size),
    last_activity_at: firstString(
      entry?.last_activity_at,
      entry?.lastActivityAt,
      entry?.updated_at,
      entry?.updatedAt,
    ),
  };
}

async function parseServiceJson(response) {
  const payloadText = await response.text();
  let payload = null;
  if (payloadText.trim()) {
    try {
      payload = JSON.parse(payloadText);
    } catch (caught) {
      throw new Error(
        caught instanceof Error
          ? `service returned invalid JSON: ${caught.message}`
          : "service returned invalid JSON",
      );
    }
  }
  if (!response.ok) {
    const detail =
      payload && typeof payload === "object" && typeof payload.error === "string"
        ? payload.error
        : payloadText.trim() || `${response.status} ${response.statusText}`;
    throw new Error(detail);
  }
  return payload;
}

function buildSessionServiceUrl(pathname, workspaceRoot, extraParams = {}) {
  if (!sessionServiceBaseUrl) {
    return null;
  }
  const nextUrl = new URL(pathname, sessionServiceBaseUrl);
  if (workspaceRoot) {
    nextUrl.searchParams.set("workspaceRoot", workspaceRoot);
  }
  for (const [key, value] of Object.entries(extraParams)) {
    if (value !== null && value !== undefined && value !== "") {
      nextUrl.searchParams.set(key, String(value));
    }
  }
  return nextUrl;
}

async function loadSessionServiceSnapshot(workspaceRoot) {
  const observedAt = new Date().toISOString();
  if (!sessionServiceBaseUrl) {
    return {
      configured: false,
      available: false,
      base_url: null,
      observed_at: observedAt,
      error: "Set OMAN_ODD_SDLC_SERVICE_URL on the odd_manager API to read odd_sdlc_service runs and workers.",
      runs: [],
      workers: [],
    };
  }

  try {
    const [runsPayload, workersPayload] = await Promise.all([
      fetch(buildSessionServiceUrl("/api/runs", workspaceRoot)).then(parseServiceJson),
      fetch(buildSessionServiceUrl("/api/workers", workspaceRoot)).then(parseServiceJson),
    ]);
    return {
      configured: true,
      available: true,
      base_url: sessionServiceBaseUrl,
      observed_at: observedAt,
      error: null,
      runs: normalizeCollection(runsPayload, ["runs", "items", "data"]).map(normalizeServiceRun),
      workers: normalizeCollection(workersPayload, ["workers", "items", "data"]).map(normalizeServiceWorker),
    };
  } catch (caught) {
    return {
      configured: true,
      available: false,
      base_url: sessionServiceBaseUrl,
      observed_at: observedAt,
      error: caught instanceof Error ? caught.message : String(caught),
      runs: [],
      workers: [],
    };
  }
}

async function postSessionServiceCommand(pathname, body = {}, workspaceRoot = null) {
  const serviceUrl = buildSessionServiceUrl(pathname, workspaceRoot);
  if (!serviceUrl) {
    throw new Error("odd_sdlc_service is not configured for odd_manager");
  }
  return parseServiceJson(
    await fetch(serviceUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

function humanizeName(value) {
  return String(value ?? "")
    .replace(/^\d{8}T\d{6}_/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function workspaceDisplayName(workspaceRoot) {
  const segments = String(workspaceRoot).split("/").filter(Boolean);
  const baseName = segments.at(-1) ?? workspaceRoot;
  if (baseName === "workspace" && segments.length >= 2) {
    return humanizeName(segments.at(-2) ?? baseName);
  }
  return humanizeName(baseName);
}

function isWorkspaceRoot(absolutePath) {
  return (
    existsSync(join(absolutePath, ".genesis")) ||
    existsSync(join(absolutePath, ".genesis", "genesis.yml"))
  );
}

function oddNameSignal(name) {
  const normalized = String(name ?? "").trim().toLowerCase();
  return (
    normalized === "odd" ||
    normalized.startsWith("odd_") ||
    normalized.startsWith("odd-") ||
    normalized.includes("_odd") ||
    normalized.includes("-odd") ||
    normalized.includes("oddmanager") ||
    normalized.includes("odd_method") ||
    normalized.includes("odd_manager") ||
    normalized.includes("odd_sdlc")
  );
}

function readOddProductSignal(workspaceRoot) {
  for (const relativePath of ["README.md", "specification/PRODUCT.md", "specification/INTENT.md"]) {
    const absolutePath = join(workspaceRoot, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    try {
      const content = readFileSync(absolutePath, "utf8").slice(0, 4000).toLowerCase();
      if (content.includes("odd_") || content.includes("odd method") || content.includes("odd manager") || content.includes("ood aware")) {
        return relativePath;
      }
    } catch {
      // Ignore unreadable files.
    }
  }
  return null;
}

function hasWorkspaceMarker(workspaceRoot, relativePath) {
  return existsSync(join(workspaceRoot, relativePath));
}

function classifyOddWorkspace(workspaceRoot) {
  const markers = [];
  const baseName = workspaceRoot.split("/").filter(Boolean).at(-1) ?? workspaceRoot;

  if (oddNameSignal(baseName)) {
    markers.push(`name:${baseName}`);
  }

  const buildTenantsRoot = join(workspaceRoot, "build_tenants");
  if (existsSync(buildTenantsRoot)) {
    try {
      const tenantNames = readdirSync(buildTenantsRoot, { withFileTypes: true })
        .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
        .map((entry) => entry.name)
        .filter((name) => oddNameSignal(name));
      for (const tenantName of tenantNames) {
        markers.push(`tenant:${tenantName}`);
      }
    } catch {
      // Ignore unreadable tenant roots.
    }
  }

  const docSignal = readOddProductSignal(workspaceRoot);
  if (docSignal) {
    markers.push(`doc:${docSignal}`);
  }

  if (hasWorkspaceMarker(workspaceRoot, ".odd_sdlc")) {
    markers.push("runtime:.odd_sdlc");
  }

  if (
    hasWorkspaceMarker(workspaceRoot, ".genesis/gtl") ||
    hasWorkspaceMarker(workspaceRoot, ".genesis/docs/standards/SPEC_METHOD.md")
  ) {
    markers.push("runtime:.genesis");
  }

  if (hasWorkspaceMarker(workspaceRoot, "build_tenants/TENANT_REGISTRY.md")) {
    markers.push("tenant:registry");
  }

  if (
    hasWorkspaceMarker(workspaceRoot, "AGENTS.md") &&
    hasWorkspaceMarker(workspaceRoot, "CLAUDE.md")
  ) {
    markers.push("bootstrap:agent-surfaces");
  }

  return markers;
}

function scanForWorkspaces(rootPath, { oddOnly = false } = {}) {
  const root = resolve(rootPath || appsRoot);
  const maxDepth = 10;
  const maxVisited = 30000;
  const maxResults = 200;
  const nestedWorkspaceCarrierNames = new Set([
    "build_tenants",
    "examples",
    "local_projects",
    "sandboxes",
    "test_runs",
    "workspaces",
  ]);

  function priorityForDirectory(name) {
    if (nestedWorkspaceCarrierNames.has(name)) {
      return 0;
    }
    if (oddNameSignal(name)) {
      return 1;
    }
    return 2;
  }
  const ignoredNames = new Set([
    ".git",
    ".venv",
    ".pytest_cache",
    "__pycache__",
    "node_modules",
    "dist",
    "build",
    "coverage",
    "site-packages",
  ]);

  const results = [];
  const queue = [{ path: root, depth: 0 }];
  let cursor = 0;
  let visited = 0;

  while (cursor < queue.length && visited < maxVisited && results.length < maxResults) {
    const current = queue[cursor];
    cursor += 1;
    if (!current) {
      continue;
    }
    visited += 1;

    if (isWorkspaceRoot(current.path)) {
      const markers = classifyOddWorkspace(current.path);
      if (!oddOnly || markers.length > 0) {
        results.push({
          name: workspaceDisplayName(current.path),
          path: current.path,
          updatedAt: statSync(current.path).mtime.toISOString(),
          markers,
        });
      }
      if (current.depth >= maxDepth) {
        continue;
      }

      let nestedEntries = [];
      try {
        nestedEntries = readdirSync(current.path, { withFileTypes: true });
      } catch {
        continue;
      }

      const nestedDirectories = nestedEntries
        .filter(
          (entry) =>
            entry.isDirectory() &&
            !entry.name.startsWith(".") &&
            nestedWorkspaceCarrierNames.has(entry.name),
        )
        .sort((left, right) => {
          const priorityDiff = priorityForDirectory(left.name) - priorityForDirectory(right.name);
          if (priorityDiff !== 0) {
            return priorityDiff;
          }
          return left.name.localeCompare(right.name);
        });

      for (const entry of nestedDirectories) {
        queue.push({
          path: join(current.path, entry.name),
          depth: current.depth + 1,
        });
      }
      continue;
    }

    if (current.depth >= maxDepth) {
      continue;
    }

    let entries = [];
    try {
      entries = readdirSync(current.path, { withFileTypes: true });
    } catch {
      continue;
    }

    const directories = entries
      .filter((entry) => entry.isDirectory() && !ignoredNames.has(entry.name) && !entry.name.startsWith("."))
      .sort((left, right) => {
        const priorityDiff = priorityForDirectory(left.name) - priorityForDirectory(right.name);
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        return left.name.localeCompare(right.name);
      });

    for (const entry of directories) {
      queue.push({
        path: join(current.path, entry.name),
        depth: current.depth + 1,
      });
    }
  }

  return results.sort((left, right) => String(right.updatedAt ?? "").localeCompare(String(left.updatedAt ?? "")));
}

function browseDirectory(targetPath) {
  const directory = targetPath || homedir();
  const maxEntries = 500;
  const rawEntries = readdirSync(directory, { withFileTypes: true });
  const directories = rawEntries
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules")
    .sort((left, right) => left.name.localeCompare(right.name));

  const entries = directories.slice(0, maxEntries).map((entry) => {
    const absolutePath = join(directory, entry.name);
    const markers = isWorkspaceRoot(absolutePath) ? classifyOddWorkspace(absolutePath) : [];
    const hasWorkspace = markers.length > 0;

    return {
      name: entry.name,
      absolutePath,
      hasWorkspace,
      markers,
    };
  });

  return {
    path: directory,
    parent: directory === "/" ? null : dirname(directory),
    entries,
    truncated: directories.length > maxEntries,
  };
}

function writeJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  });
  response.end(JSON.stringify(payload, null, 2));
}

function writeSseHeaders(response) {
  response.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
}

function writeSseEvent(response, event, payload) {
  response.write(`event: ${event}\n`);
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function readBody(request) {
  return new Promise((resolvePromise, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk.toString();
    });
    request.on("end", () => resolvePromise(body));
    request.on("error", reject);
  });
}

function runHelper(args) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(pythonBinary, [helperScript, ...args], {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `helper exited with code ${code}`));
        return;
      }
      try {
        resolvePromise(JSON.parse(stdout));
      } catch (caught) {
        reject(
          new Error(
            caught instanceof Error
              ? `failed to parse helper output: ${caught.message}`
              : "failed to parse helper output",
          ),
        );
      }
    });
  });
}

const server = createServer(async (request, response) => {
  if (!request.url) {
    writeJson(response, 400, { error: "missing request url" });
    return;
  }

  if (request.method === "OPTIONS") {
    writeJson(response, 204, {});
    return;
  }

  const url = new URL(request.url, `http://${request.headers.host ?? "127.0.0.1"}`);

  try {
    if (request.method === "GET" && url.pathname === "/api/health") {
      writeJson(response, 200, { ok: true, workspaceRoot: defaultWorkspaceRoot });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/fs/browse") {
      writeJson(response, 200, browseDirectory(url.searchParams.get("path") || undefined));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/workspace-scan") {
      const root = url.searchParams.get("root") || appsRoot;
      const kind = url.searchParams.get("kind") || "workspace";
      writeJson(response, 200, scanForWorkspaces(root, { oddOnly: kind === "odd" }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/odd-console") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(response, 200, loadAgentConsoleState(workspaceRoot));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/odd-console/stream") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeSseHeaders(response);
      writeSseEvent(response, "connected", {
        workspaceRoot,
        timestamp: new Date().toISOString(),
      });

      const unsubscribe = subscribeAgentConsoleEvents(workspaceRoot, (payload) => {
        writeSseEvent(response, "odd-console-updated", payload);
      });

      const heartbeat = setInterval(() => {
        response.write(": keepalive\n\n");
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        unsubscribe();
        response.end();
      };

      request.on("close", cleanup);
      request.on("error", cleanup);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/world") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(response, 200, await runHelper(["world", "--workspace", workspaceRoot]));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/session-service") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(response, 200, await loadSessionServiceSnapshot(workspaceRoot));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/surface") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      const relativePath = url.searchParams.get("relativePath");
      if (!relativePath) {
        writeJson(response, 400, { error: "surface requests require relativePath" });
        return;
      }
      writeJson(
        response,
        200,
        await runHelper([
          "surface",
          "--workspace",
          workspaceRoot,
          "--relative-path",
          relativePath,
        ]),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/commands/run") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      const command = body.command;
      if (!["gaps", "iterate", "start"].includes(command)) {
        writeJson(response, 400, { error: `unsupported command: ${command}` });
        return;
      }
      const args = ["command", command, "--workspace", workspaceRoot];
      if (command === "start" && body.auto) {
        args.push("--auto");
      }
      writeJson(response, 200, await runHelper(args));
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/session-service/run/approve") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      if (!body.runId) {
        writeJson(response, 400, { error: "approve requires runId" });
        return;
      }
      writeJson(
        response,
        200,
        await postSessionServiceCommand(
          `/api/runs/${encodeURIComponent(body.runId)}/approve`,
          {
            edge: body.edge ?? null,
          },
          workspaceRoot,
        ),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/session-service/run/reject") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      if (!body.runId) {
        writeJson(response, 400, { error: "reject requires runId" });
        return;
      }
      if (!body.reason || !String(body.reason).trim()) {
        writeJson(response, 400, { error: "reject requires reason" });
        return;
      }
      writeJson(
        response,
        200,
        await postSessionServiceCommand(
          `/api/runs/${encodeURIComponent(body.runId)}/reject`,
          {
            edge: body.edge ?? null,
            reason: body.reason,
          },
          workspaceRoot,
        ),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/odd-console/comment") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        createGBoardComment(workspaceRoot, {
          roomId: body.roomId,
          body: body.body,
          selectedTrainId: body.selectedTrainId,
          stationId: body.stationId,
          edgeId: body.edgeId,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/topic") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        createGChatTopic(workspaceRoot, {
          title: body.title,
          sourceRecordId: body.sourceRecordId,
          selectedTrainId: body.selectedTrainId,
          stationId: body.stationId,
          edgeId: body.edgeId,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/topic/attach-record") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        attachGChatTopicRecord(workspaceRoot, {
          topicId: body.topicId,
          recordId: body.recordId,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/topic/attach-session") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        attachGChatTopicSession(workspaceRoot, {
          topicId: body.topicId,
          sessionId: body.sessionId,
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/oddchat/room") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      const roomId = url.searchParams.get("roomId");
      if (!roomId) {
        writeJson(response, 400, { error: "room requests require roomId" });
        return;
      }
      const limit = finiteQueryNumber(url.searchParams.get("limit"), 80);
      writeJson(response, 200, {
        ok: true,
        roomId,
        messages: loadRoomMessages(workspaceRoot, roomId, limit),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/oddchat/participants") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        participants: listOddChatParticipants(workspaceRoot, {
          roomId: firstString(url.searchParams.get("roomId")),
          topicId: firstString(url.searchParams.get("topicId")),
          sessionId: firstString(url.searchParams.get("sessionId")),
          connectedOnly:
            String(url.searchParams.get("connectedOnly") ?? "true").toLowerCase() !== "false",
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/participant/join") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        joinRoomParticipant(workspaceRoot, {
          sessionId: body.sessionId,
          participantId: body.participantId,
          provider: body.provider,
          participantLabel: body.participantLabel,
          roomId: body.roomId,
          topicId: body.topicId,
          historyLimit: body.historyLimit,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/participant/leave") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        leaveRoomParticipant(workspaceRoot, {
          participantId: body.participantId,
          sessionId: body.sessionId,
          provider: body.provider,
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/oddchat/participant/status") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        getRoomParticipantStatus(workspaceRoot, {
          participantId: firstString(url.searchParams.get("participantId")),
          sessionId: firstString(url.searchParams.get("sessionId")),
          provider: firstString(url.searchParams.get("provider")),
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/participant/read") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        readRoomParticipant(workspaceRoot, {
          participantId: body.participantId,
          sessionId: body.sessionId,
          provider: body.provider,
          cursor: body.cursor,
          limit: body.limit,
          excludeSelf: body.excludeSelf,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/participant/wait") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        await waitRoomParticipant(workspaceRoot, {
          participantId: body.participantId,
          sessionId: body.sessionId,
          provider: body.provider,
          cursor: body.cursor,
          limit: body.limit,
          timeoutMs: body.timeoutMs,
          excludeSelf: body.excludeSelf,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/participant/message") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        postRoomParticipantMessage(workspaceRoot, {
          participantId: body.participantId,
          sessionId: body.sessionId,
          provider: body.provider,
          body: body.body,
          text: body.text,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/topic/bootstrap-agent") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        launchRoomParticipantBootstrap(workspaceRoot, {
          topicId: body.topicId,
          sessionId: body.sessionId,
          provider: body.provider,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session/launch-agent") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        launchShellAgent(workspaceRoot, {
          sessionId: body.sessionId,
          provider: body.provider,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session/join-topic") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        await joinShellAgentTopic(workspaceRoot, {
          sessionId: body.sessionId,
          topicId: body.topicId,
          provider: body.provider,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/odd-console/message") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      const posted = createGChatMessage(workspaceRoot, {
        roomId: body.roomId,
        body: body.body,
        selectedTrainId: body.selectedTrainId,
        stationId: body.stationId,
        edgeId: body.edgeId,
      });
      void dispatchAgentReplies(workspaceRoot, {
        roomId: body.roomId,
        body: body.body,
        selectedTrainId: body.selectedTrainId,
        stationId: body.stationId,
        edgeId: body.edgeId,
      }).catch((error) => {
        console.error("oddterm dispatch failed", error);
      });
      writeJson(response, 200, { ...posted, agentReplies: [] });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        session: createGTermSession(workspaceRoot, {
          selectedTrainId: body.selectedTrainId || null,
          stationId: body.stationId || null,
          edgeId: body.edgeId || null,
          label: body.label || null,
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session/ensure") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        session: ensureGTermSession(workspaceRoot, {
          selectedTrainId: body.selectedTrainId || null,
          stationId: body.stationId || null,
          edgeId: body.edgeId || null,
          label: body.label || null,
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session/rename") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        session: renameGTermSession(workspaceRoot, body.sessionId, body.label),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session/close") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        session: closeGTermSession(workspaceRoot, body.sessionId),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session/close-all") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        ...closeAllGTermSessions(workspaceRoot),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/session/select") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      const state = selectGTermSession(workspaceRoot, body.sessionId);
      writeJson(response, 200, {
        ok: true,
        activeSessionId: state.activeSessionId,
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddterm/promote") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        createTerminalPromotionComment(workspaceRoot, {
          sessionId: body.sessionId,
          lineCount: body.lineCount,
          selectedTrainId: body.selectedTrainId,
          stationId: body.stationId,
          edgeId: body.edgeId,
        }),
      );
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/irc/session/status") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: getIrcGatewayBindingStatus(workspaceRoot, {
          sessionId: url.searchParams.get("sessionId") || null,
          sessionLabel: url.searchParams.get("sessionLabel") || null,
        }),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/irc/session/read") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: readIrcGatewayRoom(workspaceRoot, {
          sessionId: url.searchParams.get("sessionId") || null,
          sessionLabel: url.searchParams.get("sessionLabel") || null,
          limit: finiteQueryNumber(url.searchParams.get("limit"), 40),
        }),
      });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/irc/session/who") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        ...whoIrcGatewayChannel(workspaceRoot, {
          sessionId: url.searchParams.get("sessionId") || null,
          sessionLabel: url.searchParams.get("sessionLabel") || null,
          channel: url.searchParams.get("channel") || null,
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/irc/session/connect") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: connectIrcGatewayBinding(workspaceRoot, {
          sessionId: body.sessionId || null,
          sessionLabel: body.sessionLabel || null,
          topicId: body.topicId || null,
          roomId: body.roomId || null,
          host: body.host || null,
          port: body.port || null,
          tls: body.tls ?? null,
          insecureTls: body.insecureTls ?? null,
          password: body.password || null,
          nick: body.nick || null,
          username: body.username || null,
          realName: body.realName || null,
          channels: Array.isArray(body.channels) ? body.channels : body.channel ? [body.channel] : [],
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/irc/session/disconnect") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: disconnectIrcGatewayBinding(workspaceRoot, {
          sessionId: body.sessionId || null,
          sessionLabel: body.sessionLabel || null,
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/irc/session/join") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: joinIrcGatewayChannel(workspaceRoot, {
          sessionId: body.sessionId || null,
          sessionLabel: body.sessionLabel || null,
          channel: body.channel || null,
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/irc/session/part") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: partIrcGatewayChannel(workspaceRoot, {
          sessionId: body.sessionId || null,
          sessionLabel: body.sessionLabel || null,
          channel: body.channel || null,
          reason: body.reason || null,
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/irc/session/send") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: sendIrcGatewayChannelMessage(workspaceRoot, {
          sessionId: body.sessionId || null,
          sessionLabel: body.sessionLabel || null,
          channel: body.channel || null,
          text: body.text || null,
        }),
      });
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/irc/session/dm") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(response, 200, {
        ok: true,
        binding: sendIrcGatewayDirectMessage(workspaceRoot, {
          sessionId: body.sessionId || null,
          sessionLabel: body.sessionLabel || null,
          nick: body.nick || null,
          text: body.text || null,
        }),
      });
      return;
    }

    writeJson(response, 404, { error: `unknown route: ${url.pathname}` });
  } catch (caught) {
    writeJson(response, 500, {
      error: caught instanceof Error ? caught.message : String(caught),
    });
  }
});

attachGTermServer(server, { defaultWorkspaceRoot });

server.listen(port, "127.0.0.1", () => {
  console.log(`odd_manager API listening on http://127.0.0.1:${port}`);
});
