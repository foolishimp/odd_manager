import { DeveloperControlHost } from "../capabilities/host";
import type {
  ProjectLandingSurface,
  RunInspectorFocus,
} from "../lib/projectDeepLink";

type WorkspaceRouteProps = {
  workspaceRoot: string;
  initialSurface: ProjectLandingSurface | null;
  initialRunFocus: RunInspectorFocus | null;
  onProjectRootChange: (projectRoot: string) => void;
};

export function WorkspaceRoute({
  workspaceRoot,
  initialSurface,
  initialRunFocus,
  onProjectRootChange,
}: WorkspaceRouteProps) {
  return (
    <main className="route-wrap">
      <div className="workspace-view workspace-view--developer-control">
        <DeveloperControlHost
          projectRoot={workspaceRoot}
          initialSurface={initialSurface}
          initialRunFocus={initialRunFocus}
          onProjectRootChange={onProjectRootChange}
        />
      </div>
    </main>
  );
}
