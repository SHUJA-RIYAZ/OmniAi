import type { ICodeCompressor } from "../interfaces";
import type { CompressionLevel } from "../models";

const COMMENT_PREFIX: Record<string, string> = {
  python: "#",
  javascript: "//",
  typescript: "//",
};

/** Collections spanning more than this many lines get collapsed. */
const COLLAPSE_THRESHOLD = 10;
/** String literals longer than this get shortened. */
const LITERAL_MAX = 80;

/**
 * Deterministic, text-level code compression without AI (Feature 5).
 *
 * - `none`: source returned unchanged.
 * - `light`: trailing whitespace trimmed, blank-line runs collapsed to one,
 *   duplicate import lines removed.
 * - `aggressive`: light + full-line and safe inline comments removed, blank
 *   lines dropped entirely, long string literals shortened, multi-line
 *   collections (arrays/dicts) collapsed, unused `from x import y` names
 *   pruned.
 *
 * Conservative by design: indentation and in-string content are never
 * touched except for the explicit literal-shortening rule; inline comments
 * are only stripped from lines containing no quote characters.
 */
export class CodeCompressor implements ICodeCompressor {
  compress(
    source: string,
    languageId: string,
    level: CompressionLevel,
    options: { removeComments?: boolean; compressWhitespace?: boolean } = {},
  ): string {
    if (level === "none") return source;
    const removeComments = (options.removeComments ?? true) && level === "aggressive";
    const compressWhitespace = options.compressWhitespace ?? true;
    const comment = COMMENT_PREFIX[languageId];

    let lines = source.split("\n");

    if (removeComments && comment) {
      lines = lines.filter((line) => !line.trimStart().startsWith(comment));
      lines = lines.map((line) =>
        line.includes(comment) && !/["'`]/.test(line)
          ? line.slice(0, line.indexOf(comment)).trimEnd()
          : line,
      );
    }

    if (level === "aggressive") {
      lines = pruneUnusedFromImports(lines, languageId);
      lines = collapseCollections(lines);
      lines = lines.map(shortenLongLiterals);
    }

    if (compressWhitespace) {
      lines = lines.map((line) => line.trimEnd());
      lines = collapseBlankRuns(lines, level === "aggressive" ? 0 : 1);
    }

    lines = dedupeImports(lines, languageId);
    return lines.join("\n");
  }
}

function collapseBlankRuns(lines: string[], keep: number): string[] {
  const result: string[] = [];
  let blanks = 0;
  for (const line of lines) {
    if (line.trim() === "") {
      blanks++;
      if (blanks <= keep) result.push("");
    } else {
      blanks = 0;
      result.push(line);
    }
  }
  return result;
}

function isImportLine(line: string, languageId: string): boolean {
  const trimmed = line.trim();
  if (languageId === "python") return /^(import |from \S+ import )/.test(trimmed);
  return /^import .*from |^import ["']/.test(trimmed);
}

function dedupeImports(lines: string[], languageId: string): string[] {
  const seen = new Set<string>();
  return lines.filter((line) => {
    if (!isImportLine(line, languageId)) return true;
    const key = line.trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Removes names from `from m import a, b` that appear nowhere else in the file. */
function pruneUnusedFromImports(lines: string[], languageId: string): string[] {
  if (languageId !== "python") return lines;
  const body = lines.filter((l) => !isImportLine(l, "python")).join("\n");

  return lines.flatMap((line) => {
    const match = /^(\s*from\s+\S+\s+import\s+)([\w\s,]+)$/.exec(line);
    if (!match) return [line];
    const kept = (match[2] as string)
      .split(",")
      .map((n) => n.trim())
      .filter((n) => {
        const bound = n.split(/\s+as\s+/).pop() as string;
        return new RegExp(`\\b${bound}\\b`).test(body);
      });
    if (kept.length === 0) return [];
    return [`${match[1]}${kept.join(", ")}`];
  });
}

/** Shortens quoted literals longer than LITERAL_MAX, keeping head and tail. */
export function shortenLongLiterals(line: string): string {
  return line.replace(/(["'])((?:\\.|(?!\1).){80,})\1/g, (_all, quote: string, body: string) => {
    const head = body.slice(0, Math.floor(LITERAL_MAX / 2));
    const tail = body.slice(-10);
    return `${quote}${head}…${tail}${quote}`;
  });
}

/**
 * Collapses collection literals spanning more than COLLAPSE_THRESHOLD
 * lines, keeping the opening and closing lines. Bracket counting ignores
 * characters inside simple quotes.
 */
export function collapseCollections(lines: string[]): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i] as string;
    const open = netBrackets(line);
    if (open > 0) {
      // Find the line where nesting returns to zero.
      let depth = open;
      let j = i + 1;
      while (j < lines.length && depth > 0) {
        depth += netBrackets(lines[j] as string);
        j++;
      }
      const span = j - i;
      if (depth === 0 && span > COLLAPSE_THRESHOLD) {
        const indent = /^\s*/.exec(line)?.[0] ?? "";
        result.push(line, `${indent}  … ${span - 2} lines collapsed …`, lines[j - 1] as string);
        i = j;
        continue;
      }
    }
    result.push(line);
    i++;
  }
  return result;
}

function netBrackets(line: string): number {
  let net = 0;
  let inString: string | undefined;
  for (const ch of line) {
    if (inString) {
      if (ch === inString) inString = undefined;
    } else if (ch === '"' || ch === "'") {
      inString = ch;
    } else if (ch === "[" || ch === "{") {
      net++;
    } else if (ch === "]" || ch === "}") {
      net--;
    }
  }
  return net;
}
