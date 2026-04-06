import { EventEmitter } from "node:events";
import { resolve } from "node:path";

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

function keyForWorkspace(workspaceRoot) {
  return `workspace:${resolve(workspaceRoot)}`;
}

export function emitAgentConsoleEvent(workspaceRoot, payload = {}) {
  emitter.emit(keyForWorkspace(workspaceRoot), {
    type: "odd-console-updated",
    workspaceRoot: resolve(workspaceRoot),
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

export function subscribeAgentConsoleEvents(workspaceRoot, listener) {
  const key = keyForWorkspace(workspaceRoot);
  emitter.on(key, listener);
  return () => {
    emitter.off(key, listener);
  };
}
