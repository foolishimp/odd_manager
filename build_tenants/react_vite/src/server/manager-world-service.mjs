import {
  constants as fsConstants,
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
} from "node:fs";
import { access } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";

const MANAGER_DOMAIN_CONTRACT_NAME = "odd_manager.node-world";
const MANAGER_DOMAIN_CONTRACT_VERSION = "v1";
const QUERY_CONTRACT_NAME = "odd_manager.node-world";
const QUERY_CONTRACT_VERSION = "v1";

const REQUIREMENT_METADATA_RE = /^\*\*(.+?)\*\*:\s*(.*)$/;
const BULLET_METADATA_RE = /^- ([A-Za-z0-9_-]+):\s*(.*)$/;
const REQUIREMENT_ID_RE = /\b(?:REQ|RIC)-[A-Z0-9-]+\b/g;
const REQUIREMENT_HEADING_RE = /^(?:REQ|RIC)-[A-Z0-9-]+\b/;
const REQUIREMENT_TABLE_ROW_RE =
  /^\|\s*((?:REQ|RIC)-[A-Z0-9-]+)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|/;
const INTENT_REF_RE = /\bINT-[A-Z0-9-]+\b/g;
const BACKTICK_REF_RE = /`([^`]+)`/g;
const PATH_REF_RE =
  /(?<![:\w])((?:\.ai-workspace|specification|build_tenants)\/[A-Za-z0-9_./-]+|README\.md)/g;

const SURFACE_MEDIA_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".htm", "text/html; charset=utf-8"],
  [".pdf", "application/pdf"],
  [".md", "text/markdown; charset=utf-8"],
  [".markdown", "text/markdown; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".cjs", "text/javascript; charset=utf-8"],
  [".ts", "text/plain; charset=utf-8"],
  [".tsx", "text/plain; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".yaml", "application/yaml; charset=utf-8"],
  [".yml", "application/yaml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".log", "text/plain; charset=utf-8"],
]);

const BINARY_SURFACE_EXTENSIONS = new Set([".pdf"]);

function nowIso() {
  return new Date().toISOString();
}

function readJson(path, fallback = null) {
  if (!existsSync(path)) {
    return fallback;
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

function readText(path, fallback = "") {
  if (!existsSync(path)) {
    return fallback;
  }
  try {
    return readFileSync(path, "utf8");
  } catch {
    return fallback;
  }
}

export function resolveManagerSurfacePath(workspaceRoot, relativePath) {
  const root = resolve(workspaceRoot);
  const target = resolve(root, relativePath);
  return {
    root,
    target,
    outsideWorkspace: !target.startsWith(`${root}/`) && target !== root,
  };
}

export function managerSurfaceMediaType(relativePath) {
  return SURFACE_MEDIA_TYPES.get(extensionForSurfacePath(relativePath)) ?? "text/plain; charset=utf-8";
}

function shouldReadSurfaceAsBinary(relativePath) {
  return BINARY_SURFACE_EXTENSIONS.has(extensionForSurfacePath(relativePath));
}

function extensionForSurfacePath(path) {
  const match = String(path ?? "").toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? "";
}

function uniqueStrings(values) {
  const seen = new Set();
  const ordered = [];
  for (const item of values) {
    const value = String(item ?? "").trim();
    if (!value || seen.has(value)) {
      continue;
    }
    seen.add(value);
    ordered.push(value);
  }
  return ordered;
}

function cleanValue(value) {
  return String(value ?? "").trim().replace(/^`|`$/g, "").trim();
}

function splitRefs(value) {
  if (typeof value !== "string") {
    return [];
  }
  return uniqueStrings(value.split(",").map(cleanValue));
}

function splitRecordRefs(value) {
  if (typeof value !== "string") {
    return [];
  }
  return uniqueStrings(value.replace(/;/g, ",").replace(/\|/g, ",").replace(/\sand\s/g, ",").split(",").map(cleanValue));
}

function titleCase(raw) {
  const text = String(raw ?? "").replace(/[-_]+/g, " ").replace(/\s+/g, " ").trim();
  return text.replace(/\b\w/g, (match) => match.toUpperCase()) || String(raw ?? "");
}

function statusRank(status) {
  return {
    blocked: 5,
    gated: 4,
    active: 3,
    pending: 2,
    converged: 1,
    attention: 0,
  }[status] ?? 0;
}

function dominantStatus(statuses) {
  const values = statuses.filter(Boolean);
  if (!values.length) {
    return "pending";
  }
  return [...values].sort((left, right) => statusRank(right) - statusRank(left))[0] ?? "pending";
}

function requirementTone(status) {
  const value = String(status ?? "").trim().toLowerCase();
  if (["realized", "converged", "ready", "completed", "fulfilled"].includes(value)) {
    return "converged";
  }
  if (["partially_realized", "in_progress", "active"].includes(value)) {
    return "active";
  }
  if (["planned", "pending", "specified", "draft", "not_fulfilled"].includes(value)) {
    return "pending";
  }
  if (["pending_capability", "blocked", "failed", "hard_block"].includes(value)) {
    return "blocked";
  }
  return "attention";
}

function priorityRank(priority) {
  const value = String(priority ?? "").trim().toLowerCase();
  if (value === "critical") return 4;
  if (value === "high") return 3;
  if (value === "medium") return 2;
  if (value === "low") return 1;
  return 0;
}

function loadRequirementClosureIndex(workspaceRoot) {
  const payload = readJson(join(workspaceRoot, ".ai-workspace/runtime/odd_sdlc-requirement-closure.json"), {});
  const entries = Array.isArray(payload?.requirements) ? payload.requirements : [];
  const indexed = new Map();
  for (const entry of entries) {
    if (entry && typeof entry === "object" && typeof entry.requirement_id === "string" && entry.requirement_id) {
      indexed.set(entry.requirement_id, entry);
    }
  }
  return indexed;
}

function parseMarkdownTableCells(line) {
  const stripped = String(line ?? "").trim();
  if (!stripped.startsWith("|") || !stripped.slice(1).includes("|")) {
    return null;
  }
  return stripped.slice(1, stripped.endsWith("|") ? -1 : undefined).split("|").map((cell) => cell.trim());
}

function normalizeRequirementFamilyTitle(raw) {
  const cleaned = String(raw ?? "").trim();
  if (cleaned.includes(":")) {
    const [prefix, suffix] = cleaned.split(/:(.*)/s);
    if (prefix.trim().toLowerCase() === "requirement family") {
      return suffix.trim();
    }
  }
  return cleaned;
}

function normalizeRequirementHeading(raw) {
  const text = String(raw ?? "").trim();
  for (const divider of [" — ", " - ", ": "]) {
    if (text.includes(divider)) {
      const [requirementId, title] = text.split(divider);
      return [requirementId.trim(), text.slice(requirementId.length + divider.length).trim()];
    }
  }
  return [text, ""];
}

function normalizeRequirementSectionHeading(raw) {
  let cleaned = String(raw ?? "").trim();
  const traces = uniqueStrings([...cleaned.matchAll(INTENT_REF_RE)].map((match) => match[0]));
  for (const divider of [" — ", " - "]) {
    if (cleaned.includes(divider)) {
      cleaned = cleaned.split(divider)[0].trim();
      break;
    }
  }
  cleaned = cleaned.replace(/^\d+\.\s*/, "").trim();
  return [cleaned || String(raw ?? "").trim(), traces];
}

function isAtomicRequirementId(value) {
  const parts = String(value ?? "").trim().split("-").filter(Boolean);
  if (parts.length < 3) {
    return false;
  }
  return parts.slice(2).some((part) => /\d/.test(part));
}

function parseFrontMatterBullets(lines) {
  const metadata = {};
  for (const line of lines) {
    const stripped = line.trim();
    const bullet = stripped.match(BULLET_METADATA_RE);
    if (bullet) {
      metadata[bullet[1].trim()] = cleanValue(bullet[2]);
      continue;
    }
    const rich = stripped.match(REQUIREMENT_METADATA_RE);
    if (rich) {
      metadata[rich[1].trim()] = cleanValue(rich[2]);
    }
  }
  return metadata;
}

function extractMarkdownSection(lines, heading) {
  const target = String(heading ?? "").trim().toLowerCase();
  let collecting = false;
  const collected = [];
  for (const line of lines) {
    const stripped = line.trim();
    if (stripped.startsWith("## ")) {
      if (collecting) {
        break;
      }
      collecting = stripped.slice(3).trim().toLowerCase() === target;
      continue;
    }
    if (collecting) {
      collected.push(line.replace(/\s+$/, ""));
    }
  }
  return collected.join("\n").trim();
}

function firstParagraph(text) {
  const lines = [];
  for (const line of String(text ?? "").split(/\r?\n/)) {
    const stripped = line.trim();
    if (!stripped) {
      if (lines.length) break;
      continue;
    }
    if (/^(#|- |\* )/.test(stripped)) {
      if (lines.length) break;
      continue;
    }
    lines.push(stripped);
  }
  return lines.join(" ").trim();
}

function isWorkspaceRelativePath(workspaceRoot, candidate) {
  let normalized = String(candidate ?? "").trim();
  if (!normalized || normalized.includes("://") || normalized.startsWith("/") || normalized.includes("\n") || normalized.length > 240) {
    return false;
  }
  if (normalized.startsWith("./")) {
    normalized = normalized.slice(2);
  }
  if (normalized.startsWith("../") || /\s/.test(normalized)) {
    return false;
  }
  if (
    normalized !== "README.md" &&
    !normalized.startsWith(".ai-workspace/") &&
    !normalized.startsWith("specification/") &&
    !normalized.startsWith("build_tenants/")
  ) {
    return false;
  }
  return existsSync(join(workspaceRoot, normalized));
}

function extractWorkspaceRefs(text, workspaceRoot) {
  const candidates = [
    ...[...String(text ?? "").matchAll(BACKTICK_REF_RE)].map((match) => match[1].trim()),
    ...[...String(text ?? "").matchAll(PATH_REF_RE)].map((match) => match[1].trim()),
  ];
  return uniqueStrings(candidates.map((candidate) => candidate.replace(/^\.\//, "")).filter((candidate) => isWorkspaceRelativePath(workspaceRoot, candidate)));
}

function extractRequirementIds(text) {
  return uniqueStrings([...String(text ?? "").matchAll(REQUIREMENT_ID_RE)].map((match) => match[0]));
}

function parseRequirementBlock({
  workspaceRoot,
  sourcePath,
  familyTitle,
  familyMetadata,
  requirementId,
  requirementTitle,
  blockLines,
  closureEntry,
}) {
  const metadata = {};
  const acceptanceCriteria = [];
  let collectingAcceptance = false;

  for (const line of blockLines) {
    const stripped = line.trim();
    if (!stripped) {
      continue;
    }
    const metadataMatch = stripped.match(REQUIREMENT_METADATA_RE);
    if (metadataMatch) {
      const key = metadataMatch[1].trim();
      metadata[key] = cleanValue(metadataMatch[2]);
      collectingAcceptance = key.toLowerCase() === "acceptance criteria";
      continue;
    }
    if (stripped.toLowerCase() === "acceptance criteria") {
      collectingAcceptance = true;
      continue;
    }
    if (collectingAcceptance && /^[-*]\s+/.test(stripped)) {
      acceptanceCriteria.push(cleanValue(stripped.replace(/^[-*]\s+/, "")));
      continue;
    }
    if (collectingAcceptance && acceptanceCriteria.length) {
      acceptanceCriteria[acceptanceCriteria.length - 1] = `${acceptanceCriteria.at(-1)} ${cleanValue(stripped)}`.trim();
      continue;
    }
    if (metadata.Description) {
      metadata.Description = `${metadata.Description} ${cleanValue(stripped)}`.trim();
    }
  }

  const coverage = closureEntry && typeof closureEntry === "object" ? closureEntry : null;
  const coverageStatus = typeof coverage?.status === "string" ? coverage.status.trim() : null;
  const familyStatus = familyMetadata.Status ?? null;
  const effectiveStatus = coverageStatus || familyStatus || metadata.Status || null;
  const description = metadata.Description || requirementTitle;

  return {
    requirement_id: requirementId,
    title: requirementTitle || requirementId,
    summary: description,
    family: familyMetadata.Family || "",
    family_title: familyTitle,
    family_status: familyStatus,
    priority: metadata.Priority || null,
    type: metadata.Type || familyMetadata.Category || null,
    status: effectiveStatus,
    delivery_status: requirementTone(effectiveStatus),
    traces_to: splitRefs(metadata["Traces To"] || familyMetadata["Traces To"]),
    derives_from: splitRefs(familyMetadata["Derives From"]),
    authority_refs: Array.isArray(coverage?.authority_refs) ? coverage.authority_refs : [],
    current_requirement_refs: Array.isArray(coverage?.current_requirement_refs) ? coverage.current_requirement_refs : [],
    implementation_claim_refs: Array.isArray(coverage?.implementation_claim_refs) ? coverage.implementation_claim_refs : [],
    planned_test_claim_refs: Array.isArray(coverage?.planned_test_claim_refs) ? coverage.planned_test_claim_refs : [],
    test_claim_refs: Array.isArray(coverage?.test_claim_refs) ? coverage.test_claim_refs : [],
    code_refs: Array.isArray(coverage?.code_refs) ? coverage.code_refs : [],
    test_refs: Array.isArray(coverage?.test_refs) ? coverage.test_refs : [],
    testcase_authority_refs: Array.isArray(coverage?.testcase_authority_refs) ? coverage.testcase_authority_refs : [],
    acceptance_criteria: acceptanceCriteria,
    source_path: relative(workspaceRoot, sourcePath),
  };
}

function parseRequirementTableRow({
  workspaceRoot,
  sourcePath,
  familyTitle,
  sectionTraces,
  requirementId,
  requirementTitle,
  priority,
  requirementType,
  requirementStatus,
  closureEntry,
}) {
  const coverage = closureEntry && typeof closureEntry === "object" ? closureEntry : null;
  const coverageStatus = typeof coverage?.status === "string" ? coverage.status.trim() : null;
  const tableStatus = typeof requirementStatus === "string" ? cleanValue(requirementStatus) : null;
  const effectiveStatus = coverageStatus || tableStatus || null;
  return {
    requirement_id: requirementId,
    title: requirementTitle || requirementId,
    summary: requirementTitle || requirementId,
    family: "",
    family_title: familyTitle,
    family_status: null,
    priority: cleanValue(priority),
    type: cleanValue(requirementType || "") || null,
    status: effectiveStatus,
    delivery_status: requirementTone(effectiveStatus),
    traces_to: sectionTraces,
    derives_from: [],
    authority_refs: Array.isArray(coverage?.authority_refs) ? coverage.authority_refs : [],
    current_requirement_refs: Array.isArray(coverage?.current_requirement_refs) ? coverage.current_requirement_refs : [],
    implementation_claim_refs: Array.isArray(coverage?.implementation_claim_refs) ? coverage.implementation_claim_refs : [],
    planned_test_claim_refs: Array.isArray(coverage?.planned_test_claim_refs) ? coverage.planned_test_claim_refs : [],
    test_claim_refs: Array.isArray(coverage?.test_claim_refs) ? coverage.test_claim_refs : [],
    code_refs: Array.isArray(coverage?.code_refs) ? coverage.code_refs : [],
    test_refs: Array.isArray(coverage?.test_refs) ? coverage.test_refs : [],
    testcase_authority_refs: Array.isArray(coverage?.testcase_authority_refs) ? coverage.testcase_authority_refs : [],
    acceptance_criteria: [],
    source_path: relative(workspaceRoot, sourcePath),
  };
}

function preferRequirementEntry(candidate, current) {
  function score(entry) {
    const sourcePath = String(entry.source_path || "");
    const evidenceCount = [
      "authority_refs",
      "implementation_claim_refs",
      "planned_test_claim_refs",
      "code_refs",
      "test_refs",
      "testcase_authority_refs",
    ].reduce((total, key) => total + (Array.isArray(entry[key]) ? entry[key].length : 0), 0);
    const acceptanceCount = Array.isArray(entry.acceptance_criteria) ? entry.acceptance_criteria.length : 0;
    const generatedPenalty = sourcePath.includes("generated") ? -1 : 0;
    return [generatedPenalty, evidenceCount, acceptanceCount];
  }
  const left = score(candidate);
  const right = score(current);
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return left[index] > right[index];
    }
  }
  return false;
}

export function projectRequirements(workspaceRoot) {
  const root = join(workspaceRoot, "specification/requirements");
  if (!existsSync(root)) {
    return [];
  }
  const closureIndex = loadRequirementClosureIndex(workspaceRoot);
  const projected = [];
  for (const filename of readdirSync(root).sort((left, right) => left.localeCompare(right))) {
    if (!filename.endsWith(".md") || filename.toLowerCase() === "readme.md") {
      continue;
    }
    const sourcePath = join(root, filename);
    let lines;
    try {
      lines = readFileSync(sourcePath, "utf8").split(/\r?\n/);
    } catch {
      continue;
    }
    let familyTitle = filename.replace(/\.md$/, "");
    const familyMetadata = {};
    let sectionTitle = familyTitle;
    let sectionTraces = [];
    let currentTableColumns = [];
    let currentRequirementId = null;
    let currentRequirementTitle = "";
    let currentBlockLines = [];

    function flushCurrentRequirement() {
      if (!currentRequirementId) {
        return;
      }
      projected.push(parseRequirementBlock({
        workspaceRoot,
        sourcePath,
        familyTitle,
        familyMetadata,
        requirementId: currentRequirementId,
        requirementTitle: currentRequirementTitle,
        blockLines: currentBlockLines,
        closureEntry: closureIndex.get(currentRequirementId),
      }));
      currentRequirementId = null;
      currentRequirementTitle = "";
      currentBlockLines = [];
    }

    for (const line of lines) {
      const stripped = line.trim();
      if (stripped.startsWith("# ") && familyTitle === filename.replace(/\.md$/, "")) {
        familyTitle = normalizeRequirementFamilyTitle(stripped.slice(2).trim());
        continue;
      }
      if (currentRequirementId === null) {
        const metadataMatch = stripped.match(REQUIREMENT_METADATA_RE);
        if (metadataMatch) {
          familyMetadata[metadataMatch[1].trim()] = cleanValue(metadataMatch[2]);
          continue;
        }
      }
      if (stripped.startsWith("### ")) {
        const headingText = stripped.slice(4).trim();
        if (REQUIREMENT_HEADING_RE.test(headingText)) {
          const [candidateId, candidateTitle] = normalizeRequirementHeading(headingText);
          if (isAtomicRequirementId(candidateId)) {
            flushCurrentRequirement();
            currentTableColumns = [];
            currentRequirementId = candidateId;
            currentRequirementTitle = candidateTitle;
            continue;
          }
        }
        flushCurrentRequirement();
        currentTableColumns = [];
        [sectionTitle, sectionTraces] = normalizeRequirementSectionHeading(headingText);
        continue;
      }
      const tableCells = parseMarkdownTableCells(stripped);
      if (tableCells) {
        const normalizedHeader = tableCells.map((cell) => cell.toLowerCase());
        if (normalizedHeader[0] === "id") {
          currentTableColumns = normalizedHeader;
          continue;
        }
        if (tableCells.every((cell) => /^-+:?$/.test(cell))) {
          continue;
        }
      }
      const tableMatch = stripped.match(REQUIREMENT_TABLE_ROW_RE);
      if (tableMatch) {
        flushCurrentRequirement();
        const requirementId = tableMatch[1].trim();
        if (!isAtomicRequirementId(requirementId)) {
          continue;
        }
        const fourthColumn = cleanValue(tableMatch[4]);
        const fourthHeader = currentTableColumns[3] || "";
        projected.push(parseRequirementTableRow({
          workspaceRoot,
          sourcePath,
          familyTitle: sectionTitle,
          sectionTraces,
          requirementId,
          requirementTitle: cleanValue(tableMatch[2]),
          priority: cleanValue(tableMatch[3]),
          requirementType: fourthHeader.includes("type") ? fourthColumn : null,
          requirementStatus: fourthHeader.includes("status") ? fourthColumn : null,
          closureEntry: closureIndex.get(requirementId),
        }));
        continue;
      }
      if (currentRequirementId !== null) {
        currentBlockLines.push(line);
      }
    }
    flushCurrentRequirement();
  }

  const deduped = new Map();
  for (const requirement of projected) {
    const requirementId = requirement.requirement_id;
    if (!requirementId) {
      continue;
    }
    const current = deduped.get(requirementId);
    if (!current || preferRequirementEntry(requirement, current)) {
      deduped.set(requirementId, requirement);
    }
  }
  return [...deduped.keys()].sort().map((requirementId) => deduped.get(requirementId));
}

function ticketIdFromStem(stem) {
  const match = stem.match(/^([A-Z]-\d+)/);
  return match ? match[1] : stem;
}

function projectTickets(workspaceRoot) {
  const ticketsRoot = join(workspaceRoot, ".ai-workspace/tickets");
  if (!existsSync(ticketsRoot)) {
    return [];
  }
  const projected = [];
  for (const folderName of ["active", "completed"]) {
    const folder = join(ticketsRoot, folderName);
    if (!existsSync(folder)) {
      continue;
    }
    for (const filename of readdirSync(folder).filter((entry) => entry.endsWith(".md")).sort()) {
      const sourcePath = join(folder, filename);
      const lines = readText(sourcePath).split(/\r?\n/);
      const metadata = parseFrontMatterBullets(lines);
      const titleLine = lines.find((line) => line.trim().startsWith("# "))?.trim().slice(2).trim() || filename.replace(/\.md$/, "");
      const ticketId = metadata.id || ticketIdFromStem(filename.replace(/\.md$/, ""));
      const fullText = lines.join("\n");
      const contextText = extractMarkdownSection(lines, "Context");
      projected.push({
        id: ticketId,
        title: titleLine.startsWith(`${ticketId} `) ? titleLine.slice(ticketId.length).trim() : titleLine,
        summary: firstParagraph(contextText) || titleLine,
        type: metadata.type || null,
        status: metadata.status || folderName,
        goal: metadata.goal || null,
        priority: metadata.priority || null,
        created_at: metadata.created_at || null,
        updated_at: metadata.updated_at || null,
        dependencies: splitRecordRefs(metadata.dependencies),
        links: extractWorkspaceRefs(fullText, workspaceRoot),
        linked_requirement_ids: extractRequirementIds(fullText),
        linked_surfaces: extractWorkspaceRefs(fullText, workspaceRoot),
        source_path: relative(workspaceRoot, sourcePath),
      });
    }
  }
  return projected;
}

function projectComments(workspaceRoot) {
  const commentsRoot = join(workspaceRoot, ".ai-workspace/comments");
  if (!existsSync(commentsRoot)) {
    return [];
  }
  const projected = [];
  function visit(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const sourcePath = join(directory, entry.name);
      if (entry.isDirectory()) {
        visit(sourcePath);
        continue;
      }
      if (!entry.isFile() || !entry.name.endsWith(".md")) {
        continue;
      }
      const lines = readText(sourcePath).split(/\r?\n/);
      const metadata = parseFrontMatterBullets(lines);
      const title = lines.find((line) => line.trim().startsWith("# "))?.trim().slice(2).trim() || entry.name.replace(/\.md$/, "");
      const summaryText = extractMarkdownSection(lines, "Summary");
      const fullText = lines.join("\n");
      projected.push({
        id: relative(workspaceRoot, sourcePath),
        title,
        summary: firstParagraph(summaryText) || firstParagraph(fullText) || title,
        author: metadata.Author || null,
        date: metadata.Date || null,
        status: metadata.Status || null,
        source: metadata.source || null,
        addresses: splitRecordRefs(metadata.Addresses),
        linked_requirement_ids: extractRequirementIds(fullText),
        linked_surfaces: extractWorkspaceRefs(fullText, workspaceRoot),
        source_path: relative(workspaceRoot, sourcePath),
      });
    }
  }
  visit(commentsRoot);
  return projected;
}

function emptyQueryContract() {
  return {
    name: QUERY_CONTRACT_NAME,
    version: QUERY_CONTRACT_VERSION,
    top_level_keys: [
      "query_contract",
      "workspace_root",
      "requirements",
      "tickets",
      "comments",
      "ambiguity_register",
      "assets",
      "collections",
      "bindings",
      "graph_functions",
      "workorders",
      "gaps",
    ],
    runtime_model: "abg-native-read-model",
    query_model: "odd-manager-node-projection",
  };
}

function projectDomainContract(queryContract) {
  const expected = [...queryContract.top_level_keys];
  return {
    projection_name: MANAGER_DOMAIN_CONTRACT_NAME,
    projection_version: MANAGER_DOMAIN_CONTRACT_VERSION,
    source_name: queryContract.name,
    source_version: queryContract.version,
    compatibility: "supported",
    supported_sources: [{ name: QUERY_CONTRACT_NAME, version: QUERY_CONTRACT_VERSION }],
    observed_top_level_keys: [...queryContract.top_level_keys],
    expected_top_level_keys: expected,
    missing_top_level_keys: [],
    extra_top_level_keys: [],
    source_contract_ref: "build_tenants/react_vite/src/server/manager-world-service.mjs",
    source_domain_model_ref: "specification/requirements/",
    source_query_ref: "build_tenants/react_vite/src/server/manager-world-service.mjs",
  };
}

function emptyGapPayload() {
  return {
    converged: true,
    graph_converged: true,
    carry_converged: true,
    fulfillment_converged: true,
    gaps: [],
    jobs_considered: 0,
    open_frames: 0,
    graph_total_delta: 0,
    direct_graph_delta: 0,
    carry_delta: 0,
    fulfillment_delta: 0,
    combined_delta: 0,
    total_delta: 0,
  };
}

function gapPayloadFromDossier(payload) {
  if (!payload || typeof payload !== "object") {
    return emptyGapPayload();
  }
  const summary = payload.summary && typeof payload.summary === "object" ? payload.summary : {};
  const rows = Array.isArray(payload.dossiers) ? payload.dossiers : [];
  const gaps = rows.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const gapTruth = row.gap_truth && typeof row.gap_truth === "object" ? row.gap_truth : {};
    const triage = row.triage && typeof row.triage === "object" ? row.triage : {};
    const authorityBasis = triage.authority_basis && typeof triage.authority_basis === "object" ? triage.authority_basis : {};
    const realizedBasis = triage.realized_basis && typeof triage.realized_basis === "object" ? triage.realized_basis : {};
    const edge = String(row.edge || gapTruth.signal_key || authorityBasis.edge || "").trim();
    if (!edge) return [];
    return [{
      edge,
      delta: Number(gapTruth.total_delta ?? realizedBasis.delta ?? 0),
      delta_summary: String(realizedBasis.delta_summary || gapTruth.gap_kind || ""),
      failing: uniqueStrings([
        ...(Array.isArray(gapTruth.failing) ? gapTruth.failing : []),
        ...(Array.isArray(gapTruth.graph_failing) ? gapTruth.graph_failing : []),
        ...(Array.isArray(authorityBasis.failing_evaluators) ? authorityBasis.failing_evaluators : []),
      ]),
      passing: [],
      blocking_reasons: uniqueStrings(Array.isArray(gapTruth.blocking_reasons) ? gapTruth.blocking_reasons : []),
      gap_kind: String(gapTruth.gap_kind || ""),
      route_state: String(row.route_binding?.state || ""),
      resumption_trigger: String(row.resumption_trigger || triage.resumption_trigger || ""),
      current_work_key: row.current_work_key ?? null,
    }];
  });
  const totalDelta = Number(summary.total_delta ?? gaps.reduce((sum, gap) => sum + Number(gap.delta || 0), 0));
  const unpublished = payload.published === false || summary.published === false;
  return {
    ...emptyGapPayload(),
    converged: unpublished ? false : totalDelta === 0 && gaps.length === 0,
    graph_converged: unpublished ? false : Number(summary.graph_total_delta ?? totalDelta) === 0,
    carry_converged: unpublished ? false : Number(payload.carry_delta ?? 0) === 0,
    fulfillment_converged: unpublished ? false : Number(payload.fulfillment_delta ?? 0) === 0,
    gaps,
    jobs_considered: Number(payload.jobs_considered ?? 0),
    open_frames: Number(payload.open_frames ?? 0),
    graph_total_delta: Number(summary.graph_total_delta ?? payload.graph_total_delta ?? totalDelta),
    direct_graph_delta: Number(payload.direct_graph_delta ?? 0),
    carry_delta: Number(payload.carry_delta ?? 0),
    fulfillment_delta: Number(payload.fulfillment_delta ?? 0),
    combined_delta: Number(payload.combined_delta ?? 0),
    total_delta: totalDelta,
    summary,
    gap_dossier_kind: String(payload.gap_dossier_kind || payload.register_kind || ""),
    schema_version: String(payload.schema_version || ""),
    scope: String(payload.scope || "workspace"),
    published: payload.published,
    unavailable_reason: String(payload.unavailable_reason || ""),
  };
}

function loadGapPayload(workspaceRoot) {
  const candidates = [
    ".ai-workspace/runtime/odd_sdlc-gap-dossier.json",
    ".ai-workspace/runtime/odd_sdlc-gaps.json",
    ".ai-workspace/runtime/odd_sdlc-gap-analysis.json",
  ];
  for (const relativePath of candidates) {
    const payload = readJson(join(workspaceRoot, relativePath), null);
    if (payload) {
      return gapPayloadFromDossier(payload);
    }
  }
  return emptyGapPayload();
}

function emptyAmbiguityRegister(workspaceRoot) {
  return {
    register_kind: "odd_sdlc.ambiguity_register",
    schema_version: "v2",
    workspace_root: workspaceRoot,
    stage: "unavailable",
    project_profile: {},
    summary: {
      total: 0,
      blocking: 0,
      hard_stop: 0,
      fh_required: 0,
      pending_capability: 0,
      status_counts: {},
    },
    ambiguities: [],
  };
}

function ambiguityOperatorFields(entry) {
  const ambiguityClass = String(entry.class || "");
  const policyAction = String(entry.policy_action || "");
  const decisionStatus = String(entry.decision_status || "");
  const expectedEdge = String(entry.expected_resolving_edge || "");
  const observedState = entry.observed_state && typeof entry.observed_state === "object" ? entry.observed_state : {};
  const capabilitySurface = typeof observedState.field_name === "string" && observedState.field_name ? observedState.field_name : null;
  const tenantName = typeof observedState.tenant_name === "string" && observedState.tenant_name ? observedState.tenant_name : null;

  let governancePosture = "Active ambiguity";
  if (entry.blocking || entry.hard_stop || policyAction === "hard_block") {
    governancePosture = ambiguityClass.includes("capability") ? "Capability declaration required" : "Hard stop";
  } else if (policyAction === "escalate_fh" || decisionStatus === "fh_required") {
    governancePosture = "Human resolution required";
  } else if (decisionStatus === "pending_capability" || policyAction === "pending_capability") {
    governancePosture = "Capability pending";
  } else if (policyAction === "carry") {
    governancePosture = "Carry with explicit oversight";
  } else if (policyAction === "observe") {
    governancePosture = "Observe without immediate intervention";
  }

  let operatorHeadline = String(entry.current_resolution || entry.description || "Resolve the active ambiguity before continuing the governed lane.");
  if (ambiguityClass.includes("capability") && capabilitySurface && expectedEdge) {
    operatorHeadline = `Declare \`${capabilitySurface}\` before \`${expectedEdge}\` becomes admissible.`;
  } else if (policyAction === "escalate_fh" && expectedEdge) {
    operatorHeadline = `Resolve this ambiguity through F_H before \`${expectedEdge}\` proceeds.`;
  } else if (expectedEdge) {
    operatorHeadline = `Resolve this ambiguity before \`${expectedEdge}\` proceeds.`;
  }

  let nextLawfulAction = String(entry.current_resolution || "Resolve the active ambiguity and record the governing decision.");
  if (ambiguityClass.includes("capability") && capabilitySurface) {
    nextLawfulAction = `Declare \`${capabilitySurface}\`${tenantName ? ` for tenant \`${tenantName}\`` : ""}${expectedEdge ? ` and reopen \`${expectedEdge}\`` : ""}.`;
  } else if (policyAction === "escalate_fh" && expectedEdge) {
    nextLawfulAction = `Take an F_H decision on \`${expectedEdge}\` and record the governing outcome.`;
  } else if (["carry", "observe"].includes(policyAction) && expectedEdge) {
    nextLawfulAction = `Continue bounded work on \`${expectedEdge}\` while keeping the ambiguity explicit.`;
  } else if (expectedEdge) {
    nextLawfulAction = `Resolve the governing decision for \`${expectedEdge}\` before reopening the lane.`;
  }

  return {
    governance_posture: governancePosture,
    operator_headline: operatorHeadline,
    next_lawful_action: nextLawfulAction,
    capability_surface: capabilitySurface,
    tenant_name: tenantName,
  };
}

