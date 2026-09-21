export interface GlossaryEntry {
  /** The exact text to match and wrap in <abbr>. Matching is case-sensitive. */
  term: string;
  /** Plain text used as the tooltip (the <abbr title="...">). Keep it short. */
  definition: string;
  /**
   * Whether this entry should become a live hover tooltip. Defaults to
   * `true`. Set to `false` for a term you only want documented (e.g. it's
   * ambiguous elsewhere, or it's always written as inline code and so
   * would never match in prose anyway) without it being auto-linked.
   */
  tooltip?: boolean;
  /**
   * Other exact-text spellings (an abbreviation, a full expansion, etc.)
   * that should tooltip with this same definition, without duplicating
   * it under a separate heading. Each alias is matched the same way
   * `term` is — exact-text, case-sensitive, never inside inline code.
   */
  aliases?: string[];
}

export interface GlossaryAbbrOptions {
  /**
   * Pre-parsed glossary entries. Provide this OR `file`, not both — use
   * this when you're loading/generating entries yourself (a CMS, a JSON
   * file, filtering `parseGlossaryMarkdown`'s output, etc.).
   */
  entries?: GlossaryEntry[];
  /**
   * Path to a Markdown file to parse with `parseGlossaryMarkdown`.
   * Provide this OR `entries`, not both.
   */
  file?: string;
  /**
   * Heading level that marks a term in the glossary file, e.g. `3` for
   * `### Term`. Default: `3`.
   */
  headingLevel?: number;
  /**
   * Frontmatter key that, when explicitly set to `false` on a page,
   * skips tooltip injection for that page entirely. Requires the host
   * environment to populate `env.frontmatter` before running core rules
   * (VitePress and VuePress both do). Pass `false` to disable the
   * opt-out mechanism entirely. Default: `"glossary"`.
   */
  frontmatterKey?: string | false;
}
