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
}
