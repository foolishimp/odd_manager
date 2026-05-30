export type ThemeMode = "light" | "dark-grey" | "dark";
export type WorkspaceIdentity = string;

export type WorkspaceProfile = {
  primary_identity: WorkspaceIdentity;
  governance_identities: WorkspaceIdentity[];
  active_domain_pack: "odd_sdlc" | "odd_world_model" | null;
  shell_title: string;
  confidence: "high" | "medium" | "low";
  markers: string[];
};

export type SurfaceEntry = {
  name: string;
  kind: "file" | "directory";
  relative_path: string;
};

export type SurfaceData =
  | {
      kind: "file";
      relative_path: string;
      path: string;
      content: string;
      media_type?: string;
      encoding?: "utf8" | "binary";
      size_bytes?: number;
    }
  | {
      kind: "directory";
      relative_path: string;
      path: string;
      entries: SurfaceEntry[];
      truncated: boolean;
    }
  | {
      kind: "missing";
      relative_path: string;
      path: string;
    }
  | {
      kind: "unreadable";
      relative_path: string;
      path: string;
      reason: "permission_denied" | "outside_workspace" | "read_error";
      error: string;
    };
