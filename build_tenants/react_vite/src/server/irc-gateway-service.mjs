import net from "node:net";
import tls from "node:tls";
import { resolve } from "node:path";
import {
  appendLiveRoomMessage,
  firstMeaningfulLine,
  parseTopicSessionRoomId,
  sessionParticipantId,
  slugify,
} from "./oddchat-room-service.mjs";
import {
  loadGBoardTopicById,
  loadGBoardTopicByRoomId,
} from "./oddboard-service.mjs";
import { loadRoomMessages } from "./oddchat-room-service.mjs";
import { loadGTermPoolState } from "./oddterm-pool-service.mjs";

const bindingStores = new Map();

function envBoolean(value, fallback = false) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (["1", "true", "yes", "on"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "no", "off"].includes(normalized)) {
    return false;
  }
  return fallback;
}

function defaultPortForTls(tlsEnabled) {
  return tlsEnabled ? 6697 : 6667;
}

function finiteNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function ircDefaults() {
  const tlsEnabled = envBoolean(process.env.OMAN_IRC_TLS, false);
  return {
    host: String(process.env.OMAN_IRC_HOST ?? "127.0.0.1"),
    port: finiteNumber(process.env.OMAN_IRC_PORT, defaultPortForTls(tlsEnabled)),
    tls: tlsEnabled,
    insecureTls: envBoolean(process.env.OMAN_IRC_INSECURE_TLS, false),
    password: process.env.OMAN_IRC_PASSWORD ? String(process.env.OMAN_IRC_PASSWORD) : null,
    channels: normalizeChannels(process.env.OMAN_IRC_CHANNEL ? [process.env.OMAN_IRC_CHANNEL] : []),
  };
}

function ensureWorkspaceStore(projectRoot) {
  const root = resolve(projectRoot);
  let store = bindingStores.get(root);
  if (!store) {
    store = {
      projectRoot: root,
      bindings: new Map(),
    };
    bindingStores.set(root, store);
  }
  return store;
}

