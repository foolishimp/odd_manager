import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { dirname, extname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const here = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPOSITORY_ROOT = resolve(here, "../../..");

const GOALS_PATH = "specification/GOALS.md";
const INTENT_PATH = "specification/INTENT.md";
const PRODUCT_PATH = "specification/PRODUCT.md";
const REQUIREMENTS_ROOT = "specification/requirements";
const SCENARIOS_ROOT = "specification/scenarios";
const DESIGN_ROOTS = [
  "build_tenants/common/design",
  "build_tenants/react_vite/design",
];
const CAPABILITIES_ROOT = "build_tenants/react_vite/src/capabilities";

const PRODUCT_OUTCOME_PATTERN = /\bPO-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g;
const REQUIREMENT_FAMILY_PATTERN = /\bREQ-[A-Z0-9]+(?:-[A-Z0-9]+)+-\*/g;
const REQUIREMENT_ID_PATTERN = /\bREQ-[A-Z0-9]+(?:-[A-Z0-9]+)+-\d{3}\b/g;
const SCENARIO_ID_PATTERN = /\bSCN-[A-Z0-9]+(?:-[A-Z0-9]+)+\b/g;
const REQUIRED_UX_BINDINGS = [
  "state",
  "msg",
  "update",
  "cmd",
  "sub",
  "ingress",
  "view",
  "membrane",
  "replay",
  "accessibility",
];

function normalizeRelativePath(value) {
  return value.replaceAll("\\", "/").replace(/^\.\/+/, "").replace(/\/+$/, "");
}

function listFiles(root, predicate) {
  if (!existsSync(root)) return [];
  const found = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const target = resolve(current, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && predicate(target)) found.push(target);
    }
  };
  visit(root);
  return found.sort();
}

function lineNumber(text, index) {
  return text.slice(0, Math.max(index, 0)).split("\n").length;
}

function metadataValue(text, name) {
  const lines = text.split(/\r?\n/);
  const pattern = new RegExp(`^\\*\\*${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\*\\*:\\s*(.*)$`, "i");
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(pattern);
    if (!match) continue;
    const value = [match[1].trim()];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor];
      if (!next.trim()) break;
      if (/^#{1,6}\s/.test(next) || /^\*\*[^*]+\*\*:\s*/.test(next)) break;
      value.push(next.trim().replace(/^[-*]\s+/, ""));
    }
    return value.filter(Boolean).join(" ");
  }
  return null;
}

function metadataEntries(text, names) {
  const expected = new Set(names.map((name) => name.toLowerCase()));
  const lines = text.split(/\r?\n/);
  const entries = [];
  for (let index = 0; index < lines.length; index += 1) {
    const marker = lines[index].match(/^\*\*([^*]+)\*\*:\s*(.*)$/);
    if (!marker || !expected.has(marker[1].trim().toLowerCase())) continue;
    const value = [marker[2].trim()];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const next = lines[cursor];
      if (!next.trim()) break;
      if (/^#{1,6}\s/.test(next) || /^\*\*[^*]+\*\*:\s*/.test(next)) break;
      value.push(next.trim().replace(/^[-*]\s+/, ""));
    }
    entries.push({
      name: marker[1].trim(),
      line: index + 1,
      value: value.filter(Boolean).join(" "),
    });
  }
  return entries;
}

function documentStatus(text) {
  const bold = metadataValue(text, "Status");
  if (bold) return bold.trim();
  const frontmatter = text.match(/^---\s*\n([\s\S]*?)\n---(?:\s*\n|$)/);
  const yamlStatus = frontmatter?.[1].match(/^Status:\s*(.+)$/im);
  return yamlStatus?.[1]?.trim() ?? null;
}

function isActiveDesignStatus(status) {
  if (!status) return false;
  const normalized = status.toLowerCase();
  if (normalized.includes("superseded in part")) return true;
  if (normalized.startsWith("superseded")) return false;
  return normalized === "active" || normalized === "accepted";
}

function inlineCodeValues(value) {
  if (!value) return [];
  return [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1].trim());
}

function unique(values) {
  return [...new Set(values)];
}

function setDifference(left, right) {
  return [...left].filter((value) => !right.has(value));
}

function pathWithin(root, target) {
  const path = relative(root, target);
  return path === "" || (!path.startsWith(`..${sep}`) && path !== "..");
}

function issue(errors, code, subject, detail) {
  errors.push({ code, subject, detail });
}

function derivationPathReferences(value) {
  return inlineCodeValues(value ?? "")
    .map(normalizeRelativePath)
    .filter((path) => path.includes("/") && !path.includes("://"));
}

function inspectDerivationMetadata(
  repositoryRoot,
  subjectPath,
  text,
  errors,
) {
  const entries = metadataEntries(text, ["Derived From", "Derives From"]);
  if (entries.length === 0) {
    issue(
      errors,
      "MISSING_DERIVATION_METADATA",
      subjectPath,
      "document has no explicit Derived From relation",
    );
    return [];
  }
  if (entries.length > 1) {
    const values = new Set(entries.map((entry) => entry.value));
    issue(
      errors,
      values.size === 1
        ? "DUPLICATE_DERIVATION_METADATA"
        : "CONTRADICTORY_DERIVATION_METADATA",
      subjectPath,
      `document declares ${entries.length} derivation metadata entries`,
    );
  }

  const references = entries.flatMap((entry) => derivationPathReferences(entry.value));
  const seen = new Set();
  const admitted = [];
  for (const reference of references) {
    if (seen.has(reference)) {
      issue(
        errors,
        "DUPLICATE_DERIVATION_LINK",
        subjectPath,
        `derivation target is repeated: ${reference}`,
      );
      continue;
    }
    seen.add(reference);
    const resolved = resolveTracePath(
      repositoryRoot,
      reference,
      errors,
      subjectPath,
      "MISSING_DERIVATION_TARGET",
    );
    if (resolved) admitted.push(resolved.relative);
  }
  return admitted;
}

