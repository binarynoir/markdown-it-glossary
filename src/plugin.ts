import markdownItAbbr from "markdown-it-abbr";
import type { MarkdownIt, StateCore } from "markdown-it";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseGlossaryFrontmatter, parseGlossaryMarkdown } from "./parse.js";
import { abbrReplace, caseInsensitiveEnvs, foldCase } from "./replace.js";
import {
  buildTerms,
  CASE_SENSITIVE_KEY,
  discoverLayers,
  layerFromScope,
  orderLayers,
  pageDirOf,
  parseCaseSensitive,
  resolveCaseSensitive,
  resolveTerms,
  warnSiteConflicts,
  type GlossaryLayer,
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
  const master: GlossaryLayer = {
    dir: "",
    site: true,
    source: file ?? "entries",
    terms: buildTerms(resolvedEntries),
    caseSensitive:
      masterSource === undefined
        ? undefined
        : parseCaseSensitive(parseGlossaryFrontmatter(masterSource)[CASE_SENSITIVE_KEY], file!),
  };

  const folderLayers: GlossaryLayer[] = [
    ...(root
      ? discoverLayers(root, scopedFile, file ? path.resolve(file) : undefined, headingLevel)
      : []),
    ...scopes.map((scope) => layerFromScope(scope, headingLevel)),
  ];
  warnSiteConflicts(folderLayers);

  // Most pages in a folder resolve identically, so merge once per
  // (folder, opt-out, case) combination rather than once per page.
  const cache = new Map<string, Record<string, string>>();
  const termsFor = (
    pageDir: string | undefined,
    useLocal: boolean,
    useMaster: boolean,
    pageCaseSensitive: boolean,
  ) => {
    const cacheKey = `${pageDir ?? "\0"}|${useLocal}|${useMaster}|${pageCaseSensitive}`;
    let terms = cache.get(cacheKey);
    if (!terms) {
      terms = resolveTerms(
        orderLayers(folderLayers, master, pageDir, useLocal, useMaster),
        pageCaseSensitive,
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
    const pageCaseSensitive =
      parseCaseSensitive(
        env?.frontmatter?.[CASE_SENSITIVE_KEY],
        typeof relativePath === "string" ? relativePath : "a page",
      ) ?? resolveCaseSensitive(folderLayers, master, pageDir, caseSensitive);
    if (env && !pageCaseSensitive) caseInsensitiveEnvs.add(env);
    else if (env) caseInsensitiveEnvs.delete(env);

    const optOut = frontmatterKey === false ? undefined : env?.frontmatter?.[frontmatterKey];
    if (optOut === false) {
      return;
    } else if (optOut && typeof optOut === "object") {
      useMaster = optOut.master !== false;
      useLocal = optOut.local !== false;
    }

    // Leave `env.abbreviations` unset when nothing applies: an empty object
    // is truthy, and markdown-it-abbr would then build an empty regex that
    // matches everywhere instead of skipping the page.
    const terms = Object.entries(termsFor(pageDir, useLocal, useMaster, pageCaseSensitive));
    if (terms.length === 0) return;

    state.env.abbreviations ??= {};
    const envAbbreviations = state.env.abbreviations as Record<string, string>;
    // A page-local definition wins over every spelling it matches.
    const pageLocal = pageCaseSensitive
      ? undefined
      : new Set(Object.keys(envAbbreviations).map(foldCase));
    for (const [key, definition] of terms) {
      if (pageLocal?.has(foldCase(key))) continue;
      envAbbreviations[key] ??= definition;
    }
  });
}
