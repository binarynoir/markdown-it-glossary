import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseGlossaryFrontmatter, parseGlossaryMarkdown } from "./parse.js";
import { foldCase } from "./replace.js";
import type { GlossaryEntry, ScopedGlossary } from "./types.js";

/**
 * One glossary in the layered system. `dir` is the folder it covers,
 * relative to the docs root in POSIX form (`""` = the root itself).
 * `terms` maps markdown-it-abbr keys (`":" + text`) to a definition, or
 * to `null` for a term that is deliberately not tooltipped here (see
 * {@link resolveTerms}), plus the term's own case flag. `caseSensitive` is the layer's own setting, or
 * `undefined` to inherit one (see {@link resolveSetting}); `firstOnly`
 * works the same way.
 */
export interface GlossaryLayer {
  dir: string;
  site: boolean;
  source: string;
  terms: Map<string, GlossaryTerm>;
  caseSensitive?: boolean;
  firstOnly?: boolean;
}

/** The settings a glossary file can pass down to the pages below it. */
export type InheritedSetting = "caseSensitive" | "firstOnly";

export interface GlossaryTerm {
  /** Identifies the entry, shared by its term and aliases. */
  id: string;
  /** Every spelling of the entry: its term, then its aliases. */
  names: string[];
  definition: string | null;
  /** The entry's `{.exact}` / `{.anycase}` flag; unset follows the page. */
  caseSensitive?: boolean;
}

/**
 * A page's merged terms: each key's definition, the keys that match in
 * any case, and the entry each key belongs to (so a term and its
 * aliases count as one term).
 */
export interface ResolvedTerms {
  definitions: Record<string, string>;
  anyCase: Set<string>;
  entries: Map<string, string>;
}

/** Frontmatter key that sets case sensitivity, in glossary files and pages alike. */
export const CASE_SENSITIVE_KEY = "glossary-case-sensitive";
/** Frontmatter key that turns on first-mention-only tooltips, in glossary files and pages alike. */
export const FIRST_ONLY_KEY = "glossary-first-only";

/**
 * Reads a true/false frontmatter value: a boolean (as a host's YAML
 * parser gives it) or the string `"true"` / `"false"` (as
 * {@link parseGlossaryFrontmatter} gives it). Anything else is ignored
 * with a warning.
 */
export function parseFlag(key: string, value: unknown, label: string): boolean | undefined {
  if (value === undefined || value === null) return undefined;
  if (value === true || value === "true") return true;
  if (value === false || value === "false") return false;
  console.warn(
    `markdown-it-glossary: ${label} has ${key} "${String(value)}"; expected true or false. Ignoring it.`,
  );
  return undefined;
}

let nextEntryId = 0;

const SKIP_DIRS = new Set(["node_modules", "dist", "cache"]);

export function buildTerms(entries: GlossaryEntry[]): Map<string, GlossaryTerm> {
  const terms = new Map<string, GlossaryTerm>();
  for (const entry of entries) {
    const names = [entry.term, ...(entry.aliases ?? [])];
    const value: GlossaryTerm = {
      id: String(nextEntryId++),
      names,
      definition: entry.tooltip === false ? null : entry.definition,
      caseSensitive: entry.caseSensitive,
    };
    for (const text of names) {
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
  const frontmatter = parseGlossaryFrontmatter(source);
  const scope = frontmatter["glossary-scope"];
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
    caseSensitive: parseFlag(CASE_SENSITIVE_KEY, frontmatter[CASE_SENSITIVE_KEY], label),
    firstOnly: parseFlag(FIRST_ONLY_KEY, frontmatter[FIRST_ONLY_KEY], label),
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
    return {
      dir,
      site: scope.site ?? false,
      source: scope.dir,
      terms: buildTerms(scope.entries),
      caseSensitive: scope.caseSensitive,
      firstOnly: scope.firstOnly,
    };
  }
  if (scope.file) {
    const layer = layerFromSource(
      readFileSync(scope.file, "utf8"),
      dir,
      scope.site,
      scope.file,
      headingLevel,
    );
    if (scope.caseSensitive !== undefined) layer.caseSensitive = scope.caseSensitive;
    if (scope.firstOnly !== undefined) layer.firstOnly = scope.firstOnly;
    return layer;
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
 * Decides a page's value for an inherited setting (case sensitivity,
 * first-mention-only). Like CSS inheritance, it comes from the closest
 * place that sets it: the nearest section glossary whose folder contains
 * the page, then the master glossary, then `fallback` (the plugin
 * option). The page's own frontmatter, checked by the caller, beats all
 * of these.
 */
export function resolveSetting(
  setting: InheritedSetting,
  folderLayers: GlossaryLayer[],
  master: GlossaryLayer,
  pageDir: string | undefined,
  fallback: boolean,
): boolean {
  if (pageDir !== undefined) {
    const nearest = folderLayers
      .filter((l) => l[setting] !== undefined && covers(l.dir, pageDir))
      .sort((a, b) => b.dir.length - a.dir.length)[0];
    if (nearest) return nearest[setting] as boolean;
  }
  return master[setting] ?? fallback;
}

/**
 * Merges layers (highest precedence first) into one abbreviation map.
 * The first layer to mention a term decides it. A `null` entry (a term
 * marked "not tooltipped") counts as a decision too: it hides that term
 * from every lower-precedence layer, so a section can say "this word is
 * ambiguous here" and not inherit the master's tooltip for it.
 *
 * Each term matches in exact case or in any case: its own flag if it
 * has one, else `caseSensitive` (the page's setting). A term matched in
 * any case claims every casing of itself, so `api` in a closer glossary
 * decides `API` too; an exact term claims only its own spelling.
 *
 * `exclude` holds case-folded spellings the page turned off. An entry
 * with any excluded spelling is treated as not tooltipped, aliases and
 * all, so farther glossaries can't fill the gap either.
 */
export function resolveTerms(
  layers: GlossaryLayer[],
  caseSensitive = true,
  exclude: ReadonlySet<string> = new Set(),
): ResolvedTerms {
  const spellings = new Set<string>();
  const foldedSpellings = new Set<string>();
  const definitions: Record<string, string> = {};
  const anyCase = new Set<string>();
  const entries = new Map<string, string>();
  for (const layer of layers) {
    for (const [key, term] of layer.terms) {
      const folded = foldCase(key);
      if (spellings.has(key) || foldedSpellings.has(folded)) continue;
      const exact = term.caseSensitive ?? caseSensitive;
      spellings.add(key);
      if (!exact) foldedSpellings.add(folded);
      if (term.definition === null) continue;
      if (exclude.size > 0 && term.names.some((name) => exclude.has(foldCase(":" + name))))
        continue;
      definitions[key] = term.definition;
      entries.set(key, term.id);
      if (!exact) anyCase.add(key);
    }
  }
  return { definitions, anyCase, entries };
}

/** Warns about terms defined by two or more site-wide glossaries. */
export function warnSiteConflicts(layers: GlossaryLayer[]): void {
  const owners = new Map<string, string[]>();
  for (const layer of layers.filter((l) => l.site)) {
    for (const [key, term] of layer.terms) {
      if (term.definition === null) continue;
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
