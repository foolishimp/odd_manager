import { useCallback, useEffect, useState } from "react";
import { browsePath } from "../../lib/collaboration";
import type { FsEntry } from "../../lib/collaboration";

type FolderBrowserProps = {
  onSelectWorkspace: (absolutePath: string) => void;
  path?: string;
  disabled?: boolean;
  onPathChange?: (absolutePath: string) => void;
};

type BrowseState = {
  currentPath: string;
  parent: string | null;
  entries: FsEntry[];
  truncated: boolean;
};

export function FolderBrowser({
  onSelectWorkspace,
  path,
  disabled = false,
  onPathChange,
}: FolderBrowserProps) {
  const [state, setState] = useState<BrowseState>({
    currentPath: "",
    parent: null,
    entries: [],
    truncated: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const navigate = useCallback(async (targetPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await browsePath(targetPath);
      setState({
        currentPath: result.path,
        parent: result.parent,
        entries: result.entries,
        truncated: result.truncated ?? false,
      });
      onPathChange?.(result.path);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoading(false);
    }
  }, [onPathChange]);

  useEffect(() => {
    if (path === undefined) {
      if (!state.currentPath) {
        void navigate();
      }
      return;
    }
    if (path === state.currentPath) {
      return;
    }
    void navigate(path);
  }, [navigate, path, state.currentPath]);

  const breadcrumbSegments = state.currentPath.split("/").filter(Boolean);

  return (
    <div className="folder-browser">
      <div className="folder-browser__crumbs" aria-label="Folder path">
        <button
          type="button"
          className="folder-browser__crumb"
          onClick={() => void navigate("/")}
          disabled={disabled || loading}
        >
          /
        </button>
        {breadcrumbSegments.map((segment, index) => {
          const segmentPath = `/${breadcrumbSegments.slice(0, index + 1).join("/")}`;
          const isCurrent = index === breadcrumbSegments.length - 1;
          return (
            <span key={segmentPath} className="folder-browser__crumb-group">
              <span className="folder-browser__separator">/</span>
              <button
                type="button"
                className="folder-browser__crumb"
                onClick={() => void navigate(segmentPath)}
                disabled={disabled || loading}
                aria-current={isCurrent ? "page" : undefined}
              >
                {segment}
              </button>
            </span>
          );
        })}

        {state.parent ? (
          <button
            type="button"
            className="folder-browser__up"
            onClick={() => void navigate(state.parent ?? undefined)}
            disabled={disabled || loading}
          >
            Up
          </button>
        ) : null}
      </div>

      {loading ? <p className="folder-browser__state">Loading folders…</p> : null}
      {error ? <p className="folder-browser__error">{error}</p> : null}

      {!loading && !error ? (
        <ul className="folder-browser__list">
          {state.entries.length === 0 ? (
            <li className="folder-browser__empty">No subdirectories found.</li>
          ) : null}

          {state.entries.map((entry) => (
            <li key={entry.absolutePath} className="folder-browser__row">
              <button
                type="button"
                className="folder-browser__entry"
                onClick={() => void navigate(entry.absolutePath)}
                disabled={disabled}
              >
                <span className={`folder-browser__entry-icon${entry.hasWorkspace ? " is-workspace" : ""}`}>
                  {entry.hasWorkspace ? "●" : "◦"}
                </span>
                <span className="folder-browser__entry-name">{entry.name}</span>
                {entry.hasWorkspace ? (
                  <span className="folder-browser__entry-tag" title={entry.markers.join(" · ")}>
                    managed
                  </span>
                ) : null}
              </button>

              {entry.hasWorkspace ? (
                <button
                  type="button"
                  className="folder-browser__select"
                  onClick={() => onSelectWorkspace(entry.absolutePath)}
                  disabled={disabled}
                >
                  Open
                </button>
              ) : null}
            </li>
          ))}

          {state.truncated ? (
            <li className="folder-browser__empty">Showing the first 500 folders. Navigate deeper to narrow the list.</li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}
