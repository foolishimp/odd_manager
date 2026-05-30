import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { join, relative, resolve } from "node:path";

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

export function resolveWorkspaceSurfacePath(workspaceRoot, relativePath) {
  const root = resolve(workspaceRoot);
  const target = resolve(root, relativePath);
  return {
    root,
    target,
    outsideWorkspace: !target.startsWith(`${root}/`) && target !== root,
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
  const { root, target, outsideWorkspace } = resolveWorkspaceSurfacePath(workspaceRoot, relativePath);
  if (outsideWorkspace) {
    return {
      kind: "unreadable",
      relative_path: relativePath,
      path: target,
      reason: "outside_workspace",
      error: "surface path resolves outside the active Project root",
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
    const stat = statSync(target);
    if (stat.isDirectory()) {
      const entries = readdirSync(target, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? "directory" : "file",
          relative_path: relative(root, join(target, entry.name)),
        }));
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
      content: binary ? "" : readFileSync(target, "utf8"),
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
