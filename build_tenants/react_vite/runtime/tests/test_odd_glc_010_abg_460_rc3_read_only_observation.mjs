import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import ts from 'typescript';
import { loadAbgRunObservation } from '../../src/server/abg-run-observation-service.mjs';
import {
  loadBuildCarrierDescriptor,
  PROJECT_SNAPSHOT_PROVISIONER_REF,
} from '../../src/server/build-carrier-descriptor-service.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(
  here,
  '../../qualification/fixtures/odd-glc-0.1.0-abg-4.6.0-rc.3',
);
const validationModulePath = resolve(
  here,
  '../../src/features/sidecar/abg-run-observation-validation.ts',
);

const exact = Object.freeze({
  oddGlcPackageName: '@odd-glc/route-one-typescript',
  oddGlcPackageVersion: '0.1.0',
  oddGlcTagCommit: 'a878475e4609e2d74d3260eb36ee05c4657b1879',
  oddGlcTarballSha256: '7e548f92ecd6b4442f9c9f1feb46dd2edd7e9610a7dae8706482fc65d80fa578',
  releaseManifestBytes: 5631,
  releaseManifestSha256: 'd8bbbd172cd011f68ae569f6c64bafb0e44eea002be2d55181270ae8de634eb1',
  proofBytes: 925930,
  proofSha256: '9a8bbce08257db6a5b808e629ca7dce5a6f62a293d3f29309e169930228ddfe8',
  abiPackageName: '@abiogenesis/typescript-tenant',
  abiPackageVersion: '4.6.0-rc.3',
  abiReleaseTag: 'v4.6.0-rc.3',
  abiTagCommit: 'f4f081f66ef8d3ce0c737ddb9d7530176711279a',
  abiSourceCommit: '5213301cdbfd35952badf19c27519caa9e7e6968',
  abiTarballSha256: '9cffb372c0dfc00983a5d0e882efbc3d0c3ac937a56f313000f35a4473358113',
  abiReleaseManifestSha256: '941d9a00198914120db7d7a1f466f4b3e2efe0fbd9659a71540267ca0f899bf4',
  abiToolchainDigest: '92b3f94dd32bca9368a9511d823cc8b6e2eae75cd7168c9e901d3cbe8eadf07d',
  eventCount: 602,
  projectedEventRowCount: 152,
  closedVectorCount: 8,
  catalogEntryCount: 47,
});

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

