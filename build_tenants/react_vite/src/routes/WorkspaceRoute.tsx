import { DeveloperControlHost } from "../capabilities/host";
import type { ProjectLandingSurface } from "../lib/projectDeepLink";

type WorkspaceRouteProps = {
  workspaceRoot: string;
  initialSurface: ProjectLandingSurface | null;
  onProjectRootChange: (projectRoot: string) => void;
};

export function WorkspaceRoute({ workspaceRoot, initialSurface, onProjectRootChange }: WorkspaceRouteProps) {
  return (
    <main className="route-wrap">
      <div className="workspace-view workspace-view--developer-control">
        <DeveloperControlHost
          projectRoot={workspaceRoot}
          initialSurface={initialSurface}
          onProjectRootChange={onProjectRootChange}
        />
      </div>
    </main>
  );
}
