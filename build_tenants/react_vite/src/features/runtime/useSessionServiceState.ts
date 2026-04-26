import { useCallback, useEffect, useState } from "react";
import { loadSessionServiceState } from "../../lib/api";
import type { SessionServiceState } from "../../lib/types";

type RefreshOptions = {
  background?: boolean;
};

export function useSessionServiceState(projectRoot: string) {
  const [serviceState, setServiceState] = useState<SessionServiceState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshService = useCallback(
    async (options: RefreshOptions = {}) => {
      const background = options.background ?? false;
      if (!background) {
        setLoading(true);
      }
      setError(null);
      try {
        const nextState = await loadSessionServiceState(projectRoot);
        setServiceState(nextState);
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : String(caught));
      } finally {
        if (!background) {
          setLoading(false);
        }
      }
    },
    [projectRoot],
  );

  useEffect(() => {
    void refreshService();
  }, [refreshService]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      void refreshService({ background: true });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [refreshService]);

  return {
    serviceState,
    loading,
    error,
    refreshService,
  };
}
