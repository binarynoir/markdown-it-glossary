import markdownItAbbr from "markdown-it-abbr";
import type { MarkdownIt, StateCore } from "markdown-it";
import { loadGlossaryFile } from "./parse.js";
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
 * A page opts out by setting the configured `frontmatterKey` (default
 * `"glossary"`) to `false` in its frontmatter. This requires the host
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
  const { entries, file, headingLevel = 3, frontmatterKey = "glossary" } = options;

  if (!entries && !file) {
    throw new Error("markdown-it-glossary: pass either `entries` or `file` in options.");
  }
  if (entries && file) {
    throw new Error("markdown-it-glossary: pass either `entries` or `file`, not both.");
  }

  const resolvedEntries: GlossaryEntry[] =
    entries ?? loadGlossaryFile(file as string, headingLevel);

  // Keyed the same way markdown-it-abbr keys its own
  // `state.env.abbreviations` — a leading ":" avoids clobbering
  // Object.prototype members (this is markdown-it-abbr's own convention,
  // not ours; see its source).
  const abbreviations: Record<string, string> = {};
  for (const entry of resolvedEntries) {
    if (entry.tooltip === false) continue;
    abbreviations[":" + entry.term] = entry.definition;
  }

  md.use(markdownItAbbr);

  md.core.ruler.before("abbr_replace", "glossary_abbr_inject", (state: StateCore) => {
    if (
      frontmatterKey !== false &&
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (state.env as any)?.frontmatter?.[frontmatterKey] === false
    ) {
      return;
    }

    state.env.abbreviations ??= {};
    const envAbbreviations = state.env.abbreviations as Record<string, string>;
    for (const [key, definition] of Object.entries(abbreviations)) {
      envAbbreviations[key] ??= definition;
    }
  });
}