function ambiguitySummaryCounts(register) {
  const entries = Array.isArray(register.ambiguities) ? register.ambiguities : [];
  const summary = register.summary && typeof register.summary === "object" ? register.summary : {};
  const counts = {
    total: Number(summary.total ?? entries.length),
    blocking: Number(summary.blocking ?? entries.filter((entry) => entry.blocking).length),
    hard_stop: Number(summary.hard_stop ?? entries.filter((entry) => entry.hard_stop).length),
    fh_required: Number(summary.fh_required ?? entries.filter((entry) => entry.policy_action === "escalate_fh" || entry.decision_status === "fh_required").length),
    pending_capability: Number(summary.pending_capability ?? entries.filter((entry) => entry.decision_status === "pending_capability" || entry.policy_action === "pending_capability" || String(entry.class || "").includes("capability")).length),
  };
  return counts;
}

function normalizeAmbiguityRegister(workspaceRoot) {
  const register = readJson(join(workspaceRoot, ".ai-workspace/runtime/odd_sdlc-ambiguity-register.json"), emptyAmbiguityRegister(workspaceRoot)) || emptyAmbiguityRegister(workspaceRoot);
  const ambiguities = (Array.isArray(register.ambiguities) ? register.ambiguities : [])
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({ ...entry, ...ambiguityOperatorFields(entry) }));
  const normalized = { ...register, ambiguities };
  const summary = normalized.summary && typeof normalized.summary === "object" ? normalized.summary : {};
  return {
    ...normalized,
    summary: {
      ...summary,
      ...ambiguitySummaryCounts(normalized),
      status_counts: summary.status_counts && typeof summary.status_counts === "object" ? summary.status_counts : {},
    },
  };
}

