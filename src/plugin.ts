import markdownItAbbr from "markdown-it-abbr";
import type { MarkdownIt, StateCore } from "markdown-it";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseGlossaryFrontmatter, parseGlossaryMarkdown } from "./parse.js";
import { abbrReplace, foldCase, pageMatching } from "./replace.js";
import {
  buildTerms,
  CASE_SENSITIVE_KEY,
  discoverLayers,
  FIRST_ONLY_KEY,
  layerFromScope,
  orderLayers,
  pageDirOf,
  parseFlag,
  resolveSetting,
  resolveTerms,
  warnSiteConflicts,
  type GlossaryLayer,
  type ResolvedTerms,
} from "./scopes.js";
import type { GlossaryAbbrOptions, GlossaryEntry } from "./types.js";

/**
 * A markdown-it plugin that turns a glossary into site-wide hover
 * tooltips (`<abbr title="...">`), via markdown-it-abbr — every page
 * gets every term by default, no per-page setup required.
 *
 * ```ts
 * import MarkdownIt from "markdown-it";
 * import { glossaryAbbr } from "markdown-it-glossary";
 *
 * const md = new MarkdownIt().use(glossaryAbbr, { file: "glossary.md" });
 * ```
 *
 * In VitePress, register it via `markdown.config`:
 *
 * ```ts
 * // .vitepress/config.mts
 * export default defineConfig({
 *   markdown: {
 *     config: (md) => {
 *       md.use(glossaryAbbr, { file: path.resolve(docsRoot, "glossary.md") });
 *     },
 *   },
 * });
 * ```
 *
 * Section glossaries: set `root` to the docs directory and any
 * `glossary.md` in a subfolder applies to that folder and everything
 * below it, with the closest glossary winning when terms collide (see
 * the README's "Which definition wins"). Set `glossary-scope: site` in
 * that file's frontmatter to apply it to the whole site instead.
 *
 * A page opts out by setting the configured `frontmatterKey` (default
 * `"glossary"`) to `false` in its frontmatter — or to
 * `{ master: false }` / `{ local: false }` to drop just one layer. This requires the host
 * environment to populate `env.frontmatter` before core rules run —
 * true for VitePress and VuePress; a bare markdown-it instance without
 * that convention just never triggers the opt-out, which is a safe,
 * harmless default rather than an error.
 *
 * A page-local `*[Term]: definition` (markdown-it-abbr's own inline
 * syntax) always wins over a site-wide definition for that term on that
 * page, since it's set during block parsing, before this plugin's core
 * rule runs.
 *
 * Matching ignores case by default. `caseSensitive: true` changes the
 * site-wide default, and `glossary-case-sensitive: true | false` in the
 * frontmatter of the master glossary, a section glossary (its folder and
 * below), or any page overrides it, closest setting winning.
 * `firstOnly` and `glossary-first-only` work the same way, tooltipping
 * only the first mention of each term on a page.
 *
 * A page drops individual terms with `glossary: { exclude: [...] }`.
 */
