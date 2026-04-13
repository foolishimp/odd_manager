import { readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import {
  joinRoomParticipant,
  leaveRoomParticipant,
  postRoomParticipantMessage,
  waitRoomParticipant,
} from "../src/server/oddchat-participant-service.mjs";
import { loadGTermPoolState } from "../src/server/oddterm-pool-service.mjs";

const workspaceRoot = String(process.env.OMAN_WORKSPACE_ROOT ?? "").trim();
const sessionId = String(process.env.OMAN_SESSION_ID ?? "").trim();
const sessionLabel = String(process.env.OMAN_SESSION_LABEL ?? "").trim();
const topicId = String(process.env.OMAN_TOPIC_ID ?? "").trim();
const topicLabel = String(process.env.OMAN_TOPIC_LABEL ?? "").trim() || topicId;
const provider = "codex";
const participantLabel = `Codex${sessionLabel ? ` · ${sessionLabel}` : ""}`;

if (!workspaceRoot || !sessionId || !topicId) {
  console.error("odd_manager codex room worker requires OMAN_WORKSPACE_ROOT, OMAN_SESSION_ID, and OMAN_TOPIC_ID");
  process.exit(1);
}

let shuttingDown = false;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sessionIsLive() {
  return (
    loadGTermPoolState(workspaceRoot).sessions.find((session) => session.id === sessionId)?.status === "live"
  );
}

function messageBody(message) {
  return String(message?.content ?? message?.body ?? "").trim();
}

function buildPrompt(messages) {
  const lines = messages
    .map((message) => {
      const body = messageBody(message);
      if (!body) {
        return null;
      }
      return `- [${String(message?.timestamp ?? "").trim()}] ${String(message?.senderLabel ?? "Room").trim()}: ${body}`;
    })
    .filter(Boolean);

  return [
    `You are ${participantLabel} participating in OddChat topic ${topicLabel}.`,
    "New room traffic since your last reply:",
    ...lines,
    "",
    "Reply with exactly one room message if a response is warranted.",
    'If no reply is appropriate, output exactly "NO_REPLY".',
    "Do not narrate tool use, waiting, or mailbox state.",
    "Do not address terminal stdin or shell state.",
  ].join("\n");
}

async function runCodexExec(prompt) {
  const outputPath = join(
    tmpdir(),
    `odd-manager-codex-worker-${sessionId}-${Date.now()}-${Math.random().toString(16).slice(2)}.txt`,
  );

  const args = [
    "exec",
    "-C",
    workspaceRoot,
    "--skip-git-repo-check",
    "--color",
    "never",
    "-o",
    outputPath,
    prompt,
  ];

  const exitCode = await new Promise((resolve, reject) => {
    const child = spawn("codex", args, {
      cwd: workspaceRoot,
      env: process.env,
      stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", reject);
    child.on("close", resolve);
  });

  if (exitCode !== 0) {
    throw new Error(`codex exec exited with code ${String(exitCode)}`);
  }

  try {
    return readFileSync(outputPath, "utf8").trim();
  } finally {
    rmSync(outputPath, { force: true });
  }
}

async function cleanup() {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  try {
    leaveRoomParticipant(workspaceRoot, {
      sessionId,
      provider,
    });
  } catch {
    // Ignore cleanup failures on shutdown.
  }
}

process.on("SIGINT", () => {
  void cleanup().finally(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void cleanup().finally(() => process.exit(0));
});

async function main() {
  while (!sessionIsLive()) {
    await sleep(250);
  }

  joinRoomParticipant(workspaceRoot, {
    sessionId,
    topicId,
    provider,
    participantLabel,
    historyLimit: 1,
  });

  postRoomParticipantMessage(workspaceRoot, {
    sessionId,
    provider,
    text: `Hello from ${participantLabel}. I’m connected on ${topicLabel} and will reply here as messages arrive.`,
  });

  while (!shuttingDown) {
    if (!sessionIsLive()) {
      break;
    }

    const waited = await waitRoomParticipant(workspaceRoot, {
      sessionId,
      provider,
      excludeSelf: true,
      limit: 20,
      timeoutMs: 30000,
    });
    const messages = Array.isArray(waited?.messages) ? waited.messages : [];
    if (!messages.length) {
      continue;
    }

    const prompt = buildPrompt(messages);
    const reply = (await runCodexExec(prompt)).trim();
    if (!reply || reply === "NO_REPLY") {
      continue;
    }

    postRoomParticipantMessage(workspaceRoot, {
      sessionId,
      provider,
      text: reply,
    });
  }
}

main()
  .catch(async (error) => {
    console.error(error && error.stack ? error.stack : String(error));
    await cleanup();
    process.exit(1);
  })
  .finally(async () => {
    await cleanup();
  });
