import { readFileSync } from "node:fs";
import type { GlossaryEntry } from "./types.js";

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1") // [text](url) -> text
    .replace(/`([^`]+)`/g, "$1") // `code` -> code
    .replace(/\*\*([^*]+)\*\*/g, "$1") // **bold** -> bold
    .replace(/\*([^*]+)\*/g, "$1") // *italic* -> italic
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parses Markdown of the form:
 *
 * ```md
 * ### Term
 *
 * One- or two-sentence definition. May use **bold**, *italic*, `code`,
 * and [links](...) — all stripped for the plain-text tooltip.
 *
 * ### staging (AHC database)
 *
 * A heading with a parenthetical qualifier is still returned (for
 * display on a glossary page) but marked `tooltip: false` — the
 * parenthetical is a signal that the bare term is ambiguous or always
 * written as code elsewhere, so it isn't safe to auto-tooltip.
 * ```
 *
 * Any Markdown structure around the headings (other heading levels,
 * intros, `:::` containers, etc.) is ignored — only headings at
 * `headingLevel` and the paragraph immediately following each are read.
 */
export function parseGlossaryMarkdown(source: string, headingLevel = 3): GlossaryEntry[] {
  const headingRe = new RegExp(`^${"#".repeat(headingLevel)} (.+)$`);
  const lines = source.split("\n");
  const entries: GlossaryEntry[] = [];

  let i = 0;
  while (i < lines.length) {
    const heading = lines[i].match(headingRe);
    if (!heading) {
      i++;
      continue;
    }

    const rawTerm = heading[1].trim();
    const qualified = /\s*\(.+\)\s*$/.test(rawTerm);
    const term = rawTerm.replace(/\s*\(.+\)\s*$/, "").trim();

    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    const paraLines: string[] = [];
    while (j < lines.length && lines[j].trim() !== "" && !/^#{1,6} /.test(lines[j])) {
      paraLines.push(lines[j]);
      j++;
    }
    const definition = stripMarkdown(paraLines.join(" "));

    if (term && definition) {
      entries.push({ term, definition, tooltip: !qualified });
    }
    i = j;
  }

  return entries;
}

/** Reads `filePath` and parses it with {@link parseGlossaryMarkdown}. */
export function loadGlossaryFile(filePath: string, headingLevel = 3): GlossaryEntry[] {
  return parseGlossaryMarkdown(readFileSync(filePath, "utf8"), headingLevel);
}
