import markdownItAbbr from "markdown-it-abbr";
import type { MarkdownIt, StateCore } from "markdown-it";
import path from "node:path";
import { loadGlossaryFile } from "./parse.js";
import {
  buildTerms,
  discoverLayers,
  layerFromScope,
  orderLayers,
  pageDirOf,
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
  } = options;

  if (!entries && !file) {
    throw new Error("markdown-it-glossary: pass either `entries` or `file` in options.");
  }
  if (entries && file) {
    throw new Error("markdown-it-glossary: pass either `entries` or `file`, not both.");
  }

  const resolvedEntries: GlossaryEntry[] =
    entries ?? loadGlossaryFile(file as string, headingLevel);

  // Keys follow markdown-it-abbr's own `state.env.abbreviations`
  // convention (a leading ":" avoids clobbering Object.prototype members).
  const master: GlossaryLayer = {
    dir: "",
    site: true,
    source: file ?? "entries",
    terms: buildTerms(resolvedEntries),
  };

  const folderLayers: GlossaryLayer[] = [
    ...(root
      ? discoverLayers(root, scopedFile, file ? path.resolve(file) : undefined, headingLevel)
      : []),
    ...scopes.map((scope) => layerFromScope(scope, headingLevel)),
  ];
  warnSiteConflicts(folderLayers);

  // Most pages in a folder resolve identically, so merge once per
  // (folder, opt-out) combination rather than once per page.
  const cache = new Map<string, Record<string, string>>();
  const termsFor = (pageDir: string | undefined, useLocal: boolean, useMaster: boolean) => {
    const cacheKey = `${pageDir ?? "\0"}|${useLocal}|${useMaster}`;
    let terms = cache.get(cacheKey);
    if (!terms) {
      terms = resolveTerms(orderLayers(folderLayers, master, pageDir, useLocal, useMaster));
      cache.set(cacheKey, terms);
    }
    return terms;
  };

  md.use(markdownItAbbr);

  md.core.ruler.before("abbr_replace", "glossary_abbr_inject", (state: StateCore) => {
    let useMaster = true;
    let useLocal = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const env = state.env as any;
    const optOut = frontmatterKey === false ? undefined : env?.frontmatter?.[frontmatterKey];
    if (optOut === false) {
      return;
    } else if (optOut && typeof optOut === "object") {
      useMaster = optOut.master !== false;
      useLocal = optOut.local !== false;
    }

    const relativePath: unknown = env?.relativePath;
    const pageDir = typeof relativePath === "string" ? pageDirOf(relativePath) : undefined;

    // Leave `env.abbreviations` unset when nothing applies: an empty object
    // is truthy, and markdown-it-abbr would then build an empty regex that
    // matches everywhere instead of skipping the page.
    const terms = Object.entries(termsFor(pageDir, useLocal, useMaster));
    if (terms.length === 0) return;

    state.env.abbreviations ??= {};
    const envAbbreviations = state.env.abbreviations as Record<string, string>;
    for (const [key, definition] of terms) {
      envAbbreviations[key] ??= definition;
    }
  });
}
