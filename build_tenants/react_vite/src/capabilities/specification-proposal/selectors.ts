import type {
  CapabilityContribution,
  ProjectRevision,
  SpecificationProposal,
} from "@odd-manager/developer-control-contracts";

export type ProposalDiffLine = {
  kind: "addition" | "removal" | "context" | "meta";
  content: string;
  oldLine: number | null;
  newLine: number | null;
};

export type ProposalDiffFile = {
  path: string;
  lines: ProposalDiffLine[];
};

export function selectSpecificationProposalContribution(contributions: CapabilityContribution[]) {
  return contributions.find((entry) => entry.id === "specification-proposal") ?? null;
}

export function selectProposalDiff(proposal: SpecificationProposal | null): ProposalDiffFile[] {
  if (!proposal) return [];
  const files: ProposalDiffFile[] = [];
  let current: ProposalDiffFile | null = null;
  let oldLine = 0;
  let newLine = 0;
  for (const line of proposal.patch.split("\n")) {
    const fileMatch = line.match(/^diff --git a\/(.+) b\/(.+)$/);
    if (fileMatch) {
      current = { path: fileMatch[2], lines: [] };
      files.push(current);
      continue;
    }
    if (!current || line.startsWith("--- ") || line.startsWith("+++ ")) continue;
    const hunkMatch = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunkMatch) {
      oldLine = Number(hunkMatch[1]);
      newLine = Number(hunkMatch[2]);
      current.lines.push({ kind: "meta", content: line, oldLine: null, newLine: null });
      continue;
    }
    if (line.startsWith("+")) {
      current.lines.push({ kind: "addition", content: line.slice(1), oldLine: null, newLine });
      newLine += 1;
    } else if (line.startsWith("-")) {
      current.lines.push({ kind: "removal", content: line.slice(1), oldLine, newLine: null });
      oldLine += 1;
    } else if (line.startsWith(" ")) {
      current.lines.push({ kind: "context", content: line.slice(1), oldLine, newLine });
      oldLine += 1;
      newLine += 1;
    } else if (line) {
      current.lines.push({ kind: "meta", content: line, oldLine: null, newLine: null });
    }
  }
  return files;
}

export function selectProposalCanAccept(proposal: SpecificationProposal | null) {
  return Boolean(
    proposal
    && proposal.status === "valid"
    && proposal.validation.length > 0
    && proposal.validation.every((entry) => entry.status === "passed"),
  );
}

export function selectProposalIsCurrent(
  proposal: SpecificationProposal | null,
  revision: ProjectRevision | null,
) {
  return Boolean(
    proposal
    && revision
    && proposal.basisRevision.kind === revision.kind
    && proposal.basisRevision.revision === revision.revision
    && proposal.basisRevision.dirty === revision.dirty
    && proposal.basisRevision.sourceDigest === revision.sourceDigest
    && proposal.basisRevision.specificationDigest === revision.specificationDigest,
  );
}
