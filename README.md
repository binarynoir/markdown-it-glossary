# markdown-it-glossary

[![npm version](https://img.shields.io/npm/v/markdown-it-glossary.svg)](https://www.npmjs.com/package/markdown-it-glossary)
[![CI](https://github.com/binarynoir/markdown-it-glossary/actions/workflows/ci.yml/badge.svg)](https://github.com/binarynoir/markdown-it-glossary/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/markdown-it-glossary.svg?cacheSeconds=3600)](LICENSE)

Define a glossary once, in a plain Markdown file, and get it back as
site-wide hover tooltips (`<abbr title="...">`) wherever those terms
appear in your docs — no per-page setup, with a Markdown-frontmatter
opt-out for the odd page that needs one. Built for [VitePress](https://vitepress.dev),
works with any [markdown-it](https://github.com/markdown-it/markdown-it)
consumer.

```md
<!-- glossary.md -->

### SSRS

SQL Server Reporting Services — Microsoft's reporting platform.
```

```md
<!-- any other page -->

We build most of our reports in SSRS.
```

renders as:

```html
We build most of our reports in
<abbr title="SQL Server Reporting Services — Microsoft's reporting platform.">SSRS</abbr>.
```

— automatically, on every page, the moment `SSRS` (or any other defined
term) shows up in prose.

## Install

```sh
npm install markdown-it-glossary
```

## Usage

### VitePress

Use `withGlossary` from the `/vitepress` subpath — no `markdown-it`
knowledge required, same idea as `withMermaid` from
[vitepress-plugin-mermaid](https://github.com/emersonbottero/vitepress-plugin-mermaid)
if you've used that:

```ts
// .vitepress/config.mts
import { defineConfig } from "vitepress";
import { withGlossary } from "markdown-it-glossary/vitepress";
import path from "node:path";

export default withGlossary(
  defineConfig({
    // ...your normal config
  }),
  { file: path.resolve(import.meta.dirname, "../glossary.md") },
);
```

That's it — every page in the site now tooltips every term defined in
`glossary.md`. Ship `glossary.md` as a normal page (add it to your nav)
and it doubles as a browsable reference; nothing about this package
requires it to be a "special" page type.

**`withGlossary` will not clobber a `markdown.config` you already
have** — including one set by another `withX()` wrapper composed the
same way (`withMermaid`, etc.). It installs the glossary plugin, then
calls whatever was already there with the same arguments, so both take
effect regardless of the order you nest the wrappers in:

```ts
export default withGlossary(withMermaid(defineConfig({/* ... */})), {
  file: path.resolve(import.meta.dirname, "../glossary.md"),
});
```

If you'd rather call `md.use()` yourself — inside your own
`markdown.config`, alongside other plugins, with full control over
ordering — the lower-level `glossaryAbbr` plugin (used internally by
`withGlossary`) is exported from the package root; see
[Plain markdown-it](#plain-markdown-it) below. The two are equivalent;
`withGlossary` just does the `markdown.config` wiring for you.

### Plain markdown-it

```ts
import MarkdownIt from "markdown-it";
import { glossaryAbbr } from "markdown-it-glossary";

const md = new MarkdownIt().use(glossaryAbbr, { file: "glossary.md" });
```

The Markdown-frontmatter opt-out (below) only works in a host that
populates `env.frontmatter` before running core rules — VitePress and
VuePress both do this. In a bare markdown-it setup without that
convention, the opt-out option is simply inert; everything else works
the same.

## Writing `glossary.md`

Each term is a heading (`###` by default — see `headingLevel`) followed
by its definition as the next paragraph:

```md
### PBI

Product Backlog Item — Azure DevOps' unit of work below a Feature/Epic.

### linked server

A SQL Server feature that lets one database server query another as if
it were local.
```

- **The definition becomes the tooltip text verbatim.** Markdown
  formatting (`**bold**`, `` `code` ``, `[links](...)`) is stripped down
  to plain text for the `title` attribute — keep it to one or two
  sentences; a long tooltip is a bad tooltip.
- **Matching is exact-text and case-sensitive**, and only matches plain
  prose — never text inside inline code spans (`` `like this` ``).
  Write the heading in whatever casing the term actually appears in
  prose: lowercase for a common phrase (`linked server`), normal
  capitalization for a proper noun or acronym (`SSRS`, `HIPAA`).
- **A heading with a parenthetical qualifier is parsed but never
  tooltipped:**

  ```md
  ### staging (internal deploy environment)

  Not to be confused with a client's database of the same name.
  ```

  Use this for a term that's ambiguous elsewhere in your docs, or one
  that's always written as inline code anyway (a live tooltip for
  something that only ever appears inside `` `backticks` `` is dead
  weight). It still shows up wherever you render the parsed entries —
  see [Building your own glossary page](#building-your-own-glossary-page).

## Opting a page out

Add the configured frontmatter key (`glossary` by default) set to
`false`:

```md
---
glossary: false
---
```

Useful for the glossary page itself, so its own term headings don't
tooltip themselves.

## Overriding a term on one page

Write a real [markdown-it-abbr](https://github.com/markdown-it/markdown-it-abbr)
definition anywhere in that page's Markdown — a page-local definition
always wins over the site-wide one for that term, on that page:

```md
*[PBI]: On this page specifically, refers to a different acronym entirely
```

## Options

The same options object works for both `glossaryAbbr(md, options)` and
`withGlossary(config, options)`:

```ts
{
  // Exactly one of `entries` or `file` is required.
  entries: GlossaryEntry[],   // pre-parsed entries — see parseGlossaryMarkdown
  file: string,                // path to a glossary Markdown file to parse

  headingLevel: 3,             // heading level that marks a term (### = 3)
  frontmatterKey: "glossary",  // frontmatter key for the opt-out; `false` disables it entirely
}
```

## API

Besides the `glossaryAbbr` plugin, two lower-level exports let you
source entries from somewhere other than a single Markdown file (a CMS,
multiple files merged together, filtered/generated at build time, etc.):

```ts
import { parseGlossaryMarkdown, loadGlossaryFile } from "markdown-it-glossary";

parseGlossaryMarkdown(source: string, headingLevel?: number): GlossaryEntry[]
loadGlossaryFile(filePath: string, headingLevel?: number): GlossaryEntry[]
```

```ts
interface GlossaryEntry {
  term: string;
  definition: string;
  /** Defaults to `true`. `false` = parsed, but never auto-tooltipped. */
  tooltip?: boolean;
}
```

### Building your own glossary page

Since `glossary.md` is just a normal Markdown page you author yourself,
you don't need anything from this package to display it — write the
page however you like. If you want a rendered list of terms somewhere
_other_ than the glossary source file itself (a sitemap, a search
index, a different layout), `parseGlossaryMarkdown` gives you the same
data your tooltips are built from.

## Styling

This package renders plain `<abbr>` tags and does not inject any CSS —
your site's own styles apply, and most browsers already underline an
`<abbr title>` by default. If you want a more deliberate affordance:

```css
abbr[title] {
  text-decoration: underline dotted;
  cursor: help;
}
```

## Releasing

Releases are tag-triggered. To ship a new version, from a clean `main` that's
in sync with `origin/main`:

```sh
npm run release:patch   # or release:minor / release:major
```

This runs typecheck/lint/test/build locally, then `npm version <bump>`
(bumps `package.json`, commits, and creates a matching `vX.Y.Z` tag) and
`git push --follow-tags`. Pushing that tag triggers
[`.github/workflows/release.yml`](.github/workflows/release.yml), which
re-runs the checks, publishes to npm (with
[provenance](https://docs.npmjs.com/generating-provenance-statements)), and
creates a GitHub release with auto-generated notes.

For a prerelease or an explicit version, use `npm run release -- <arg>`
(e.g. `npm run release -- 1.2.3` or `npm run release -- prerelease`) — see
[`npm version`](https://docs.npmjs.com/cli/v10/commands/npm-version) for the
full list of accepted values.

This requires an `NPM_TOKEN` repository secret (an npm
[automation token](https://docs.npmjs.com/creating-and-viewing-access-tokens)
with publish access) — set it under Settings → Secrets and variables →
Actions.

## License

[MIT](LICENSE)
