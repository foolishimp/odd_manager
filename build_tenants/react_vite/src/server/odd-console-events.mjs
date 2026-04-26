import { EventEmitter } from "node:events";
import { resolve } from "node:path";

const emitter = new EventEmitter();
emitter.setMaxListeners(200);

function keyForWorkspace(projectRoot) {
  return `workspace:${resolve(projectRoot)}`;
}

export function emitAgentConsoleEvent(projectRoot, payload = {}) {
  emitter.emit(keyForWorkspace(projectRoot), {
    type: "odd-console-updated",
    projectRoot: resolve(projectRoot),
    timestamp: new Date().toISOString(),
    ...payload,
  });
}

export function subscribeAgentConsoleEvents(projectRoot, listener) {
  const key = keyForWorkspace(projectRoot);
  emitter.on(key, listener);
  return () => {
    emitter.off(key, listener);
  };
}
