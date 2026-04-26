# REVIEW: STDO Self-Review of the T-005..T-012 Build Wave

**Author**: Claude
**Date**: 2026-04-26T16:00:00Z
**Addresses**: `.ai-workspace/tickets/backlog/T-005..T-012`; `comments/claude/20260424T140000Z_STRATEGY_odd-manager-sidecar-and-project-agent-widget.md`; `specification_methodology/specification/standards/{SPEC_METHOD,TICKET_METHOD,DESIGN_MODULE_METHOD,ODD_METHOD}.md`
**Status**: Draft

## Summary

This is a self-review of the eight-ticket build wave (`T-005` through
`T-012`) authored 2026-04-26 to regulate the in-flight odd_manager
work — `.ai-workspace/` topology widgets and coding-agent
interoperability — under STDO Method (constitutional governance per
user directive 2026-04-26).

The review is unsparing because that is the only kind of self-review
worth posting. The wave is shape-correct under STDO (TICKET_METHOD
required and recommended fields satisfied, lane discipline correct,
dependency DAG explicit) and substance-correct under ODD only if one
accepts an implicit assumption that odd_manager's UX layer is exempt
from §11.2 carrier law. That exemption is not yet ratified, and the
wave inherits the same recurring failure pattern flagged in the
abiogenesis TS review (2026-04-26T14:00:00Z) and the odd_sdlc TS-wave
review (2026-04-26T15:30:00Z) — the third instance of the same
diagnosis posted to the workspace today.

This post describes both current reality and target direction.
Findings are separated from recommended action.

## Per-Method Evaluation

### S — SPEC_METHOD

**Strong parts.** Each ticket carries `intake_source`, `target_truth`,
`superseded_truth`, `closure_law`, and a named `change_class` and
`re_entry_point`. The wave goal
(`realize-ai-workspace-topology-and-agent-interoperability`) is
consistent across all eight. T-005 correctly fronts the chain as
`product_reprice` with `re_entry_point: product_definition`.

**Gaps.**

- **The S-chain `goal → intent → requirements → design → code` is
  broken at the requirements layer.** No ticket cites a
  `specification/requirements/` section. `intake_source` fields cite
  the STRATEGY post and code files; they do not cite a `REQ-*`
  family. odd_manager has `specification/requirements/`; the wave
  should either cite REQs already there or call for new ones for
  these surfaces (project selection, ticket-as-record, comment
  threading, session lifecycle, MCP exposure). This is the same gap
  diagnosed in the odd_sdlc T-033 / T-036 / B-004 review earlier
  today, reproduced in the new wave.
- **T-012 RC criteria have no spec ratification path named.** Where
  do the scenario portfolio's pass/fail criteria live constitutionally?
  Either a `specification/scenarios/` surface or a PRODUCT.md RC
  section. The ticket asserts a report will be published but does not
  name the spec authority the report is measured against.
- **T-005 propagation to INTENT.md is unstated.** Adding Context to
  PRODUCT.md may require an INTENT.md update too — Context is
  arguably product intent, not only product shape. The ticket should
  call out the upward-propagation check explicitly.

### T — TICKET_METHOD

**Strong parts.** All twelve required fields present
(`id`, `title`, `type`, `ticket_category`, `status`, `goal`,
`change_intent`, `change_class`, `re_entry_point`, `triaged_at`,
`created_at`, `updated_at`); all six execution-contract fields present
(`target_truth`, `superseded_truth`, `closure_law`,
`evaluation_criteria`, `non_closure_conditions`, `proof_surface`);
lane discipline correct (`tickets/backlog/`); filename pattern
correct (`T-NNN-kebab-title.md`); dependency DAG explicit and acyclic.
`non_closure_conditions` are concrete and falsifiable on most tickets.

**Gaps.**

- **`build_tenant: react_vite` is missing on T-007 through T-011.**
  TICKET_METHOD's "Multi-Build-Tenant Ticket Independence" rule and
  the Required-Fields recommended-additional list both call for
  `build_tenant` on tenant-local work. T-007–T-011 are entirely
  scoped to `build_tenants/react_vite/` and are tenant-local by
  definition. This is the most concrete TICKET_METHOD omission in
  the wave. Five tickets, one field each.
- **`links` field omitted across the wave.** Recommended-only, not
  required. The cross-references to the STRATEGY post are present
  via `intake_source` but not in the dedicated `links` shape.
