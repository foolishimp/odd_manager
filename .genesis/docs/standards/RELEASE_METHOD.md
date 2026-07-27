# Release Method

## Position

Release process is distinct from live project specification.

Live specification defines the current constitutional truth of the project.

Release process defines how one accepted point-in-time cut is:

- evaluated
- bounded
- named
- recorded
- published

The only operative version identifier is the tapped release version.

That version is a release-process fact. It is not part of the live project
specification.

Release handling is downstream of intake triage.

A bug, feature, issue, regression, or release blocker does not enter the method
through release first. It enters through intake triage first, where the project
determines:

- the change class
- the lawful re-entry point
- the affected scope
- the downstream build, test, and evidence obligations
- whether the change remains inside the current release scope

Only after that triage may the change be treated as RC work, a new RC cycle, a
patch release, or a hotfix.

---

## Phases

The release process has three phases:

1. `release_candidate` window
2. published RC cut inside that window
3. tapped release cut

## Release Candidate Window

The release-candidate window is mutable.

Its purpose is to prove the candidate against the release criteria before the
final release number is tapped.

During the RC window:

- fixes are allowed
- qualification and operator review continue
- release notes may remain draft or RC-scoped
- the candidate branch remains mutable

Those fixes are still intake-triaged changes. The RC window does not authorize
direct code mutation without explicit scope classification.

What must remain stable during the RC window:

- the intended release scope boundary
- the release criteria being evaluated
- the candidate identity being qualified

If the intended scope changes materially, the RC should be repriced or restarted
rather than silently expanded.

## Published RC Cut

A published RC cut is an immutable point-in-time candidate cut inside the
mutable RC window.

Its purpose is to let the project:

- name the exact candidate being qualified
- publish one stable RC artifact set
- give operators and downstream consumers one concrete branch and tag to use
- continue the RC window later with a new RC cut if bounded fixes are needed

During the RC window, the project may publish multiple RC cuts:

- `rc.1`
- `rc.2`
- `rc.3`

Each published RC cut is immutable once tagged.

If more RC work is needed after one RC cut is published, the next point-in-time
candidate must receive a new RC tag rather than mutating the old RC identity in
place.

## Tapped Release Cut

The tapped release cut is the point-in-time decision that:

- the candidate passed the required evaluation
- the accepted feature set is now bounded
- one concrete release number is assigned

After the tap:

- the accepted release subject and release-scoped claims remain byte-identical
  to their reviewed final-ready RC identities
- the final carrier commit becomes the canonical release cut
- the release branch and release tag identify that cut
- that cut is no longer mutated in place
- publication-caused source-work bookkeeping may be recorded afterward on the
  continuing source branch without moving the immutable release tag

Any further change becomes a new RC cycle, patch release, or hotfix process.

If a project has not ratified a separate patch-release or hotfix method, the
default post-tap path is a new RC cycle.

---

## Candidate Flow

1. Intake-triage the candidate change set and confirm the lawful release scope.
2. Declare the exact Product release subject, release-scoped claim surfaces,
   and excluded mutable source-project state.
3. Open or continue an RC branch and prepare final-ready release-scoped assets.
4. Run pre-RC qualification and operator-readiness checks.
5. Apply bounded fixes during the RC window and re-run affected evidence.
6. Publish one immutable RC cut and tag for the final-ready subject.
7. Obtain independent exact-cut review of that immutable RC.
8. If Product or release-scoped bytes, or any other bytes that can affect a
   qualified property, change, publish and review a new RC cut.
9. If the final carrier differs only in declared excluded source-project state,
   prove the permitted final delta.
10. Obtain human acceptance of the exact release subject, final carrier, and
    final-delta relation.
11. Push the accepted final carrier.
12. Create and push the final release branch and release tag at that carrier.
13. Record publication-caused work-state closure afterward on the continuing
    source branch without moving the immutable release tag.

## RC Trigger

The RC trigger is the point where the project has already decided:

- the current candidate scope is the one being qualified
- the project is ready to publish one stable RC identity for broader review or
  downstream use

