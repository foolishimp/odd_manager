export type FormattedTextPresentation =
  | { kind: "plain"; text: string }
  | { kind: "markdown"; content: string };

export function renderContentByFormat(
  content: string | null | undefined,
  format: "markdown" | "yaml" | "text",
) {
  const normalized = String(content ?? "").trimEnd();
  if (format === "yaml") {
    return `\`\`\`yaml\n${normalized}\n\`\`\`\n`;
  }
  if (format === "text") {
    return `\`\`\`text\n${normalized}\n\`\`\`\n`;
  }
  return normalized;
}

export function normalizeStructuredText(value: string) {
  return value
    .replace(/\\r\\n/g, "\n")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .trimEnd();
}

export function looksStructuredDetailValue(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  if (value.includes("\\n") || value.includes("\n")) {
    return true;
  }
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return true;
  }
  if (
    trimmed.includes('{"') ||
    trimmed.includes('":') ||
    trimmed.includes("':") ||
    trimmed.includes('["') ||
    trimmed.includes("],")
  ) {
    return true;
  }
  return trimmed.length > 160 && (trimmed.includes("{") || trimmed.includes("["));
}

export function presentStructuredText(value: string): FormattedTextPresentation {
  const normalized = normalizeStructuredText(value);
  if (!looksStructuredDetailValue(normalized)) {
    return { kind: "plain", text: normalized || "none" };
  }

  const trimmed = normalized.trim();
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      return {
        kind: "markdown",
        content: `\`\`\`json\n${JSON.stringify(parsed, null, 2)}\n\`\`\`\n`,
      };
    } catch {
      // Fall through to plain text block.
    }
  }

  return {
    kind: "markdown",
    content: `\`\`\`text\n${trimmed || "none"}\n\`\`\`\n`,
  };
}
