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
  attachGTermServer,
  closeAllGTermSessions,
  closeGTermSession,
  createGTermSession,
  renameGTermSession,
  selectGTermSession,
} from "./oddterm-pool-service.mjs";

const serverDir = dirname(fileURLToPath(import.meta.url));
const defaultWorkspaceRoot = resolve(serverDir, "../../../../");
const appsRoot = resolve(serverDir, "../../../../../");
const helperScript = resolve(serverDir, "../../runtime/odd_manager_world.py");
const pythonBinary = process.env.OMAN_PYTHON ?? "python";
const port = Number(process.env.OMAN_API_PORT ?? 4173);

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
    const hasWorkspace = isWorkspaceRoot(absolutePath);

    return {
      name: entry.name,
      absolutePath,
      hasWorkspace,
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