The RC trigger does not mean the final release is tapped.

It means the project is ready to publish one immutable RC cut inside the still
mutable RC window.

The RC trigger should occur only when:

- the intended RC scope is stable
- pre-RC qualification and operator-readiness checks have passed
- the Product release subject, release-scoped claims, and excluded mutable
  source-project state are declared
- release-scoped notes and documentation are final-ready and describe that
  exact subject without depending on later mutable status reconciliation
- the RC branch, RC tag, and RC note identity are internally consistent

## RC Publish Flow

Once the project decides it is ready for RC publication:

1. confirm the RC scope and RC candidate identity
2. reconcile final-ready release notes and release-scoped documentation to that
   exact subject
3. prepare any separately declared RC-only publication assets that must carry
   the RC identity; they are not part of the final release-scoped claim set
4. commit the RC cut
5. push the RC commit
6. create or update the RC branch carrier for that RC line
7. create and push the immutable RC tag for that exact cut
8. publish the release note and any required release-scoped documentation for
   that exact RC cut
9. obtain independent exact-cut review against the immutable RC identity

If additional RC work is required afterward, the next RC publication repeats
this flow with a new RC tag. The previous RC tag remains immutable.

---

## Naming

One lawful naming shape is:

- RC branch: `rc/<version>`
- RC tag: `v<version>-rc.<n>`
- release branch: `release/<version>`
- release tag: `v<version>`

The exact naming convention may vary by project, but the distinction between RC
identity and tapped release identity must remain explicit.

For example:

- RC branch: `rc/1.0.0`
- first RC tag: `v1.0.0-rc.1`
- second RC tag: `v1.0.0-rc.2`
- final release branch: `release/1.0.0`
- final release tag: `v1.0.0`

If a project uses a different naming convention, it must still preserve:

- one mutable RC branch identity
- one immutable RC tag per published RC cut
- one final release branch identity
- one final release tag identity

---

## Release-Scoped Assets

The tapped release version may appear in release-scoped surfaces such as:

- release notes
- release manifests
- dependency declarations
- installed-carrier metadata
- release branches
- release tags

It should not be used to describe the live constitutional project truth.

## Release Notes And Documentation States

Release notes and release-facing documentation move through distinct states:

1. draft candidate state
2. final-ready RC state
3. immutable tapped-release state

The draft candidate state may remain incomplete while the RC window is still
being shaped.

An RC published only for provisional evaluation may carry explicit RC caveats.
The exact RC selected for final acceptance must already carry final-ready,
release-invariant claims. It must not require a later tracked edit merely to
change candidate, review, acceptance, branch, or tag-existence status.

The tapped release preserves those accepted release-scoped bytes. Any later
content change creates a changed release-scoped subject and requires affected
re-evaluation.

## Documentation Reconciliation

Before a published RC cut, the project must reconcile the RC-facing release
surfaces for that exact RC identity.

Before publishing the exact RC intended for final acceptance, the project must
reconcile the final release surfaces so that they remain truthful for both that
RC subject and the tapped Product. Before tap, final-delta evidence must prove
that those release-scoped bytes still match the reviewed RC.

At minimum, reconciliation should cover whatever release-scoped assets the
project actually uses, such as:

- release notes
- RC notes or known-limitation notes
- release manifests
- version references in release-facing docs
- install or operator guidance for the release cut
- branch and tag references

The method does not require every project to use every asset above.

It does require each project to know which release-scoped assets exist and to
reconcile them before publishing the relevant cut.

---

## Release Subject And Repository Carrier

Before qualification, the project declares:

- the exact Product member set or artifact constituting the release subject
- the release-scoped claim surfaces whose bytes describe that subject and its
  publication
- any co-located mutable source-project fields permitted to differ between the
  reviewed RC carrier and final carrier and therefore excluded from both

A repository commit is an identity carrier for those declared sets. A branch or
tag reaching that commit does not make every co-located source-project file a
Product member or release-scoped claim.

