import {
  existsSync,
  realpathSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";

const SURFACE_MEDIA_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".md", "text/markdown; charset=utf-8"],
  [".markdown", "text/markdown; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".cjs", "text/javascript; charset=utf-8"],
  [".ts", "text/plain; charset=utf-8"],
  [".tsx", "text/plain; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".yaml", "application/yaml; charset=utf-8"],
  [".yml", "application/yaml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".log", "text/plain; charset=utf-8"],
]);

const BINARY_SURFACE_EXTENSIONS = new Set([".pdf"]);

function pathIsWithin(root, candidate) {
  const value = relative(root, candidate);
  return value === "" || (!value.startsWith("..") && !isAbsolute(value));
}

export function resolveWorkspaceSurfacePath(workspaceRoot, relativePath) {
  const root = resolve(workspaceRoot);
  const target = resolve(root, relativePath);
  const lexicallyOutside = !pathIsWithin(root, target);
  let realRoot = null;
  let realTarget = null;
  let resolutionError = null;
  if (!lexicallyOutside && existsSync(root) && existsSync(target)) {
    try {
      realRoot = realpathSync(root);
      realTarget = realpathSync(target);
    } catch (error) {
      resolutionError = error;
    }
  }
  return {
    root,
    target,
    realRoot,
    realTarget,
    resolutionError,
    outsideWorkspace: lexicallyOutside
      || (realRoot !== null && realTarget !== null && !pathIsWithin(realRoot, realTarget)),
  };
}

export function workspaceSurfaceMediaType(relativePath) {
  return SURFACE_MEDIA_TYPES.get(extensionForSurfacePath(relativePath)) ?? "text/plain; charset=utf-8";
}

function shouldReadSurfaceAsBinary(relativePath) {
  return BINARY_SURFACE_EXTENSIONS.has(extensionForSurfacePath(relativePath));
}

function extensionForSurfacePath(path) {
  const match = String(path ?? "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

export function readWorkspaceSurface(workspaceRoot, relativePath) {
  const {
    root,
    target,
    realRoot,
    realTarget,
    resolutionError,
    outsideWorkspace,
  } = resolveWorkspaceSurfacePath(workspaceRoot, relativePath);
  if (outsideWorkspace) {
    return {
      kind: "unreadable",
      relative_path: relativePath,
      path: target,
      reason: "outside_workspace",
      error: "surface path resolves outside the active Project root",
    };
  }
  if (resolutionError) {
    return {
      kind: "unreadable",
      relative_path: relativePath,
      path: target,
      reason: "read_error",
      error: "surface path could not be resolved inside the active Project root",
    };
  }
  if (!existsSync(target)) {
    return {
      kind: "missing",
      relative_path: relativePath,
      path: target,
    };
  }
  try {
    const admittedTarget = realTarget ?? target;
    const stat = statSync(admittedTarget);
    if (stat.isDirectory()) {
      const entries = readdirSync(admittedTarget, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))
        .flatMap((entry) => {
          const lexicalChild = join(target, entry.name);
          try {
            const realChild = realpathSync(join(admittedTarget, entry.name));
            if (realRoot && !pathIsWithin(realRoot, realChild)) return [];
            return [{
              name: entry.name,
              kind: statSync(realChild).isDirectory() ? "directory" : "file",
              relative_path: relative(root, lexicalChild),
            }];
          } catch {
            return [];
          }
        });
      return {
        kind: "directory",
        relative_path: relativePath,
        path: target,
        entries: entries.slice(0, 200),
        truncated: entries.length > 200,
      };
    }
    const mediaType = workspaceSurfaceMediaType(relativePath);
    const binary = shouldReadSurfaceAsBinary(relativePath);
    return {
      kind: "file",
      relative_path: relativePath,
      path: target,
      content: binary ? "" : readFileSync(admittedTarget, "utf8"),
      media_type: mediaType,
      encoding: binary ? "binary" : "utf8",
      size_bytes: stat.size,
    };
  } catch (error) {
    return {
      kind: "unreadable",
      relative_path: relativePath,
      path: target,
      reason: error?.code === "EACCES" || error?.code === "EPERM" ? "permission_denied" : "read_error",
      error: error?.message ?? String(error),
    };
  }
}