function assetCheckpoint(path) {
  try {
    const stat = statSync(path);
    return {
      exists: true,
      path_kind: stat.isDirectory() ? "directory" : "file",
      content_digest: null,
      bytes: stat.isFile() ? stat.size : null,
    };
  } catch {
    return {
      exists: false,
      path_kind: "missing",
      content_digest: null,
      bytes: null,
    };
  }
}

function assetForRelativePath(workspaceRoot, relativePath, declaredType, metadata = {}) {
  return {
    asset_id: `asset:${relativePath}`,
    uri: `workspace://${relativePath}`,
    declared_type: declaredType,
    kind: "workspace_surface",
    metadata,
    provenance: {
      model: "workspace-file",
      source: relativePath,
      mutable: true,
      history_basis: "filesystem",
    },
    checkpoint: assetCheckpoint(join(workspaceRoot, relativePath)),
    projection_source: "odd_manager.node-world",
  };
}

function buildDomainAssets(workspaceRoot, requirements, tickets, comments) {
  const sourceRefs = uniqueStrings([
    ...requirements.map((item) => item.source_path),
    ...tickets.map((item) => item.source_path),
    ...comments.map((item) => item.source_path),
    "specification/INTENT.md",
    "specification/PRODUCT.md",
  ].filter((relativePath) => relativePath && existsSync(join(workspaceRoot, relativePath))));
  return sourceRefs.map((relativePath) => {
    let declaredType = "manager_surface";
    if (relativePath.startsWith("specification/requirements/")) declaredType = "requirement_surface";
    if (relativePath.startsWith(".ai-workspace/tickets/")) declaredType = "ticket_surface";
    if (relativePath.startsWith(".ai-workspace/comments/")) declaredType = "comment_surface";
    if (relativePath === "specification/INTENT.md") declaredType = "intent_surface";
    if (relativePath === "specification/PRODUCT.md") declaredType = "product_surface";
    return assetForRelativePath(workspaceRoot, relativePath, declaredType, { basename: basename(relativePath) });
  });
}

