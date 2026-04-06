import { useCallback, useEffect, useState } from "react";
import {
  loadAgentConsoleState,
  subscribeAgentConsoleEvents,
} from "../../lib/collaboration";
import type { AgentConsoleState } from "../../lib/collaboration";

type RefreshOptions = {
  background?: boolean;
};

export function useOddConsoleState(workspaceRoot: string) {
  const [consoleState, setConsoleState] = useState<AgentConsoleState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshConsole = useCallback(
    async (options: RefreshOptions = {}) => {
      const background = options.background ?? false;
      if (!background) {
        setLoading(true);
      }
      setError(null);
      try {
        const nextState = await loadAgentConsoleState(workspaceRoot);
        setConsoleState(nextState);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [workspaceRoot],
  );

  useEffect(() => {
    void refreshConsole();
  }, [refreshConsole]);

  useEffect(() => {
    return subscribeAgentConsoleEvents(workspaceRoot, {
      onUpdate: () => {
        void refreshConsole({ background: true });
      },
      onError: () => {
        setError("Live oddboard relay disconnected.");
      },
    });
  }, [workspaceRoot, refreshConsole]);

  return {
    consoleState,
    loading,
    error,
    refreshConsole,
  };
}
