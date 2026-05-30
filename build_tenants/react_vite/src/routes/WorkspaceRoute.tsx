import { SidecarPanel } from "../features/sidecar/SidecarPanel";

type WorkspaceRouteProps = {
  workspaceRoot: string;
  onProjectRootChange: (projectRoot: string) => void;
};

export function WorkspaceRoute({ workspaceRoot, onProjectRootChange }: WorkspaceRouteProps) {
  return (
    <main className="route-wrap">
      <div className="workspace-view workspace-view--sidecar">
        <SidecarPanel
          projectRoot={workspaceRoot}
          onContextChange={(ctx) => {
            if (ctx.project.root !== workspaceRoot) {
              onProjectRootChange(ctx.project.root);
            }
          }}
        />
      </div>
    </main>
  );
}