function validateConstitutionalDerivations(
  derivations,
  constitutionalRanks,
  errors,
) {
  const requiredDirectParents = new Map([
    [INTENT_PATH, GOALS_PATH],
    [PRODUCT_PATH, INTENT_PATH],
  ]);
  for (const [subject, parent] of requiredDirectParents) {
    const references = derivations.get(subject) ?? [];
    if (!references.includes(parent)) {
      issue(
        errors,
        "MISSING_CONSTITUTIONAL_DERIVATION",
        subject,
        `required direct upstream relation is missing: ${parent}`,
      );
    }
  }
  for (const [subject, references] of derivations) {
    if (subject.startsWith(`${REQUIREMENTS_ROOT}/`) && !references.includes(PRODUCT_PATH)) {
      issue(
        errors,
        "MISSING_CONSTITUTIONAL_DERIVATION",
        subject,
        `requirement family must derive directly from ${PRODUCT_PATH}`,
      );
    }
    const subjectRank = constitutionalRanks.get(subject);
    for (const target of references) {
      const targetRank = constitutionalRanks.get(target);
      if (targetRank === undefined || subjectRank === undefined) continue;
      if (target === subject) {
        issue(
          errors,
          "CIRCULAR_CONSTITUTIONAL_DERIVATION",
          subject,
          `document derives from itself: ${target}`,
        );
      } else if (targetRank > subjectRank) {
        issue(
          errors,
          "REVERSED_CONSTITUTIONAL_DERIVATION",
          subject,
          `upstream authority cannot derive from downstream ${target}`,
        );
      } else if (targetRank === subjectRank) {
        issue(
          errors,
          "CONTRADICTORY_CONSTITUTIONAL_DERIVATION",
          subject,
          `same-layer requirement derivation is not an ordered constitutional link: ${target}`,
        );
      }
    }
  }

  const adjacency = new Map(
    [...derivations].map(([subject, references]) => [
      subject,
      references.filter((target) => constitutionalRanks.has(target)).sort(),
    ]),
  );
  const state = new Map();
  const stack = [];
  const reportedCycles = new Set();
  const visit = (subject) => {
    state.set(subject, "visiting");
    stack.push(subject);
    for (const target of adjacency.get(subject) ?? []) {
      if (!adjacency.has(target)) continue;
      if (state.get(target) === "visiting") {
        const start = stack.indexOf(target);
        const cycle = [...stack.slice(start), target];
        const identity = [...new Set(cycle.slice(0, -1))].sort().join("|");
        if (!reportedCycles.has(identity)) {
          reportedCycles.add(identity);
          issue(
            errors,
            "CIRCULAR_CONSTITUTIONAL_DERIVATION",
            subject,
            `constitutional derivation cycle: ${cycle.join(" -> ")}`,
          );
        }
      } else if (!state.has(target)) {
        visit(target);
      }
    }
    stack.pop();
    state.set(subject, "visited");
  };
  for (const subject of [...adjacency.keys()].sort()) {
    if (!state.has(subject)) visit(subject);
  }
}

function resolveTracePath(repositoryRoot, rawPath, errors, subject, code = "MISSING_PATH") {
  const normalized = normalizeRelativePath(rawPath);
  if (!normalized || normalized.includes("://")) {
    issue(errors, "INVALID_PATH", subject, `trace path is not repository-relative: ${rawPath}`);
    return null;
  }
  const absolute = resolve(repositoryRoot, normalized);
  if (!pathWithin(repositoryRoot, absolute)) {
    issue(errors, "INVALID_PATH", subject, `trace path escapes the repository: ${rawPath}`);
    return null;
  }
  if (!existsSync(absolute)) {
    issue(errors, code, subject, `trace path does not exist: ${normalized}`);
    return null;
  }
  return { absolute, relative: normalized };
}

function sourceFileKind(path) {
  const extension = extname(path).toLowerCase();
  if (extension === ".tsx") return ts.ScriptKind.TSX;
  if (extension === ".ts") return ts.ScriptKind.TS;
  if (extension === ".jsx") return ts.ScriptKind.JSX;
  if (extension === ".js" || extension === ".mjs" || extension === ".cjs") return ts.ScriptKind.JS;
  return ts.ScriptKind.Unknown;
}

