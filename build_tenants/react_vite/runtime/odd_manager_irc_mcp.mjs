const defaultApiPort = Number(process.env.OMAN_API_PORT ?? 4173);
const gatewayBaseUrl = normalizeBaseUrl(
  process.env.OMAN_MCP_GATEWAY_URL ?? `http://127.0.0.1:${defaultApiPort}`,
);
const projectRoot = String(process.env.OMAN_WORKSPACE_ROOT ?? process.cwd());
const configuredSessionLabel = trimmedText(process.env.OMAN_SESSION_LABEL);
const configuredRoomId = trimmedText(process.env.OMAN_ROOM_ID);
const configuredTopicId = trimmedText(process.env.OMAN_TOPIC_ID);
const configuredProvider = trimmedText(process.env.OMAN_AGENT_PROVIDER) ?? "agent";
const mcpDebugLogPath = trimmedText(process.env.OMAN_ROOM_MCP_DEBUG_LOG);

let resolvedSessionId = trimmedText(process.env.OMAN_SESSION_ID);
let stdinBuffer = Buffer.alloc(0);
let joinedRoomParticipant = false;
let roomJoinPromise = null;
let rpcTransportMode = "framed";

const tools = [
  {
    name: "room_join",
    description:
      "Join the configured OddChat room through odd_manager and receive the recent room backlog.",
    inputSchema: {
      type: "object",
      properties: {
        roomId: { type: "string" },
        topicId: { type: "string" },
        provider: { type: "string" },
        participantLabel: { type: "string" },
        historyLimit: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "room_status",
    description: "Show room participant status and unread state for this agent session.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "room_read",
    description: "Read room messages for this participant from the stored cursor or an explicit cursor.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "integer" },
        excludeSelf: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "room_wait",
    description: "Wait for new room messages for this participant.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string" },
        cursor: { type: "string" },
        limit: { type: "integer" },
        timeoutMs: { type: "integer" },
        excludeSelf: { type: "boolean" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "room_send",
    description: "Post a message into the joined OddChat room as this participant.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string" },
        text: { type: "string" },
        body: { type: "string" },
      },
      required: ["text"],
      additionalProperties: false,
    },
  },
  {
    name: "room_leave",
    description: "Leave the joined OddChat room for this participant.",
    inputSchema: {
      type: "object",
      properties: {
        provider: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "irc_connect",
    description:
      "Bind this agent's terminal session to the local odd_manager IRC gateway and connect to the configured IRC server.",
    inputSchema: {
      type: "object",
      properties: {
        host: { type: "string" },
        port: { type: "integer" },
        tls: { type: "boolean" },
        insecureTls: { type: "boolean" },
        password: { type: "string" },
        nick: { type: "string" },
        username: { type: "string" },
        realName: { type: "string" },
        roomId: { type: "string" },
        topicId: { type: "string" },
        channels: {
          type: "array",
          items: { type: "string" },
        },
      },
      additionalProperties: false,
    },
  },
  {
    name: "irc_status",
    description: "Show the current IRC binding status for this agent session.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: "irc_join",
    description: "Join an IRC channel through the odd_manager gateway.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
      },
      required: ["channel"],
      additionalProperties: false,
    },
  },
  {
    name: "irc_part",
    description: "Leave an IRC channel through the odd_manager gateway.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        reason: { type: "string" },
      },
      required: ["channel"],
      additionalProperties: false,
    },
  },
  {
    name: "irc_send_channel",
    description: "Send a message to an IRC channel through the odd_manager gateway.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
        text: { type: "string" },
      },
      required: ["channel", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "irc_send_dm",
    description: "Send a direct IRC message to a nick through the odd_manager gateway.",
    inputSchema: {
      type: "object",
      properties: {
        nick: { type: "string" },
        text: { type: "string" },
      },
      required: ["nick", "text"],
      additionalProperties: false,
    },
  },
  {
    name: "irc_read_room",
    description: "Read the canonical OddChat room history currently bound to this IRC session.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "integer" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "irc_who",
    description: "List the known users in a joined IRC channel.",
    inputSchema: {
      type: "object",
      properties: {
        channel: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  {
    name: "irc_disconnect",
    description: "Disconnect this agent session from the IRC gateway.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

function normalizeBaseUrl(value) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    throw new Error("ODDM IRC MCP gateway URL is required");
  }
  return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
}

function trimmedText(value) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

async function appendDebugLog(event, detail = {}) {
  if (!mcpDebugLogPath) {
    return;
  }

  try {
    const fs = await import("node:fs/promises");
    await fs.appendFile(
      mcpDebugLogPath,
      `${JSON.stringify({
        ts: new Date().toISOString(),
        event,
        ...detail,
      })}\n`,
      "utf8",
    );
  } catch {
    // Debug logging must never interfere with MCP traffic.
  }
}

function sendFrame(payload) {
  const serializedText = JSON.stringify(payload);
  if (rpcTransportMode === "plain") {
    process.stdout.write(`${serializedText}\n`);
    return;
  }

  const serialized = Buffer.from(serializedText, "utf8");
  process.stdout.write(`Content-Length: ${serialized.length}\r\n\r\n`);
  process.stdout.write(serialized);
}

function okResult(id, result) {
  sendFrame({
    jsonrpc: "2.0",
    id,
    result,
  });
}

function errorResult(id, code, message) {
  sendFrame({
    jsonrpc: "2.0",
    id,
    error: {
      code,
      message,
    },
  });
}

async function expectJson(response) {
  const payloadText = await response.text();
  let payload = null;
  if (payloadText.trim()) {
    try {
      payload = JSON.parse(payloadText);
    } catch (error) {
      throw new Error(
        error instanceof Error
          ? `gateway returned invalid JSON: ${error.message}`
          : "gateway returned invalid JSON",
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

async function gatewayGet(pathname, params = {}) {
  const url = new URL(pathname, gatewayBaseUrl);
  for (const [key, value] of Object.entries(params)) {
    if (value !== null && value !== undefined && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  return expectJson(await fetch(url));
}

async function gatewayPost(pathname, body = {}) {
  return expectJson(
    await fetch(new URL(pathname, gatewayBaseUrl), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );
}

async function ensureSessionId() {
  if (resolvedSessionId) {
    return resolvedSessionId;
  }
  if (!configuredSessionLabel) {
    throw new Error("Set OMAN_SESSION_ID or OMAN_SESSION_LABEL before using the IRC MCP adapter.");
  }
  const payload = await gatewayPost("/api/oddterm/session/ensure", {
    projectRoot,
    label: configuredSessionLabel,
  });
  resolvedSessionId = payload?.session?.id ?? null;
  if (!resolvedSessionId) {
    throw new Error("odd_manager did not return a terminal session id");
  }
  return resolvedSessionId;
}

async function sessionRef() {
  return {
    projectRoot,
    sessionId: await ensureSessionId(),
  };
}

function configuredRoomTarget(args = {}) {
  return {
    provider: args.provider ?? configuredProvider,
    roomId: args.roomId ?? configuredRoomId,
    topicId: args.topicId ?? configuredTopicId,
  };
}

async function ensureConfiguredRoomParticipant(args = {}) {
  if (joinedRoomParticipant) {
    return null;
  }

  const target = configuredRoomTarget(args);
  if (!target.roomId && !target.topicId) {
    return null;
  }

  if (!roomJoinPromise) {
    void appendDebugLog("room.auto_join.start", {
      provider: target.provider,
      roomId: target.roomId,
      topicId: target.topicId,
    });
    roomJoinPromise = gatewayPost("/api/oddchat/participant/join", {
      ...(await sessionRef()),
      provider: target.provider,
      roomId: target.roomId,
      topicId: target.topicId,
      historyLimit: args.historyLimit ?? 12,
    })
      .then((payload) => {
        joinedRoomParticipant = true;
        void appendDebugLog("room.auto_join.ok", {
          roomId: payload?.roomId ?? null,
          topicId: payload?.topicId ?? null,
        });
        return payload;
      })
      .catch((error) => {
        roomJoinPromise = null;
        void appendDebugLog("room.auto_join.error", {
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      });
  }

  return roomJoinPromise;
}

function formatToolResponse(payload) {
  return {
    content: [
      {
        type: "text",
        text:
          typeof payload === "string"
            ? payload
            : JSON.stringify(payload, null, 2),
      },
    ],
  };
}

async function handleToolCall(name, args = {}) {
  switch (name) {
    case "room_join":
      return formatToolResponse(await ensureConfiguredRoomParticipant(args));
    case "room_status":
      await ensureConfiguredRoomParticipant(args);
      return formatToolResponse(
        await gatewayGet("/api/oddchat/participant/status", {
          ...(await sessionRef()),
          provider: args.provider ?? configuredProvider,
        }),
      );
    case "room_read":
      await ensureConfiguredRoomParticipant(args);
      return formatToolResponse(
        await gatewayPost("/api/oddchat/participant/read", {
          ...(await sessionRef()),
          provider: args.provider ?? configuredProvider,
          cursor: args.cursor ?? null,
          limit: args.limit ?? 40,
          excludeSelf: args.excludeSelf ?? true,
        }),
      );
    case "room_wait":
      await ensureConfiguredRoomParticipant(args);
      return formatToolResponse(
        await gatewayPost("/api/oddchat/participant/wait", {
          ...(await sessionRef()),
          provider: args.provider ?? configuredProvider,
          cursor: args.cursor ?? null,
          limit: args.limit ?? 40,
          timeoutMs: args.timeoutMs ?? 30000,
          excludeSelf: args.excludeSelf ?? true,
        }),
      );
    case "room_send":
      await ensureConfiguredRoomParticipant(args);
      return formatToolResponse(
        await gatewayPost("/api/oddchat/participant/message", {
          ...(await sessionRef()),
          provider: args.provider ?? configuredProvider,
          body: args.text ?? args.body,
        }),
      );
    case "room_leave":
      {
        const payload = await gatewayPost("/api/oddchat/participant/leave", {
          ...(await sessionRef()),
          provider: args.provider ?? configuredProvider,
        });
        joinedRoomParticipant = false;
        roomJoinPromise = null;
        return formatToolResponse(payload);
      }
    case "irc_connect":
      return formatToolResponse(
        await gatewayPost("/api/irc/session/connect", {
          ...(await sessionRef()),
          host: args.host ?? null,
          port: args.port ?? null,
          tls: args.tls ?? null,
          insecureTls: args.insecureTls ?? null,
          password: args.password ?? null,
          nick: args.nick ?? null,
          username: args.username ?? null,
          realName: args.realName ?? null,
          roomId: args.roomId ?? configuredRoomId,
          topicId: args.topicId ?? configuredTopicId,
          channels: Array.isArray(args.channels) ? args.channels : [],
        }),
      );
    case "irc_status":
      return formatToolResponse(
        await gatewayGet("/api/irc/session/status", {
          ...(await sessionRef()),
        }),
      );
    case "irc_join":
      return formatToolResponse(
        await gatewayPost("/api/irc/session/join", {
          ...(await sessionRef()),
          channel: args.channel,
        }),
      );
    case "irc_part":
      return formatToolResponse(
        await gatewayPost("/api/irc/session/part", {
          ...(await sessionRef()),
          channel: args.channel,
          reason: args.reason ?? null,
        }),
      );
    case "irc_send_channel":
      return formatToolResponse(
        await gatewayPost("/api/irc/session/send", {
          ...(await sessionRef()),
          channel: args.channel,
          text: args.text,
        }),
      );
    case "irc_send_dm":
      return formatToolResponse(
        await gatewayPost("/api/irc/session/dm", {
          ...(await sessionRef()),
          nick: args.nick,
          text: args.text,
        }),
      );
    case "irc_read_room":
      return formatToolResponse(
        await gatewayGet("/api/irc/session/read", {
          ...(await sessionRef()),
          limit: args.limit ?? 40,
        }),
      );
    case "irc_who":
      return formatToolResponse(
        await gatewayGet("/api/irc/session/who", {
          ...(await sessionRef()),
          channel: args.channel ?? null,
        }),
      );
    case "irc_disconnect":
      return formatToolResponse(
        await gatewayPost("/api/irc/session/disconnect", {
          ...(await sessionRef()),
        }),
      );
    default:
      throw new Error(`unknown tool: ${name}`);
  }
}

async function handleRequest(message) {
  const { id, method, params = {} } = message;
  void appendDebugLog("rpc.request", {
    id: id ?? null,
    method: method ?? null,
  });

  if (!method) {
    if (id !== undefined) {
      errorResult(id, -32600, "missing JSON-RPC method");
    }
    return;
  }

  try {
    if (method === "initialize") {
      okResult(id, {
        protocolVersion: params.protocolVersion ?? "2025-03-26",
        capabilities: {
          tools: {},
          resources: {},
          prompts: {},
          logging: {},
        },
        serverInfo: {
          name: "odd-manager-room-mcp",
          version: "0.2.0",
        },
      });
      return;
    }

    if (method === "notifications/initialized") {
      void ensureConfiguredRoomParticipant({}).catch(() => {
        // Best-effort auto-join. Tool calls will surface real errors later.
      });
      return;
    }

    if (method === "ping") {
      okResult(id, {});
      return;
    }

    if (method === "tools/list") {
      okResult(id, { tools });
      return;
    }

    if (method === "tools/call") {
      okResult(id, await handleToolCall(params.name, params.arguments ?? {}));
      return;
    }

    if (method === "resources/list") {
      okResult(id, { resources: [] });
      return;
    }

    if (method === "prompts/list") {
      okResult(id, { prompts: [] });
      return;
    }

    if (method === "resources/templates/list") {
      okResult(id, { resourceTemplates: [] });
      return;
    }

    if (method === "logging/setLevel") {
      okResult(id, {});
      return;
    }

    throw new Error(`unsupported method: ${method}`);
  } catch (error) {
    void appendDebugLog("rpc.error", {
      id: id ?? null,
      method,
      message: error instanceof Error ? error.message : String(error),
    });
    if (id === undefined) {
      return;
    }
    errorResult(
      id,
      -32000,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function drainStdinBuffer() {
  while (true) {
    let headerEnd = stdinBuffer.indexOf("\r\n\r\n");
    let separatorLength = 4;
    let headerSeparator = "\r\n";
    if (headerEnd < 0) {
      headerEnd = stdinBuffer.indexOf("\n\n");
      separatorLength = 2;
      headerSeparator = "\n";
    }
    if (headerEnd < 0) {
      break;
    }

    rpcTransportMode = "framed";
    const headerText = stdinBuffer.slice(0, headerEnd).toString("utf8");
    const headerLines = headerText.split(headerSeparator);
    const contentLengthHeader = headerLines.find((line) => /^content-length:/i.test(line));
    if (!contentLengthHeader) {
      stdinBuffer = Buffer.alloc(0);
      return;
    }

    const contentLength = Number(contentLengthHeader.split(":")[1]?.trim() ?? "0");
    const bodyStart = headerEnd + separatorLength;
    const bodyEnd = bodyStart + contentLength;
    if (stdinBuffer.length < bodyEnd) {
      return;
    }

    const bodyBuffer = stdinBuffer.slice(bodyStart, bodyEnd);
    stdinBuffer = stdinBuffer.slice(bodyEnd);

    let message;
    try {
      message = JSON.parse(bodyBuffer.toString("utf8"));
    } catch (error) {
      errorResult(
        null,
        -32700,
        error instanceof Error ? error.message : "invalid JSON payload",
      );
      continue;
    }

    void handleRequest(message);
  }

  while (stdinBuffer.length > 0) {
    const text = stdinBuffer.toString("utf8");
    const trimmed = text.trim();
    if (!trimmed.startsWith("{") && !trimmed.startsWith("[")) {
      return;
    }

    rpcTransportMode = "plain";

    try {
      const message = JSON.parse(trimmed);
      stdinBuffer = Buffer.alloc(0);
      void handleRequest(message);
      continue;
    } catch {
      // Wait for more bytes or fall back to newline-delimited parsing below.
    }

    const newlineIndex = text.indexOf("\n");
    if (newlineIndex < 0) {
      return;
    }

    const line = text.slice(0, newlineIndex).trim();
    if (!line) {
      stdinBuffer = Buffer.from(text.slice(newlineIndex + 1), "utf8");
      continue;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }

    stdinBuffer = Buffer.from(text.slice(newlineIndex + 1), "utf8");
    void handleRequest(message);
  }
}

process.stdin.on("data", (chunk) => {
  void appendDebugLog("stdin.data", {
    bytes: chunk.length,
    headHex: chunk.subarray(0, Math.min(chunk.length, 24)).toString("hex"),
  });
  stdinBuffer = Buffer.concat([stdinBuffer, chunk]);
  drainStdinBuffer();
});

process.stdin.on("end", () => {
  void appendDebugLog("stdin.end");
  process.exit(0);
});

void appendDebugLog("process.start", {
  pid: process.pid,
  sessionLabel: configuredSessionLabel,
  roomId: configuredRoomId,
  topicId: configuredTopicId,
  provider: configuredProvider,
  stdinIsTTY: Boolean(process.stdin.isTTY),
});
