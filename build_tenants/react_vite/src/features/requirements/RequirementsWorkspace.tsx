import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { MarkdownDocument } from "../../components/MarkdownDocument";
import { WidgetFrame } from "../../components/WidgetFrame";
import { loadSurface } from "../../lib/api";
import {
  describeCanonicalTerm,
  labelDeliveryStatus,
  labelSelectionKind,
} from "../../lib/presentation";
import type {
  AmbiguityEntryView,
  CommentView,
  ManagerWorld,
  RequirementView,
  Selection,
  SurfaceData,
  TicketView,
  Tone,
} from "../../lib/types";
import { InspectorPanel } from "../inspector/InspectorPanel";

type RequirementsWorkspaceProps = {
  world: ManagerWorld;
  selection: Selection | null;
  selectedGraphId: string;
  onSelectSelection: (selection: Selection) => void;
};

type RequirementFilter = {
  id:
    | "all"
    | "blocked"
    | "active"
    | "missing_acceptance"
    | "missing_tests"
    | "missing_code";
  label: string;
  tone: Tone;
  description: string;
  matches: (requirement: RequirementView) => boolean;
};

type NavigatorTabId = "intent" | "product" | "goals" | "requirements";

type NavigatorTab = {
  id: NavigatorTabId;
  label: string;
  title: string;
  summary: string;
  path?: string;
};

type RequirementTrackingLens = {
  id: "accounting_ledger" | "transformation_provenance";
  label: string;
  summary: string;
  primaryRequirementId: string;
  relatedRequirementIds: string[];
};

const REQUIREMENT_FILTERS: RequirementFilter[] = [
  {
    id: "all",
    label: "Total Requirements",
    tone: "converged",
    description: "The full projected backlog from the live requirement surface.",
    matches: () => true,
  },
  {
    id: "blocked",
    label: "Blocked",
    tone: "blocked",
    description: "Requirements currently carrying blocked or pending-capability posture.",
    matches: (requirement) => requirement.delivery_status === "blocked",
  },
  {
    id: "active",
    label: "In Progress",
    tone: "active",
    description: "Requirements with partial downstream realization already visible.",
    matches: (requirement) => requirement.delivery_status === "active",
  },
  {
    id: "missing_acceptance",
    label: "Missing Acceptance",
    tone: "attention",
    description: "Requirements that do not yet publish explicit acceptance criteria.",
    matches: (requirement) => requirement.acceptance_criteria.length === 0,
  },
  {
    id: "missing_tests",
    label: "Missing Test Authority",
    tone: "attention",
    description: "Requirements with no linked testcase authority or test evidence references.",
    matches: (requirement) => testEvidenceCount(requirement) === 0,
  },
  {
    id: "missing_code",
    label: "Missing Implementation",
    tone: "pending",
    description: "Requirements with no linked implementation or code evidence surfaces.",
    matches: (requirement) => implementationEvidenceCount(requirement) === 0,
  },
];

const REQUIREMENTS_EXPLORER_LIST_ID = "requirements-explorer-list";

const NAVIGATOR_TABS: NavigatorTab[] = [
  {
    id: "intent",
    label: "Intent",
    title: "Intent entry point",
    summary: "The constitutional purpose boundary the product wave is meant to satisfy.",
    path: "specification/INTENT.md",
  },
  {
    id: "product",
    label: "Product",
    title: "Product entry point",
    summary: "The product definition that shapes the operating object, terms, and expected behavior.",
    path: "specification/PRODUCT.md",
  },
  {
    id: "goals",
    label: "Goals",
    title: "Goals entry point",
    summary: "The active bounded wave of work and current project posture that produce the live backlog.",
    path: "specification/GOALS.md",
  },
  {
    id: "requirements",
    label: "Requirements",
    title: "Requirements entry point",
    summary: "The projected backlog and its traceability into design, implementation, proof, work tracking, and discussion.",
  },
];

const REQUIREMENT_TRACKING_LENSES: RequirementTrackingLens[] = [
  {
    id: "accounting_ledger",
    label: "Accounting Ledger",
    summary: "Ledger output, accounting balance, and run completion gating across edge traversal.",
    primaryRequirementId: "REQ-ACC-002",
    relatedRequirementIds: ["REQ-ACC-001", "REQ-ACC-004", "REQ-ENG-004"],
  },
  {
    id: "transformation_provenance",
    label: "Transformation Provenance",
    summary: "Run manifest, lineage, and audit traceability carried through transformation.",
    primaryRequirementId: "REQ-TRV-005",
    relatedRequirementIds: ["REQ-TRV-005-A", "REQ-TRV-005-B", "REQ-INT-003"],
  },
];

const PREFERRED_REQUIREMENT_IDS = REQUIREMENT_TRACKING_LENSES.map(
  (lens) => lens.primaryRequirementId,
);