function executableTestTitles(path) {
  const text = readFileSync(path, "utf8");
  const source = ts.createSourceFile(
    path,
    text,
    ts.ScriptTarget.Latest,
    true,
    sourceFileKind(path),
  );
  const titles = new Set();
  const visit = (node) => {
    if (ts.isCallExpression(node) && node.arguments.length > 0) {
      const expression = node.expression;
      const directTest = ts.isIdentifier(expression) && (expression.text === "test" || expression.text === "it");
      const qualifiedTest = ts.isPropertyAccessExpression(expression)
        && ["only", "skip", "fixme", "fail", "slow"].includes(expression.name.text)
        && ts.isIdentifier(expression.expression)
        && (expression.expression.text === "test" || expression.expression.text === "it");
      const title = node.arguments[0];
      if (
        (directTest || qualifiedTest)
        && (ts.isStringLiteral(title) || ts.isNoSubstitutionTemplateLiteral(title))
      ) {
        titles.add(title.text);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return titles;
}

function validateProofSelector(repositoryRoot, selector, errors, subject, proofCache) {
  const delimiter = selector.indexOf(" :: ");
  if (delimiter < 1 || delimiter === selector.length - 4) {
    issue(
      errors,
      "INVALID_PROOF_SELECTOR",
      subject,
      `expected "path :: exact test title", received: ${selector}`,
    );
    return null;
  }
  const rawPath = selector.slice(0, delimiter).trim();
  const title = selector.slice(delimiter + 4).trim();
  const resolved = resolveTracePath(repositoryRoot, rawPath, errors, subject, "MISSING_PROOF_PATH");
  if (!resolved) return null;
  if (!statSync(resolved.absolute).isFile()) {
    issue(errors, "INVALID_PROOF_PATH", subject, `proof selector is not a file: ${resolved.relative}`);
    return null;
  }
  let titles = proofCache.get(resolved.absolute);
  if (!titles) {
    titles = executableTestTitles(resolved.absolute);
    proofCache.set(resolved.absolute, titles);
  }
  if (!titles.has(title)) {
    issue(
      errors,
      "MISSING_TEST_TITLE",
      subject,
      `test title not found in ${resolved.relative}: ${title}`,
    );
  }
  return {
    id: `${resolved.relative} :: ${title}`,
    path: resolved.relative,
    title,
  };
}

function proofSelectorsFromValue(value) {
  const selectors = new Set();
  for (const segment of (value ?? "").split(";")) {
    const plain = segment.replaceAll("`", "").trim();
    if (plain.includes(" :: ")) selectors.add(plain);
  }
  for (const code of inlineCodeValues(value ?? "")) {
    if (code.includes(" :: ")) selectors.add(code);
  }
  return [...selectors];
}

function expandRequirementReferences(value, families, requirements, errors, subject) {
  const references = new Set();
  const plain = (value ?? "").replaceAll("`", "");

  for (const wildcard of plain.match(REQUIREMENT_FAMILY_PATTERN) ?? []) {
    const family = families.get(wildcard);
    if (!family) {
      issue(errors, "UNKNOWN_REQUIREMENT_FAMILY", subject, `unknown requirement family: ${wildcard}`);
      continue;
    }
    for (const requirementId of family.requirementIds) references.add(requirementId);
  }

  const rangePattern = new RegExp(
    `(${REQUIREMENT_ID_PATTERN.source})\\s+(?:through|to)\\s+(${REQUIREMENT_ID_PATTERN.source})`,
    "g",
  );
  for (const match of plain.matchAll(rangePattern)) {
    const [startId, endId] = [match[1], match[2]];
    const startParts = startId.match(/^(.*-)(\d{3})$/);
    const endParts = endId.match(/^(.*-)(\d{3})$/);
    if (!startParts || !endParts || startParts[1] !== endParts[1]) {
      issue(errors, "INVALID_REQUIREMENT_RANGE", subject, `range crosses families: ${startId} through ${endId}`);
      continue;
    }
    const start = Number(startParts[2]);
    const end = Number(endParts[2]);
    if (start > end) {
      issue(errors, "INVALID_REQUIREMENT_RANGE", subject, `range is descending: ${startId} through ${endId}`);
      continue;
    }
    for (let number = start; number <= end; number += 1) {
      const id = `${startParts[1]}${String(number).padStart(3, "0")}`;
      if (!requirements.has(id)) {
        issue(errors, "REQUIREMENT_RANGE_HOLE", subject, `range includes unknown requirement: ${id}`);
      } else {
        references.add(id);
      }
    }
  }

  for (const requirementId of plain.match(REQUIREMENT_ID_PATTERN) ?? []) {
    if (!requirements.has(requirementId)) {
      issue(errors, "UNKNOWN_REQUIREMENT", subject, `unknown requirement: ${requirementId}`);
    } else {
      references.add(requirementId);
    }
  }
  return references;
}

function parseTableRows(section) {
  const rows = [];
  for (const line of section.split(/\r?\n/)) {
    if (!line.trim().startsWith("|")) continue;
    const cells = line
      .trim()
      .replace(/^\|/, "")
      .replace(/\|$/, "")
      .split("|")
      .map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-{3,}:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

function parseUxBindings(value) {
  const bindings = new Map();
  for (const segment of (value ?? "").split(";")) {
    const match = segment.trim().match(/^([A-Za-z][A-Za-z -]*)\s*=\s*(.+)$/);
    if (!match) continue;
    bindings.set(match[1].trim().toLowerCase(), match[2].trim());
  }
  return bindings;
}

function isUxGovernedDesign(text) {
  return /\bUX_METHOD\b|\bSTDO-UX\b/i.test(text);
}

function designPathIsExcluded(path) {
  const name = path.split("/").at(-1)?.toLowerCase();
  return name === "readme.md" || name === "odd_manager_dashboard.md";
}

function pathCoveredByEntrypoint(sourcePath, entrypoint) {
  const source = normalizeRelativePath(sourcePath);
  const entry = normalizeRelativePath(entrypoint);
  if (source === entry) return true;
  const sourceDirectory = source.slice(0, source.lastIndexOf("/"));
  return entry === sourceDirectory
    || entry.startsWith(`${sourceDirectory}/`)
    || source.startsWith(`${entry}/`);
}

export function auditStdoTraceability(repositoryRoot = DEFAULT_REPOSITORY_ROOT) {
  const root = resolve(repositoryRoot);
  const errors = [];
  const proofCache = new Map();
  const graph = {
    constitutionalDocuments: [],
    outcomes: [],
    requirementFamilies: [],
    requirements: [],
    designs: [],
    scenarios: [],
    sources: [],
    proofs: [],
    edges: [],
  };

  const constitutionalRanks = new Map([
    [GOALS_PATH, 0],
    [INTENT_PATH, 1],
    [PRODUCT_PATH, 2],
  ]);
  const derivations = new Map();
  for (const [path, role] of [
    [GOALS_PATH, "Goals"],
    [INTENT_PATH, "Intent"],
    [PRODUCT_PATH, "Product Definition"],
  ]) {
    const absolute = resolve(root, path);
    if (!existsSync(absolute)) {
      issue(
        errors,
        path === PRODUCT_PATH ? "MISSING_PRODUCT" : `MISSING_${role.toUpperCase()}`,
        path,
        `${role} authority is missing`,
      );
      continue;
    }
    const text = readFileSync(absolute, "utf8");
    const derivesFrom = inspectDerivationMetadata(root, path, text, errors);
    derivations.set(path, derivesFrom);
    graph.constitutionalDocuments.push({
      id: path,
      path,
      role,
      derivesFrom,
    });
  }

  const productAbsolute = resolve(root, PRODUCT_PATH);
  if (!existsSync(productAbsolute)) {
    validateConstitutionalDerivations(derivations, constitutionalRanks, errors);
    return finalizeReport(graph, errors);
  }
  const productText = readFileSync(productAbsolute, "utf8");
  const outcomeHeading = productText.search(/^## Product Outcome Identities\s*$/m);
  const outcomeSection = outcomeHeading < 0
    ? ""
    : productText.slice(
      outcomeHeading,
      productText.slice(outcomeHeading + 1).search(/^##\s/m) < 0
        ? productText.length
        : outcomeHeading + 1 + productText.slice(outcomeHeading + 1).search(/^##\s/m),
    );
  const outcomes = new Map();
  for (const match of outcomeSection.matchAll(/^\s*-\s+`(PO-[A-Z0-9]+(?:-[A-Z0-9]+)+)`\s+(?:—|-)\s+.+$/gm)) {
    const id = match[1];
    if (outcomes.has(id)) {
      issue(errors, "DUPLICATE_PRODUCT_OUTCOME", PRODUCT_PATH, `duplicate Product outcome: ${id}`);
      continue;
    }
    const node = { id, path: PRODUCT_PATH, line: lineNumber(productText, outcomeHeading + match.index) };
    outcomes.set(id, node);
    graph.outcomes.push(node);
  }
  if (outcomeHeading < 0 || outcomes.size === 0) {
    issue(errors, "MISSING_PRODUCT_OUTCOMES", PRODUCT_PATH, "no stable Product outcome identities were found");
  }

  const requirementFiles = listFiles(
    resolve(root, REQUIREMENTS_ROOT),
    (path) => /^\d{2}-.+\.md$/.test(path.split(sep).at(-1)),
  );
  for (const absolute of requirementFiles) {
    constitutionalRanks.set(normalizeRelativePath(relative(root, absolute)), 3);
  }
  const families = new Map();
  const requirements = new Map();
  for (const absolute of requirementFiles) {
    const path = normalizeRelativePath(relative(root, absolute));
    const text = readFileSync(absolute, "utf8");
    const familyId = inlineCodeValues(metadataValue(text, "Family"))
      .find((value) => /^REQ-[A-Z0-9]+(?:-[A-Z0-9]+)+-\*$/.test(value));
    if (!familyId) continue;
    if (families.has(familyId)) {
      issue(errors, "DUPLICATE_REQUIREMENT_FAMILY", path, `duplicate requirement family: ${familyId}`);
      continue;
    }
    const derivesFrom = inspectDerivationMetadata(root, path, text, errors);
    derivations.set(path, derivesFrom);
    const status = metadataValue(text, "Status");
    const category = metadataValue(text, "Category");
    const requirementIds = [];
    for (const match of text.matchAll(/^###\s+(REQ-[A-Z0-9]+(?:-[A-Z0-9]+)+-\d{3})\s+-\s+.+$/gm)) {
      const id = match[1];
      if (requirements.has(id)) {
        issue(errors, "DUPLICATE_REQUIREMENT", path, `duplicate requirement identity: ${id}`);
        continue;
      }
      if (!id.startsWith(familyId.slice(0, -1))) {
        issue(errors, "REQUIREMENT_FAMILY_MISMATCH", path, `${id} does not belong to ${familyId}`);
      }
      const node = { id, familyId, path, line: lineNumber(text, match.index) };
      requirements.set(id, node);
      graph.requirements.push(node);
      requirementIds.push(id);
    }
    if (requirementIds.length === 0) {
      issue(errors, "EMPTY_REQUIREMENT_FAMILY", path, `${familyId} declares no requirements`);
    }

    const outcomeValue = metadataValue(text, "Product Outcomes");
    const outcomeIds = unique((outcomeValue?.match(PRODUCT_OUTCOME_PATTERN) ?? []));
    if (outcomeIds.length === 0) {
      issue(errors, "MISSING_REQUIREMENT_OUTCOME", path, `${familyId} names no Product outcome`);
    }
    for (const outcomeId of outcomeIds) {
      if (!outcomes.has(outcomeId)) {
        issue(errors, "UNKNOWN_PRODUCT_OUTCOME", path, `${familyId} references unknown Product outcome: ${outcomeId}`);
      }
      graph.edges.push({ from: familyId, to: outcomeId, kind: "derives-from-product" });
    }

    const disposition = metadataValue(text, "Downstream Disposition");
    const deferment = {
      basis: metadataValue(text, "Deferment Basis"),
      owner: metadataValue(text, "Deferment Owner"),
      endCondition: metadataValue(text, "Deferment End Condition"),
    };
    const defermentValues = Object.values(deferment).filter(Boolean);
    const dispositionLower = disposition?.toLowerCase() ?? "";
    const isMixed = dispositionLower.startsWith("mixed");
    const isDeferred = !isMixed && dispositionLower.includes("deferred") && !dispositionLower.includes("realized");
    const isRealized = dispositionLower.includes("realized");
    const isRepair = dispositionLower.includes("repair admitted");
    if (!disposition) {
      issue(errors, "MISSING_DISPOSITION", path, `${familyId} has no downstream disposition`);
    } else if (!isMixed && !isDeferred && !isRealized && !isRepair) {
      issue(errors, "UNKNOWN_DISPOSITION", path, `${familyId} has an unrecognized disposition: ${disposition}`);
    }
    if ((isMixed || isDeferred) && defermentValues.length !== 3) {
      issue(
        errors,
        "INCOMPLETE_DEFERMENT_METADATA",
        path,
        `${familyId} deferment requires basis, owner, and end condition`,
      );
    }
    if (!isMixed && !isDeferred && defermentValues.length > 0) {
      issue(
        errors,
        "INVALID_MIXED_DEFERMENT_METADATA",
        path,
        `${familyId} carries deferment metadata without a mixed or deferred disposition`,
      );
    }
    let deferredRequirementIds = new Set();
    if (isMixed) {
      const listed = disposition.match(REQUIREMENT_ID_PATTERN) ?? [];
      const listedSet = new Set(listed);
      if (listed.length !== listedSet.size) {
        issue(errors, "DUPLICATE_MIXED_DISPOSITION_ID", path, `${familyId} repeats a requirement in its mixed disposition`);
      }
      const missing = setDifference(new Set(requirementIds), listedSet);
      const unknown = setDifference(listedSet, new Set(requirementIds));
      if (missing.length > 0 || unknown.length > 0) {
        issue(
          errors,
          "INVALID_MIXED_DISPOSITION_COVERAGE",
          path,
          `${familyId} mixed disposition must name every family member exactly once; missing=${missing.join(",") || "none"} unknown=${unknown.join(",") || "none"}`,
        );
      }
      const deferredClause = disposition.match(/;\s*(.+?)\s+are explicitly deferred/i)?.[1] ?? "";
      deferredRequirementIds = new Set(deferredClause.match(REQUIREMENT_ID_PATTERN) ?? []);
    } else if (isDeferred) {
      deferredRequirementIds = new Set(requirementIds);
    }
    if (isRepair && !/\bT-\d+\b/.test(disposition)) {
      issue(errors, "UNOWNED_REPAIR_DISPOSITION", path, `${familyId} repair disposition names no ticket owner`);
    }

    const testcaseAuthority = metadataValue(text, "Testcase Authority");
    if (!testcaseAuthority) {
      issue(errors, "MISSING_TESTCASE_AUTHORITY", path, `${familyId} has no testcase authority`);
    }
    const testcasePaths = inlineCodeValues(testcaseAuthority ?? "")
      .filter((value) => value.includes("/") && !value.includes(" :: "));
    for (const testcasePath of testcasePaths) {
      resolveTracePath(root, testcasePath, errors, path, "MISSING_TESTCASE_AUTHORITY_PATH");
    }

    const family = {
      id: familyId,
      path,
      status,
      category,
      outcomeIds,
      requirementIds,
      disposition,
      deferredRequirementIds,
      testcasePaths,
      derivesFrom,
    };
    families.set(familyId, family);
    graph.requirementFamilies.push({
      id: familyId,
      path,
      status,
      category,
      disposition,
      requirementIds: [...requirementIds],
      derivesFrom,
    });
  }

  validateConstitutionalDerivations(derivations, constitutionalRanks, errors);
  const familyByPath = new Map(
    [...families.values()].map((family) => [family.path, family.id]),
  );
  for (const [subject, references] of derivations) {
    for (const target of references) {
      if (!constitutionalRanks.has(target)) continue;
      graph.edges.push({
        from: familyByPath.get(subject) ?? subject,
        to: familyByPath.get(target) ?? target,
        kind: "constitutional-derives-from",
      });
    }
  }

  const designFiles = DESIGN_ROOTS.flatMap((designRoot) => listFiles(
    resolve(root, designRoot),
    (path) => path.endsWith(".md"),
  ));
  const activeDesigns = [];
  const sourceOwners = new Map();
  const proofOwners = new Map();
  for (const absolute of unique(designFiles)) {
    const path = normalizeRelativePath(relative(root, absolute));
    if (designPathIsExcluded(path)) continue;
    const text = readFileSync(absolute, "utf8");
    const status = documentStatus(text);
    if (!isActiveDesignStatus(status)) continue;

    const implementsValue = metadataValue(text, "Implements");
    if (!implementsValue) {
      issue(errors, "MISSING_DESIGN_IMPLEMENTS", path, "active design has no Implements metadata");
    }
    const designOutcomeIds = unique(implementsValue?.match(PRODUCT_OUTCOME_PATTERN) ?? []);
    if (designOutcomeIds.length === 0) {
      issue(errors, "MISSING_DESIGN_OUTCOME", path, "active design Implements metadata names no Product outcome");
    }
    for (const outcomeId of designOutcomeIds) {
      if (!outcomes.has(outcomeId)) {
        issue(errors, "UNKNOWN_PRODUCT_OUTCOME", path, `active design references unknown Product outcome: ${outcomeId}`);
      }
      graph.edges.push({ from: path, to: outcomeId, kind: "design-derives-from-product" });
    }
    const implementedRequirements = expandRequirementReferences(
      implementsValue,
      families,
      requirements,
      errors,
      path,
    );
    if (implementedRequirements.size === 0) {
      issue(errors, "MISSING_DESIGN_REQUIREMENTS", path, "active design Implements metadata names no requirement");
    }
    for (const requirementId of implementedRequirements) {
      const family = families.get(requirements.get(requirementId)?.familyId);
      if (
        family
        && designOutcomeIds.length > 0
        && !designOutcomeIds.some((outcomeId) => family.outcomeIds.includes(outcomeId))
      ) {
        issue(
          errors,
          "DESIGN_OUTCOME_REQUIREMENT_DISCONNECT",
          path,
          `${requirementId} shares no Product outcome with this design`,
        );
      }
      graph.edges.push({ from: path, to: requirementId, kind: "implements" });
    }

    const codeValue = metadataValue(text, "Code Entrypoints");
    const codeEntrypoints = inlineCodeValues(codeValue ?? "")
      .filter((value) => !value.includes(" :: "));
    if (!codeValue || codeEntrypoints.length === 0) {
      issue(errors, "MISSING_CODE_ENTRYPOINTS", path, "active design has no Code Entrypoints metadata");
    }
    const admittedCodeEntrypoints = [];
    for (const entrypoint of codeEntrypoints) {
      const resolved = resolveTracePath(root, entrypoint, errors, path, "MISSING_CODE_ENTRYPOINT");
      if (!resolved) continue;
      admittedCodeEntrypoints.push(resolved.relative);
      if (!sourceOwners.has(resolved.relative)) sourceOwners.set(resolved.relative, new Set());
      sourceOwners.get(resolved.relative).add(path);
      graph.edges.push({ from: path, to: resolved.relative, kind: "realizes-at" });
    }

    const proofValue = metadataValue(text, "Executable Proof");
    const proofSelectors = proofSelectorsFromValue(proofValue);
    if (!proofValue || proofSelectors.length === 0) {
      issue(errors, "MISSING_EXECUTABLE_PROOF", path, "active design has no Executable Proof metadata");
    }
    const admittedProofs = [];
    for (const selector of proofSelectors) {
      const proof = validateProofSelector(root, selector, errors, path, proofCache);
      if (!proof) continue;
      admittedProofs.push(proof.id);
      if (!proofOwners.has(proof.id)) proofOwners.set(proof.id, new Set());
      proofOwners.get(proof.id).add(path);
      graph.edges.push({ from: path, to: proof.id, kind: "proved-by" });
    }

    const uxGoverned = isUxGovernedDesign(text);
    const uxValue = metadataValue(text, "STDO-UX Bindings");
    const uxBindings = parseUxBindings(uxValue);
    if (uxGoverned) {
      if (!uxValue) {
        issue(errors, "MISSING_UX_BINDINGS", path, "UX-governed active design has no STDO-UX Bindings metadata");
      } else {
        for (const binding of REQUIRED_UX_BINDINGS) {
          if (!uxBindings.has(binding) || !uxBindings.get(binding)) {
            issue(errors, "MISSING_UX_BINDING", path, `STDO-UX binding is missing: ${binding}`);
          }
        }
      }
      for (const bindingName of ["replay", "accessibility"]) {
        const selectorValue = uxBindings.get(bindingName);
        const selectors = proofSelectorsFromValue(selectorValue);
        if (selectorValue && selectors.length !== 1) {
          issue(
            errors,
            "INVALID_UX_PROOF_BINDING",
            path,
            `${bindingName} must name exactly one "path :: exact test title" selector`,
          );
        }
        for (const selector of selectors) {
          const proof = validateProofSelector(
            root,
            selector,
            errors,
            `${path}#${bindingName}`,
            proofCache,
          );
          if (!proof) continue;
          if (!proofOwners.has(proof.id)) proofOwners.set(proof.id, new Set());
          proofOwners.get(proof.id).add(`${path}#${bindingName}`);
          graph.edges.push({ from: path, to: proof.id, kind: `ux-${bindingName}-proof` });
        }
      }
    }

    const design = {
      id: path,
      path,
      status,
      outcomeIds: designOutcomeIds,
      requirementIds: [...implementedRequirements],
      codeEntrypoints: admittedCodeEntrypoints,
      proofs: admittedProofs,
      uxGoverned,
      uxBindings: Object.fromEntries(uxBindings),
    };
    activeDesigns.push(design);
    graph.designs.push(design);
  }

  for (const family of families.values()) {
    if ((family.status ?? "").toLowerCase() !== "active") continue;
    const owners = activeDesigns.filter((design) => (
      design.requirementIds.some((requirementId) => family.requirementIds.includes(requirementId))
    ));
    if (owners.length === 0) {
      issue(
        errors,
        "ACTIVE_FAMILY_WITHOUT_DESIGN_OWNER",
        family.path,
        `${family.id} has no active design owner`,
      );
    }
  }

  const scenarios = new Map();
  const scenarioRequirementCoverage = new Map();
  const scenarioFiles = listFiles(resolve(root, SCENARIOS_ROOT), (path) => path.endsWith(".md"));
  for (const absolute of scenarioFiles) {
    const path = normalizeRelativePath(relative(root, absolute));
    const text = readFileSync(absolute, "utf8");
    for (const match of text.matchAll(/^##\s+(SCN-[A-Z0-9]+(?:-[A-Z0-9]+)+)\s+-\s+.+$/gm)) {
      const id = match[1];
      if (scenarios.has(id)) {
        issue(errors, "DUPLICATE_SCENARIO", path, `duplicate scenario identity: ${id}`);
        continue;
      }
      const scenario = {
        id,
        path,
        line: lineNumber(text, match.index),
        bindings: [],
        supportingBindings: [],
        testcaseCount: 0,
        proofGapCount: 0,
        deferredCount: 0,
      };
      scenarios.set(id, scenario);
      scenarioRequirementCoverage.set(id, new Set());
      graph.scenarios.push(scenario);
    }

    const bindingHeading = text.search(/^## Executable Proof Bindings\s*$/m);
    if (bindingHeading < 0) {
      if ([...scenarios.values()].some((scenario) => scenario.path === path)) {
        issue(errors, "MISSING_SCENARIO_BINDINGS", path, "scenario file has no Executable Proof Bindings table");
      }
      continue;
    }
    const following = text.slice(bindingHeading);
    const nextHeadingOffset = following.slice(1).search(/^##\s/m);
    const section = nextHeadingOffset < 0 ? following : following.slice(0, nextHeadingOffset + 1);
    const rows = parseTableRows(section);
    for (const cells of rows) {
      if (cells.length < 5 || /^scenario$/i.test(cells[0])) continue;
      const scenarioIds = cells[0].match(SCENARIO_ID_PATTERN) ?? [];
      if (scenarioIds.length !== 1) {
        issue(errors, "INVALID_SCENARIO_BINDING_ROW", path, `binding row must name exactly one scenario: ${cells[0]}`);
        continue;
      }
      const scenarioId = scenarioIds[0];
      const scenario = scenarios.get(scenarioId);
      if (!scenario || scenario.path !== path) {
        issue(errors, "UNKNOWN_SCENARIO", path, `binding row references unknown scenario: ${scenarioId}`);
        continue;
      }
      const requirementIds = expandRequirementReferences(
        cells[1],
        families,
        requirements,
        errors,
        `${path}#${scenarioId}`,
      );
      if (requirementIds.size === 0) {
        issue(errors, "SCENARIO_WITHOUT_REQUIREMENTS", path, `${scenarioId} binds no requirements`);
      }
      if (requirementIds.size > 1) {
        issue(
          errors,
          "BATCHED_SCENARIO_REQUIREMENTS",
          path,
          `${scenarioId} testcase row must name exactly one requirement, found: ${[...requirementIds].join(",")}`,
        );
      }
      const authorityCase = cells[2].replaceAll("`", "").trim();
      if (
        authorityCase.length < 20
        || /^(?:none|n\/a|same as|covered by|see proof)$/i.test(authorityCase)
      ) {
        issue(
          errors,
          "MISSING_REQUIREMENT_AUTHORITY_CASE",
          path,
          `${scenarioId} must state the requirement-specific observable asserted by this testcase`,
        );
      }
      const posture = cells[3].replaceAll("`", "").trim().toLowerCase();
      const isScenarioProof = posture === "scenario proof";
      const isSupportingProof = posture === "supporting proof; scenario gap";
      const isProofGap = posture === "executable proof gap";
      const deferred = posture === "deferred";
      if (!isScenarioProof && !isSupportingProof && !isProofGap && !deferred) {
        issue(
          errors,
          "UNKNOWN_SCENARIO_PROOF_POSTURE",
          path,
          `${scenarioId} has unsupported proof posture: ${cells[3]}`,
        );
      }
      for (const requirementId of requirementIds) {
        scenarioRequirementCoverage.get(scenarioId).add(requirementId);
        graph.edges.push({
          from: scenarioId,
          to: requirementId,
          kind: "testcase-authority",
          authorityCase,
          posture: cells[3].replaceAll("`", "").trim(),
        });
      }
      scenario.testcaseCount += 1;
      const proofCell = cells.slice(4).join(" | ");
      if (deferred) {
        const notDeferred = [...requirementIds].filter((requirementId) => {
          const requirement = requirements.get(requirementId);
          const family = families.get(requirement?.familyId);
          return !family?.deferredRequirementIds.has(requirementId);
        });
        if (notDeferred.length > 0) {
          issue(
            errors,
            "SCENARIO_DEFERMENT_MISMATCH",
            path,
            `${scenarioId} claims deferment for non-deferred requirements: ${notDeferred.join(",")}`,
          );
        }
        scenario.deferredCount += 1;
      }
      const selectors = proofSelectorsFromValue(proofCell);
      if ((isScenarioProof || isSupportingProof) && selectors.length !== 1) {
        issue(
          errors,
          "INVALID_SCENARIO_PROOF_COUNT",
          path,
          `${scenarioId} executable testcase row must bind exactly one proof selector`,
        );
      }
      if ((isProofGap || deferred) && selectors.length > 0) {
        issue(
          errors,
          deferred ? "DEFERRED_SCENARIO_WITH_PROOF" : "PROOF_GAP_WITH_SELECTOR",
          path,
          `${scenarioId} ${deferred ? "deferred" : "gap"} testcase cannot claim an executable selector`,
        );
      }
      if (isProofGap || deferred) {
        const gapRationale = proofCell.replaceAll("`", "").trim();
        if (!/^none\s+—\s+\S.{11,}$/i.test(gapRationale)) {
          issue(
            errors,
            "MISSING_PROOF_GAP_RATIONALE",
            path,
            `${scenarioId} ${deferred ? "deferment" : "proof gap"} must use "none — <specific rationale>"`,
          );
        }
      }
      if (isProofGap) {
        scenario.proofGapCount += 1;
      }
      for (const selector of selectors) {
        const proof = validateProofSelector(root, selector, errors, `${path}#${scenarioId}`, proofCache);
        if (!proof) continue;
        if (!proofOwners.has(proof.id)) proofOwners.set(proof.id, new Set());
        proofOwners.get(proof.id).add(`${scenarioId}#${[...requirementIds][0] ?? "unknown"}`);
        if (isScenarioProof) {
          scenario.bindings.push(proof.id);
          graph.edges.push({ from: scenarioId, to: proof.id, kind: "scenario-proved-by" });
        } else {
          scenario.supportingBindings.push(proof.id);
          scenario.proofGapCount += 1;
          graph.edges.push({ from: scenarioId, to: proof.id, kind: "supporting-proof-only" });
        }
      }
    }
  }
  for (const scenario of scenarios.values()) {
    if (scenario.testcaseCount === 0) {
      issue(errors, "ORPHAN_SCENARIO", scenario.path, `${scenario.id} has no testcase authority rows`);
    }
  }

  const requirementScenarioCoverage = new Map();
  for (const [scenarioId, requirementIds] of scenarioRequirementCoverage) {
    for (const requirementId of requirementIds) {
      if (!requirementScenarioCoverage.has(requirementId)) {
        requirementScenarioCoverage.set(requirementId, new Set());
      }
      requirementScenarioCoverage.get(requirementId).add(scenarioId);
    }
  }
  for (const family of families.values()) {
    if ((family.status ?? "").toLowerCase() !== "active") continue;
    if (!/^capability$/i.test(family.category ?? "")) continue;
    for (const requirementId of family.requirementIds) {
      if (!requirementScenarioCoverage.has(requirementId)) {
        issue(
          errors,
          "CAPABILITY_REQUIREMENT_WITHOUT_TESTCASE_AUTHORITY",
          family.path,
          `${requirementId} has no requirement-specific scenario testcase authority`,
        );
      }
    }
  }

  const requirementOutcomeRefs = new Set(
    [...families.values()].flatMap((family) => family.outcomeIds),
  );
  const designOutcomeRefs = new Set(activeDesigns.flatMap((design) => design.outcomeIds));
  for (const outcomeId of outcomes.keys()) {
    if (!requirementOutcomeRefs.has(outcomeId)) {
      issue(errors, "ORPHAN_PRODUCT_OUTCOME", PRODUCT_PATH, `${outcomeId} has no requirement-family edge`);
    }
    if (!designOutcomeRefs.has(outcomeId)) {
      issue(errors, "ORPHAN_PRODUCT_OUTCOME_DESIGN", PRODUCT_PATH, `${outcomeId} has no active design edge`);
    }
  }

  const capabilityRoot = resolve(root, CAPABILITIES_ROOT);
  if (existsSync(capabilityRoot)) {
    for (const entry of readdirSync(capabilityRoot, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const indexPath = normalizeRelativePath(`${CAPABILITIES_ROOT}/${entry.name}/index.ts`);
      const indexAbsolute = resolve(root, indexPath);
      if (!existsSync(indexAbsolute)) {
        issue(errors, "MISSING_CAPABILITY_PUBLIC_ENTRYPOINT", indexPath, "capability has no public index.ts");
        continue;
      }
      const owned = [...sourceOwners.keys()].some((entrypoint) => (
        pathCoveredByEntrypoint(indexPath, entrypoint)
      ));
      if (!owned) {
        issue(errors, "ORPHAN_CAPABILITY_SOURCE", indexPath, "public capability source has no active design owner");
      }
    }
  }

  graph.sources = [...sourceOwners.entries()].map(([id, owners]) => ({
    id,
    owners: [...owners].sort(),
  }));
  graph.proofs = [...proofOwners.entries()].map(([id, owners]) => ({
    id,
    owners: [...owners].sort(),
  }));
  return finalizeReport(graph, errors);
}

function finalizeReport(graph, errors) {
  for (const key of Object.keys(graph)) {
    if (!Array.isArray(graph[key])) continue;
    graph[key].sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  errors.sort((left, right) => (
    left.code.localeCompare(right.code)
    || left.subject.localeCompare(right.subject)
    || left.detail.localeCompare(right.detail)
  ));
  return {
    ok: errors.length === 0,
    errors,
    graph,
    summary: {
      constitutionalDocuments: graph.constitutionalDocuments.length,
      productOutcomes: graph.outcomes.length,
      requirementFamilies: graph.requirementFamilies.length,
      requirements: graph.requirements.length,
      activeDesigns: graph.designs.length,
      scenarios: graph.scenarios.length,
      sourceCarriers: graph.sources.length,
      proofCarriers: graph.proofs.length,
      scenarioProofGaps: graph.scenarios.reduce(
        (total, scenario) => total + scenario.proofGapCount,
        0,
      ),
      edges: graph.edges.length,
    },
  };
}

export function formatTraceabilityReport(report) {
  const summary = report.summary;
  const headline = [
    `STDO traceability ${report.ok ? "PASS" : "FAIL"}`,
    `${summary.constitutionalDocuments} constitutional documents`,
    `${summary.productOutcomes} Product outcomes`,
    `${summary.requirementFamilies} requirement families`,
    `${summary.requirements} requirements`,
    `${summary.activeDesigns} active designs`,
    `${summary.scenarios} scenarios`,
    `${summary.sourceCarriers} source carriers`,
    `${summary.proofCarriers} proof carriers`,
    `${summary.scenarioProofGaps} scenario proof gaps`,
    `${summary.edges} edges`,
  ].join(" | ");
  if (report.ok) return headline;
  return [
    headline,
    ...report.errors.map((entry) => `[${entry.code}] ${entry.subject}: ${entry.detail}`),
  ].join("\n");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const report = auditStdoTraceability(process.argv[2] ?? DEFAULT_REPOSITORY_ROOT);
  process.stdout.write(`${formatTraceabilityReport(report)}\n`);
  if (!report.ok) process.exitCode = 1;
}