function buildAssetFamilies() {
  return [
    {
      name: "requirement_surfaces",
      description: "Project-owned requirement authority surfaces.",
      lifecycle_role: "authority",
      representative_asset_types: ["requirement_surface"],
      realization_status: "active",
    },
    {
      name: "operator_records",
      description: "Tickets and comments carrying operator record truth.",
      lifecycle_role: "record",
      representative_asset_types: ["ticket_surface", "comment_surface"],
      realization_status: "active",
    },
    {
      name: "product_definition",
      description: "Intent and product-definition surfaces.",
      lifecycle_role: "authority",
      representative_asset_types: ["intent_surface", "product_surface"],
      realization_status: "active",
    },
  ];
}

function buildCollections(assets) {
  return [
    {
      name: "manager_authority",
      assets: assets.filter((asset) => ["requirement_surface", "intent_surface", "product_surface"].includes(asset.declared_type)),
    },
    {
      name: "operator_records",
      assets: assets.filter((asset) => ["ticket_surface", "comment_surface"].includes(asset.declared_type)),
    },
  ];
}

function buildRequirementWorkorders(requirements) {
  const byFamily = new Map();
  for (const requirement of requirements) {
    const key = requirement.family_title || "Requirements";
    if (!byFamily.has(key)) {
      byFamily.set(key, []);
    }
    byFamily.get(key).push(requirement);
  }
  return [...byFamily.entries()].map(([familyTitle, entries]) => {
    const id = `requirement-family:${familyTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "requirements"}`;
    return {
      id,
      label: familyTitle,
      status: dominantStatus(entries.map((entry) => entry.delivery_status)),
      intent: `Project and close the ${familyTitle} requirement family.`,
      inputs: uniqueStrings(entries.flatMap((entry) => entry.derives_from)),
      outputs: entries.map((entry) => entry.requirement_id),
      graph_function_id: "graph-function:manager-requirement-traceability",
      graph_function_name: "manager_requirement_traceability",
      gap: null,
      run_ids: [],
      call_ids: [],
      open_continuation_ids: [],
      source: "requirement_family",
    };
  });
}