export function RequirementsWorkspace({
  world,
  selection,
  selectedGraphId,
  onSelectSelection,
}: RequirementsWorkspaceProps) {
  const requirements = useMemo(
    () => [...world.domain.requirements].sort(compareRequirements),
    [world.domain.requirements],
  );
  const selectedRequirementId = selection?.kind === "requirement" ? selection.id : null;
  const [search, setSearch] = useState("");
  const [activeFilterId, setActiveFilterId] = useState<RequirementFilter["id"]>("all");
  const [activeTabId, setActiveTabId] = useState<NavigatorTabId>("requirements");
  const [focusedRequirementId, setFocusedRequirementId] = useState<string | null>(
    selectedRequirementId,
  );
  const [explorerFocusToken, setExplorerFocusToken] = useState(0);

  useEffect(() => {
    if (selectedRequirementId) {
      setFocusedRequirementId(selectedRequirementId);
    }
  }, [selectedRequirementId]);

  useEffect(() => {
    if (selection?.kind !== "surface") {
      return;
    }
    const matchingTab = NAVIGATOR_TABS.find((tab) => tab.path === selection.id);
    if (matchingTab) {
      setActiveTabId(matchingTab.id);
    }
  }, [selection]);

  const activeFilter =
    REQUIREMENT_FILTERS.find((filter) => filter.id === activeFilterId) ?? REQUIREMENT_FILTERS[0];
  const activeTab =
    NAVIGATOR_TABS.find((tab) => tab.id === activeTabId) ?? NAVIGATOR_TABS[NAVIGATOR_TABS.length - 1];
  const trackingLenses = useMemo(
    () =>
      REQUIREMENT_TRACKING_LENSES.filter((lens) =>
        requirements.some((requirement) => requirement.requirement_id === lens.primaryRequirementId),
      ),
    [requirements],
  );
  const visibleRequirements = useMemo(
    () =>
      requirements.filter(
        (requirement) =>
          activeFilter.matches(requirement) && matchesRequirementSearch(requirement, search),
      ),
    [activeFilter, requirements, search],
  );
  const preferredVisibleRequirement = useMemo(
    () => pickDefaultRequirement(visibleRequirements, trackingLenses),
    [trackingLenses, visibleRequirements],
  );

  useEffect(() => {
    if (selectedRequirementId) {
      return;
    }
    if (!focusedRequirementId && preferredVisibleRequirement) {
      setFocusedRequirementId(preferredVisibleRequirement.requirement_id);
      return;
    }
    if (
      focusedRequirementId &&
      visibleRequirements.length &&
      !visibleRequirements.some((requirement) => requirement.requirement_id === focusedRequirementId)
    ) {
      setFocusedRequirementId(
        preferredVisibleRequirement?.requirement_id ?? visibleRequirements[0].requirement_id,
      );
    }
  }, [
    focusedRequirementId,
    preferredVisibleRequirement,
    selectedRequirementId,
    visibleRequirements,
  ]);

  const effectiveRequirementId = selectedRequirementId ?? focusedRequirementId;
  const focusedRequirement =
    requirements.find((requirement) => requirement.requirement_id === effectiveRequirementId) ??
    preferredVisibleRequirement ??
    visibleRequirements[0] ??
    requirements[0] ??
    null;

  const linkedTickets = focusedRequirement
    ? resolveLinkedTickets(focusedRequirement, world.domain.tickets)
    : [];
  const linkedComments = focusedRequirement
    ? resolveLinkedComments(focusedRequirement, world.domain.comments)
    : [];
  const linkedAmbiguities = focusedRequirement
    ? resolveLinkedAmbiguities(focusedRequirement, world.domain.ambiguity_register.ambiguities)
    : [];
  const drilldownSelection = selection && selection.kind !== "requirement" ? selection : null;

  const focusExplorer = () => {
    setExplorerFocusToken((current) => current + 1);
  };

  const handleSelectFilter = (filterId: RequirementFilter["id"]) => {
    setActiveFilterId(filterId);
    focusExplorer();
  };

  const handleClearFilter = () => {
    setActiveFilterId("all");
    focusExplorer();
  };

  const handleClearSearch = () => {
    setSearch("");
    focusExplorer();
  };

  if (!requirements.length) {
    return (
      <div className="workspace-view requirements-page">
        <section className="panel panel--context">
          <div className="empty-state">
            <strong>No requirements are projected.</strong>
            <p>
              The current workspace did not publish any first-class requirement items under
              `specification/requirements/`.
            </p>
          </div>
        </section>
        <aside className="panel panel--context requirements-page__detail-panel">
          <div className="empty-state">
            <strong>Drilldown is unavailable.</strong>
            <p>Select a workspace with live requirement surfaces to populate the workbench.</p>
          </div>
        </aside>
      </div>
    );
  }

  return (
    <div className="workspace-view requirements-page">
      <div className="workspace-stack requirements-page__main">
        <BacklogNavigatorWidget
          activeTab={activeTab}
          allRequirements={requirements}
          requirements={visibleRequirements}
          totalRequirements={requirements.length}
          activeFilter={activeFilter}
          search={search}
          focusToken={explorerFocusToken}
          focusedRequirement={focusedRequirement}
          trackingLenses={trackingLenses}
          onSelectFilter={handleSelectFilter}
          onSelectTab={setActiveTabId}
          onSearchChange={setSearch}
          onClearFilter={handleClearFilter}
          onClearSearch={handleClearSearch}
          onSelectRequirement={(requirementId) => {
            setFocusedRequirementId(requirementId);
            onSelectSelection({ kind: "requirement", id: requirementId });
          }}
        >
          {activeTab.id === "requirements" ? (
            <RequirementWorkbench
              world={world}
              requirement={focusedRequirement}
              linkedTickets={linkedTickets}
              linkedComments={linkedComments}
              linkedAmbiguities={linkedAmbiguities}
              drilldownSelection={drilldownSelection}
              selectedGraphId={selectedGraphId}
              onSelectSelection={onSelectSelection}
            />
          ) : (
            <AuthorityWorkbench
              workspaceRoot={world.workspace_root}
              tab={activeTab}
              totalRequirements={requirements.length}
              onOpenBacklog={() => {
                setActiveTabId("requirements");
                setActiveFilterId("all");
                setSearch("");
                focusExplorer();
              }}
            />
          )}
        </BacklogNavigatorWidget>
      </div>
    </div>
  );
}

