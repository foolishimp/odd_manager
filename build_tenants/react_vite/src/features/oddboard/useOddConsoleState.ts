import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadAgentConsoleState,
  subscribeAgentConsoleEvents,
} from "../../lib/collaboration";
import type { AgentConsoleState } from "../../lib/collaboration";

type RefreshOptions = {
  background?: boolean;
};

export function useOddConsoleState(projectRoot: string) {
  const [consoleState, setConsoleState] = useState<AgentConsoleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const backgroundRefreshRef = useRef<Promise<void> | null>(null);

  const refreshConsole = useCallback(
    async (options: RefreshOptions = {}) => {
      const background = options.background ?? false;
      if (background && backgroundRefreshRef.current) {
        return backgroundRefreshRef.current;
      }

      const run = async () => {
        if (!background) {
          setLoading(true);
        }
        setError(null);
        try {
          const nextState = await loadAgentConsoleState(projectRoot);
          setConsoleState(nextState);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : String(caught));
        } finally {
          if (!background) {
            setLoading(false);
          }
        }
      };

      const task = run();
      if (background) {
        const backgroundTask = task.finally(() => {
          if (backgroundRefreshRef.current === backgroundTask) {
            backgroundRefreshRef.current = null;
          }
        });
        backgroundRefreshRef.current = backgroundTask;
        return backgroundTask;
      }

      return task;
    },
    [projectRoot],
  );

  useEffect(() => {
    void refreshConsole();
  }, [refreshConsole]);

  useEffect(() => {
    return subscribeAgentConsoleEvents(projectRoot, {
      onUpdate: () => {
        void refreshConsole({ background: true });
      },
      onError: () => {
        setError("Live oddboard relay disconnected.");
      },
    });
  }, [projectRoot, refreshConsole]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const refreshVisibleState = () => {
      void refreshConsole({ background: true });
    };

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshConsole({ background: true });
      }
    }, 2500);

    window.addEventListener("focus", refreshVisibleState);
    document.addEventListener("visibilitychange", refreshVisibleState);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisibleState);
      document.removeEventListener("visibilitychange", refreshVisibleState);
    };
  }, [refreshConsole]);

  return {
    consoleState,
    loading,
    error,
    refreshConsole,
  };
}
