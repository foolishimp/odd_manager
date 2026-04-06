# Release Method

**Status**: Draft
**Scope**: Release-process method for evaluating, tapping, and publishing one point-in-time release cut

---

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

---

## Phases

The release process has two phases:

1. `release_candidate` window
2. tapped release cut

## Release Candidate Window

The release-candidate window is mutable.

Its purpose is to prove the candidate against the release criteria before the
final release number is tapped.

During the RC window:

- fixes are allowed
- qualification and operator review continue
- release notes may remain draft or RC-scoped
- the candidate branch remains mutable

What must remain stable during the RC window:

- the intended release scope boundary
- the release criteria being evaluated
- the candidate identity being qualified

If the intended scope changes materially, the RC should be repriced or restarted
rather than silently expanded.

## Tapped Release Cut

The tapped release cut is the point-in-time decision that:

- the candidate passed the required evaluation
- the accepted feature set is now bounded
- one concrete release number is assigned

After the tap:

- release-scoped assets are updated with the tapped version
- the release note is finalized for that cut
- the release commit becomes the canonical release cut
- the release branch and release tag identify that cut
- that cut is no longer mutated in place

Any further change becomes a new RC cycle, patch release, or hotfix process.

---

## Candidate Flow

1. Create or update the draft release note for the candidate.
2. Open or continue an RC branch for the candidate.
3. Run release-candidate qualification and operator review against that RC branch.
4. Apply bounded fixes during the RC window while preserving the declared release scope.
5. When the candidate is accepted, tap the release number.
6. Update release-scoped assets with the tapped release number.
7. Finalize the release note for that exact cut.
8. Commit the release cut.
9. Push the release commit.
10. Create and push the release branch with the final name.
11. Create and push the release tag.

---

## Naming

One lawful naming shape is:

- RC branch: `rc/<candidate-name>`
- release branch: `release/<version>`
- release tag: `v<version>`

The exact naming convention may vary by project, but the distinction between RC
identity and tapped release identity must remain explicit.

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

---

## Tap Criteria

The release tap should occur only when:

- RC qualification has passed
- required operator review is complete
- the intended release scope is stable
- the release note accurately describes the accepted cut
- release-scoped assets are internally consistent

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

---

## Open Questions

- What exact qualification bundle is mandatory before tap?
- How long may an RC remain mutable before it must be repriced or abandoned?
- Is the release branch created only from the final tapped commit, or may it exist earlier as an RC carrier?
- What is the exact hotfix process after a tapped release?
