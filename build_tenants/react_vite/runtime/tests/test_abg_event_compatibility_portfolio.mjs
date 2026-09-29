import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';
import { indexAbgEventCarrier } from '../../src/server/abg-event-carrier-service.mjs';
import { loadAbgRunObservation } from '../../src/server/abg-run-observation-service.mjs';
import { loadTraversalSummary } from '../../src/server/traversal-projection-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const manifestPath = resolve(here, '../../qualification/abg-5-compatibility-portfolio.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const externalPortfolioAvailable = [
  manifest.oddGlcV22.checkout,
  manifest.significantLargeCarrier.checkout,
  manifest.abiogenesis5Artifact.checkout,
].every(existsSync);

function sha256(path) {
  return `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
}

function assertCheckoutCommit(checkout, expected) {
  const actual = execFileSync('git', ['-C', checkout, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  assert.equal(actual, expected);
}

function assertCarrier(subject, checkout) {
  const runRoot = join(checkout, subject.runRoot);
  const eventPath = join(runRoot, 'instance', '.ai-workspace', 'events', 'events.jsonl');
  const index = indexAbgEventCarrier(eventPath, { refresh: true });
  assert.equal(index.state, 'ready', JSON.stringify(index.diagnostics));
  assert.equal(index.envelopeProfile, 'abiogenesis_4_6_flat');
  assert.equal(index.eventCount, subject.eventCount);
  assert.equal(index.observedSizeBytes, subject.byteLength);
  assert.equal(index.maxLineBytes, subject.maxLineBytes);
  assert.equal(index.completePrefixDigest, subject.eventDigest);
  return { runRoot, eventPath, index };
}

test('pinned ABIogenesis 5.0 artifact identities remain exact', {
  skip: !externalPortfolioAvailable && 'external ABG compatibility portfolio is unavailable',
}, () => {
  const subject = manifest.abiogenesis5Artifact;
  const packagePath = join(subject.checkout, 'build_tenants/abiogenesis/typescript/package.json');
  const toolchainPath = join(subject.checkout, 'build_tenants/abiogenesis/typescript/product-toolchain-manifest.json');
  const sourcePath = join(subject.checkout, 'build_tenants/abiogenesis/typescript/code/src/abg/event_store.ts');
  const buildPath = join(subject.checkout, 'build_tenants/abiogenesis/typescript/build/code/src/abg/event_store.js');
  assert.equal(sha256(packagePath), subject.packageJsonSha256);
  assert.equal(sha256(toolchainPath), subject.productToolchainManifestSha256);
  assert.equal(sha256(sourcePath), subject.eventStoreSourceSha256);
  assert.equal(sha256(buildPath), subject.eventStoreBuildSha256);
  const packageRecord = JSON.parse(readFileSync(packagePath, 'utf8'));
  const toolchain = JSON.parse(readFileSync(toolchainPath, 'utf8'));
  assert.equal(packageRecord.name, subject.packageName);
  assert.equal(packageRecord.version, subject.packageVersion);
  assert.equal(toolchain.schemaVersion, subject.workflowVersion);
  assert.ok(toolchain.compatibilityRefs.includes(subject.compatibilityRef));
});

test('latest six odd_glc Hello World carriers reconcile through observation v3 without retry closure inflation', {
  skip: !externalPortfolioAvailable && 'external ABG compatibility portfolio is unavailable',
}, () => {
  const portfolio = manifest.oddGlcV22;
  assertCheckoutCommit(portfolio.checkout, portfolio.commit);
  for (const subject of portfolio.completedRuns) {
    const { runRoot, index } = assertCarrier(subject, portfolio.checkout);
    assert.equal(index.eventPosture, 'terminal_converged');
    const observation = loadAbgRunObservation(runRoot, { refresh: true });
    assert.equal(observation.state, 'ready');
    assert.equal(observation.version, 3);
    assert.equal(observation.substrate.packageVersion, portfolio.publishedSubstrateVersion);
    assert.equal(observation.proofReconciliation.state, 'reconciled');
    assert.equal(observation.compatibility.posture, 'abiogenesis_4_6_legacy_supported');
    assert.equal(observation.eventPosture, 'terminal_converged');
    assert.equal(observation.processPosture, 'unavailable');
    assert.equal(observation.activity.semanticVectorCount, 8);
    assert.equal(observation.activity.openSemanticVectorCount, 0);
    assert.ok(observation.activity.vectorAttemptCount >= 8);
    assert.equal(observation.diagnostics.some((entry) => entry.code === 'run_has_open_closure'), false);
    assert.ok(Buffer.byteLength(JSON.stringify(observation)) < 512 * 1024);
  }
});

test('latest stopped Data Mapper is proof-independent and the significant 126 MB carrier stays bounded', {
  skip: !externalPortfolioAvailable && 'external ABG compatibility portfolio is unavailable',
}, () => {
  const current = assertCarrier(manifest.oddGlcV22.nonTerminalRun, manifest.oddGlcV22.checkout);
  assert.equal(current.index.eventPosture, 'non_terminal');
  const currentObservation = loadAbgRunObservation(current.runRoot, { refresh: true });
  assert.equal(currentObservation.state, 'ready');
  assert.equal(currentObservation.eventPosture, 'non_terminal');
  assert.equal(currentObservation.processPosture, 'unavailable');
  assert.equal(currentObservation.proofReconciliation.state, 'absent');
  assert.equal(currentObservation.carrierSnapshot.completePrefixDigest, current.index.completePrefixDigest);
  assert.ok(Buffer.byteLength(JSON.stringify(currentObservation)) < 512 * 1024);
  const traversal = loadTraversalSummary(current.runRoot, { refresh: true });
  assert.equal(traversal.state, 'ready');
  assert.equal(traversal.eventLogDigest, current.index.completePrefixDigest);

  const largeSubject = manifest.significantLargeCarrier;
  assertCheckoutCommit(largeSubject.checkout, largeSubject.commit);
  const large = assertCarrier(largeSubject, largeSubject.checkout);
  assert.equal(large.index.eventPosture, 'non_terminal');
  assert.ok(large.index.observedSizeBytes >= 126_000_000);
  assert.ok(large.index.maxLineBytes >= 4_100_000);
  const largeObservation = loadAbgRunObservation(large.runRoot, { refresh: true });
  assert.equal(largeObservation.state, 'ready');
  assert.equal(largeObservation.proofReconciliation.state, 'absent');
  assert.ok(Buffer.byteLength(JSON.stringify(largeObservation)) < 512 * 1024);
});

test('portfolio refuses to relabel published 4.6 carriers as exact odd_glc on ABIogenesis 5.0', () => {
  assert.equal(manifest.claimBoundary.abiogenesis46FlatEnvelopeSupport, 'qualified_against_exact_external_carriers');
  assert.equal(manifest.claimBoundary.abiogenesis50RootEnvelopeReadiness, 'qualified_against_exact_5_0_0_dev_286_contract_artifact');
  assert.equal(manifest.claimBoundary.oddGlcOnAbiogenesis50RuntimeCompatibility, 'blocked_no_self_identified_5_0_odd_glc_runtime_carrier');
  assert.equal(manifest.claimBoundary.processLivenessClaimedFromEvents, false);
});
