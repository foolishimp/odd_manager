import { startTransition, useEffect, useState } from "react";
import { AppShell } from "../layout/AppShell";
import { loadWorld, runCommand } from "../lib/api";
import { closeAllGTermSessions } from "../lib/collaboration";
import type {
  CommandName,
  GraphNodeView,
  ManagerWorld,
  NavigatorMode,
  PageId,
  Selection,
  ThemeMode,
} from "../lib/types";
import { WorkspaceRoute } from "../routes/WorkspaceRoute";

const DEFAULT_WORKSPACE = "/Users/jim/src/apps/odd_manager";
const THEME_STORAGE_KEY = "oman-theme";

function initialTheme(): ThemeMode {
  if (typeof window === "undefined") {
    return "light";
  }
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" ? "dark" : "light";
}

export function App() {
  const [workspaceRoot, setWorkspaceRoot] = useState(DEFAULT_WORKSPACE);
  const [workspaceDraft, setWorkspaceDraft] = useState(DEFAULT_WORKSPACE);
  const [world, setWorld] = useState<ManagerWorld | null>(null);
  const [selectedPage, setSelectedPage] = useState<PageId>("graphs");
  const [selectedGraphId, setSelectedGraphId] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [navigatorMode, setNavigatorMode] = useState<NavigatorMode>("expanded");
  const [loadingWorld, setLoadingWorld] = useState(true);
  const [runningCommand, setRunningCommand] = useState<CommandName | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeMode>(initialTheme);

  async function refreshWorld(nextWorkspaceRoot = workspaceRoot) {
    setLoadingWorld(true);
    setError(null);
    try {
      const nextWorld = await loadWorld(nextWorkspaceRoot);
      startTransition(() => {
        setWorld(nextWorld);
        setSelectedGraphId((current) => ensureGraphSelection(nextWorld, current));
        setSelection((current) => ensureObjectSelection(nextWorld, current));
        setSelectedNodeId((current) => ensureNodeSelection(nextWorld, current));
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setLoadingWorld(false);
    }
  }

  async function triggerCommand(command: CommandName, auto = false) {
    setRunningCommand(command);
    setError(null);
    try {
      await runCommand(workspaceRoot, command, { auto });
      await refreshWorld(workspaceRoot);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : String(caught));
    } finally {
      setRunningCommand(null);
    }
  }

  function applySelection(nextSelection: Selection) {
    setSelection(nextSelection);
    if (!world) {
      return;
    }
    const located = locateSelection(world, nextSelection);
    setSelectedNodeId(located?.nodeId ?? null);
    if (located?.graphId) {
      setSelectedGraphId(located.graphId);
    }
  }

  function handleSelectNode(node: GraphNodeView) {
    setSelectedNodeId(node.id);
    setSelection(nodeToSelection(node));
  }

  useEffect(() => {
    void refreshWorld(DEFAULT_WORKSPACE);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  return (
    <AppShell
      theme={theme}
      onToggleTheme={() => setTheme((current) => (current === "light" ? "dark" : "light"))}
      workspaceRoot={workspaceRoot}
      workspaceDraft={workspaceDraft}
      onWorkspaceDraftChange={setWorkspaceDraft}
      onApplyWorkspace={(nextWorkspaceRoot) => {
        const targetWorkspace = (nextWorkspaceRoot ?? workspaceDraft).trim();
        if (!targetWorkspace) {
          return;
        }
        const previousWorkspace = workspaceRoot;
        setWorkspaceRoot(targetWorkspace);
        setWorkspaceDraft(targetWorkspace);
        setSelectedGraphId("");
        setSelectedNodeId(null);
        setSelection(null);
        setError(null);
        void refreshWorld(targetWorkspace);
        if (previousWorkspace !== targetWorkspace) {
          void closeAllGTermSessions(previousWorkspace).catch((caught) => {
            setError(caught instanceof Error ? caught.message : String(caught));
          });
        }
      }}
      selectedPage={selectedPage}
      onSelectPage={setSelectedPage}
      overview={world?.overview ?? null}
      loadingWorld={loadingWorld}
      runningCommand={runningCommand}
      error={error}
    >
      <WorkspaceRoute
        workspaceRoot={workspaceRoot}
        world={world}
        loadingWorld={loadingWorld}
        selectedPage={selectedPage}
        selectedGraphId={selectedGraphId}
        onSelectGraph={(graphId) => {
          setSelectedGraphId(graphId);
          setSelection({ kind: "graph", id: graphId });
          setSelectedNodeId(null);
        }}
        selectedNodeId={selectedNodeId}
        onSelectNode={handleSelectNode}
        navigatorMode={navigatorMode}
        onChangeNavigatorMode={setNavigatorMode}
        selection={selection}
        onSelectSelection={applySelection}
        runningCommand={runningCommand}
        onRefresh={() => void refreshWorld(workspaceRoot)}
        onIterate={() => void triggerCommand("iterate")}
        onStartAuto={() => void triggerCommand("start", true)}
      />
    </AppShell>
  );
}

function ensureGraphSelection(world: ManagerWorld, current: string) {
  if (world.graph_set.graphs.some((graph) => graph.id === current)) {
    return current;
  }
  return world.graph_set.graphs[0]?.id ?? "";
}

function ensureNodeSelection(world: ManagerWorld, current: string | null) {
  if (current) {
    for (const graph of world.graph_set.graphs) {
      if (graph.nodes.some((node) => node.id === current)) {
        return current;
      }
    }
  }
  return world.graph_set.graphs[0]?.nodes[0]?.id ?? null;
}

function ensureObjectSelection(world: ManagerWorld, current: Selection | null) {
  if (current && selectionExists(world, current)) {
    return current;
  }
  const firstGraph = world.graph_set.graphs[0];
  const firstNode = firstGraph?.nodes[0];
  if (firstNode) {
    return nodeToSelection(firstNode);
  }
  if (firstGraph) {
    return { kind: "graph", id: firstGraph.id };
  }
  return null;
}

function selectionExists(world: ManagerWorld, selection: Selection) {
  switch (selection.kind) {
    case "requirement":
      return world.domain.requirements.some((requirement) => requirement.requirement_id === selection.id);
    case "surface":
      return Boolean(selection.id.trim());
    case "asset":
      return world.domain.assets.some((asset) => asset.asset_id === selection.id);
    case "asset_family":
      return world.domain.asset_families.some((assetFamily) => assetFamily.name === selection.id);
    case "binding":
      return world.domain.bindings.some((binding) => binding.node === selection.id);
    case "collection":
      return world.domain.collections.some((collection) => collection.name === selection.id);
    case "ambiguity":
      return world.domain.ambiguity_register.ambiguities.some(
        (ambiguity) => ambiguity.ambiguity_id === selection.id,
      );
    case "edge_contract":
      return world.domain.edge_contracts.some((contract) => contract.name === selection.id);
    case "function":
      return world.domain.functions.some((item) => item.id === selection.id);
    case "program":
      return world.domain.programs.some((program) => program.name === selection.id);
    case "workorder":
      return world.domain.workorders.some((workorder) => workorder.id === selection.id);
    case "work_act_type":
      return world.domain.work_act_types.some((workActType) => workActType.name === selection.id);
    case "graph_function":
      return world.domain.graph_functions.some((graphFunction) => graphFunction.id === selection.id);
    case "run":
      return world.runtime.runs.some((run) => run.instance_id === selection.id);
    case "graph_call":
      return world.runtime.graph_calls.some((call) => call.instance_id === selection.id);
    case "continuation":
      return world.runtime.continuations.some((continuation) => continuation.instance_id === selection.id);
    case "frame":
      return world.runtime.frames.some((frame) => frame.instance_id === selection.id);
    case "event":
      return world.runtime.recent_events.some((event) => event.event_id === selection.id);
    case "graph":
      return world.graph_set.graphs.some((graph) => graph.id === selection.id);
    default:
      return false;
  }
}

function locateSelection(world: ManagerWorld, selection: Selection) {
  if (selection.kind === "graph") {
    return { graphId: selection.id, nodeId: null };
  }
  for (const graph of world.graph_set.graphs) {
    const node = graph.nodes.find((candidate) => {
      return candidate.ref_kind === selection.kind && candidate.ref_id === selection.id;
    });
    if (node) {
      return { graphId: graph.id, nodeId: node.id };
    }
  }
  return null;
}

function nodeToSelection(node: GraphNodeView): Selection {
  return { kind: node.ref_kind, id: node.ref_id };
}
