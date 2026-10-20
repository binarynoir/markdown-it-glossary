export interface GlossaryEntry {
  /**
   * The text to match and wrap in <abbr>. Matching ignores case unless
   * case sensitivity is turned on (see `caseSensitive`).
   */
  term: string;
  /** Plain text used as the tooltip (the <abbr title="...">). Keep it short. */
  definition: string;
  /**
   * Whether this entry should become a live hover tooltip. Defaults to
   * `true`. Set to `false` for a term you only want documented (e.g. it's
   * ambiguous elsewhere, or it's always written as inline code and so
   * would never match in prose anyway) without it being auto-linked.
   * In a glossary file, a parenthetical qualifier or `{.off}` at the end
   * of the heading sets this.
   */
  tooltip?: boolean;
  /**
   * Other exact-text spellings (an abbreviation, a full expansion, etc.)
   * that should tooltip with this same definition, without duplicating
   * it under a separate heading. Each alias is matched the same way
   * `term` is — whole words, never inside inline code.
   */
  aliases?: string[];
  /**
   * Match this entry's spellings in exact case only (`true`) or in any
   * case (`false`), whatever the page's setting. Leave unset to follow
   * the page. In a glossary file, write `{.exact}` or `{.anycase}` at
   * the end of the heading.
   */
  caseSensitive?: boolean;
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
  /**
   * Docs source directory. When set, every file named `scopedFile` below
   * it becomes a section glossary covering its own folder and everything
   * under it. The master `file` is never treated as a section glossary.
   * Needs a host that sets `env.relativePath` (VitePress does).
   */
  root?: string;
  /** File name that marks a section glossary under `root`. Default: `"glossary.md"`. */
  scopedFile?: string;
  /** Section glossaries declared explicitly, in addition to any found under `root`. */
  scopes?: ScopedGlossary[];
  /**
   * Match terms only when their case matches the glossary exactly
   * (`API` but not `api`). This is the site-wide default; the master
   * glossary, a section glossary, or a single page can override it with
   * `glossary-case-sensitive: true | false` in its frontmatter.
   * Default: `false`.
   */
  caseSensitive?: boolean;
  /**
   * Tooltip only the first mention of each term on a page; later ones
   * stay plain text. This is the site-wide default; the master glossary,
   * a section glossary, or a single page can override it with
   * `glossary-first-only: true | false` in its frontmatter. Default: `false`.
   */
  firstOnly?: boolean;
}

/**
 * A glossary that covers one folder of the docs and everything below it.
 * Most sites don't need to list these by hand — set `root` and drop a
 * `glossary.md` into any folder. Use `scopes` for non-conventional file
 * names or for hosts that don't pass a page path.
 */
export interface ScopedGlossary {
  /** Folder it covers, relative to the docs root (e.g. `"team-a"`). */
  dir: string;
  /** Path to a Markdown glossary file. Provide this OR `entries`. */
  file?: string;
  /** Pre-parsed entries. Provide this OR `file`. */
  entries?: GlossaryEntry[];
  /**
   * Also apply to pages outside `dir`. Defaults to the file's
   * `glossary-scope` frontmatter (`site`), else `false`.
   */
  site?: boolean;
  /**
   * Case sensitivity for pages in `dir` and below. Defaults to the
   * file's `glossary-case-sensitive` frontmatter, else inherited from
   * the next glossary up.
   */
  caseSensitive?: boolean;
  /**
   * First-mention-only tooltips for pages in `dir` and below. Defaults to
   * the file's `glossary-first-only` frontmatter, else inherited.
   */
  firstOnly?: boolean;
}