function buildGraphFunctions(workorders) {
  return [
    {
      id: "graph-function:manager-requirement-traceability",
      name: "manager_requirement_traceability",
      label: "Manager Requirement Traceability",
      status: dominantStatus(workorders.map((workorder) => workorder.status)),
      intent: "Project manager-owned requirement authority, record surfaces, and realized closure refs into an inspectable graph.",
      function_kind: "read_model_projection",
      inputs: ["specification/requirements", ".ai-workspace/runtime/odd_sdlc-requirement-closure.json"],
      outputs: ["graphset.workspace"],
      environment: {
        requires: ["node"],
        provides: ["manager_world_projection"],
        carries: ["spec_method_traceability"],
      },
      vectors: [
        {
          name: "project_requirement_authority",
          source: ["specification/requirements"],
          target: "graphset.workspace",
        },
      ],
      job_names: workorders.map((workorder) => workorder.id),
      workorder_ids: workorders.map((workorder) => workorder.id),
    },
  ];
}

function moduleSurfaceForPath(relativePath) {
  const normalized = String(relativePath ?? "").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("specification/")) {
    return null;
  }
  for (const marker of ["/src/main/", "/src/test/", "/src/"]) {
    if (normalized.includes(marker)) {
      return normalized.split(marker)[0] || dirname(normalized);
    }
  }
  const parent = dirname(normalized);
  return parent && parent !== "." ? parent : null;
}