Between a reviewed RC and the final cut, the final carrier may differ only by an
enumerated change to declared excluded source-project state. Final-delta
evidence must prove that the release-subject member set and bytes and the
release-scoped claim bytes are unchanged and that the excluded delta cannot
affect a qualified property. Such a delta does not require Product
requalification. Any change to the release subject or a release-scoped claim
requires affected re-evaluation.

Human acceptance binds the exact release subject, final carrier identity, and
final-delta relation before the final branch and tag are published. Work-state
closure caused by publication may be recorded afterward on the continuing
source branch; it must not move the immutable release tag.

---

## Exact Candidate Qualification And Final Delta (`STDO-UP-011`)

Every qualification verdict binds the exact declared release subject,
release-scoped claim set, and reviewed RC carrier. It identifies candidate
identity, governing Product and release basis, properties claimed, evidence
subjects and observation boundaries, owner verdicts, and unresolved gaps.

Evidence matches the claim. Source success does not prove packaged or installed
behavior; packaging equivalence does not prove semantic behavior; artifact
presence does not prove usability unless presence is the exact claim.

Before tap, the final carrier is compared with the reviewed immutable RC. A
change to Product or release-scoped bytes, or any other change that can affect a
qualified property, invalidates that verdict until the property is
re-evaluated. Qualification covers the complete successor Product and complete
release delta from the declared predecessor, not only the latest authoring
increment.

A tapped release requires acceptance of the exact release subject, final
carrier, and final-delta relation by the human authority owning the Product
boundary or by a separately established bounded proxy. Acceptance of a plan,
topic, earlier candidate, or reviewed RC does not imply acceptance of a changed
release subject or an undeclared carrier delta.

## Tap Criteria

The release tap should occur only when:

- pre-RC qualification has passed
- the immutable RC has passed required exact-cut review
- required operator review is complete
- the intended release scope is stable
- the final-ready release note accurately describes the accepted cut
- release-scoped assets are internally consistent
- the final delta preserves the reviewed Product and release-scoped bytes
- human authority has accepted the exact release subject, final carrier, and
  final-delta relation

In addition:

- the published RC lineage for that release is internally coherent
- the final release branch and final release tag point to the same accepted cut
- publication-caused source-work closure does not move the immutable release tag

## External Qualification Dependencies

Some release claims depend on external backends, transports, or operator-facing
services that are not part of the local product carrier.

When a release claim depends on one of those external dependencies:

- the dependency may be treated as out-of-product for carrier and migration
  classification
- but it is still release-blocking for that claim

This means:

- a clean skip caused by an unhealthy external dependency may preserve correct
  product classification
- but it is not sufficient to tap a release that claims the dependent
  capability has passed

For example:

- if lawful self-modification MVP claims depend on the canonical installed-dev
  live bundle against a selected external backend
- then that bundle must pass against a healthy backend before the release may
  claim the MVP is delivered

## Successor Baseline Conservation (`STDO-UP-015`)

A successor identifies the exact predecessor release whose semantic claims it
evolves. That origin remains immutable for the candidate. Every predecessor
claim capable of affecting the successor receives one semantic disposition:

- **conserved**: the successor retains the claim;
- **superseded**: an accepted successor relation replaces it;
- **intentionally removed**: current Product authority removes it; or
- **not applicable**: it has no successor effect, with a bounded reason.

An unresolved disposition blocks qualification of the affected claim.
Conservation is semantic: patch absence does not prove loss when a
successor-native realization preserves behavior, and naming or code similarity
does not prove conservation without relevant evidence.

Where a maintenance or support line may affect retained claims, the release
basis identifies the watched source, observation boundary, inclusion policy,
and successor candidate. Relevant changes receive semantic disposition at
material integration, qualification, and final-delta evaluation. The consumer
owns the record, branch strategy, comparison, and proof mechanism.

---

## Open Questions

- What exact qualification bundle is mandatory before tap?
- How long may an RC remain mutable before it must be repriced or abandoned?
- What is the exact hotfix process after a tapped release?
