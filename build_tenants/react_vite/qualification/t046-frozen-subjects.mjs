import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
export const T046_MANIFEST = JSON.parse(readFileSync(new URL('./fixtures/abg-5-rc1/subjects.json', import.meta.url), 'utf8'));
const tenant = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function resolveT046EvidenceRoot() {
  return resolve(process.env.OMAN_T046_EVIDENCE_ROOT ?? join(tenant, '../../../abiogenesis/.ai-workspace/comments/codex/20260928_FRAMED_GOVERNANCE'));
}
export function resolveT046Subjects() {
  const root = resolveT046EvidenceRoot();
  return T046_MANIFEST.subjects.map((subject) => {
    for (const file of subject.files) {
      const path = join(root, file.source);
      const bytes = readFileSync(path);
      if (bytes.length !== file.bytes || createHash('sha256').update(bytes).digest('hex') !== file.sha256) throw new Error(`T046 frozen member differs: ${path}`);
    }
    return { ...subject, path: join(root, subject.sourceRoot) };
  });
}
export function copyT046Subjects(projectRoot) {
  const subjects = resolveT046Subjects();
  for (const subject of subjects) {
    const target = join(projectRoot, 'test_runs', subject.key);
    mkdirSync(target, { recursive: true });
    for (const file of subject.files) copyFileSync(join(resolveT046EvidenceRoot(), file.source), join(target, file.name));
  }
  return { projectRoot, subjects: subjects.map((s) => ({ ...s, path: join(projectRoot, 'test_runs', s.key) })) };
}
