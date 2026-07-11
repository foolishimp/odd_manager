# Orientation And Navigation

**Family**: `REQ-OM-NAV-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/INTENT.md`, `specification/PRODUCT.md`

### REQ-OM-NAV-001 - The home surface answers immediate supervisory questions

The product shall provide a Project Portfolio home surface that answers the
practical questions a developer must resolve first across registered Projects.

Acceptance Criteria
- the home surface shows what is active, what is blocked, what changed, and
  what needs attention
- the home surface can point to the next lawful move or next waiting condition
- the home surface can show the currently relevant runtime carrier and open
  obligations without forcing immediate deep drill-down
- the home surface keeps Project, revision, build, assurance, freshness, and
  attention identity distinct across the portfolio

### REQ-OM-NAV-002 - Primary orientation follows the developer control loop

The main developer experience shall orient the user through the Project
Portfolio and selected Project Workbench rather than through raw artifacts,
logs, terminals, or one runtime view as the first navigation model.

Acceptance Criteria
- the portfolio answers which Projects require attention
- the Project Workbench frames Review, Tune, Build, and Assure over one Context
- graph, runtime, artifact, file, ticket, and shell capabilities remain
  reachable as supporting observations and tools
- orientation preserves active, open, blocked, gated, stale, and waiting-human
  meaning across levels

### REQ-OM-NAV-003 - The operator can move between multiple graphs without losing context

When the workspace exposes multiple graphs, the product shall let the operator
move between them without losing larger workspace context.

Acceptance Criteria
- the operator can tell which graph is currently selected
- the product can show graph-local focus while preserving graph-set context
- switching graphs does not reset unrelated workspace context unnecessarily

### REQ-OM-NAV-004 - Simplified topology remains traceable to underlying truth

The product may simplify topology for human orientation, but that simplification
shall remain traceable to underlying authoritative truth.

Acceptance Criteria
- simplified layout emphasizes logical relationships and operator orientation
  over literal storage structure
- simplification does not hide evidence, provenance, or underlying object
  identity
- the operator can move from the simplified graph to the underlying objects and
  supporting surfaces that justify it

### REQ-OM-NAV-005 - Drill-down stays tethered to visible world context

Detailed understanding of a selected object shall remain tethered to visible
world context so the operator does not lose big-picture orientation while
inspecting local detail.

Acceptance Criteria
- the orientation surface remains visible during ordinary drill-down except
  where narrow layouts require stacked presentation
- selection highlights the current local focus while preserving enough nearby
  context to explain consequence and dependency
- the product does not require a full-page context switch for ordinary object
  inspection

### REQ-OM-NAV-006 - Compressed and expanded navigation modes share one world model

The product shall support both compressed and expanded navigation modes as
projections of the same underlying world model.

Acceptance Criteria
- compressed and expanded modes preserve one selection and highlighting model
- switching modes does not invent a second status model or alternate truth
- changes in active work, continuations, or blockage are reflected consistently
  across both modes

### REQ-OM-NAV-007 - Derived lenses remain truthful and object-appropriate

The product shall support derived operator lenses that emphasize different
questions without distorting object truth.

Acceptance Criteria
- a lens can emphasize builder, runtime, closure, or another supervisory
  concern over the same underlying world
- a lens can hide irrelevant detail without silently discarding underlying
  obligations
- the operator can tell which obligations are central to the current lens and
  which remain present outside that lens

### REQ-OM-NAV-008 - Orientation surfaces share one published visual language

The product shall use one published visual language across shell, graph
workspace, overview surfaces, and local inspection so operators do not have to
relearn state meaning while moving between views.

Acceptance Criteria
- shell, graph workspace, overview, inspector, and status chips share one
  token set for color, typography, elevation, and radius
- active, converged, gated, blocked, and pending state meanings remain visually
  consistent across graph routes, nodes, and local detail surfaces
- alternate theme variants preserve the same semantic mapping and compositional
  language

### REQ-OM-NAV-009 - The graph workspace keeps a dense supervisory spatial aesthetic

The graph workspace shall present graphs with a dense supervisory spatial
aesthetic rather than flattening them into generic diagrams or node editors.

Acceptance Criteria
- graph surfaces use layered panels, rounded nodes, route segments, and compact
  status pulses that support rapid supervisory scanning
- graph surfaces include local orientation aids such as overview or minimap
  surfaces and lightweight overlay controls
- emphasis, selection, relatedness, and muted state are legible without
  obscuring object identity or evidence access

### REQ-OM-NAV-010 - The common loader chooses identity-appropriate landing pages

The product shall start from one common workspace loader that resolves the
selected workspace's primary identity before opening domain-specific landing
pages.

Acceptance Criteria
- the operator chooses a workspace through one common loader surface rather
  than through separate per-domain launchers
- after selection, the manager resolves the workspace's primary identity before
  admitting domain capability contributions to the Project Workbench
- the Project Workbench remains the common goal-oriented landing surface while
  identity-specific capability contributions can differ between product lines
  without forking the whole shell or hard-coding a product list
- if identity cannot be resolved confidently, the manager falls back to an
  explicit compatibility or unknown-identity state rather than silently
  choosing the wrong domain landing page

### REQ-OM-NAV-011 - Non-ODD Projects remain admissible for generic workspace use

The manager shall allow the operator to register and open Projects that do not
yet carry an `odd_*` identity.

Acceptance Criteria
- the Workspace Tool can add and remove filesystem roots whose identity is
  `unknown`, non-ODD, or pre-bootstrap
- generic Project/file capabilities such as Browse, pinned folders, recent
  path memory, code/document viewing, and shell workspace remain available for
  those Projects
- capability-specific widgets such as Run Inspector show an explicit
  unsupported or missing state when their required carriers are absent
- `specification_methodology` and other method/source repositories can be
  registered for inspection without being assigned a false product identity

### REQ-OM-NAV-012 - Registered Projects are directly addressable by local-path deep links

The common loader shall accept an absolute local Project path in the browser
URL and resolve it through the maintained Project registry before activating
that Project.

Acceptance Criteria
- a deep-linked registered Project path takes precedence over persisted browser
  context and the registry's previously active Project during initial load
- deep-link admission matches a registered Project root exactly and does not
  register an unknown filesystem location as a side effect of navigation
- malformed, relative, or unregistered paths produce an explicit loader error
  and fall back to a registered active or manager Project
- generated run roots and run workspaces remain subordinate observation
  topology and are not promoted into Project identity by a deep link
- after initial resolution and ordinary Project switching, the browser URL
  carries the selected absolute Project root as a copyable deep link
- a Project-only deep link opens the Project Workbench rather than an empty
  viewer canvas or a supporting observation tab; `view=run-inspector` and
  `view=ticket-board` may directly select those admitted manager surfaces