export function glossaryAbbr(md: MarkdownIt, options: GlossaryAbbrOptions = {}): void {
  const {
    entries,
    file,
    headingLevel = 3,
    frontmatterKey = "glossary",
    root,
    scopedFile = "glossary.md",
    scopes = [],
    caseSensitive = false,
    firstOnly = false,
  } = options;

  if (!entries && !file) {
    throw new Error("markdown-it-glossary: pass either `entries` or `file` in options.");
  }
  if (entries && file) {
    throw new Error("markdown-it-glossary: pass either `entries` or `file`, not both.");
  }

  const masterSource = file ? readFileSync(file, "utf8") : undefined;
  const resolvedEntries: GlossaryEntry[] =
    entries ?? parseGlossaryMarkdown(masterSource as string, headingLevel);

  // Keys follow markdown-it-abbr's own `state.env.abbreviations`
  // convention (a leading ":" avoids clobbering Object.prototype members).
  const masterFrontmatter = masterSource ? parseGlossaryFrontmatter(masterSource) : {};
  const master: GlossaryLayer = {
    dir: "",
    site: true,
    source: file ?? "entries",
    terms: buildTerms(resolvedEntries),
    caseSensitive: parseFlag(CASE_SENSITIVE_KEY, masterFrontmatter[CASE_SENSITIVE_KEY], file ?? ""),
    firstOnly: parseFlag(FIRST_ONLY_KEY, masterFrontmatter[FIRST_ONLY_KEY], file ?? ""),
  };

  const folderLayers: GlossaryLayer[] = [
    ...(root
      ? discoverLayers(root, scopedFile, file ? path.resolve(file) : undefined, headingLevel)
      : []),
    ...scopes.map((scope) => layerFromScope(scope, headingLevel)),
  ];
  warnSiteConflicts(folderLayers);

  // Most pages in a folder resolve identically, so merge once per
  // (folder, opt-out, case, exclusions) combination rather than once per page.
  const cache = new Map<string, ResolvedTerms>();
  const termsFor = (
    pageDir: string | undefined,
    useLocal: boolean,
    useMaster: boolean,
    pageCaseSensitive: boolean,
    exclude: Set<string>,
  ) => {
    const cacheKey = [
      pageDir ?? "\0",
      useLocal,
      useMaster,
      pageCaseSensitive,
      ...[...exclude].sort(),
    ].join("|");
    let terms = cache.get(cacheKey);
    if (!terms) {
      terms = resolveTerms(
        orderLayers(folderLayers, master, pageDir, useLocal, useMaster),
        pageCaseSensitive,
        exclude,
      );
      cache.set(cacheKey, terms);
    }
    return terms;
  };

  md.use(markdownItAbbr);
  // markdown-it-abbr only matches exact case; this replacement can do both.
  md.core.ruler.at("abbr_replace", abbrReplace(md));

  md.core.ruler.before("abbr_replace", "glossary_abbr_inject", (state: StateCore) => {
    let useMaster = true;
    let useLocal = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = state.env as any;
    const relativePath: unknown = env?.relativePath;
    const pageDir = typeof relativePath === "string" ? pageDirOf(relativePath) : undefined;

    // Decided even on opted-out pages, since it also applies to the
    // page's own `*[Term]: …` definitions.
    const label = typeof relativePath === "string" ? relativePath : "a page";
    const pageSetting = (key: string, setting: "caseSensitive" | "firstOnly", fallback: boolean) =>
      parseFlag(key, env?.frontmatter?.[key], label) ??
      resolveSetting(setting, folderLayers, master, pageDir, fallback);
    const pageCaseSensitive = pageSetting(CASE_SENSITIVE_KEY, "caseSensitive", caseSensitive);
    if (!env) return;

    // Page-local definitions follow the page's setting.
    const pageLocal = Object.keys((env.abbreviations ?? {}) as Record<string, string>);
    const anyCase = new Set(pageCaseSensitive ? [] : pageLocal);
    const entryOf = new Map<string, string>();
    pageMatching.set(env, {
      anyCase,
      entryOf,
      firstOnly: pageSetting(FIRST_ONLY_KEY, "firstOnly", firstOnly),
    });

    const optOut = frontmatterKey === false ? undefined : env?.frontmatter?.[frontmatterKey];
    const exclude = new Set<string>();
    if (optOut === false) {
      return;
    } else if (optOut && typeof optOut === "object") {
      useMaster = optOut.master !== false;
      useLocal = optOut.local !== false;
      const excluded: unknown = optOut.exclude;
      if (typeof excluded === "string") {
        exclude.add(foldCase(":" + excluded));
      } else if (Array.isArray(excluded)) {
        for (const name of excluded) exclude.add(foldCase(":" + String(name)));
      } else if (excluded !== undefined && excluded !== null) {
        console.warn(
          `markdown-it-glossary: ${label} has ${frontmatterKey}.exclude that is not a list of terms. Ignoring it.`,
        );
      }
    }

    // Leave `env.abbreviations` unset when nothing applies: an empty object
    // is truthy, and markdown-it-abbr would then build an empty regex that
    // matches everywhere instead of skipping the page.
    const resolved = termsFor(pageDir, useLocal, useMaster, pageCaseSensitive, exclude);
    const terms = Object.entries(resolved.definitions);
    if (terms.length === 0) return;

    env.abbreviations ??= {};
    const envAbbreviations = env.abbreviations as Record<string, string>;
    // A page-local definition wins over every spelling it matches.
    const pageLocalFolded = new Set([...anyCase].map(foldCase));
    for (const [key, definition] of terms) {
      if (key in envAbbreviations || pageLocalFolded.has(foldCase(key))) continue;
      envAbbreviations[key] = definition;
      if (resolved.anyCase.has(key)) anyCase.add(key);
      entryOf.set(key, resolved.entries.get(key) as string);
    }
  });
}