- **`ticket_category: build_wave` is not in the TICKET_METHOD base
  set.** It is used by odd_sdlc and now by this wave; plausibly a
  project-local extension. If not yet ratified upstream, either the
  wave should use a base category (`feature` / `chore`) or
  `build_wave` should be added to TICKET_METHOD.
- **§11.5A-style guards (the T-033 / T-037 pattern of baking
  ABG-owns-continuation into `non_closure_conditions`) are missing on
  T-009 (Sessions) and T-011 (MCP).** Both are surfaces where
  continuation can leak into local code. Should add: T-009 —
  "session.spawn embeds traversal selection logic"; T-011 — "MCP
  tools own multi-step workflows instead of returning single-step
  results to the agent".
- **T-007 ↔ T-008 ↔ T-009 are written sequentially but are
  technically independent after T-006.** The strict chain matches
  odd_sdlc shape but unnecessarily blocks parallelism. Either re-DAG
  the dependencies or note explicitly that the chain is ordering
  preference, not technical dependency.

### D — DESIGN_MODULE_METHOD

**Strong part.** T-006 exists at all. That alone puts the wave ahead
of the odd_sdlc TS wave (which I flagged for missing the D leg
entirely earlier today).

**Gaps.**

- **T-006 does not require a structural carrier diagram
  (§5E Structural Carrier Diagram Rule).** The AssetSurface chassis
  has seven fields — that calls for a diagram showing the field
  relationships and the module's place in the topology.
- **Design-module taxonomy class is unstated (§6 Design Module
  Taxonomy).** What class does AssetSurface fall into (interface
  module, carrier module, projection module, etc.)? Should be named
  in T-006.
- **§6A "Design → Module → (Implementation, Unit Tests) Evidence
  Route" is implicit but not declared.** T-006 → T-007/T-008/T-009 →
  tests *is* the route, but no ticket states it as such. T-006
  should publish a short "Evidence Route" statement so downstream
  tickets can cite it.
- **§6B "Module-Derived Unit Test Rule" is not enforced.**
  T-007 / T-008 / T-009 evaluation criteria name tests but do not
  require them to derive from the module design (the test surface
  should be derivable from the AssetSurface chassis fields, not from
  implementation choices). Without the rule, tests will accrete
  around code shape and re-couple to implementation.
- **One design module covering all five collections may be
  insufficient.** §11 Coupling Rule and §5A Irreducible Architectural
  Carrier Set Rule suggest each collection (Tickets, Comments,
  Sessions, Projects, ActiveContext) may warrant its own structural
  carrier diagram, with one umbrella for the AssetSurface contract.
  T-006 should at least name whether it produces one document or
  five linked documents.

### O — ODD_METHOD

**Strong parts.** T-005 ratifies Context as a typed concept (§11.1).
T-007 / T-008 / T-009 instantiate typed AssetSurface records. T-009
carries the strongest robustness property in the wave (server-restart
survival of the pty). T-012 enforces dogfood via a real cross-agent
run (§14).

**Gaps.**

- **§11.2 "graph functions as primary constructive carrier" is
  silently violated.** None of T-007 / T-008 / T-009 / T-011 require
  their actions (status transition, post comment, session.spawn,
  create_comment) to be published as `GraphFunction` objects in a
  GTL module. They are framed as TypeScript controller methods. If
  odd_manager is an ODD product (its CLAUDE.md positions it as
  odd_sdlc-governed), then by §11.2 every operative constructive
  step should be carried by a named `GraphFunction`. Either the wave
  must require this, or the wave must explicitly declare the
  odd_manager UX layer exempt as "service or query layer" under §10
  — and that exemption needs spec authority.
- **§11.4 "GTL Module is the operative publication surface" — T-011
  MCP layer does not declare it publishes a GTL module.** Same root
  problem as §11.2. The MCP server tools and resources should map
  onto a published module if the tenant is ODD-built.
- **§11.9 "global convergence stable under zoom" — not exercised.**
  Same gap as both other reviewed waves today. Worth treating as an
  ecosystem-level dependency rather than a per-wave gap.
- **§14 dogfooding — partially captured, not stated explicitly.**
  odd_manager's TicketAssetSurface (T-007) reading its own
  `.ai-workspace/tickets/` is dogfood; T-012 makes the cross-agent
  property explicit but does not name the meta-dogfood (the manager
  managing its own tickets).
- **§16 failure pattern #10 ("framework behavior implemented
  imperatively first, GTL vocabulary later") is the dominant risk in
  the wave.** Five `realization_refactor` tickets are about to write
  TypeScript that publishes typed records and actions. Without the
  §11.2 graph-function requirement, this is the same pattern flagged
  in both prior reviews today. The wave is one method clarification
  away from being structurally identical to the failure mode it is
  adjacent to.

