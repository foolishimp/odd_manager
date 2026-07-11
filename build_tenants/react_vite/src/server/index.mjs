import { createReadStream, existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
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
  setGChatTopicRoomRecipients,
} from "./odd-console.mjs";
import { subscribeAgentConsoleEvents } from "./odd-console-events.mjs";
import { createTicketSurface } from "./ticket-asset-surface-service.mjs";
import { createCommentSurface } from "./comment-asset-surface-service.mjs";
import { createSessionSurface } from "./session-asset-surface-service.mjs";
import { createProjectSurface } from "./project-asset-surface-service.mjs";
import { loadAiWorkspaceObservation } from "./ai-workspace-observation-service.mjs";
import { loadTraversalSummary, loadTraversalVectorDetail } from "./traversal-projection-service.mjs";
import { loadAbgRunObservation } from "./abg-run-observation-service.mjs";
import {
  loadDeveloperControlBootstrap,
  loadDeveloperControlPortfolio,
} from "./developer-control-bootstrap-service.mjs";
import {
  createCodexSpecificationProposalProvider,
  createFixtureSpecificationProposalProvider,
} from "./specification-proposal-provider.mjs";
import {
  createSpecificationProposalService,
  SpecificationProposalError,
} from "./specification-proposal-service.mjs";
import {
  BuildControlError,
  createBuildControlService,
} from "./build-control-service.mjs";
import { loadBuildExecutionAdapterRegistry } from "./build-execution-adapter-registry.mjs";
import {
  AssuranceError,
  createAssuranceService,
} from "./assurance-service.mjs";
import { detectPublishedWorkspaceIdentity } from "./workspace-identity-service.mjs";
import {
  readWorkspaceSurface,
  resolveWorkspaceSurfacePath,
  workspaceSurfaceMediaType,
} from "./workspace-surface-service.mjs";
import {
  spawnSession,
  killSession,
  listLiveSessionIds,
  mountSessionWebSocket,
  rehydrateSessions,
  sessionBackplaneDiagnostic,
} from "./session-pty-service.mjs";
import { dispatchAgentReplies } from "./odd-plugin-host.mjs";
import {
  addTopicParticipant,
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
const managerStateRoot = resolve(process.env.OMAN_MANAGER_STATE_ROOT || defaultWorkspaceRoot);
const appsRoot = resolve(serverDir, "../../../../../");
const port = Number(process.env.OMAN_API_PORT ?? 4173);
const specificationProposalProvider = process.env.OMAN_PROPOSAL_FIXTURE_MODE === "1"
  ? createFixtureSpecificationProposalProvider()
  : createCodexSpecificationProposalProvider();
const specificationProposalService = createSpecificationProposalService({
  managerStateRoot,
  provider: specificationProposalProvider,
});
const buildExecutionAdapterRegistry = await loadBuildExecutionAdapterRegistry({
  managerStateRoot,
  registryPath: process.env.OMAN_BUILD_ADAPTER_REGISTRY,
});
const buildControlService = createBuildControlService({
  managerStateRoot,
  adapters: buildExecutionAdapterRegistry.adapters,
  fixtureMode: process.env.OMAN_BUILD_FIXTURE_MODE === "1",
  maxConcurrent: Number(process.env.OMAN_BUILD_MAX_CONCURRENT ?? 2),
  maxQueued: Number(process.env.OMAN_BUILD_MAX_QUEUED ?? 100),
});
const assuranceService = createAssuranceService({ buildControlService });

function loadAdmittedDeveloperControlBootstrap(projectRoot, projects) {
  const base = loadDeveloperControlBootstrap(projectRoot, projects, {
    proposalParticipantRef: specificationProposalService.participantRef,
  });
  return loadDeveloperControlBootstrap(projectRoot, projects, {
    proposalParticipantRef: specificationProposalService.participantRef,
    revision: base.context.revision,
    buildDescriptorAdmission: buildControlService.descriptorAdmission(base.context.project),
    assuranceCatalogAdmission: assuranceService.catalogAdmission(base.context.project),
  });
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

function finiteQueryNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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

function uniqueStrings(values) {
  return [...new Set(values.filter((value) => typeof value === "string" && value.trim()))];
}

function isPathWithin(root, candidate) {
  const rel = relative(resolve(root), resolve(candidate));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function oddTermSessionRecord(session, workspaceRoot) {
  const status = session.status === "live" ? "running" : session.status ?? "unknown";
  return {
    id: session.id,
    agent_type: "shell",
    cwd: session.cwd ?? workspaceRoot,
    status,
    started_at: session.createdAt,
    transcript_ref: session.conversationHistoryId
      ? `.ai-workspace/runtime/conversation_history/${session.conversationHistoryId}.jsonl`
      : null,
    context_at_spawn: {
      project: workspaceDisplayName(workspaceRoot),
      workspace: "react_vite",
      odd_type: profileWorkspace(workspaceRoot).active_domain_pack ?? profileWorkspace(workspaceRoot).primary_identity ?? "unknown",
    },
    source_path: session.conversationHistoryId
      ? `.ai-workspace/runtime/conversation_history/${session.conversationHistoryId}.jsonl`
      : null,
    raw: {
      source: "oddterm",
      label: session.label,
      backend: session.backend,
      pid: session.pid,
      shell: session.shell,
      createdAt: session.createdAt,
      updatedAt: session.lastOutputAt ?? session.lastResizeAt ?? session.createdAt ?? null,
      lastOutputAt: session.lastOutputAt,
      lastResizeAt: session.lastResizeAt,
      terminalSize: session.terminalSize ?? null,
      liveClientCount: session.liveClientCount,
      historyBytes: session.historyBytes,
      attachedTrainId: session.attachedTrainId,
      attachedStationId: session.attachedStationId,
      attachedEdgeId: session.attachedEdgeId,
    },
  };
}

function loadOddTermSessionRecords(workspaceRoot) {
  const state = loadAgentConsoleState(workspaceRoot).oddterm;
  return {
    records: state.sessions.map((session) => oddTermSessionRecord(session, workspaceRoot)),
    diagnostic: {
      backplane: "oddterm",
      registry_root: ".ai-workspace/runtime/oddterm",
      notes: [
        "sessions are served by the Local Shell Workspace oddterm backplane",
        "session listing rehydrates persisted oddterm records before projection",
      ],
      runtime: {
        default_backplane: "oddterm",
        reconnect: "browser reloads reconnect to backend-managed GNU screen sessions by session id",
        notes: ["oddterm is the product session substrate for sidecar-visible shells"],
      },
    },
  };
}

function profileWorkspace(workspaceRoot) {
  const publishedIdentity = detectPublishedWorkspaceIdentity(workspaceRoot);
  const primaryIdentity = publishedIdentity.id;
  const governanceIdentities = publishedIdentity.governancePackages;
  const activeDomainPack = null;
  const markers = uniqueStrings([
    ...classifyOddWorkspace(workspaceRoot),
    primaryIdentity !== "unknown" ? `identity:${primaryIdentity}` : null,
    ...governanceIdentities.map((identity) => `governance:${identity}`),
  ]);
  const confidence =
    primaryIdentity === "unknown"
      ? "low"
      : governanceIdentities.includes(primaryIdentity) || primaryIdentity === "odd_manager"
        ? "high"
        : "medium";

  return {
    primary_identity: primaryIdentity,
    governance_identities: governanceIdentities,
    active_domain_pack: activeDomainPack,
    shell_title: publishedIdentity.label !== "unknown" ? publishedIdentity.label : "Odd Manager",
    confidence,
    markers,
  };
}

function isWorkspaceRoot(absolutePath) {
  return (
    existsSync(join(absolutePath, ".ai-workspace")) ||
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
    normalized.includes("odd_manager")
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

  if (hasWorkspaceMarker(workspaceRoot, ".ai-workspace")) {
    markers.push("runtime:.ai-workspace");
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

  return uniqueStrings(markers);
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
      const profile = profileWorkspace(current.path);
      if (!oddOnly || markers.length > 0) {
        results.push({
          name: workspaceDisplayName(current.path),
          path: current.path,
          updatedAt: statSync(current.path).mtime.toISOString(),
          markers,
          profile,
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

function browseDirectory(targetPath, options = {}) {
  const directory = targetPath || homedir();
  const maxEntries = Number.isFinite(options.maxEntries)
    ? Math.max(0, Math.floor(options.maxEntries))
    : 500;
  const includeHidden = options.includeHidden === true;
  if (!existsSync(directory)) {
    return {
      path: directory,
      parent: directory === "/" ? null : dirname(directory),
      entries: [],
      truncated: false,
      state: "missing",
    };
  }
  if (!statSync(directory).isDirectory()) {
    return {
      path: directory,
      parent: directory === "/" ? null : dirname(directory),
      entries: [],
      truncated: false,
      state: "not_directory",
    };
  }
  const rawEntries = readdirSync(directory, { withFileTypes: true });
  const visibleEntries = rawEntries
    .filter((entry) => {
      if (entry.name === "node_modules") return false;
      if (!includeHidden && entry.name.startsWith(".")) return false;
      if (entry.isDirectory()) return true;
      return options.includeFiles === true && entry.isFile();
    })
    .map((entry) => {
      const absolutePath = join(directory, entry.name);
      try {
        return { entry, absolutePath, stat: statSync(absolutePath) };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((left, right) => {
      const timeDiff = right.stat.mtimeMs - left.stat.mtimeMs;
      if (timeDiff !== 0) return timeDiff;
      return left.entry.name.localeCompare(right.entry.name);
    });

  const listedEntries = maxEntries > 0 ? visibleEntries.slice(0, maxEntries) : visibleEntries;
  const entries = listedEntries.map(({ entry, absolutePath, stat }) => {
    const updatedAt = stat.mtime.toISOString();
    const markers = isWorkspaceRoot(absolutePath) ? classifyOddWorkspace(absolutePath) : [];
    const profile = isWorkspaceRoot(absolutePath) ? profileWorkspace(absolutePath) : null;
    const hasWorkspace = markers.length > 0;

    return {
      name: entry.name,
      absolutePath,
      kind: entry.isDirectory() ? "directory" : "file",
      updatedAt,
      hasWorkspace,
      markers,
      profile,
    };
  });

  return {
    path: directory,
    parent: directory === "/" ? null : dirname(directory),
    entries,
    truncated: maxEntries > 0 && visibleEntries.length > maxEntries,
    state: "present",
  };
}

function browseMaxEntriesFromParam(value) {
  if (value === null) return undefined;
  const normalized = value.trim().toLowerCase();
  if (normalized === "all") return 0;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}

// Per-workspaceRoot AssetSurface cache (shared across requests; surfaces
// memoize their own reads internally and invalidate on action).
const assetSurfaceCache = new Map();
const rehydratedSessionRoots = new Set();
function getOrCreateAssetSurface(kind, root, factory) {
  const key = `${kind}::${root}`;
  if (!assetSurfaceCache.has(key)) assetSurfaceCache.set(key, factory());
  return assetSurfaceCache.get(key);
}

function ensureSessionsRehydrated(root) {
  const normalizedRoot = resolve(root);
  if (rehydratedSessionRoots.has(normalizedRoot)) {
    return null;
  }
  rehydratedSessionRoots.add(normalizedRoot);
  return rehydrateSessions(normalizedRoot);
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

function writeRawSurface(response, workspaceRoot, relativePath, options = {}) {
  const resolved = resolveWorkspaceSurfacePath(workspaceRoot, relativePath);
  if (resolved.outsideWorkspace) {
    writeJson(response, 403, { error: "surface path resolves outside the active Project root" });
    return;
  }
  if (!existsSync(resolved.target)) {
    writeJson(response, 404, { error: "surface not found" });
    return;
  }
  const stat = statSync(resolved.target);
  if (!stat.isFile()) {
    writeJson(response, 400, { error: "raw surface requests require a file path" });
    return;
  }
  response.writeHead(200, {
    "Content-Type": workspaceSurfaceMediaType(relativePath),
    "Content-Length": String(stat.size),
    "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(basename(resolved.target))}`,
    "X-Content-Type-Options": "nosniff",
    "Access-Control-Allow-Origin": "*",
  });
  if (options.headOnly) {
    response.end();
    return;
  }
  const stream = createReadStream(resolved.target);
  stream.on("error", (error) => {
    response.destroy(error);
  });
  stream.pipe(response);
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
      writeJson(response, 200, { ok: true, workspaceRoot: defaultWorkspaceRoot, managerStateRoot });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/fs/browse") {
      writeJson(response, 200, browseDirectory(url.searchParams.get("path") || undefined, {
        includeHidden: url.searchParams.get("includeHidden") === "1",
        includeFiles: url.searchParams.get("includeFiles") === "1",
        maxEntries: browseMaxEntriesFromParam(url.searchParams.get("maxEntries")),
      }));
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

    if (request.method === "GET" && url.pathname === "/api/surface") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      const relativePath = url.searchParams.get("relativePath");
      if (!relativePath) {
        writeJson(response, 400, { error: "surface requests require relativePath" });
        return;
      }
      writeJson(response, 200, readWorkspaceSurface(workspaceRoot, relativePath));
      return;
    }

    if ((request.method === "GET" || request.method === "HEAD") && url.pathname === "/api/surface/raw") {
      const workspaceRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
      const relativePath = url.searchParams.get("relativePath");
      if (!relativePath) {
        writeJson(response, 400, { error: "raw surface requests require relativePath" });
        return;
      }
      writeRawSurface(response, workspaceRoot, relativePath, { headOnly: request.method === "HEAD" });
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
        await launchRoomParticipantBootstrap(workspaceRoot, {
          topicId: body.topicId,
          sessionId: body.sessionId,
          provider: body.provider,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/topic/add-participant") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        await addTopicParticipant(workspaceRoot, {
          topicId: body.topicId,
          provider: body.provider,
          role: body.role,
          label: body.label,
        }),
      );
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/oddchat/topic/room-recipients") {
      const body = JSON.parse((await readBody(request)) || "{}");
      const workspaceRoot = body.workspaceRoot || defaultWorkspaceRoot;
      writeJson(
        response,
        200,
        setGChatTopicRoomRecipients(workspaceRoot, {
          topicId: body.topicId,
          sessionIds: body.sessionIds,
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

    // T-016 closure: AssetSurface read/write endpoints absorbed from the
    // retired sidecar-demo.mjs scaffold. Per project rather than per-request
    // so the surfaces cache properly. SidecarPanel consumes /api/* relative.
    const surfaceProjectRoot = url.searchParams.get("workspaceRoot") || defaultWorkspaceRoot;
    ensureSessionsRehydrated(surfaceProjectRoot);
    const ticketSurface = getOrCreateAssetSurface("tickets", surfaceProjectRoot, () => createTicketSurface(surfaceProjectRoot));
    const commentSurface = getOrCreateAssetSurface("comments", surfaceProjectRoot, () => createCommentSurface(surfaceProjectRoot));
    const sessionSurface = getOrCreateAssetSurface("sessions", surfaceProjectRoot, () => createSessionSurface(surfaceProjectRoot));
    const projectSurface = getOrCreateAssetSurface(
      "projects",
      managerStateRoot,
      () => createProjectSurface(managerStateRoot, {
        discoveryRoot: process.env.PROJECT_REGISTRY_ROOT || appsRoot,
      }),
    );
    const VIEWER_AGENT = url.searchParams.get("agent") || process.env.OMAN_AGENT_PROVIDER || "operator";

    if (request.method === "GET" && url.pathname === "/api/context") {
      const profile = profileWorkspace(surfaceProjectRoot);
      const projectId = surfaceProjectRoot.split("/").filter(Boolean).at(-1) ?? "workspace";
      const oddType = profile.active_domain_pack ?? profile.primary_identity ?? "unknown";
      writeJson(response, 200, {
        project: { id: projectId, root: surfaceProjectRoot, odd_type: oddType },
        workspace: { id: "react_vite", profile: profile.active_domain_pack ?? profile.primary_identity ?? "unknown" },
        session: null,
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/projects") {
      writeJson(response, 200, projectSurface.list());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/projects/registry") {
      writeJson(response, 200, {
        projects: projectSurface.list(),
        diagnostic: projectSurface.diagnostic(),
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/projects/discover") {
      writeJson(response, 200, projectSurface.discover());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/developer-control/bootstrap") {
      try {
        writeJson(response, 200, loadAdmittedDeveloperControlBootstrap(surfaceProjectRoot, projectSurface.list()));
      } catch (caught) {
        writeJson(response, 400, { error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/developer-control/portfolio") {
      try {
        writeJson(response, 200, loadDeveloperControlPortfolio(projectSurface.list(), {
          browseRoot: process.env.OMAN_PORTFOLIO_BROWSE_ROOT || appsRoot,
          buildObservation: (project) => buildControlService.snapshot(project),
          assuranceObservation: (project, revision, executionId) => assuranceService.snapshot({
            project,
            revision,
            executionId,
          }),
        }));
      } catch (caught) {
        writeJson(response, 500, { error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/developer-control/builds") {
      try {
        const bootstrap = loadAdmittedDeveloperControlBootstrap(surfaceProjectRoot, projectSurface.list());
        writeJson(response, 200, buildControlService.snapshot(bootstrap.context.project));
      } catch (caught) {
        const statusCode = caught instanceof BuildControlError ? caught.statusCode : 400;
        writeJson(response, statusCode, { error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/developer-control/assurance") {
      try {
        const bootstrap = loadAdmittedDeveloperControlBootstrap(surfaceProjectRoot, projectSurface.list());
        if (!bootstrap.context.revision) throw new AssuranceError("Assurance requires an admitted Project Revision.");
        writeJson(response, 200, assuranceService.snapshot({
          project: bootstrap.context.project,
          revision: bootstrap.context.revision,
          executionId: url.searchParams.get("executionId"),
        }));
      } catch (caught) {
        const statusCode = caught instanceof AssuranceError ? caught.statusCode : 400;
        writeJson(response, statusCode, { error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/developer-control/builds/submit") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { error: "invalid json body" }); return; }
      try {
        const bootstrap = loadAdmittedDeveloperControlBootstrap(parsed?.project?.root, projectSurface.list());
        const result = buildControlService.submit({ ...parsed, project: bootstrap.context.project });
        writeJson(response, 202, result);
      } catch (caught) {
        const statusCode = caught instanceof BuildControlError ? caught.statusCode : 400;
        writeJson(response, statusCode, {
          error: caught instanceof Error ? caught.message : String(caught),
          execution: caught instanceof BuildControlError ? caught.execution : null,
        });
      }
      return;
    }
    if (
      request.method === "POST"
      && [
        "/api/developer-control/builds/attach",
        "/api/developer-control/builds/cancel",
        "/api/developer-control/builds/resume",
      ].includes(url.pathname)
    ) {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { error: "invalid json body" }); return; }
      try {
        const bootstrap = loadAdmittedDeveloperControlBootstrap(parsed?.projectRoot, projectSurface.list());
        const action = url.pathname.split("/").at(-1);
        const value = action === "attach"
          ? buildControlService.attach(parsed, bootstrap.context.project)
          : action === "resume"
            ? buildControlService.resume(parsed, bootstrap.context.project)
            : buildControlService.cancel(parsed, bootstrap.context.project);
        writeJson(response, 200, action === "attach" ? value : { execution: value });
      } catch (caught) {
        const statusCode = caught instanceof BuildControlError ? caught.statusCode : 400;
        writeJson(response, statusCode, {
          error: caught instanceof Error ? caught.message : String(caught),
          execution: caught instanceof BuildControlError ? caught.execution : null,
        });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/developer-control/proposals") {
      try {
        loadAdmittedDeveloperControlBootstrap(surfaceProjectRoot, projectSurface.list());
        writeJson(response, 200, specificationProposalService.list(surfaceProjectRoot));
      } catch (caught) {
        const statusCode = caught instanceof SpecificationProposalError ? caught.statusCode : 400;
        writeJson(response, statusCode, {
          error: caught instanceof Error ? caught.message : String(caught),
          proposal: caught instanceof SpecificationProposalError ? caught.proposal : null,
        });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/developer-control/proposals/generate") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { error: "invalid json body" }); return; }
      try {
        const bootstrap = loadAdmittedDeveloperControlBootstrap(parsed?.project?.root, projectSurface.list());
        const proposal = await specificationProposalService.generate({
          ...parsed,
          project: bootstrap.context.project,
        });
        writeJson(response, 200, { proposal });
      } catch (caught) {
        const statusCode = caught instanceof SpecificationProposalError ? caught.statusCode : 400;
        writeJson(response, statusCode, {
          error: caught instanceof Error ? caught.message : String(caught),
          proposal: caught instanceof SpecificationProposalError ? caught.proposal : null,
        });
      }
      return;
    }
    if (
      request.method === "POST"
      && [
        "/api/developer-control/proposals/validate",
        "/api/developer-control/proposals/accept",
        "/api/developer-control/proposals/reject",
      ].includes(url.pathname)
    ) {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { error: "invalid json body" }); return; }
      try {
        loadAdmittedDeveloperControlBootstrap(parsed?.projectRoot, projectSurface.list());
        const action = url.pathname.split("/").at(-1);
        const proposal = action === "validate"
          ? specificationProposalService.validate(parsed)
          : action === "accept"
            ? specificationProposalService.accept(parsed)
            : specificationProposalService.reject(parsed);
        writeJson(response, 200, { proposal });
      } catch (caught) {
        const statusCode = caught instanceof SpecificationProposalError ? caught.statusCode : 400;
        writeJson(response, statusCode, {
          error: caught instanceof Error ? caught.message : String(caught),
          proposal: caught instanceof SpecificationProposalError ? caught.proposal : null,
        });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/ai-workspace/observation") {
      writeJson(response, 200, loadAiWorkspaceObservation(surfaceProjectRoot));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/ai-workspace/traversal") {
      writeJson(response, 200, loadTraversalSummary(surfaceProjectRoot, {
        runId: url.searchParams.get("runId"),
        refresh: url.searchParams.get("refresh") === "1",
      }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/ai-workspace/run") {
      writeJson(response, 200, loadAbgRunObservation(surfaceProjectRoot, {
        runId: url.searchParams.get("runId"),
        refresh: url.searchParams.get("refresh") === "1",
      }));
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/ai-workspace/traversal/vector") {
      const indexParam = url.searchParams.get("index");
      const vectorIndex = Number(indexParam);
      if (indexParam === null || !Number.isInteger(vectorIndex) || vectorIndex < 0) {
        writeJson(response, 400, { error: "traversal vector detail requires a non-negative integer index param" });
        return;
      }
      const variantParam = url.searchParams.get("variant");
      if (variantParam !== null && variantParam !== "primary" && variantParam !== "evaluator") {
        writeJson(response, 400, { error: "traversal vector variant must be primary or evaluator" });
        return;
      }
      const attemptParam = url.searchParams.get("attempt");
      const attempt = attemptParam === null ? undefined : Number(attemptParam);
      if (attempt !== undefined && (!Number.isInteger(attempt) || attempt < 1)) {
        writeJson(response, 400, { error: "traversal vector attempt must be a positive integer" });
        return;
      }
      const result = loadTraversalVectorDetail(surfaceProjectRoot, {
        vectorIndex,
        variant: variantParam ?? undefined,
        attempt,
        runId: url.searchParams.get("runId"),
      });
      if (!result.ok) {
        writeJson(response, 404, { error: result.error });
        return;
      }
      writeJson(response, 200, result.detail);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/projects/register") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { ok: false, error: "invalid json body" }); return; }
      const root = parsed.root || parsed.projectRoot;
      if (!root || typeof root !== "string") {
        writeJson(response, 400, { ok: false, error: "register requires root" });
        return;
      }
      try {
        const project = projectSurface.register(root, {
          label: parsed.label,
          tags: parsed.tags,
          setActive: Boolean(parsed.setActive),
        });
        writeJson(response, 200, { ok: true, project, projects: projectSurface.list(), diagnostic: projectSurface.diagnostic() });
      } catch (caught) {
        writeJson(response, 400, { ok: false, error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/projects/unregister") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { ok: false, error: "invalid json body" }); return; }
      const identity = parsed.id || parsed.root || parsed.projectRoot;
      if (!identity || typeof identity !== "string") {
        writeJson(response, 400, { ok: false, error: "unregister requires id or root" });
        return;
      }
      try {
        const result = projectSurface.unregister(identity);
        writeJson(response, 200, { ok: true, ...result, diagnostic: projectSurface.diagnostic() });
      } catch (caught) {
        writeJson(response, 400, { ok: false, error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/projects/active") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { ok: false, error: "invalid json body" }); return; }
      const identity = parsed.id || parsed.root || parsed.projectRoot;
      if (!identity || typeof identity !== "string") {
        writeJson(response, 400, { ok: false, error: "set active requires id or root" });
        return;
      }
      try {
        const project = projectSurface.setActive(identity, { registerIfMissing: parsed.registerIfMissing !== false });
        writeJson(response, 200, { ok: true, project, projects: projectSurface.list(), diagnostic: projectSurface.diagnostic() });
      } catch (caught) {
        writeJson(response, 400, { ok: false, error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/tickets") {
      writeJson(response, 200, ticketSurface.list());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/comments") {
      writeJson(response, 200, commentSurface.list());
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/sessions") {
      writeJson(response, 200, {
        records: sessionSurface.list(),
        diagnostic: { ...sessionSurface.diagnostic(), runtime: sessionBackplaneDiagnostic() },
      });
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/comments/unread") {
      writeJson(response, 200, { agent: VIEWER_AGENT, unread_ids: commentSurface.getUnreadIds(VIEWER_AGENT) });
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/sidecar/sessions") {
      writeJson(response, 200, loadOddTermSessionRecords(surfaceProjectRoot));
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/sidecar/sessions/spawn") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { ok: false, error: "invalid json body" }); return; }
      const requestedCwd = typeof parsed.cwd === "string" && parsed.cwd.trim()
        ? resolve(parsed.cwd)
        : surfaceProjectRoot;
      if (!isPathWithin(surfaceProjectRoot, requestedCwd) || !existsSync(requestedCwd) || !statSync(requestedCwd).isDirectory()) {
        writeJson(response, 400, { ok: false, error: "session cwd must be an existing directory inside the active Project" });
        return;
      }
      const session = createGTermSession(surfaceProjectRoot, {
        selectedTrainId: parsed.selectedTrainId || "sidecar",
        stationId: parsed.stationId || null,
        edgeId: parsed.edgeId || null,
        label: parsed.label || "sidecar shell",
        cwd: requestedCwd,
      });
      selectGTermSession(surfaceProjectRoot, session.id);
      const record = oddTermSessionRecord(session, surfaceProjectRoot);
      writeJson(response, 200, { ok: true, ...record });
      return;
    }

    const sidecarKillMatch = request.method === "POST" && url.pathname.match(/^\/api\/sidecar\/sessions\/([^/]+)\/kill$/);
    if (sidecarKillMatch) {
      const id = decodeURIComponent(sidecarKillMatch[1]);
      try {
        const session = closeGTermSession(surfaceProjectRoot, id);
        const record = oddTermSessionRecord(session, surfaceProjectRoot);
        writeJson(response, 200, { ok: true, id, ...record });
      } catch (caught) {
        writeJson(response, 400, { ok: false, error: caught instanceof Error ? caught.message : String(caught) });
      }
      return;
    }

    let m;
    if ((m = request.method === "POST" && url.pathname.match(/^\/api\/tickets\/([^/]+)\/transition$/))) {
      const id = decodeURIComponent(m[1]);
      const result = ticketSurface.transitionStatus(id, url.searchParams.get("to"));
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    if ((m = request.method === "POST" && url.pathname.match(/^\/api\/tickets\/([^/]+)\/link-dependency$/))) {
      const id = decodeURIComponent(m[1]);
      const result = ticketSurface.linkDependency(id, url.searchParams.get("dep"));
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    if (request.method === "POST" && url.pathname === "/api/comments") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { ok: false, error: "invalid json body" }); return; }
      const result = commentSurface.createPost(parsed);
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    if ((m = request.method === "POST" && url.pathname.match(/^\/api\/comments\/(.+)\/reply$/))) {
      const parentId = decodeURIComponent(m[1]);
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { ok: false, error: "invalid json body" }); return; }
      const result = commentSurface.createReply(parentId, parsed);
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    if ((m = request.method === "POST" && url.pathname.match(/^\/api\/comments\/(.+)\/mark-read$/))) {
      const id = decodeURIComponent(m[1]);
      const result = commentSurface.markRead(VIEWER_AGENT, id);
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    if ((m = request.method === "POST" && url.pathname.match(/^\/api\/comments\/(.+)\/mark-unread$/))) {
      const id = decodeURIComponent(m[1]);
      const result = commentSurface.markUnread(VIEWER_AGENT, id);
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    // T-020 session pty actions
    if (request.method === "POST" && url.pathname === "/api/sessions/spawn") {
      const body = await readBody(request);
      let parsed;
      try { parsed = body ? JSON.parse(body) : {}; } catch { writeJson(response, 400, { ok: false, error: "invalid json body" }); return; }
      const result = spawnSession(surfaceProjectRoot, parsed);
      // Invalidate session-surface cache so the new record shows in /api/sessions immediately.
      sessionSurface.invalidate?.();
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    if ((m = request.method === "POST" && url.pathname.match(/^\/api\/sessions\/([^/]+)\/kill$/))) {
      const id = decodeURIComponent(m[1]);
      const result = killSession(surfaceProjectRoot, id);
      sessionSurface.invalidate?.();
      writeJson(response, result.ok ? 200 : 400, result);
      return;
    }
    if (request.method === "GET" && url.pathname === "/api/sessions/live") {
      writeJson(response, 200, { live_ids: listLiveSessionIds(surfaceProjectRoot) });
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
ensureSessionsRehydrated(defaultWorkspaceRoot);
mountSessionWebSocket(server);

server.listen(port, "127.0.0.1", () => {
  console.log(`odd_manager API listening on http://127.0.0.1:${port}`);
});
