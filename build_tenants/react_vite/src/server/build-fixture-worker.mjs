import { createHash } from 'node:crypto';
import { mkdirSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const encoded = process.argv[2];
const resultPath = process.argv[3];
const evidenceBundlePath = process.argv[4];
const evidenceRoot = process.argv[5];
if (!encoded || !resultPath || !evidenceBundlePath || !evidenceRoot) {
  process.stderr.write('fixture worker requires encoded input and a result path\n');
  process.exit(64);
}

let input;
try {
  input = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
} catch {
  process.stderr.write('fixture worker input is invalid\n');
  process.exit(65);
}

const durationMs = Number(input.durationMs);
const outcome = String(input.outcome);
const label = String(input.label);
const tickMs = Math.max(25, Math.min(250, Math.floor(durationMs / 4)));
let tick = 0;
process.stdout.write(`[${label}] fixture build started\n`);
const timer = setInterval(() => {
  tick += 1;
  process.stdout.write(`[${label}] fixture build heartbeat ${tick}\n`);
}, tickMs);

setTimeout(() => {
  clearInterval(timer);
  const evidenceBundleRef = writeAssuranceEvidence(input, evidenceBundlePath, evidenceRoot);
  const result = {
    kind: outcome,
    resultRef: `build-result://fixture/${label}`,
    detail: outcome === 'converged'
      ? 'Fixture carrier reported convergence.'
      : outcome === 'waiting_human'
        ? 'Fixture carrier reported a waiting-human posture.'
        : 'Fixture carrier reported failure.',
    runRefs: [`run://fixture/${label}`],
    sourceRefs: [`fixture-carrier://${label}`, ...(evidenceBundleRef ? [evidenceBundleRef] : [])],
  };
  mkdirSync(dirname(resultPath), { recursive: true });
  const temporaryPath = `${resultPath}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, resultPath);
  process.stdout.write(`[${label}] fixture build ${outcome}\n`);
  process.exit(outcome === 'failed' ? 2 : 0);
}, durationMs);

function writeJsonAtomic(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporaryPath = `${path}.${process.pid}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  renameSync(temporaryPath, path);
}

function evidenceFile(root, key, value) {
  const path = `${root}/${key}.json`;
  const content = `${JSON.stringify(value, null, 2)}\n`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content, 'utf8');
  return `sha256:${createHash('sha256').update(content).digest('hex')}`;
}

function writeAssuranceEvidence(input, bundlePath, root) {
  const profile = String(input.assuranceProfile ?? 'none');
  if (profile === 'none') return null;
  const producerRef = 'producer://odd_manager/fixture-build-adapter';
  const gateResults = [];
  const assetResults = [];
  const addGate = (gateRef, status, evidenceKey, options = {}) => {
    const digest = evidenceFile(root, evidenceKey, {
      kind: 'fixture_gate_evidence', gateRef, status, executionId: input.executionId,
    });
    gateResults.push({
      gateRef,
      status,
      evidenceKey,
      digest: options.mismatch ? `sha256:${'0'.repeat(64)}` : digest,
      evidenceRefs: [`build-evidence://${input.executionId}/${evidenceKey}`],
      sourceRefs: [producerRef],
    });
  };
  const addAsset = (requirementRef, status, evidenceKey, options = {}) => {
    const digest = evidenceFile(root, evidenceKey, {
      kind: 'fixture_asset_evidence', requirementRef, status, executionId: input.executionId,
    });
    assetResults.push({
      requirementRef,
      status,
      evidenceKey,
      artifactRef: status === 'delivered' ? `artifact://fixture/${input.executionId}/software-package` : null,
      producerRef,
      digest: options.mismatch ? `sha256:${'f'.repeat(64)}` : digest,
      evidenceRefs: [`build-evidence://${input.executionId}/${evidenceKey}`],
      sourceRefs: [producerRef],
    });
  };

  if (profile === 'complete' || profile === 'proof_mismatch' || profile === 'revision_mismatch') {
    addGate('gate://fixture/tests', 'passed', 'tests');
    addGate('gate://fixture/depth', 'passed', 'depth', { mismatch: profile === 'proof_mismatch' });
    addGate('gate://fixture/human-review', 'passed', 'human-review');
    addAsset('requirement://fixture/software-package', 'delivered', 'software-package');
  } else if (profile === 'partial') {
    addGate('gate://fixture/tests', 'passed', 'tests');
  } else if (profile === 'fd_fail_waiting_human') {
    addGate('gate://fixture/tests', 'failed', 'tests');
    addGate('gate://fixture/depth', 'passed', 'depth');
    addGate('gate://fixture/human-review', 'waiting_human', 'human-review');
  }

  const revision = profile === 'revision_mismatch'
    ? { ...input.revision, sourceDigest: `sha256:${'9'.repeat(64)}` }
    : input.revision;
  const evidenceBundleRef = `build-evidence-bundle://${input.executionId}`;
  writeJsonAtomic(bundlePath, {
    schemaVersion: '1',
    evidenceBundleRef,
    executionId: input.executionId,
    projectRoot: input.projectRoot,
    revision,
    producerRef,
    observedAt: new Date().toISOString(),
    gateResults,
    assetResults,
    sourceRefs: [producerRef, evidenceBundleRef],
  });
  return evidenceBundleRef;
}