## Cross-Cutting Findings

### F1. Self-review reproduces the prior reviews' top findings

D leg present-but-thin, §11.5A guards missing on the surfaces most
exposed to continuation leakage, §11.9 zoom unaddressed,
`REQ-*` citations absent. Method-level pattern: I am writing tickets
that pass STDO in shape but inherit the same realization-debt risks I
just diagnosed elsewhere this same day. STDO-shape compliance is not
ODD-substance compliance.

### F2. The wave is method-strong on TICKET_METHOD shape, method-weak on ODD_METHOD substance

Frontmatter completeness ≠ ODD compliance. Without §11.2 carrier law
explicitly enforced, T-007–T-011 are likely to land as
`realization_refactor` that re-creates the imperative-first pattern.

### F3. The `build_tenant` omission is the single most concrete fix

Five tickets, one field each. Closes the most specific TICKET_METHOD
gap.

### F4. odd_manager's ODD identity needs explicit ratification

Its CLAUDE.md says "governed by odd_sdlc … not itself a GTL/ABG
project in identity terms." But T-005 ratifies Context as a
constitutional product surface, T-006 introduces a design module, and
the AssetSurface contract is graph-shaped in spirit. The wave is
implicitly making odd_manager more ODD-built than its CLAUDE.md
acknowledges. This needs a one-line resolution in T-005: ODD product
subject to §11.2 carrier law, or service/query layer under §10
exemption.

### F5. Three reviews in one day, one pattern

Three REVIEW posts published 2026-04-26 across three repos
(abiogenesis, odd_sdlc, odd_manager) trace the same recurring
diagnosis: §11.2 carrier law treated as design intent rather than
realization requirement, the D leg of STDO underweighted, §11.9 zoom
unaddressed across the ecosystem, and §16 failure pattern #10 as the
dominant ambient risk. The pattern is ecosystem-level, not
project-local.

## Recommended Action

In priority order, with STDO anchor:

1. **Add `build_tenant: react_vite` to T-007 through T-011.**
   *Anchor: TICKET_METHOD §Multi-Build-Tenant.*
2. **Resolve odd_manager ODD-identity question in T-005** — one
   sentence: ODD product subject to §11.2 carrier law, or
   service/query layer under §10 exemption.
   *Anchor: ODD §10, §11.2.*
3. **Add §11.5A-style guards to T-009 (Sessions) and T-011 (MCP)
   non_closure_conditions.** Mirror the odd_sdlc T-033 / T-037
   pattern.
   *Anchor: ODD §11.5A; TICKET_METHOD non-closure law.*
4. **Add `links:` to each ticket** with explicit cross-references to
   the STRATEGY post, the ratified PRODUCT.md section once T-005
   closes, and dependency tickets.
   *Anchor: TICKET_METHOD recommended fields.*
5. **Strengthen T-006** — require a structural carrier diagram
   (§5E), name the design-module taxonomy (§6), declare the
   design-to-module-to-test evidence route (§6A), and decide
   one-vs-many design module documents.
   *Anchor: DESIGN_MODULE_METHOD §5E, §6, §6A, §11.*
6. **Cite or commission `REQ-*` sections** for the wave's product
   requirements. If `odd_manager/specification/requirements/` does
   not yet have AssetSurface / Context / MCP requirements, add a
   sub-ticket (T-005a) to author them before T-005 closes.
   *Anchor: SPEC_METHOD chain.*
7. **Note T-007 / T-008 / T-009 as parallelizable** in the wave
   description, even if dependency edges remain conservative.
   *Anchor: TICKET_METHOD §Inside-Out plus parallel-when-seams-clean.*
8. **Add a meta-dogfood criterion to T-012** — verify odd_manager's
   own tickets are read through TicketAssetSurface and its own posts
   through CommentAssetSurface.
   *Anchor: ODD §14.*

---

Honest summary: the wave is shape-correct under STDO and
substance-correct under ODD only if the odd_manager UX-layer
exemption is ratified. If that exemption is not ratified, the wave
is method-shaped but not method-built — the same diagnosis issued
for the abiogenesis TS tenant and the odd_sdlc TS wave earlier
today, applied recursively to my own ticket authoring.

This post is commentary. It becomes consequential only if its
content is adopted as ticket revisions before T-005 is moved to
`active/`.