async function loadClientAdmissionModule() {
  const source = readFileSync(validationModulePath, 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ES2020,
      target: ts.ScriptTarget.ES2020,
      importsNotUsedAsValues: ts.ImportsNotUsedAsValues.Remove,
    },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled, 'utf8').toString('base64')}`);
}

function assertObservation(observation, expected) {
  assert.equal(observation.state, expected.state);
  assert.equal(observation.identity.id, expected.identityId);
  assert.equal(observation.substrate.packageName, exact.abiPackageName);
  assert.equal(observation.substrate.packageVersion, expected.substratePackageVersion);
  assert.equal(observation.substrate.releaseTag, exact.abiReleaseTag);
  assert.equal(observation.substrate.sourceCommit, exact.abiSourceCommit);
  assert.equal(observation.activity.eventCount, expected.eventCount);
  assert.equal(observation.events.length, expected.projectedEventRowCount);
  assert.equal(observation.activity.vectorClosedCount, expected.closedVectorCount);
  assert.equal(observation.catalog.entryCount, expected.catalogEntryCount);
  assert.equal(observation.catalog.entries.length, expected.catalogEntryCount);
  assert.equal(observation.diagnostics.length, expected.diagnosticCount);
}

test('exact odd_glc 0.1.0 / ABIogenesis 4.6.0-rc.3 read-only observation qualifies while Build remains unavailable', async () => {
  const qualification = readJson(join(fixtureRoot, 'qualification-manifest.json'));
  assert.deepEqual(qualification.claim, {
    operation: 'read_only_observation',
    subject: 'odd_glc 0.1.0 on ABIogenesis 4.6.0-rc.3',
    exactReleasePairOnly: true,
    general46Compatibility: false,
    buildAvailabilityClaimed: false,
    runtimeDependencyRequired: false,
  });
  assert.deepEqual(qualification.expectedObservation, {
    state: 'ready',
    identityId: 'odd_glc',
    substratePackageVersion: exact.abiPackageVersion,
    eventCount: exact.eventCount,
    projectedEventRowCount: exact.projectedEventRowCount,
    closedVectorCount: exact.closedVectorCount,
    catalogEntryCount: exact.catalogEntryCount,
    diagnosticCount: 0,
  });
  assert.deepEqual(qualification.expectedBuildAdmission, {
    status: 'unavailable',
    descriptor: null,
    reason: 'Project does not publish .odd/build-carrier.json.',
  });

  assert.equal(qualification.oddGlc.packageName, exact.oddGlcPackageName);
  assert.equal(qualification.oddGlc.packageVersion, exact.oddGlcPackageVersion);
  assert.equal(qualification.oddGlc.releaseTag, 'v0.1.0');
  assert.equal(qualification.oddGlc.releaseTagCommit, exact.oddGlcTagCommit);
  assert.equal(qualification.oddGlc.packageTarballSha256, exact.oddGlcTarballSha256);
  assert.equal(qualification.abiogenesis.packageName, exact.abiPackageName);
  assert.equal(qualification.abiogenesis.packageVersion, exact.abiPackageVersion);
  assert.equal(qualification.abiogenesis.releaseTag, exact.abiReleaseTag);
  assert.equal(qualification.abiogenesis.releaseTagCommit, exact.abiTagCommit);
  assert.equal(qualification.abiogenesis.sourceCommit, exact.abiSourceCommit);
  assert.equal(qualification.abiogenesis.packageTarballSha256, exact.abiTarballSha256);
  assert.equal(
    qualification.abiogenesis.releaseSnapshotManifestSha256,
    exact.abiReleaseManifestSha256,
  );
  assert.equal(
    qualification.abiogenesis.productToolchainManifestDigest,
    exact.abiToolchainDigest,
  );

  const releaseManifestBytes = readFileSync(join(fixtureRoot, 'release-snapshot-manifest.json'));
  assert.equal(releaseManifestBytes.byteLength, exact.releaseManifestBytes);
  assert.equal(sha256(releaseManifestBytes), exact.releaseManifestSha256);
  assert.equal(
    qualification.oddGlc.releaseSnapshotManifest.sha256,
    exact.releaseManifestSha256,
  );
  const releaseManifest = JSON.parse(releaseManifestBytes.toString('utf8'));
  assert.equal(releaseManifest.releaseIdentity, exact.oddGlcPackageVersion);
  assert.equal(releaseManifest.releaseTag, 'v0.1.0');
  assert.equal(releaseManifest.package.packageName, exact.oddGlcPackageName);
  assert.equal(releaseManifest.package.packageVersion, exact.oddGlcPackageVersion);
  assert.equal(releaseManifest.tarball.sha256, exact.oddGlcTarballSha256);
  assert.equal(releaseManifest.abgSubstrate.packageName, exact.abiPackageName);
  assert.equal(releaseManifest.abgSubstrate.packageVersion, exact.abiPackageVersion);
  assert.equal(releaseManifest.abgSubstrate.releaseTag, exact.abiReleaseTag);
  assert.equal(releaseManifest.abgSubstrate.sourceCommit, exact.abiSourceCommit);
  assert.equal(releaseManifest.abgSubstrate.snapshotCommit, exact.abiTagCommit);
  assert.equal(releaseManifest.abgSubstrate.tarballSha256, exact.abiTarballSha256);
  assert.equal(
    releaseManifest.abgSubstrate.releaseSnapshotManifestSha256,
    exact.abiReleaseManifestSha256,
  );
  assert.equal(
    releaseManifest.abgSubstrate.productToolchainManifestDigest,
    exact.abiToolchainDigest,
  );

  const encodedProof = readFileSync(
    join(fixtureRoot, qualification.liveProof.file),
    'utf8',
  );
  const proofBytes = gunzipSync(Buffer.from(encodedProof.replace(/\s+/g, ''), 'base64'));
  assert.equal(proofBytes.byteLength, exact.proofBytes);
  assert.equal(sha256(proofBytes), exact.proofSha256);
  assert.equal(qualification.liveProof.decodedBytes, exact.proofBytes);
  assert.equal(qualification.liveProof.decodedSha256, exact.proofSha256);

  const proof = JSON.parse(proofBytes.toString('utf8'));
  assert.equal(proof.kind, 'odd_glc_software_build_overlay_live_proof');
  assert.equal(proof.scenarioId, qualification.liveProof.scenarioId);
  assert.equal(proof.oddGlcInstallMode, releaseManifest.packedInstall.installMode);
  assert.equal(
    proof.oddGlcPackageTarballSha256,
    `sha256:${exact.oddGlcTarballSha256}`,
  );
  assert.equal(proof.substrate.packageName, exact.abiPackageName);
  assert.equal(proof.substrate.packageVersion, exact.abiPackageVersion);
  assert.equal(proof.substrate.releaseTag, exact.abiReleaseTag);
  assert.equal(proof.substrate.sourceCommit, exact.abiSourceCommit);
  assert.equal(proof.substrate.snapshotCommit, exact.abiTagCommit);
  assert.equal(proof.substrate.tarballSha256, exact.abiTarballSha256);
  assert.equal(
    proof.substrate.releaseSnapshotManifestSha256,
    exact.abiReleaseManifestSha256,
  );
  assert.equal(proof.substrate.productToolchainManifestDigest, exact.abiToolchainDigest);
  assert.equal(proof.eventSequence.length, qualification.expectedObservation.eventCount);
  assert.equal(
    proof.eventCounts.vector_closed,
    qualification.expectedObservation.closedVectorCount,
  );
  assert.equal(
    proof.eventCounts.registry_entry_admitted,
    qualification.expectedObservation.catalogEntryCount,
  );

  const projectRoot = mkdtempSync(join(tmpdir(), 'odd-manager-odd-glc-observation-'));
  try {
    mkdirSync(join(projectRoot, 'specification'), { recursive: true });
    writeFileSync(
      join(projectRoot, 'specification', 'PRODUCT.md'),
      '# odd_glc Product\n\n## Product Identity\n\nExact read-only observation fixture.\n',
      'utf8',
    );
    const runRoot = join(
      projectRoot,
      'test_runs',
      'odd-glc-0.1.0-abg-4.6.0-rc.3',
    );
    mkdirSync(runRoot, { recursive: true });
    writeFileSync(join(runRoot, 'odd-glc-basic-cli-live-proof.json'), proofBytes);

    const serverObservation = loadAbgRunObservation(projectRoot, { refresh: true });
    assertObservation(serverObservation, qualification.expectedObservation);

    const clientAdmission = await loadClientAdmissionModule();
    const admittedObservation = clientAdmission.asAbgRunObservation(serverObservation);
    assertObservation(admittedObservation, qualification.expectedObservation);

    assert.equal(existsSync(join(projectRoot, '.odd', 'build-carrier.json')), false);
    const buildAdmission = loadBuildCarrierDescriptor(
      {
        root: projectRoot,
        publishedProductRef: 'product://odd_glc',
      },
      {
        provisionerRefs: new Set([PROJECT_SNAPSHOT_PROVISIONER_REF]),
        adapterRefs: new Set(),
      },
    );
    assert.equal(buildAdmission.status, qualification.expectedBuildAdmission.status);
    assert.equal(buildAdmission.descriptor, qualification.expectedBuildAdmission.descriptor);
    assert.equal(buildAdmission.reason, qualification.expectedBuildAdmission.reason);
  } finally {
    rmSync(projectRoot, { recursive: true, force: true });
  }
});
