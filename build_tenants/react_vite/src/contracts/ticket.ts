// Ticket contract — shared between FE and BE per UX_METHOD §10.
// Authoritative type for any TicketAssetSurface consumer.
//
// This is the typed projection of a STDO-frontmatter markdown ticket
// living under .ai-workspace/tickets/{active,backlog,completed}/.
//
// Companion to: build_tenants/common/design/ASSET_SURFACE_AND_TOPOLOGY.md (§2.1)
// Realized by: build_tenants/react_vite/src/server/ticket-asset-surface-service.mjs
// Adopted via: T-007 (closes when this contract is the read source for the tickets surface)

export type TicketLane = 'active' | 'backlog' | 'completed';

export type TicketStdoMethod =
  | 'SPEC_METHOD.md'
  | 'TICKET_METHOD.md'
  | 'DESIGN_MODULE_METHOD.md'
  | 'ODD_METHOD.md'
  | 'UX_METHOD.md'
  | string;

export interface TicketGovernanceExpansion {
  // Each entry is { letter: methodFile }, e.g. { S: 'SPEC_METHOD.md' }.
  [letter: string]: TicketStdoMethod;
}

export interface TicketRecord {
  // Identity (lane is derived from on-disk location, not frontmatter).
  id: string;
  lane: TicketLane;
  sourcePath: string;

  // Required STDO frontmatter fields.
  title: string;
  type: string;
  ticketCategory?: string;
  status: string;
  goal?: string;
  changeIntent?: string;
  changeClass?: string;
  reEntryPoint?: string;
  triagedAt?: string;
  createdAt?: string;
  updatedAt?: string;

  // Recommended fields.
  priority?: string;
  dependencies?: string[];
  intakeSource?: string;
  affectedBoundary?: string;
  buildTenant?: string;
  sourceTicket?: string;
  links?: string[];

  // STDO governance fields.
  governanceScope?: string;
  governanceScopeExpansion?: TicketGovernanceExpansion[];

  // Execution-contract fields.
  targetTruth?: string;
  supersededTruth?: string;
  closureLaw?: string;
  evaluationCriteria?: string[];
  proofSurface?: string[];
  nonClosureConditions?: string[];

  // Implementation-migration extras.
  migrationStrategy?: string;
  libraryUsage?: string;
  governingLibrary?: string;
  libraryRationale?: string;

  // Markdown body following the YAML frontmatter (may contain STDO Reading or other prose).
  body?: string;

  // Any frontmatter field not explicitly typed above; preserved for forward compatibility.
  raw: Record<string, unknown>;
}

export interface TicketCollectionFilter {
  lane?: TicketLane | TicketLane[];
  status?: string | string[];
  goal?: string;
  buildTenant?: string;
  ticketCategory?: string;
  changeClass?: string;
  hasDependency?: string;
}

export interface TicketCollectionQuery {
  list(filter?: TicketCollectionFilter): TicketRecord[];
  get(id: string): TicketRecord | undefined;
  count(filter?: TicketCollectionFilter): number;
}
