import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseGlossaryFrontmatter, parseGlossaryMarkdown } from "./parse.js";
import type { GlossaryEntry, ScopedGlossary } from "./types.js";

/**
 * One glossary in the layered system. `dir` is the folder it covers,
 * relative to the docs root in POSIX form (`""` = the root itself).
 * `terms` maps markdown-it-abbr keys (`":" + text`) to a definition, or
 * to `null` for a term that is deliberately not tooltipped here (see
 * {@link resolveTerms}).
 */
export interface GlossaryLayer {
  dir: string;
  site: boolean;
  source: string;
  terms: Map<string, string | null>;
}

const SKIP_DIRS = new Set(["node_modules", "dist", "cache"]);

export function buildTerms(entries: GlossaryEntry[]): Map<string, string | null> {
  const terms = new Map<string, string | null>();
  for (const entry of entries) {
    const value = entry.tooltip === false ? null : entry.definition;
    for (const text of [entry.term, ...(entry.aliases ?? [])]) {
      terms.set(":" + text, value);
    }
  }
  return terms;
}

export function toPosixDir(dir: string): string {
  return dir
    .replace(/\\/g, "/")
    .replace(/^\.?\/+|\/+$/g, "")
    .replace(/^\.$/, "");
}

/** Folder of a page, from its source-relative path (`a/b/page.md` -> `a/b`). */
export function pageDirOf(relativePath: string): string {
  const posix = relativePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const slash = posix.lastIndexOf("/");
  return slash === -1 ? "" : posix.slice(0, slash);
}

function layerFromSource(
  source: string,
  dir: string,
  site: boolean | undefined,
  label: string,
  headingLevel: number,
): GlossaryLayer {
  const scope = parseGlossaryFrontmatter(source)["glossary-scope"];
  if (scope !== undefined && scope !== "site" && scope !== "section") {
    console.warn(
      `markdown-it-glossary: ${label} has glossary-scope "${scope}"; expected "site" or "section". Using "section".`,
    );
  }
  return {
    dir,
    site: site ?? scope === "site",
    source: label,
    terms: buildTerms(parseGlossaryMarkdown(source, headingLevel)),
  };
}

/** Finds every `scopedFile` below `root`, skipping `skipFile` (the master). */
export function discoverLayers(
  root: string,
  scopedFile: string,
  skipFile: string | undefined,
  headingLevel: number,
): GlossaryLayer[] {
  const absRoot = path.resolve(root);
  const layers: GlossaryLayer[] = [];

  const walk = (abs: string): void => {
    for (const dirent of readdirSync(abs, { withFileTypes: true })) {
      const full = path.join(abs, dirent.name);
      if (dirent.isDirectory()) {
        if (!dirent.name.startsWith(".") && !SKIP_DIRS.has(dirent.name)) walk(full);
      } else if (dirent.name === scopedFile && (!skipFile || full !== skipFile)) {
        layers.push(
          layerFromSource(
            readFileSync(full, "utf8"),
            toPosixDir(path.relative(absRoot, abs)),
            undefined,
            path.relative(absRoot, full),
            headingLevel,
          ),
        );
      }
    }
  };

  walk(absRoot);
  return layers;
}

/** Builds a layer from an explicit `scopes` option entry. */
export function layerFromScope(scope: ScopedGlossary, headingLevel: number): GlossaryLayer {
  const dir = toPosixDir(scope.dir);
  if (scope.entries && scope.file) {
    throw new Error(
      `markdown-it-glossary: scope "${scope.dir}" has both \`entries\` and \`file\`; pass one.`,
    );
  }
  if (scope.entries) {
    return { dir, site: scope.site ?? false, source: scope.dir, terms: buildTerms(scope.entries) };
  }
  if (scope.file) {
    return layerFromSource(
      readFileSync(scope.file, "utf8"),
      dir,
      scope.site,
      scope.file,
      headingLevel,
    );
  }
  throw new Error(`markdown-it-glossary: scope "${scope.dir}" needs \`entries\` or \`file\`.`);
}

function covers(layerDir: string, pageDir: string): boolean {
  return layerDir === "" || pageDir === layerDir || pageDir.startsWith(layerDir + "/");
}

/**
 * Orders the layers that apply to a page from highest to lowest
 * precedence ("closest wins"):
 *
 * 1. Section glossaries whose folder contains the page, nearest folder
 *    first.
 * 2. Site-wide glossaries from folders that do *not* contain the page,
 *    in path order.
 * 3. The master glossary.
 */
export function orderLayers(
  folderLayers: GlossaryLayer[],
  master: GlossaryLayer | undefined,
  pageDir: string | undefined,
  useLocal: boolean,
  useMaster: boolean,
): GlossaryLayer[] {
  const ordered: GlossaryLayer[] = [];
  if (useLocal) {
    const inSection = folderLayers
      .filter((l) => pageDir !== undefined && covers(l.dir, pageDir))
      .sort((a, b) => b.dir.length - a.dir.length);
    const elsewhere = folderLayers
      .filter((l) => l.site && !(pageDir !== undefined && covers(l.dir, pageDir)))
      .sort((a, b) => a.dir.localeCompare(b.dir));
    ordered.push(...inSection, ...elsewhere);
  }
  if (useMaster && master) ordered.push(master);
  return ordered;
}

/**
 * Merges layers (highest precedence first) into one abbreviation map.
 * The first layer to mention a term decides it. A `null` entry (a term
 * marked "not tooltipped") counts as a decision too: it hides that term
 * from every lower-precedence layer, so a section can say "this word is
 * ambiguous here" and not inherit the master's tooltip for it.
 */
export function resolveTerms(layers: GlossaryLayer[]): Record<string, string> {
  const decided = new Set<string>();
  const merged: Record<string, string> = {};
  for (const layer of layers) {
    for (const [key, definition] of layer.terms) {
      if (decided.has(key)) continue;
      decided.add(key);
      if (definition !== null) merged[key] = definition;
    }
  }
  return merged;
}

/** Warns about terms defined by two or more site-wide glossaries. */
export function warnSiteConflicts(layers: GlossaryLayer[]): void {
  const owners = new Map<string, string[]>();
  for (const layer of layers.filter((l) => l.site)) {
    for (const [key, definition] of layer.terms) {
      if (definition === null) continue;
      owners.set(key, [...(owners.get(key) ?? []), layer.source]);
    }
  }
  for (const [key, sources] of owners) {
    if (sources.length > 1) {
      console.warn(
        `markdown-it-glossary: "${key.slice(1)}" is defined by several site-wide glossaries (${sources.join(
          ", ",
        )}); the one with the alphabetically first folder wins on pages outside those sections.`,
      );
    }
  }
}