function trimmedText(value) {
  return String(value ?? "")
    .replace(/[\u0000\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ircToken(value) {
  return trimmedText(value).replace(/\s+/g, "");
}

function sanitizeMessageText(value) {
  return String(value ?? "")
    .replace(/[\u0000\r\n]+/g, " ")
    .trim();
}

function sanitizeNick(value) {
  const normalized = String(value ?? "")
    .replace(/[^A-Za-z0-9_\-\[\]\\`^{}|]/g, "")
    .slice(0, 15);
  return normalized || "oddmgr";
}

function defaultNick(sessionLabel, sessionId) {
  const stem = slugify(sessionLabel || sessionId)
    .replace(/-/g, "_")
    .slice(0, 10);
  const suffix = String(sessionId ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 4)
    .toLowerCase();
  return sanitizeNick(`om_${stem || "agent"}${suffix ? `_${suffix}` : ""}`);
}

function normalizeChannels(values) {
  const inputs = Array.isArray(values) ? values : [values];
  return Array.from(
    new Set(
      inputs
        .flatMap((value) => String(value ?? "").split(","))
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => (value.startsWith("#") ? value : `#${value}`)),
    ),
  );
}

function ircUserName(sessionLabel, sessionId, value) {
  return sanitizeNick(value || slugify(sessionLabel || sessionId).replace(/-/g, "_") || "oddmgr");
}

function parseIrcLine(rawLine) {
  let rest = String(rawLine ?? "").replace(/\r?\n$/, "");
  let prefix = null;
  if (rest.startsWith(":")) {
    const separator = rest.indexOf(" ");
    if (separator >= 0) {
      prefix = rest.slice(1, separator);
      rest = rest.slice(separator + 1);
    }
  }
  const trailingIndex = rest.indexOf(" :");
  let trailing = null;
  if (trailingIndex >= 0) {
    trailing = rest.slice(trailingIndex + 2);
    rest = rest.slice(0, trailingIndex);
  } else if (rest.startsWith(":")) {
    trailing = rest.slice(1);
    rest = "";
  }
  const parts = rest.split(/\s+/).filter(Boolean);
  const command = parts.shift() ?? "";
  return {
    prefix,
    command,
    params: parts,
    trailing,
  };
}

function nickFromPrefix(prefix) {
  if (!prefix) {
    return null;
  }
  const separator = prefix.indexOf("!");
  return separator >= 0 ? prefix.slice(0, separator) : prefix;
}

function cleanNamesEntry(entry) {
  return String(entry ?? "").replace(/^[@+%&~]+/, "").trim();
}

function roomContextFor(projectRoot, roomId, topicId = null) {
  let topic = null;

  if (topicId) {
    topic = loadGBoardTopicById(projectRoot, topicId);
  } else {
    const privateRoom = parseTopicSessionRoomId(roomId);
    topic = privateRoom
      ? loadGBoardTopicById(projectRoot, privateRoom.topicId)
      : loadGBoardTopicByRoomId(projectRoot, roomId);
  }

  return {
    roomId: topic?.roomId && topicId ? topic.roomId : roomId || topic?.roomId || "workspace",
    selectedTrainId: topic?.selectedTrainId ?? null,
    stationId: topic?.stationId ?? null,
    edgeId: topic?.edgeId ?? null,
  };
}

function sessionSummaryFor(projectRoot, { sessionId = null, sessionLabel = null } = {}) {
  const pool = loadGTermPoolState(projectRoot);
  if (sessionId) {
    return pool.sessions.find((session) => session.id === sessionId) ?? null;
  }
  const normalizedLabel = String(sessionLabel ?? "").trim().toLowerCase();
  if (!normalizedLabel) {
    return null;
  }
  return (
    pool.sessions.find((session) => String(session.label ?? "").trim().toLowerCase() === normalizedLabel) ?? null
  );
}

function bindingSnapshot(binding) {
  return {
    sessionId: binding.session.id,
    sessionLabel: binding.session.label,
    roomId: binding.room.roomId,
    selectedTrainId: binding.room.selectedTrainId,
    stationId: binding.room.stationId,
    edgeId: binding.room.edgeId,
    status: binding.status,
    server: {
      host: binding.config.host,
      port: binding.config.port,
      tls: binding.config.tls,
      insecureTls: binding.config.insecureTls,
    },
    nick: binding.nick,
    desiredNick: binding.desiredNick,
    username: binding.username,
    realName: binding.realName,
    connectedAt: binding.connectedAt,
    lastEventAt: binding.lastEventAt,
    lastError: binding.lastError,
    channels: Array.from(binding.channels.values()).sort((left, right) => left.localeCompare(right)),
    configuredChannels: Array.from(binding.config.channels.values()).sort((left, right) => left.localeCompare(right)),
    usersByChannel: Object.fromEntries(
      [...binding.channelUsers.entries()]
        .sort((left, right) => left[0].localeCompare(right[0]))
        .map(([channel, users]) => [channel, [...users].sort((left, right) => left.localeCompare(right))]),
    ),
  };
}

function appendBindingRoomMessage(binding, payload) {
  const body = trimmedText(payload.body);
  if (!body) {
    return null;
  }
  return appendLiveRoomMessage(binding.projectRoot, {
    roomId: binding.room.roomId,
    senderId: payload.senderId,
    senderLabel: payload.senderLabel,
    title: payload.title ?? firstMeaningfulLine(body),
    body,
    kind: payload.kind ?? "chat",
    source: payload.source ?? "irc",
    relatedSessionId: payload.relatedSessionId ?? null,
    selectedTrainId: payload.selectedTrainId ?? binding.room.selectedTrainId,
    stationId: payload.stationId ?? binding.room.stationId,
    edgeId: payload.edgeId ?? binding.room.edgeId,
  });
}

class IrcGatewayBinding {
  constructor(projectRoot, session, options = {}) {
    this.projectRoot = resolve(projectRoot);
    this.session = session;
    this.room = roomContextFor(this.projectRoot, options.roomId, options.topicId);
    this.config = {
      ...ircDefaults(),
      host: String(options.host ?? ircDefaults().host),
      port: finiteNumber(options.port, ircDefaults().port),
      tls: Boolean(options.tls ?? ircDefaults().tls),
      insecureTls: Boolean(options.insecureTls ?? ircDefaults().insecureTls),
      password: options.password ? String(options.password) : ircDefaults().password,
      channels: new Set(normalizeChannels(options.channels?.length ? options.channels : ircDefaults().channels)),
    };
    this.desiredNick = sanitizeNick(options.nick || defaultNick(session.label, session.id));
    this.nick = this.desiredNick;
    this.username = ircUserName(session.label, session.id, options.username);
    this.realName = trimmedText(options.realName) || `${session.label} via odd_manager`;
    this.socket = null;
    this.buffer = "";
    this.status = "idle";
    this.connectedAt = null;
    this.lastEventAt = null;
    this.lastError = null;
    this.registered = false;
    this.disconnectReason = null;
    this.channels = new Set();
    this.channelUsers = new Map();
  }

  snapshot() {
    return bindingSnapshot(this);
  }

  touch() {
    this.lastEventAt = new Date().toISOString();
  }

  sendCommand(command, params = [], trailing = null) {
    if (!this.socket || this.status === "closed") {
      throw new Error("IRC socket is not connected");
    }
    const tokens = [command, ...params.map(ircToken).filter(Boolean)];
    let line = tokens.join(" ");
    if (trailing !== null && trailing !== undefined) {
      line = `${line} :${sanitizeMessageText(trailing)}`;
    }
    this.socket.write(`${line}\r\n`);
  }

  connect() {
    this.disconnectReason = null;
    this.status = "connecting";
    this.touch();

    const connectHandler = () => {
      try {
        if (this.config.password) {
          this.sendCommand("PASS", [this.config.password]);
        }
        this.sendCommand("NICK", [this.desiredNick]);
        this.sendCommand("USER", [this.username, "0", "*"], this.realName);
      } catch (error) {
        this.lastError = error instanceof Error ? error.message : String(error);
        this.status = "error";
      }
    };

    this.socket = this.config.tls
      ? tls.connect({
          host: this.config.host,
          port: this.config.port,
          rejectUnauthorized: !this.config.insecureTls,
        })
      : net.createConnection({
          host: this.config.host,
          port: this.config.port,
        });

    this.socket.setEncoding("utf8");
    this.socket.on(this.config.tls ? "secureConnect" : "connect", connectHandler);
    this.socket.on("data", (chunk) => this.handleData(chunk));
    this.socket.on("error", (error) => {
      this.lastError = error instanceof Error ? error.message : String(error);
      this.status = "error";
      this.touch();
    });
    this.socket.on("close", () => {
      const previousStatus = this.status;
      this.status = "closed";
      this.registered = false;
      this.channels.clear();
      this.touch();
      this.socket = null;
      if (previousStatus === "connected" || this.disconnectReason) {
        appendBindingRoomMessage(this, {
          senderId: sessionParticipantId(this.session.id),
          senderLabel: this.session.label,
          body: this.disconnectReason
            ? `Disconnected IRC session for ${this.session.label}: ${this.disconnectReason}.`
            : `IRC session for ${this.session.label} closed.`,
          kind: "system",
          source: "session",
          relatedSessionId: this.session.id,
        });
      }
      this.disconnectReason = null;
    });
  }

  disconnect(reason = "disconnect requested") {
    this.disconnectReason = reason;
    try {
      if (this.socket) {
        this.sendCommand("QUIT", [], reason);
      }
    } catch {
      // Best effort.
    }
    try {
      this.socket?.end();
      this.socket?.destroy();
    } catch {
      // Best effort.
    }
  }

  join(channel) {
    const normalized = normalizeChannels([channel])[0];
    if (!normalized) {
      throw new Error("IRC channel is required");
    }
    this.config.channels.add(normalized);
    this.channelUsers.set(normalized, this.channelUsers.get(normalized) ?? new Set());
    if (this.registered) {
      this.sendCommand("JOIN", [normalized]);
    }
    return this.snapshot();
  }

  part(channel, reason = "part requested") {
    const normalized = normalizeChannels([channel])[0];
    if (!normalized) {
      throw new Error("IRC channel is required");
    }
    this.config.channels.delete(normalized);
    if (this.registered) {
      this.sendCommand("PART", [normalized], reason);
    }
    this.channels.delete(normalized);
    this.channelUsers.delete(normalized);
    return this.snapshot();
  }

  sendChannelMessage(channel, text) {
    const normalized = normalizeChannels([channel])[0];
    const body = sanitizeMessageText(text);
    if (!normalized || !body) {
      throw new Error("IRC channel and message are required");
    }
    this.sendCommand("PRIVMSG", [normalized], body);
    appendBindingRoomMessage(this, {
      senderId: sessionParticipantId(this.session.id),
      senderLabel: this.session.label,
      body: `[${normalized}] ${body}`,
      kind: "chat",
      source: "session",
      relatedSessionId: this.session.id,
    });
    return this.snapshot();
  }

  sendDirectMessage(nick, text) {
    const target = sanitizeNick(nick);
    const body = sanitizeMessageText(text);
    if (!target || !body) {
      throw new Error("IRC target nick and message are required");
    }
    this.sendCommand("PRIVMSG", [target], body);
    appendBindingRoomMessage(this, {
      senderId: sessionParticipantId(this.session.id),
      senderLabel: this.session.label,
      body: `[dm -> ${target}] ${body}`,
      kind: "chat",
      source: "session",
      relatedSessionId: this.session.id,
    });
    return this.snapshot();
  }

  handleData(chunk) {
    this.buffer += String(chunk ?? "");
    while (true) {
      const separator = this.buffer.indexOf("\n");
      if (separator < 0) {
        break;
      }
      const line = this.buffer.slice(0, separator).replace(/\r$/, "");
      this.buffer = this.buffer.slice(separator + 1);
      if (line.trim()) {
        this.handleLine(line);
      }
    }
  }

  handleLine(rawLine) {
    this.touch();
    const line = parseIrcLine(rawLine);
    const command = String(line.command ?? "").toUpperCase();

    if (command === "PING") {
      this.sendCommand("PONG", [], line.trailing ?? line.params[0] ?? "");
      return;
    }

    if (command === "001") {
      this.status = "connected";
      this.registered = true;
      this.connectedAt = new Date().toISOString();
      this.lastError = null;
      for (const channel of this.config.channels) {
        this.sendCommand("JOIN", [channel]);
      }
      appendBindingRoomMessage(this, {
        senderId: sessionParticipantId(this.session.id),
        senderLabel: this.session.label,
        body: `Connected ${this.session.label} to IRC ${this.config.host}:${this.config.port} as ${this.nick}.`,
        kind: "system",
        source: "session",
        relatedSessionId: this.session.id,
      });
      return;
    }

    if (command === "433") {
      const nextNick = sanitizeNick(`${this.desiredNick.slice(0, 12)}${Math.floor(Math.random() * 90 + 10)}`);
      this.nick = nextNick;
      this.sendCommand("NICK", [nextNick]);
      return;
    }

    if (command === "NICK") {
      const previousNick = nickFromPrefix(line.prefix);
      const nextNick = sanitizeNick(line.trailing ?? line.params[0] ?? "");
      if (previousNick && previousNick.toLowerCase() === this.nick.toLowerCase()) {
        this.nick = nextNick;
      }
      for (const users of this.channelUsers.values()) {
        if (previousNick) {
          users.delete(previousNick);
        }
        if (nextNick) {
          users.add(nextNick);
        }
      }
      return;
    }

    if (command === "JOIN") {
      const channel = normalizeChannels([line.trailing ?? line.params[0] ?? ""])[0];
      const actorNick = nickFromPrefix(line.prefix);
      if (!channel || !actorNick) {
        return;
      }
      const users = this.channelUsers.get(channel) ?? new Set();
      users.add(actorNick);
      this.channelUsers.set(channel, users);
      if (actorNick.toLowerCase() === this.nick.toLowerCase()) {
        this.channels.add(channel);
      }
      return;
    }

    if (command === "PART") {
      const channel = normalizeChannels([line.params[0] ?? ""])[0];
      const actorNick = nickFromPrefix(line.prefix);
      if (!channel || !actorNick) {
        return;
      }
      this.channelUsers.get(channel)?.delete(actorNick);
      if (actorNick.toLowerCase() === this.nick.toLowerCase()) {
        this.channels.delete(channel);
      }
      return;
    }

    if (command === "QUIT") {
      const actorNick = nickFromPrefix(line.prefix);
      if (!actorNick) {
        return;
      }
      for (const users of this.channelUsers.values()) {
        users.delete(actorNick);
      }
      return;
    }

    if (command === "353") {
      const channel = normalizeChannels([line.params[2] ?? ""])[0];
      const names = String(line.trailing ?? "")
        .split(/\s+/)
        .map(cleanNamesEntry)
        .filter(Boolean);
      if (!channel) {
        return;
      }
      const users = this.channelUsers.get(channel) ?? new Set();
      for (const name of names) {
        users.add(name);
      }
      this.channelUsers.set(channel, users);
      return;
    }

    if (command !== "PRIVMSG") {
      return;
    }

    const target = line.params[0] ?? "";
    const body = sanitizeMessageText(line.trailing ?? "");
    const authorNick = nickFromPrefix(line.prefix);
    if (!body || !authorNick) {
      return;
    }
    if (authorNick.toLowerCase() === this.nick.toLowerCase()) {
      return;
    }

    const isChannel = target.startsWith("#");
    const content = isChannel ? `[${target}] ${body}` : `[dm from ${authorNick}] ${body}`;
    appendBindingRoomMessage(this, {
      senderId: `irc:${slugify(authorNick)}`,
      senderLabel: authorNick,
      body: content,
      kind: "chat",
      source: "irc",
      relatedSessionId: null,
    });
  }
}

function bindingFor(projectRoot, sessionRef) {
  const store = ensureWorkspaceStore(projectRoot);
  const session = sessionSummaryFor(projectRoot, sessionRef);
  if (!session) {
    throw new Error("terminal session not found");
  }
  const binding = store.bindings.get(session.id);
  if (!binding) {
    throw new Error("IRC session binding not found");
  }
  return binding;
}

export function connectIrcGatewayBinding(projectRoot, options = {}) {
  const store = ensureWorkspaceStore(projectRoot);
  const session = sessionSummaryFor(projectRoot, options);
  if (!session) {
    throw new Error("terminal session not found");
  }

  const existing = store.bindings.get(session.id);
  if (existing) {
    existing.disconnect("replaced by new IRC configuration");
    store.bindings.delete(session.id);
  }

  const binding = new IrcGatewayBinding(projectRoot, session, options);
  store.bindings.set(session.id, binding);
  binding.connect();
  return binding.snapshot();
}

export function disconnectIrcGatewayBinding(projectRoot, options = {}) {
  const store = ensureWorkspaceStore(projectRoot);
  const session = sessionSummaryFor(projectRoot, options);
  if (!session) {
    throw new Error("terminal session not found");
  }
  const binding = store.bindings.get(session.id);
  if (!binding) {
    throw new Error("IRC session binding not found");
  }
  binding.disconnect("disconnect requested");
  store.bindings.delete(session.id);
  return binding.snapshot();
}

export function getIrcGatewayBindingStatus(projectRoot, options = {}) {
  return bindingFor(projectRoot, options).snapshot();
}

export function joinIrcGatewayChannel(projectRoot, options = {}) {
  const binding = bindingFor(projectRoot, options);
  return binding.join(options.channel);
}

export function partIrcGatewayChannel(projectRoot, options = {}) {
  const binding = bindingFor(projectRoot, options);
  return binding.part(options.channel, options.reason);
}

export function sendIrcGatewayChannelMessage(projectRoot, options = {}) {
  const binding = bindingFor(projectRoot, options);
  return binding.sendChannelMessage(options.channel, options.text);
}

export function sendIrcGatewayDirectMessage(projectRoot, options = {}) {
  const binding = bindingFor(projectRoot, options);
  return binding.sendDirectMessage(options.nick, options.text);
}

export function readIrcGatewayRoom(projectRoot, options = {}) {
  const binding = bindingFor(projectRoot, options);
  const limit = Math.max(1, finiteNumber(options.limit, 40));
  return {
    ...binding.snapshot(),
    messages: loadRoomMessages(binding.projectRoot, binding.room.roomId, limit),
  };
}

export function whoIrcGatewayChannel(projectRoot, options = {}) {
  const binding = bindingFor(projectRoot, options);
  const requested = normalizeChannels([options.channel])[0];
  const channel =
    requested ||
    Array.from(binding.channels.values())[0] ||
    Array.from(binding.config.channels.values())[0] ||
    null;

  if (!channel) {
    throw new Error("IRC channel is required");
  }

  return {
    channel,
    users: [...(binding.channelUsers.get(channel) ?? new Set())].sort((left, right) => left.localeCompare(right)),
  };
}