function BacklogNavigatorWidget({
  activeTab,
  allRequirements,
  requirements,
  totalRequirements,
  activeFilter,
  search,
  focusToken,
  focusedRequirement,
  trackingLenses,
  onSelectFilter,
  onSelectTab,
  onSearchChange,
  onClearFilter,
  onClearSearch,
  onSelectRequirement,
  children,
}: {
  activeTab: NavigatorTab;
  allRequirements: RequirementView[];
  requirements: RequirementView[];
  totalRequirements: number;
  activeFilter: RequirementFilter;
  search: string;
  focusToken: number;
  focusedRequirement: RequirementView | null;
  trackingLenses: RequirementTrackingLens[];
  onSelectFilter: (filterId: RequirementFilter["id"]) => void;
  onSelectTab: (tabId: NavigatorTabId) => void;
  onSearchChange: (value: string) => void;
  onClearFilter: () => void;
  onClearSearch: () => void;
  onSelectRequirement: (requirementId: string) => void;
  children: ReactNode;
}) {
  const activeQueryRef = useRef<HTMLDivElement | null>(null);
  const normalizedSearch = search.trim();

  useEffect(() => {
    if (focusToken === 0) {
      return;
    }
    activeQueryRef.current?.scrollIntoView({ block: "nearest" });
    activeQueryRef.current?.focus();
  }, [focusToken]);

  const querySummary = describeRequirementQuery({
    activeFilter,
    focusedRequirement,
    visibleCount: requirements.length,
    totalCount: totalRequirements,
    search: normalizedSearch,
  });

  return (
    <WidgetFrame
      eyebrow="Backlog Navigator"
      title="Saved views govern the explorer and requirement workbench below."
      summary="This navigator owns the saved backlog views, active query state, explorer, and requirement detail because they all operate over the same backing set."
      badge={
        <span className="status-chip active">
          {requirements.length} of {totalRequirements}
        </span>
      }
    >
      <div className="requirements-navigator">
        <div className="requirements-source-tabs" role="tablist" aria-label="Backlog source tabs">
          {NAVIGATOR_TABS.map((tab) => {
            const isSelected = tab.id === activeTab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`requirements-source-tab ${isSelected ? "is-selected" : ""}`}
                onClick={() => onSelectTab(tab.id)}
              >
                <strong>{tab.label}</strong>
                <span>{tab.summary}</span>
              </button>
            );
          })}
        </div>

        <div className="requirements-navigator__views">
          <div className="requirements-explorer__section-heading">
            <span className="panel__eyebrow">{activeTab.label}</span>
            <p>{activeTab.summary}</p>
          </div>
          {activeTab.id === "requirements" ? (
            <div className="requirements-tab-grid" role="tablist" aria-label="Backlog views">
              {REQUIREMENT_FILTERS.map((filter) => {
                const count = allRequirements.filter(filter.matches).length;
                const isSelected = activeFilter.id === filter.id;
                return (
                  <button
                    key={filter.id}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-controls={REQUIREMENTS_EXPLORER_LIST_ID}
                    className={`requirements-tab ${isSelected ? "is-selected" : ""}`}
                    onClick={() => onSelectFilter(filter.id)}
                  >
                    <div className="requirements-tab__meta">
                      <strong>{filter.label}</strong>
                      <span className={`status-chip ${filter.tone}`}>{count}</span>
                    </div>
                    <p>{filter.description}</p>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="requirements-authority-summary">
              <div className="odd-card">
                <span className="panel__eyebrow">Source Surface</span>
                <strong>{activeTab.path}</strong>
                <p>{activeTab.title}</p>
              </div>
              <div className="odd-card">
                <span className="panel__eyebrow">Published Requirements</span>
                <strong>{totalRequirements}</strong>
                <p>The current backlog is derived downstream from this constitutional source set.</p>
              </div>
            </div>
          )}
        </div>

        {activeTab.id === "requirements" ? (
          <div
            ref={activeQueryRef}
            tabIndex={-1}
            className="requirements-explorer__query"
            aria-live="polite"
          >
            <div className="requirements-explorer__query-heading">
              <span className="panel__eyebrow">Active Query</span>
              <span className={`status-chip ${activeFilter.tone}`}>{activeFilter.label}</span>
            </div>
            <strong>{querySummary.headline}</strong>
            <p>{querySummary.summary}</p>
            <div className="inline-pills">
              {normalizedSearch ? (
                <span className="status-chip attention">Search: {normalizedSearch}</span>
              ) : null}
              {focusedRequirement ? (
                <span className="status-chip converged">
                  Focused: {focusedRequirement.requirement_id}
                </span>
              ) : null}
              {activeFilter.id !== "all" ? (
                <button type="button" className="status-chip converged" onClick={onClearFilter}>
                  Clear Filter
                </button>
              ) : null}
              {normalizedSearch ? (
                <button type="button" className="status-chip converged" onClick={onClearSearch}>
                  Clear Search
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {activeTab.id === "requirements" && trackingLenses.length ? (
          <div className="requirements-authority-summary">
            {trackingLenses.map((lens) => (
              <button
                key={lens.id}
                type="button"
                className="odd-card odd-card--interactive"
                onClick={() => onSelectRequirement(lens.primaryRequirementId)}
              >
                <span className="panel__eyebrow">Active Tracking Asset</span>
                <strong>
                  {lens.label} · {lens.primaryRequirementId}
                </strong>
                <p>{lens.summary}</p>
                <div className="inline-pills">
                  {lens.relatedRequirementIds.map((requirementId) => (
                    <span key={`${lens.id}:${requirementId}`} className="status-chip attention">
                      {requirementId}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        ) : null}

        <div className="requirements-page__lens">
          {activeTab.id === "requirements" ? (
            <div className="requirements-page__explorer">
              <div className="requirements-explorer__controls">
                <div className="requirements-explorer__section-heading">
                  <span className="panel__eyebrow">Requirement Explorer</span>
                  <p>Select a requirement to anchor the workbench.</p>
                </div>
                <input
                  value={search}
                  onChange={(event) => onSearchChange(event.target.value)}
                  placeholder="Search requirements by id, title, summary, family, or trace reference"
                  aria-label="Search requirements"
                />
              </div>

              <div id={REQUIREMENTS_EXPLORER_LIST_ID} className="requirements-explorer__list">
                <div className="list-stack">
                  {requirements.length ? (
                    requirements.map((requirement) => (
                      <button
                        key={requirement.requirement_id}
                        type="button"
                        className={`list-row ${focusedRequirement?.requirement_id === requirement.requirement_id ? "is-selected" : ""}`}
                        onClick={() => onSelectRequirement(requirement.requirement_id)}
                      >
                        <div className="list-row__meta">
                          <span className="panel__eyebrow">{requirement.priority ?? "Requirement"}</span>
                          <span className={`status-chip ${requirement.delivery_status}`}>
                            {labelDeliveryStatus(requirement.status ?? requirement.delivery_status)}
                          </span>
                        </div>
                        <strong className="list-row__title">
                          {requirement.requirement_id} · {requirement.title}
                        </strong>
                        <p className="list-row__summary">
                          {requirement.summary} Implementation{" "}
                          {implementationEvidenceCount(requirement)} · Tests{" "}
                          {testEvidenceCount(requirement)} · Acceptance{" "}
                          {requirement.acceptance_criteria.length}
                        </p>
                      </button>
                    ))
                  ) : (
                    <div className="empty-state">
                      <strong>No requirements match the current query.</strong>
                      <p>Clear the active filter or widen the search to restore the backlog list.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="requirements-page__explorer">
              <div className="requirements-explorer__section-heading">
                <span className="panel__eyebrow">Constitutional Source</span>
                <p>{activeTab.title}</p>
              </div>
              <div className="list-stack">
                <div className="list-row is-selected">
                  <div className="list-row__meta">
                    <span className="panel__eyebrow">{activeTab.label}</span>
                    <span className="status-chip converged">source</span>
                  </div>
                  <strong className="list-row__title">{activeTab.path}</strong>
                  <p className="list-row__summary">
                    {activeTab.summary} This source stays above the backlog and explains why the
                    requirement surface exists.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="requirements-page__workbench">
            {children}
          </div>
        </div>
      </div>
    </WidgetFrame>
  );
}

function AuthorityWorkbench({
  workspaceRoot,
  tab,
  totalRequirements,
  onOpenBacklog,
}: {
  workspaceRoot: string;
  tab: NavigatorTab;
  totalRequirements: number;
  onOpenBacklog: () => void;
}) {
  const [surface, setSurface] = useState<SurfaceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tab.path) {
      setSurface(null);
      setLoading(false);
      setError(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    void loadSurface(workspaceRoot, tab.path)
      .then((result) => {
        if (!cancelled) {
          setSurface(result);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : String(caught));
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tab.path, workspaceRoot]);

  return (
    <div className="workspace-stack">
      <WidgetFrame
        eyebrow={`${tab.label} Workbench`}
        title={tab.title}
        summary={tab.summary}
        badge={<span className="status-chip active">{totalRequirements} requirements</span>}
      >
        <div className="odd-card-grid odd-card-grid--two">
          <div className="odd-card">
            <span className="panel__eyebrow">Source Path</span>
            <strong>{tab.path}</strong>
            <p>Constitutional document currently backing this entry point.</p>
          </div>
          <button
            type="button"
            className="odd-card odd-card--interactive"
            onClick={onOpenBacklog}
          >
            <span className="panel__eyebrow">Backlog Reach</span>
            <strong>{totalRequirements}</strong>
            <p>Published requirements currently projected beneath this constitutional layer.</p>
          </button>
        </div>
      </WidgetFrame>

      <WidgetFrame
        eyebrow={`${tab.label} Surface`}
        title={tab.path ?? tab.label}
        summary="The constitutional source is rendered directly here so the page starts from human-readable authority before dropping into backlog detail."
      >
        {loading ? (
          <div className="empty-state">
            <strong>Loading surface.</strong>
            <p>{tab.path}</p>
          </div>
        ) : error ? (
          <div className="empty-state">
            <strong>Surface could not be loaded.</strong>
            <p>{error}</p>
          </div>
        ) : !surface || surface.kind === "missing" ? (
          <div className="empty-state">
            <strong>Surface is missing.</strong>
            <p>{tab.path}</p>
          </div>
        ) : surface.kind === "file" ? (
          <div className="requirements-authority__document">
            {surface.relative_path.endsWith(".md") ? (
              <MarkdownDocument content={surface.content} />
            ) : (
              <pre className="markdown-viewer__code-block">{surface.content}</pre>
            )}
          </div>
        ) : (
          <div className="empty-state">
            <strong>Expected a document-backed surface.</strong>
            <p>{tab.path}</p>
          </div>
        )}
      </WidgetFrame>
    </div>
  );
}

function RequirementWorkbench({
  world,
  requirement,
  linkedTickets,
  linkedComments,
  linkedAmbiguities,
  drilldownSelection,
  selectedGraphId,
  onSelectSelection,
}: {
  world: ManagerWorld;
  requirement: RequirementView | null;
  linkedTickets: TicketView[];
  linkedComments: CommentView[];
  linkedAmbiguities: AmbiguityEntryView[];
  drilldownSelection: Selection | null;
  selectedGraphId: string;
  onSelectSelection: (selection: Selection) => void;
}) {
  if (!requirement) {
    return (
      <WidgetFrame
        eyebrow="Requirement Workbench"
        title="No requirement is currently focused."
        summary="Select a requirement from the explorer to populate the downstream workbench."
        defaultCollapsed={false}
      >
        <div className="empty-state">
          <strong>No focused requirement.</strong>
          <p>The requirement workbench populates once a backlog item is selected.</p>
        </div>
      </WidgetFrame>
    );
  }

  const requirementRefs = uniqueRefs([
    ...requirement.traces_to,
    ...requirement.derives_from,
    requirement.source_path,
  ]);
  const designRefs = uniqueRefs([
    ...filterSurfaceRefs(requirement.derives_from),
    ...filterSurfaceRefs(requirement.authority_refs),
    ...filterSurfaceRefs(requirement.current_requirement_refs),
  ]);
  const implementationRefs = uniqueRefs([
    ...filterSurfaceRefs(requirement.implementation_claim_refs),
    ...filterSurfaceRefs(requirement.code_refs),
  ]);
  const moduleAreas = deriveModuleAreas(implementationRefs);
  const testRefs = uniqueRefs([
    ...filterSurfaceRefs(requirement.testcase_authority_refs),
    ...filterSurfaceRefs(requirement.test_claim_refs),
    ...filterSurfaceRefs(requirement.planned_test_claim_refs),
    ...filterSurfaceRefs(requirement.test_refs),
  ]);
  const activityItems = buildActivityItems(linkedTickets, linkedComments);

  return (
    <div className="workspace-stack">
      <WidgetFrame
        eyebrow="Requirement Workbench"
        title={`${requirement.requirement_id} · ${requirement.title}`}
        summary="The requirement remains the framing object while you move through design, implementation, proof, work tracking, and discussion."
        badge={<span className={`status-chip ${requirement.delivery_status}`}>{labelDeliveryStatus(requirement.status ?? requirement.delivery_status)}</span>}
      >
        <div className="odd-card-grid odd-card-grid--two">
          <div className="odd-card">
            <span className="panel__eyebrow">Family</span>
            <strong>{requirement.family_title || requirement.family || "Unspecified"}</strong>
            <p>{describeCanonicalTerm(requirement.type, "Unspecified")}</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Priority</span>
            <strong>{requirement.priority ?? "Unspecified"}</strong>
            <p>{labelDeliveryStatus(requirement.status ?? requirement.delivery_status)}</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Implementation Evidence</span>
            <strong>{implementationEvidenceCount(requirement)}</strong>
            <p>Implementation claims and code surfaces currently linked to this requirement.</p>
          </div>
          <div className="odd-card">
            <span className="panel__eyebrow">Test Evidence</span>
            <strong>{testEvidenceCount(requirement)}</strong>
            <p>Test authority and test surface links currently projected for this requirement.</p>
          </div>
        </div>

        <div className="odd-card">
          <span className="panel__eyebrow">Human Summary</span>
          <strong>{requirement.title}</strong>
          <p>{requirement.summary}</p>
        </div>

        <ReferenceStrip
          title="Requirement Context"
          items={requirementRefs}
          emptyLabel="No upstream traces or governing references are currently published."
          onSelectSelection={onSelectSelection}
        />

        <div>
          <span className="panel__eyebrow">Acceptance Criteria</span>
          {requirement.acceptance_criteria.length ? (
            <div className="list-stack">
              {requirement.acceptance_criteria.map((criterion, index) => (
                <div key={`${requirement.requirement_id}:acceptance:${index}`} className="list-row">
                  <strong className="list-row__title">Acceptance {index + 1}</strong>
                  <p className="list-row__summary">{criterion}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <strong>No explicit acceptance criteria are published yet.</strong>
              <p>This requirement currently lacks a written acceptance surface.</p>
            </div>
          )}
        </div>
      </WidgetFrame>

      {drilldownSelection ? (
        <div className="requirements-inline-detail">
          <WidgetFrame
            eyebrow="Artifact Detail"
            title={`${labelSelectionKind(drilldownSelection.kind)} · ${drilldownSelection.id}`}
            summary="This drilldown stays inside the requirement workbench so the underlying surface remains visible in immediate requirement context."
            actions={
              <button
                type="button"
                className="requirements-inline-detail__hide"
                onClick={() =>
                  onSelectSelection({ kind: "requirement", id: requirement.requirement_id })
                }
              >
                Hide Detail
              </button>
            }
          >
            <div className="requirements-inline-detail__body">
              <InspectorPanel
                world={world}
                selection={drilldownSelection}
                selectedGraphId={selectedGraphId}
                onSelectSelection={onSelectSelection}
              />
            </div>
          </WidgetFrame>
        </div>
      ) : null}

      <WidgetFrame
        eyebrow="Requirement Activity"
        title="History and delivery movement around this requirement"
        summary="History is projected from linked ticket and comment records when those records exist."
        defaultCollapsed={activityItems.length === 0}
      >
        {activityItems.length ? (
          <div className="list-stack">
            {activityItems.map((item) => (
              <button
                key={item.id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "surface", id: item.sourcePath })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{item.eyebrow}</span>
                  <span className={`status-chip ${item.tone}`}>{item.when ?? "record"}</span>
                </div>
                <strong className="list-row__title">{item.title}</strong>
                <p className="list-row__summary">{item.summary}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No requirement-linked history is currently projected.</strong>
            <p>Add linked tickets or published comments to make requirement-local history inspectable here.</p>
          </div>
        )}
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Design Drilldown"
        title="Governing design and authority surfaces"
        summary="These are the design-facing and authority-facing surfaces that shape this requirement."
      >
        <ReferenceStrip
          title="Design Surfaces"
          items={designRefs}
          emptyLabel="No design or authority surfaces are currently linked."
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Implementation Drilldown"
        title="Modules and implementation surfaces"
        summary="Implementation stays readable as modules first, then underlying code and implementation claims."
      >
        <ReferenceStrip
          title="Module Areas"
          items={moduleAreas}
          emptyLabel="No module areas can be derived from the current implementation evidence."
          onSelectSelection={onSelectSelection}
        />
        <ReferenceStrip
          title="Implementation Surfaces"
          items={implementationRefs}
          emptyLabel="No implementation surfaces are currently linked."
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Test Authority"
        title="Acceptance, testcase authority, and proving surfaces"
        summary="This is the proof-facing surface for the selected requirement."
      >
        <ReferenceStrip
          title="Test Authority and Test Surfaces"
          items={testRefs}
          emptyLabel="No testcase authority or test surfaces are currently linked."
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Delivery Work"
        title="Durable tickets and bugs linked to this requirement"
        summary="Tickets remain the durable work authority. They do not collapse into the comment layer."
        defaultCollapsed={linkedTickets.length === 0}
      >
        <RecordList
          records={linkedTickets.map((ticket) => ({
            id: ticket.id,
            eyebrow: ticket.type ?? "Ticket",
            tone: ticket.status === "completed" ? "converged" : ticket.status === "blocked" ? "blocked" : "active",
            title: `${ticket.id} · ${ticket.title}`,
            summary: ticket.summary,
            sourcePath: ticket.source_path,
            metaLabel: ticket.goal ?? ticket.priority ?? "linked work item",
          }))}
          emptyTitle="No linked tickets are currently projected."
          emptySummary="Create or link durable tickets under `.ai-workspace/tickets/` to make requirement-local work tracking visible here."
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Discussion"
        title="Published comments and handoffs linked to this requirement"
        summary="Comments remain discussion and publication, not task-status authority. OddBoard remains available above as the ubiquitous live collaboration surface."
        defaultCollapsed={linkedComments.length === 0}
      >
        <RecordList
          records={linkedComments.map((comment) => ({
            id: comment.id,
            eyebrow: comment.author ?? comment.source ?? "Comment",
            tone: "attention" as const,
            title: comment.title,
            summary: comment.summary,
            sourcePath: comment.source_path,
            metaLabel: comment.date ?? comment.status ?? "published comment",
          }))}
          emptyTitle="No linked comments are currently projected."
          emptySummary="Published comments linked to this requirement will appear here once they reference the requirement or its backing surfaces."
          onSelectSelection={onSelectSelection}
        />
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Open Issues / Risks"
        title="Blockers, ambiguity, and local delivery risk"
        summary="Requirement-local risks stay explicit instead of being inferred from generic project drift."
        defaultCollapsed={linkedAmbiguities.length === 0}
      >
        {linkedAmbiguities.length ? (
          <div className="list-stack">
            {linkedAmbiguities.map((entry) => (
              <button
                key={entry.ambiguity_id}
                type="button"
                className="list-row"
                onClick={() => onSelectSelection({ kind: "ambiguity", id: entry.ambiguity_id })}
              >
                <div className="list-row__meta">
                  <span className="panel__eyebrow">{describeCanonicalTerm(entry.class)}</span>
                  <span className={`status-chip ${entry.blocking || entry.hard_stop ? "blocked" : "attention"}`}>
                    {labelDeliveryStatus(entry.decision_status || entry.status)}
                  </span>
                </div>
                <strong className="list-row__title">{entry.operator_headline}</strong>
                <p className="list-row__summary">
                  {entry.next_lawful_action || entry.current_resolution || entry.description}
                </p>
              </button>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <strong>No requirement-local ambiguity is currently projected.</strong>
            <p>
              Blockers will appear here when the ambiguity register references this requirement, its
              backing surfaces, or its proving surfaces.
            </p>
          </div>
        )}
      </WidgetFrame>

      <WidgetFrame
        eyebrow="Test Execution"
        title="Observed proving runs and results"
        summary="This widget is reserved for requirement-linked test execution once the runtime projection connects proving runs back to requirements."
        defaultCollapsed
      >
        <div className="empty-state">
          <strong>Requirement-linked execution is not yet projected.</strong>
          <p>
            Use the testcase authority widget and the runtime/evidence pages until installed-dev
            proving runs are linked back to the selected requirement.
          </p>
        </div>
      </WidgetFrame>
    </div>
  );
}

function RecordList({
  records,
  emptyTitle,
  emptySummary,
  onSelectSelection,
}: {
  records: Array<{
    id: string;
    eyebrow: string;
    tone: Tone;
    title: string;
    summary: string;
    sourcePath: string;
    metaLabel: string;
  }>;
  emptyTitle: string;
  emptySummary: string;
  onSelectSelection: (selection: Selection) => void;
}) {
  return records.length ? (
    <div className="list-stack">
      {records.map((record) => (
        <button
          key={record.id}
          type="button"
          className="list-row"
          onClick={() => onSelectSelection({ kind: "surface", id: record.sourcePath })}
        >
          <div className="list-row__meta">
            <span className="panel__eyebrow">{record.eyebrow}</span>
            <span className={`status-chip ${record.tone}`}>{record.metaLabel}</span>
          </div>
          <strong className="list-row__title">{record.title}</strong>
          <p className="list-row__summary">{record.summary}</p>
        </button>
      ))}
    </div>
  ) : (
    <div className="empty-state">
      <strong>{emptyTitle}</strong>
      <p>{emptySummary}</p>
    </div>
  );
}

function ReferenceStrip({
  title,
  items,
  emptyLabel,
  onSelectSelection,
}: {
  title: string;
  items: string[];
  emptyLabel: string;
  onSelectSelection: (selection: Selection) => void;
}) {
  return (
    <div>
      <span className="panel__eyebrow">{title}</span>
      <div className="inline-pills">
        {items.length ? (
          items.map((item) => {
            const selection = selectionForReference(item);
            return selection ? (
              <button
                key={`${title}:${item}`}
                type="button"
                className="status-chip converged"
                onClick={() => onSelectSelection(selection)}
              >
                {item}
              </button>
            ) : (
              <span key={`${title}:${item}`} className="status-chip attention">
                {item}
              </span>
            );
          })
        ) : (
          <span className="status-chip attention">{emptyLabel}</span>
        )}
      </div>
    </div>
  );
}

function selectionForReference(value: string): Selection | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^REQ-[A-Z0-9-]+$/.test(trimmed)) {
    return { kind: "requirement", id: trimmed };
  }
  if (isSurfaceLike(trimmed)) {
    return { kind: "surface", id: trimmed.startsWith("./") ? trimmed.slice(2) : trimmed };
  }
  return null;
}

function compareRequirements(left: RequirementView, right: RequirementView) {
  const leftPreferred = PREFERRED_REQUIREMENT_IDS.indexOf(left.requirement_id);
  const rightPreferred = PREFERRED_REQUIREMENT_IDS.indexOf(right.requirement_id);
  if (leftPreferred !== -1 || rightPreferred !== -1) {
    const normalizedLeft = leftPreferred === -1 ? Number.MAX_SAFE_INTEGER : leftPreferred;
    const normalizedRight = rightPreferred === -1 ? Number.MAX_SAFE_INTEGER : rightPreferred;
    if (normalizedLeft !== normalizedRight) {
      return normalizedLeft - normalizedRight;
    }
  }
  const byPriority = priorityRank(right.priority) - priorityRank(left.priority);
  if (byPriority !== 0) {
    return byPriority;
  }
  const byTone = toneRank(left.delivery_status) - toneRank(right.delivery_status);
  if (byTone !== 0) {
    return byTone;
  }
  return left.requirement_id.localeCompare(right.requirement_id);
}

function pickDefaultRequirement(
  requirements: RequirementView[],
  trackingLenses: RequirementTrackingLens[],
) {
  if (!requirements.length) {
    return null;
  }
  const byId = new Map(requirements.map((requirement) => [requirement.requirement_id, requirement]));
  for (const lens of trackingLenses) {
    const match = byId.get(lens.primaryRequirementId);
    if (match) {
      return match;
    }
  }
  return requirements[0] ?? null;
}

function priorityRank(priority: string | null | undefined) {
  const value = priority?.trim().toLowerCase();
  if (value === "critical") {
    return 4;
  }
  if (value === "high") {
    return 3;
  }
  if (value === "medium") {
    return 2;
  }
  if (value === "low") {
    return 1;
  }
  return 0;
}

function toneRank(tone: Tone) {
  if (tone === "blocked") {
    return 0;
  }
  if (tone === "attention") {
    return 1;
  }
  if (tone === "active") {
    return 2;
  }
  if (tone === "pending") {
    return 3;
  }
  if (tone === "gated") {
    return 4;
  }
  return 5;
}

function matchesRequirementSearch(requirement: RequirementView, query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  return [
    requirement.requirement_id,
    requirement.title,
    requirement.summary,
    requirement.family,
    requirement.family_title,
    ...requirement.traces_to,
    ...requirement.derives_from,
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalized);
}

function testEvidenceCount(requirement: RequirementView) {
  return (
    requirement.test_refs.length +
    requirement.test_claim_refs.length +
    requirement.planned_test_claim_refs.length +
    requirement.testcase_authority_refs.length
  );
}

function implementationEvidenceCount(requirement: RequirementView) {
  return requirement.code_refs.length + requirement.implementation_claim_refs.length;
}

function uniqueRefs(items: string[]) {
  return [...new Set(items.map((item) => item.trim()).filter(Boolean))];
}

function isSurfaceLike(value: string) {
  return value.includes("/") || /\.(md|tsx?|jsx?|py|mjs|json|ya?ml|scala|java|kt)$/i.test(value);
}

function filterSurfaceRefs(items: string[]) {
  return uniqueRefs(items.filter((item) => isSurfaceLike(item)));
}

function deriveModuleAreas(items: string[]) {
  return uniqueRefs(
    items.map((item) => {
      if (item.includes("/src/")) {
        return item.split("/src/")[0] ?? item;
      }
      if (item.includes("/tests/")) {
        return item.split("/tests/")[0] ?? item;
      }
      const segments = item.split("/");
      return segments.length > 1 ? segments.slice(0, -1).join("/") : item;
    }),
  );
}

function resolveLinkedTickets(requirement: RequirementView, tickets: TicketView[]) {
  return tickets
    .filter((ticket) =>
      ticket.linked_requirement_ids.includes(requirement.requirement_id) ||
      ticket.linked_surfaces.includes(requirement.source_path),
    )
    .sort((left, right) => (right.updated_at ?? right.created_at ?? "").localeCompare(left.updated_at ?? left.created_at ?? ""));
}

function resolveLinkedComments(requirement: RequirementView, comments: CommentView[]) {
  return comments
    .filter((comment) =>
      comment.linked_requirement_ids.includes(requirement.requirement_id) ||
      comment.linked_surfaces.includes(requirement.source_path),
    )
    .sort((left, right) => (right.date ?? "").localeCompare(left.date ?? ""));
}

function resolveLinkedAmbiguities(
  requirement: RequirementView,
  ambiguities: AmbiguityEntryView[],
) {
  const requirementRefs = new Set<string>([
    requirement.requirement_id,
    requirement.source_path,
    ...requirement.authority_refs,
    ...requirement.current_requirement_refs,
    ...requirement.testcase_authority_refs,
  ]);
  return ambiguities.filter((entry) => {
    if (
      entry.evidence_refs.some((ref) => requirementRefs.has(ref)) ||
      entry.invariant_refs.some((ref) => requirementRefs.has(ref))
    ) {
      return true;
    }
    const narrative = [entry.description, entry.operator_headline, entry.current_resolution]
      .join(" ")
      .toLowerCase();
    return narrative.includes(requirement.requirement_id.toLowerCase());
  });
}

function buildActivityItems(tickets: TicketView[], comments: CommentView[]) {
  return [
    ...tickets.map((ticket) => ({
      id: `ticket:${ticket.id}`,
      eyebrow: ticket.type ?? "Ticket",
      tone:
        ticket.status === "completed"
          ? ("converged" as const)
          : ticket.status === "blocked"
            ? ("blocked" as const)
            : ("active" as const),
      title: `${ticket.id} · ${ticket.title}`,
      summary: ticket.summary,
      when: ticket.updated_at ?? ticket.created_at,
      sourcePath: ticket.source_path,
    })),
    ...comments.map((comment) => ({
      id: `comment:${comment.id}`,
      eyebrow: comment.author ?? comment.source ?? "Comment",
      tone: "attention" as const,
      title: comment.title,
      summary: comment.summary,
      when: comment.date,
      sourcePath: comment.source_path,
    })),
  ].sort((left, right) => (right.when ?? "").localeCompare(left.when ?? ""));
}

function describeRequirementQuery({
  activeFilter,
  focusedRequirement,
  visibleCount,
  totalCount,
  search,
}: {
  activeFilter: RequirementFilter;
  focusedRequirement: RequirementView | null;
  visibleCount: number;
  totalCount: number;
  search: string;
}) {
  const noun = visibleCount === 1 ? "requirement" : "requirements";
  const headline =
    activeFilter.id === "all"
      ? `Showing ${visibleCount} of ${totalCount} ${noun} in the live backlog.`
      : `Showing ${visibleCount} ${noun} for ${activeFilter.label.toLowerCase()}.`;

  const summaryParts = [
    activeFilter.description,
    search ? `Search is narrowing the result set with “${search}”.` : null,
    focusedRequirement
      ? `${focusedRequirement.requirement_id} is currently framing the workbench.`
      : "Select a requirement to anchor the downstream workbench.",
  ];

  return {
    headline,
    summary: summaryParts.filter(Boolean).join(" "),
  };
}
