# Orientation And Navigation

**Family**: `REQ-OM-NAV-*`
**Status**: Active
**Category**: Capability
**Derives From**: `specification/PRODUCT.md`, `build_tenants/common/design/ODD_MANAGER_DASHBOARD.md`

### REQ-OM-NAV-001 - The home surface answers immediate supervisory questions

The product shall provide a home surface that answers the practical questions
an operator must resolve first.

Acceptance Criteria
- the home surface shows what is active, what is blocked, what changed, and
  what needs attention
- the home surface can point to the next lawful move or next waiting condition
- the home surface can show the currently relevant runtime carrier and open
  obligations without forcing immediate deep drill-down

### REQ-OM-NAV-002 - The primary orientation surface is a graph workspace

The main operator experience shall orient the user through a navigable graph
workspace over typed assets and workorders rather than relying on tables, raw
logs, or filesystem browsing as the first navigation model.

Acceptance Criteria
- the orientation surface can show one or more graphs in the current workspace
- the graph view makes the main typed assets, bindings, and workorders legible
  at a glance
- the graph can show active, open, blocked, and gated state where relevant
- the graph gives enough orientation to explain where the current concern lives
  in the larger managed world

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
