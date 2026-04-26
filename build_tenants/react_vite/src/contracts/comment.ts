// Comment contract — shared between FE and BE per UX_METHOD §10.
// Authoritative type for any CommentAssetSurface consumer.
//
// Companion to: build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md (§3 Comments)
// Realized by: build_tenants/react_vite/src/server/comment-asset-surface-service.mjs
// Adopted via: T-008 (read path); T-019 (write + threading + unread state)

export type CommentCategory =
  | 'REVIEW'
  | 'STRATEGY'
  | 'GAP'
  | 'SCHEMA'
  | 'HANDOFF'
  | 'MATRIX'
  | 'CONSOLIDATION'
  | 'ODDTERM'
  | 'CORRECTIVE_REVIEW'
  | 'FORENSIC_STDO_REVIEW'
  | 'HANDOVER'
  | string;

export type CommentStatus = 'Draft' | 'Open handover' | 'Approved' | 'Superseded' | string;

export interface CommentRecord {
  // Identity
  id: string;          // <agent>/<filename-without-extension>
  author: string;      // derived from <agent>/ directory
  sourcePath: string;  // relative to projectRoot
  filename: string;
  timestamp?: string;  // YYYYMMDDTHHMMSSZ from filename prefix
  category?: CommentCategory;
  subject?: string;    // derived from filename suffix (kebab-cased subject)
  threadId?: string;   // derived from Addresses field or filename when no Addresses

  // POSTING_GUIDE bold-key frontmatter fields
  title?: string;      // first H1 line content (e.g. "REVIEW: Goals 0426 Against ODD_METHOD")
  date?: string;       // **Date**: line value
  addresses?: string;  // **Addresses**: line value
  status?: CommentStatus;
  scope?: string;
  governance?: string;

  // Body following the metadata block
  body?: string;

  // Any bold-key field not explicitly typed above; preserved for forward compat.
  raw: Record<string, unknown>;
}

export interface CommentCollectionFilter {
  author?: string | string[];
  category?: CommentCategory | CommentCategory[];
  status?: CommentStatus | CommentStatus[];
  threadId?: string;
  addressesIncludes?: string;
}

export interface CommentCollectionQuery {
  list(filter?: CommentCollectionFilter): CommentRecord[];
  get(id: string): CommentRecord | undefined;
  count(filter?: CommentCollectionFilter): number;
}
