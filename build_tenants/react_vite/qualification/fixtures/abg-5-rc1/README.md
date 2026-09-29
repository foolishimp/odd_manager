# T-046 I-01 frozen observation subjects

`subjects.json` pins the three published Run identities and all twelve input
members by byte length and SHA-256. All twelve match the ABIogenesis commit
`8a21b20fb624adc29f2ac9ca688c7032217afe48` in the manifest's source repository.
This is a reproducible read-only dependency, not a request to execute ABIogenesis.

Resolve that exact commit in an ABIogenesis checkout and set:

```sh
export OMAN_T046_EVIDENCE_ROOT='<checkout>/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE'
node qualification/t046-installed-proof.mjs
```

The default resolver uses the sibling ABIogenesis checkout only as a convenient
locator; every required byte identity is rechecked. The proof copies the exact
manager working candidate, installs its lockfile dependencies, builds the UI,
starts its server and built preview, registers a separate observation Project
through the ordinary registry API, and uses the ordinary Run Inspector.
Original receipts, read results and event logs are copied unchanged. Candidate
manifest, tests, browser result, bounded response measurements and screenshots
are copied to `qualification/t046-i01-evidence/` after success; execution scratch
also remains under the printed `odd-manager-t046-installed-*` directory. The
proof output directory is explicitly excluded from candidate membership to
avoid self-reference.

For direct operator use, register the ABIogenesis Project or an observation
root containing these retained archives, open Run Inspector, and explicitly
select the Run. The server discovers typed invocation/read receipts and exact
ledger bytes under admitted roots. Names only locate candidate files; a sandbox
identity is unnecessary. The S7 first archive supplies its blocked status at
prefix 2318. The fresh shared archive supplies its fresh Run's closed status at
prefix 4485. Selecting the source Run from that longer shared archive shows
canonical status unavailable because it has no owner read at that prefix.

This slice validates the frozen `ddc961...` profile only. It does not adopt the
newer dirty `a25d...` profile, infer process liveness, or close T-040/T-045 or
whole-release qualification. Copied archives preserve original durable store
coordinates but confer no reopening authority.