function describeSurface(relativePath) {
  const normalized = String(relativePath ?? "").toLowerCase();
  if (relativePath.startsWith("specification/requirements/")) {
    return ["Requirement Surface", "converged", "requirement authority"];
  }
  if (relativePath.startsWith("specification/")) {
    return normalized.includes("testcase") || normalized.includes("acceptance")
      ? ["Acceptance Surface", "pending", "acceptance definition"]
      : ["Design Surface", "converged", "design input"];
  }
  if (
    normalized.includes("/tests/") ||
    normalized.includes("/test/") ||
    normalized.includes("/src/test/") ||
    normalized.endsWith(".spec.ts") ||
    normalized.endsWith(".spec.tsx") ||
    normalized.endsWith(".test.ts") ||
    normalized.endsWith(".test.tsx") ||
    normalized.endsWith(".mjs")
  ) {
    return ["Test Surface", "pending", "test evidence"];
  }
  return ["Code Surface", "active", "implementation file"];
}

function buildRequirementTraceabilityGraph(requirements) {
  const nodes = [];
  const segments = [];
  const nodeIds = new Set();
  const segmentIds = new Set();

  function appendNode(node) {
    if (nodeIds.has(node.id)) return;
    nodeIds.add(node.id);
    nodes.push(node);
  }

  function appendSegment(segment) {
    if (segmentIds.has(segment.id) || !nodeIds.has(segment.from) || !nodeIds.has(segment.to)) return;
    segmentIds.add(segment.id);
    segments.push(segment);
  }

  function ensureRequirementNode(requirement) {
    const nodeId = `requirement:${requirement.requirement_id}`;
    appendNode({
      id: nodeId,
      node_name: requirement.requirement_id,
      label: requirement.requirement_id,
      kind: "catalog",
      status: requirement.delivery_status || "attention",
      description: requirement.title || requirement.summary || requirement.requirement_id,
      subtitle: [requirement.priority, requirement.family_title].filter(Boolean).join(" · ") || "requirement",
      asset_ids: [],
      ref_kind: "requirement",
      ref_id: requirement.requirement_id,
      input_node_ids: [],
      output_node_ids: [],
    });
    return nodeId;
  }

  function ensureSurfaceNode(relativePath) {
    const [title, tone, subtitle] = describeSurface(relativePath);
    const nodeId = `surface:${relativePath}`;
    appendNode({
      id: nodeId,
      node_name: relativePath,
      label: basename(relativePath),
      kind: "asset_node",
      status: tone,
      description: title,
      subtitle,
      asset_ids: [`asset:${relativePath}`],
      ref_kind: "surface",
      ref_id: relativePath,
      input_node_ids: [],
      output_node_ids: [],
    });
    return nodeId;
  }

  function ensureModuleNode(modulePath) {
    const nodeId = `module:${modulePath}`;
    appendNode({
      id: nodeId,
      node_name: modulePath,
      label: basename(modulePath),
      kind: "catalog",
      status: "active",
      description: "Module or implementation area carrying requirement realization.",
      subtitle: "module",
      asset_ids: [],
      ref_kind: "surface",
      ref_id: modulePath,
      input_node_ids: [],
      output_node_ids: [],
    });
    return nodeId;
  }

  const orderedRequirements = [...requirements].sort((left, right) => {
    const priorityDiff = priorityRank(right.priority) - priorityRank(left.priority);
    return priorityDiff || left.requirement_id.localeCompare(right.requirement_id);
  });

  for (const requirement of orderedRequirements) {
    const requirementNodeId = ensureRequirementNode(requirement);
    const added = new Set();
    function addSurface(path, label) {
      const normalized = String(path ?? "").trim().replace(/^\.\//, "");
      if (!normalized || normalized.includes("://") || added.has(normalized)) return;
      added.add(normalized);
      const surfaceNodeId = ensureSurfaceNode(normalized);
      appendSegment({
        id: `${requirement.requirement_id}->${label}:${normalized}`,
        from: requirementNodeId,
        to: surfaceNodeId,
        label,
        status: label.includes("test") ? "pending" : "active",
        ref_id: normalized,
      });
      const modulePath = moduleSurfaceForPath(normalized);
      if (modulePath) {
        const moduleNodeId = ensureModuleNode(modulePath);
        appendSegment({
          id: `${normalized}->module:${modulePath}`,
          from: surfaceNodeId,
          to: moduleNodeId,
          label: "module",
          status: "active",
          ref_id: modulePath,
        });
      }
    }
    addSurface(requirement.source_path, "authority");
    for (const path of requirement.current_requirement_refs || []) addSurface(path, "current");
    for (const path of requirement.implementation_claim_refs || []) addSurface(path, "implementation");
    for (const path of requirement.code_refs || []) addSurface(path, "code");
    for (const path of requirement.test_refs || []) addSurface(path, "test");
    for (const path of requirement.testcase_authority_refs || []) addSurface(path, "testcase");
  }

  return {
    id: "graph.requirement-traceability",
    label: "Requirement Traceability",
    status: dominantStatus(nodes.map((node) => node.status)),
    derivation: "specification/requirements plus requirement closure register",
    nodes,
    segments,
  };
}

function buildGraphSet(requirements, workorders) {
  const graphs = [];
  if (requirements.length) {
    graphs.push(buildRequirementTraceabilityGraph(requirements));
  }
  return {
    id: "graphset.workspace",
    label: "Workspace Graph Set",
    status: dominantStatus([...graphs.map((graph) => graph.status), ...workorders.map((workorder) => workorder.status)]),
    graphs,
  };
}

function eventValue(event, key) {
  if (event?.[key] !== undefined && event?.[key] !== null) {
    return event[key];
  }
  return event?.data?.[key] ?? null;
}

function collectIds(events, key) {
  return uniqueStrings(events.map((event) => eventValue(event, key)).filter(Boolean));
}

function readEvents(workspaceRoot) {
  const candidates = [
    ".ai-workspace/events/events.jsonl",
    ".ai-workspace/runtime/events.jsonl",
    ".ai-workspace/runtime/abg/events.jsonl",
  ];
  for (const relativePath of candidates) {
    const absolutePath = join(workspaceRoot, relativePath);
    if (!existsSync(absolutePath)) {
      continue;
    }
    return readText(absolutePath)
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .flatMap((line) => {
        try {
          return [JSON.parse(line)];
        } catch {
          return [];
        }
      });
  }
  return [];
}

function projectAggregate(events, id, key, assetType, extraKeys = []) {
  const related = events.filter((event) => eventValue(event, key) === id);
  const latest = related.at(-1) || {};
  const failure = related.findLast?.((event) => event.event_type === "failed" || eventValue(event, "status") === "failed") ?? null;
  const status = String(eventValue(latest, "status") || (failure ? "failed" : related.length ? "observed" : "unknown"));
  const projected = {
    asset_type: assetType,
    instance_id: id,
    status,
    event_count: related.length,
  };
  for (const extraKey of extraKeys) {
    projected[extraKey] = eventValue(latest, extraKey);
  }
  return projected;
}

function projectRuntime(workspaceRoot) {
  const events = readEvents(workspaceRoot);
  const runIds = collectIds(events, "run_id");
  const callIds = collectIds(events, "call_id");
  const continuationIds = collectIds(events, "continuation_id");
  const frameIds = collectIds(events, "frame_id");
  return {
    runs: runIds.map((id) => projectAggregate(events, id, "run_id", "run", [
      "work_key",
      "run_id",
      "edge",
      "vector_id",
      "job_id",
      "worker_id",
      "role_id",
      "authority_ref",
      "selected_worker_id",
      "selected_backend",
      "assignment_source",
      "resolved_runtime_ref",
      "failure_class",
      "attempt_number",
      "superseded_by",
    ])),
    graph_calls: callIds.map((id) => projectAggregate(events, id, "call_id", "graph_call", [
      "call_id",
      "run_id",
      "graph_function_id",
      "materialization_id",
      "failure_class",
    ])),
    continuations: continuationIds.map((id) => projectAggregate(events, id, "continuation_id", "continuation", [
      "continuation_id",
      "continuation_kind",
      "run_id",
      "caused_by_event_id",
      "call_id",
      "frame_attempt_id",
    ])),
    frames: frameIds.map((id) => projectAggregate(events, id, "frame_id", "frame", [
      "frame_lineage_id",
      "frame_attempt_id",
      "call_id",
      "parent_key",
      "parent_edge",
      "graph_function",
      "materialization_id",
      "checkpoint_id",
    ])),
    recent_events: events.slice(-30).map((event) => ({
      event_id: event.event_id ?? null,
      event_time: event.event_time ?? null,
      event_type: event.event_type ?? null,
      aggregate_type: event.aggregate_type ?? null,
      aggregate_id: event.aggregate_id ?? null,
      run_id: eventValue(event, "run_id"),
      call_id: eventValue(event, "call_id"),
      continuation_id: eventValue(event, "continuation_id"),
      frame_id: eventValue(event, "frame_id"),
    })),
    event_count: events.length,
    latest_event_time: events.at(-1)?.event_time ?? null,
  };
}

export function composeManagerWorld(workspaceRoot) {
  const root = resolve(workspaceRoot);
  const requirements = projectRequirements(root);
  const tickets = projectTickets(root);
  const comments = projectComments(root);
  const assets = buildDomainAssets(root, requirements, tickets, comments);
  const workorders = buildRequirementWorkorders(requirements);
  const graphFunctions = buildGraphFunctions(workorders);
  const graphSet = buildGraphSet(requirements, workorders);
  const runtime = projectRuntime(root);
  const gaps = loadGapPayload(root);
  const ambiguityRegister = normalizeAmbiguityRegister(root);
  const queryContract = emptyQueryContract();
  const activeRuns = runtime.runs.filter((run) => ["queued", "pending", "started", "dispatched", "active"].includes(String(run.status))).length;
  const openContinuations = runtime.continuations.filter((continuation) => continuation.status === "open").length;
  const ambiguityCounts = ambiguitySummaryCounts(ambiguityRegister);
  const overviewStatus = dominantStatus([
    graphSet.status,
    ...workorders.map((workorder) => workorder.status),
    gaps.converged ? "converged" : "pending",
    ambiguityCounts.blocking || ambiguityCounts.hard_stop ? "blocked" : null,
    ambiguityCounts.fh_required ? "gated" : null,
  ].filter(Boolean));

  let headline = "Manager world projection is derived from Node-owned workspace read models.";
  if (ambiguityCounts.blocking > 0 || ambiguityCounts.hard_stop > 0) {
    headline = "Published ambiguity currently hard-blocks one or more governed paths.";
  } else if (ambiguityCounts.fh_required > 0) {
    headline = "Published ambiguity currently requires F_H resolution.";
  } else if (!gaps.converged) {
    headline = "Published gap analysis reports open convergence pressure.";
  } else if (openContinuations > 0) {
    headline = "Open continuations require review or correction.";
  } else if (activeRuns > 0) {
    headline = "Runtime work is currently active.";
  }

  return {
    workspace_root: root,
    generated_at: nowIso(),
    boundary: {
      runtime_source: "workspace_event_surfaces",
      runtime_aggregate_provider: "odd_manager_node_projector",
      domain_source: "specification_and_workspace_records",
      graph_derivation: "specification requirements plus closure refs and manager-owned record surfaces",
      query_cadence: "on_demand",
    },
    overview: {
      status: overviewStatus,
      headline,
      summary: "odd_manager composes manager-owned Node projections from specification, runtime, and record surfaces without a Python helper or shadow runtime.",
      total_delta: Number(gaps.total_delta || 0),
      total_assets: assets.length,
      total_workorders: workorders.length,
      total_gaps: Array.isArray(gaps.gaps) ? gaps.gaps.length : 0,
      active_runs: activeRuns,
      open_continuations: openContinuations,
      latest_event_time: runtime.latest_event_time,
    },
    graph_set: graphSet,
    domain: {
      workspace_root: root,
      query_contract: queryContract,
      domain_contract: projectDomainContract(queryContract),
      semantic_facets: [
        {
          name: "spec_method_traceability",
          description: "Authority flows from specification through design, code, proof, and projected delta.",
        },
      ],
      asset_types: [],
      asset_families: buildAssetFamilies(),
      assets,
      start_target_catalog: [],
      asset_ownership_index: [],
      operational_capabilities: {},
      execution_contract_surface: {},
      gap_dossier: {},
      requirements,
      tickets,
      comments,
      ambiguity_register: ambiguityRegister,
      collections: buildCollections(assets),
      bindings: requirements.map((requirement) => ({
        node: requirement.requirement_id,
        asset_ids: [`asset:${requirement.source_path}`],
      })),
      functions: [],
      edge_contracts: [],
      programs: [],
      work_act_types: [],
      jobs: workorders.map((workorder) => ({
        name: workorder.id,
        contracts: [{ kind: "graph_function", target_id: workorder.graph_function_id }],
      })),
      graph_functions: graphFunctions,
      workorders,
      gaps,
    },
    runtime,
  };
}

export function readManagerSurface(workspaceRoot, relativePath) {
  const { root, target, outsideWorkspace } = resolveManagerSurfacePath(workspaceRoot, relativePath);
  if (outsideWorkspace) {
    return {
      kind: "unreadable",
      relative_path: relativePath,
      path: target,
      reason: "outside_workspace",
      error: "surface path resolves outside the active Project root",
    };
  }
  if (!existsSync(target)) {
    return {
      kind: "missing",
      relative_path: relativePath,
      path: target,
    };
  }
  try {
    const stat = statSync(target);
    if (stat.isDirectory()) {
      const entries = readdirSync(target, { withFileTypes: true })
        .sort((left, right) => left.name.localeCompare(right.name))
        .map((entry) => ({
          name: entry.name,
          kind: entry.isDirectory() ? "directory" : "file",
          relative_path: relative(root, join(target, entry.name)),
        }));
      return {
        kind: "directory",
        relative_path: relativePath,
        path: target,
        entries: entries.slice(0, 200),
        truncated: entries.length > 200,
      };
    }
    const mediaType = managerSurfaceMediaType(relativePath);
    const binary = shouldReadSurfaceAsBinary(relativePath);
    return {
      kind: "file",
      relative_path: relativePath,
      path: target,
      content: binary ? "" : readFileSync(target, "utf8"),
      media_type: mediaType,
      encoding: binary ? "binary" : "utf8",
      size_bytes: stat.size,
    };
  } catch (error) {
    return {
      kind: "unreadable",
      relative_path: relativePath,
      path: target,
      reason: error?.code === "EACCES" || error?.code === "EPERM" ? "permission_denied" : "read_error",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function runManagerCommand(workspaceRoot, command, options = {}) {
  if (command === "gaps") {
    const world = composeManagerWorld(workspaceRoot);
    return {
      ok: true,
      command,
      source: "odd_manager_node_projection",
      overview: world.overview,
      gaps: world.domain.gaps,
    };
  }
  await access(resolve(workspaceRoot), fsConstants.R_OK);
  return {
    ok: false,
    command,
    auto: Boolean(options.auto),
    status: "unavailable",
    error: `${command} traversal is not implemented in odd_manager's Node-only tenant runtime. Use the configured odd_sdlc service integration for execution, or add a Node domain-package command adapter as the single source of truth.`,
  };
}
