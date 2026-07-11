import { spawn } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { specificationProposalProviderResponseSchema } from '@odd-manager/developer-control-contracts';

const outputSchemaPath = fileURLToPath(
  new URL('./specification-proposal-output.schema.json', import.meta.url),
);

function boundedText(value, maxLength = 200000) {
  const text = String(value ?? '');
  return text.length <= maxLength ? text : `${text.slice(0, maxLength)}\n[truncated]`;
}

function proposalPrompt(input) {
  const attachmentSections = input.attachments.map((attachment) => [
    `### ${attachment.label}`,
    `Source: ${attachment.sourceRef}`,
    `Digest: ${attachment.digest}`,
    attachment.content === null ? '[Reference only; content is not locally readable.]' : attachment.content,
  ].join('\n'));
  const predecessor = input.predecessor
    ? [
        '## Predecessor Proposal',
        `Proposal: ${input.predecessor.proposalId}`,
        `Summary: ${input.predecessor.summary}`,
        'Patch:',
        input.predecessor.patch,
      ].join('\n')
    : 'No predecessor proposal.';

  return [
    'Produce one bounded specification proposal for the selected Project.',
    'You have read-only access. Do not edit, create, move, or delete any file.',
    'Return JSON that conforms exactly to the supplied output schema.',
    'The patch must be a complete unified Git diff and may touch only paths under specification/.',
    'Do not include implementation, generated output, runtime state, tickets, or commentary in the patch.',
    'affectedSurfaceRefs must exactly list the specification/ paths changed by the patch.',
    '',
    '## Project Basis',
    `Project: ${input.project.root}`,
    `Revision: ${input.basisRevision.revision}`,
    `Source digest: ${input.basisRevision.sourceDigest ?? 'unavailable'}`,
    `Specification digest: ${input.basisRevision.specificationDigest ?? 'unavailable'}`,
    '',
    '## Operator Request',
    input.prompt,
    '',
    predecessor,
    '',
    '## Bounded Context',
    attachmentSections.length > 0 ? attachmentSections.join('\n\n') : 'No additional context attachments.',
  ].join('\n');
}

function runCodex(args, options) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(options.binary, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ['pipe', 'ignore', 'pipe'],
    });
    let stderr = '';
    const timeout = setTimeout(() => {
      child.kill('SIGTERM');
      reject(new Error('specification proposal provider timed out'));
    }, options.timeoutMs);
    child.stderr.on('data', (chunk) => {
      stderr = boundedText(`${stderr}${chunk.toString()}`, 20000);
    });
    child.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`specification proposal provider exited with code ${String(code)}${stderr ? `: ${stderr.trim()}` : ''}`));
        return;
      }
      resolvePromise();
    });
    child.stdin.end(options.prompt);
  });
}

export function createCodexSpecificationProposalProvider(options = {}) {
  const binary = options.binary ?? process.env.OMAN_CODEX_BINARY ?? 'codex';
  const timeoutMs = Number(options.timeoutMs ?? process.env.OMAN_PROPOSAL_TIMEOUT_MS ?? 600000);
  return {
    participantRef: 'participant://codex/specification-proposal',
    async generate(input) {
      const outputRoot = mkdtempSync(join(tmpdir(), 'odd-manager-specification-proposal-'));
      const outputPath = join(outputRoot, 'proposal.json');
      try {
        const prompt = proposalPrompt(input);
        await runCodex([
          'exec',
          '-C', input.project.root,
          '--sandbox', 'read-only',
          '--skip-git-repo-check',
          '--ephemeral',
          '--color', 'never',
          '--output-schema', outputSchemaPath,
          '-o', outputPath,
          '-',
        ], {
          binary,
          cwd: input.project.root,
          timeoutMs,
          prompt,
        });
        return specificationProposalProviderResponseSchema.parse(
          JSON.parse(readFileSync(outputPath, 'utf8')),
        );
      } finally {
        rmSync(outputRoot, { recursive: true, force: true });
      }
    },
  };
}

function fullFileAppendPatch(relativePath, current, appendedLines) {
  const normalized = current.endsWith('\n') ? current.slice(0, -1) : current;
  const currentLines = normalized ? normalized.split('\n') : [];
  const nextLines = [...currentLines, ...appendedLines];
  const oldRange = currentLines.length === 0 ? '0,0' : `1,${currentLines.length}`;
  const newRange = nextLines.length === 0 ? '0,0' : `1,${nextLines.length}`;
  const body = [
    ...currentLines.map((line) => ` ${line}`),
    ...appendedLines.map((line) => `+${line}`),
  ];
  return [
    `diff --git a/${relativePath} b/${relativePath}`,
    `--- a/${relativePath}`,
    `+++ b/${relativePath}`,
    `@@ -${oldRange} +${newRange} @@`,
    ...body,
    '',
  ].join('\n');
}

export function createFixtureSpecificationProposalProvider() {
  return {
    participantRef: 'participant://fixture/specification-proposal',
    async generate(input) {
      const relativePath = 'specification/PRODUCT.md';
      const current = readFileSync(join(input.project.root, relativePath), 'utf8');
      const heading = input.predecessor ? 'Refined Proposal' : 'Proposed Change';
      const marker = basename(input.project.root).replace(/[^A-Za-z0-9_-]/g, '-');
      const patch = fullFileAppendPatch(relativePath, current, [
        '',
        `## ${heading}`,
        '',
        `${input.prompt} (${marker})`,
      ]);
      return specificationProposalProviderResponseSchema.parse({
        summary: `${heading} for ${relativePath}`,
        patch,
        affectedSurfaceRefs: [relativePath],
      });
    },
  };
}

