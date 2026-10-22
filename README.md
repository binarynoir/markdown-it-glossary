# markdown-it-glossary

[![npm version](https://img.shields.io/npm/v/markdown-it-glossary.svg)](https://www.npmjs.com/package/markdown-it-glossary)
[![CI](https://github.com/binarynoir/markdown-it-glossary/actions/workflows/ci.yml/badge.svg)](https://github.com/binarynoir/markdown-it-glossary/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/markdown-it-glossary.svg?cacheSeconds=3600)](LICENSE)

A [markdown-it](https://github.com/markdown-it/markdown-it) plugin that
turns a term you define once into a hover tooltip everywhere it appears in
your docs.

[Documentation and live demo](https://binarynoir.tech/plugins/glossary/)

[![Support me on Buy Me a Coffee](https://img.shields.io/badge/Support%20me-Buy%20Me%20a%20Coffee-orange?style=for-the-badge&logo=buy-me-a-coffee)](https://buymeacoffee.com/binarynoir)
[![Support me on Ko-fi](https://img.shields.io/badge/Support%20me-Ko--fi-blue?style=for-the-badge&logo=ko-fi)](https://ko-fi.com/binarynoir)
[![More tools](https://img.shields.io/badge/Website-binarynoir.tech-8c8c8c?style=for-the-badge)](https://binarynoir.tech)

## What this does

Say your docs mention "CI" a hundred times across dozens of pages. Anyone
who doesn't already know what that means has to go look it up, or just guess
from context.

This plugin lets you write what a term means once, in a plain Markdown file,
and it automatically wraps every plain-text mention of that term across your
whole site in a hover tooltip showing the definition. No linking each mention
by hand, no repeating the definition on every page it shows up on. Built for
[VitePress](https://vitepress.dev), and works with any markdown-it-based
setup too.

Here's the idea in practice:

```md
<!-- glossary.md -->

### CI

Continuous Integration — automatically building and testing every commit.
```

```md
<!-- any other page -->

Every PR runs through CI before it can merge.
```

renders as:

```html
Every PR runs through
<abbr title="Continuous Integration — automatically building and testing every commit.">CI</abbr>
before it can merge.
```

That happens automatically, on every page, the moment `CI` (or any other
defined term) shows up in prose.

## Install

```sh
npm install markdown-it-glossary
```

## Usage

### VitePress

Register the plugin in VitePress's own `markdown.config` hook, the same place
you'd add any other markdown-it plugin:

```ts
// .vitepress/config.mts
import { defineConfig } from "vitepress";
import { glossaryAbbr } from "markdown-it-glossary";
import path from "node:path";

export default defineConfig({
  markdown: {
    config(md) {
      md.use(glossaryAbbr, {
        file: path.resolve(import.meta.dirname, "../glossary.md"),
      });
    },
  },
});
```

That's it — every page in the site now tooltips every term defined in
`glossary.md`. Ship `glossary.md` as a normal page (add it to your nav)
and it doubles as a browsable reference; nothing about this package
requires it to be a "special" page type.

Other markdown-it plugins go in the same `config(md)` function, so they
share one place and you control the order:

```ts
config(md) {
  md.use(glossaryAbbr, { file: path.resolve(import.meta.dirname, "../glossary.md") });
  md.use(somethingElse);
},
```

#### `withGlossary` shortcut

If you'd rather wrap your config than touch `markdown.config`, use
`withGlossary` from the `/vitepress` subpath, same idea as `withMermaid` from
[vitepress-plugin-mermaid](https://github.com/emersonbottero/vitepress-plugin-mermaid):

```ts
import { withGlossary } from "markdown-it-glossary/vitepress";

export default withGlossary(
  defineConfig({
    // ...your normal config
  }),
  { file: path.resolve(import.meta.dirname, "../glossary.md") },
);
```

It is equivalent to the `markdown.config` version above. It will not clobber a
`markdown.config` you already have, including one set by another `withX()`
wrapper (`withMermaid`, etc.): it installs the glossary plugin, then calls
whatever was already there with the same arguments.

#### Hover, click and tap

`<abbr title>` tooltips need a mouse hover, so they never show on a phone
or tablet. Call `enableGlossaryTooltips()` once in the browser and every
term gets a small popover that works with any input: hover a term with a
mouse (click to pin it open), or tap it on a touch screen. Tap the term
again, tap elsewhere, scroll, or press Escape to dismiss it. While the
popover is open the term's `title` is lifted so the browser's own tooltip
doesn't show on top of it, then restored.

In VitePress, set it up in the theme, not the config. Call it from your theme's `enhanceApp`:

```ts
// .vitepress/theme/index.ts
import DefaultTheme from "vitepress/theme";
import { enableGlossaryTooltips } from "markdown-it-glossary/client";

export default {
  extends: DefaultTheme,
  enhanceApp() {
    enableGlossaryTooltips();
  },
};
```

Options (all optional): `selector` (default `"abbr[title]"`), `hover`
(default `true`; `false` for click and tap only), `hoverDelay` (default
`500`; milliseconds the mouse must rest on a term before the popover
appears, like a native tooltip's delay, `0` for instant), `touchOnly` (default
`false`; `true` responds to touch input only and leaves mouse users with
the native tooltip), and `injectStyles` (default `true`; `false` lets you
style `.glossary-popover` yourself). Terms get a `help` (question mark) cursor for mouse users, which you can override in your own CSS. On touch screens they get a pointer cursor instead, which iOS Safari needs before it will deliver taps. The default look follows VitePress
theme colors and can be overridden with `--glossary-popover-bg`,
`--glossary-popover-fg`, and `--glossary-popover-border`. It returns a
function that removes the listeners.

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

Product Backlog Item — Scrum's unit of work below a Feature/Epic.

### standup

A short daily sync where each person says what they did, what's next,
and any blockers.
```

- **The definition becomes the tooltip text verbatim.** Markdown
  formatting (`**bold**`, `` `code` ``, `[links](...)`) is stripped down
  to plain text for the `title` attribute — keep it to one or two
  sentences; a long tooltip is a bad tooltip.
- **Matching ignores case by default** (`API` also matches `api` and
  `Api`), matches whole words only, and only matches plain prose — never
  text inside inline code spans (`` `like this` ``). The text keeps the
  casing it was written in. To match exact case only, see
  [Case sensitivity](#case-sensitivity).
- **A heading with a parenthetical qualifier is parsed but never
  tooltipped:**

  ```md
  ### staging (pre-production environment)

  Not to be confused with git's staging area — an unrelated meaning
  of the same word.
  ```

  Use this for a term that's ambiguous elsewhere in your docs, or one
  that's always written as inline code anyway (a live tooltip for
  something that only ever appears inside `` `backticks` `` is dead
  weight). It still shows up wherever you render the parsed entries —
  see [Building your own glossary page](#building-your-own-glossary-page).

  `{.off}` at the end of the heading does the same without a qualifier:
  `### sharp {.off}`. In a section glossary, either form turns the term
  off for that folder and below, even if a farther glossary defines it.

- **A comma-separated heading defines aliases** — other exact-text
  spellings that should tooltip with the same definition, without
  repeating it under a separate heading:

  ```md
  ### PO, Product Owner

  The person who owns the product backlog and represents the
  customer's interests to the Scrum team.
  ```

  The first name is the canonical `term` (what shows on the glossary
  page); the rest become `aliases`. Both `PO` and `Product Owner`
  tooltip site-wide with the same definition. Combine with a
  parenthetical qualifier if the whole group shouldn't auto-tooltip:
  `### PO, Product Owner (internal nickname, not client-facing)`.

- **A trailing attribute block sets a term's case rule**:
  `### IT {.exact}` matches only `IT`, and `### standup {.anycase}`
  matches any case, whatever the page's setting. See
  [Per-term flags](#per-term-flags). Other attributes, like a custom
  anchor (`### CI {#ci}`), are stripped from the term.

## Case sensitivity

Terms match regardless of case by default. Turn exact-case matching on
or off at five levels. The closest setting to the term wins:

| Where                        | Setting                         | Applies to                            |
| ---------------------------- | ------------------------------- | ------------------------------------- |
| Plugin options               | `caseSensitive: true`           | the whole site (the base default)     |
| Master glossary frontmatter  | `glossary-case-sensitive: true` | the whole site, overriding the option |
| Section glossary frontmatter | `glossary-case-sensitive: true` | that folder and every folder below it |
| Any page's frontmatter       | `glossary-case-sensitive: true` | that page only                        |
| The term's heading           | `### IT {.exact}`               | that term, on every page              |

Use `false` at any level to turn it back off below that point:

```md
---
# docs/reference/glossary.md (the master)
glossary-case-sensitive: true
---
```

```md
---
# docs/team-a/glossary.md: team-a/ ignores case again
glossary-case-sensitive: false
---
```

Details worth knowing:

- **The setting follows folders, not terms.** It controls how every term
  on a page is matched, whichever glossary the term came from. A section
  glossary's setting covers its own folder even if it is marked
  `glossary-scope: site`; the setting doesn't travel with its terms to
  other folders.
- **A section glossary without the key inherits** from the next
  glossary up, then the master, then the option.
- **Opt-outs don't change it.** `glossary: false` or `{ master: false }`
  drops terms, not the setting, and page-local `*[Term]: …` definitions
  follow the page's setting too.
- **When case is ignored, spellings that differ only in case are one
  term.** A closer glossary's `api` overrides the master's `API`, and a
  "not tooltipped" `api (internal)` hides it. When case matters, `api`
  and `API` are separate terms.
- **Short acronyms can collide with ordinary words** when case is
  ignored (`IT` matches "it", `US` matches "us"). Flag the term
  `{.exact}`.
- For explicit `scopes`, set `caseSensitive` on the scope instead; it
  defaults to the file's frontmatter.

### Per-term flags

End a term's heading with `{.exact}` or `{.anycase}` to fix its case
rule regardless of the site, section or page setting:

```md
### IT, Information Technology {.exact}

The team that runs our laptops and servers.

### standup {.anycase}

A short daily sync.
```

- **The flag covers the whole heading**, aliases included. To give two
  spellings different rules, write them as separate headings.
- **It works alongside other attributes**: `{#it .exact}` keeps a
  custom anchor too. VitePress hides the block on the rendered glossary
  page; other renderers may show it as text.
- **An `{.exact}` term claims only its own spelling.** If a closer
  glossary has `IT {.exact}` and a farther one has `it`, `IT` gets the
  closer definition and `it` the farther one. An any-case term claims
  every casing, so a closer `it` overrides a farther `IT {.exact}`.
- With `entries`, set `caseSensitive: true` or `false` on the entry.

## Section glossaries

A large site often has parts that own their own vocabulary: a team's
docs, a product line, a versioned manual. A **section glossary** gives
that part of the site its own terms without touching the rest.

Some vocabulary used below:

- **Master glossary** — the one you pass as `file` (or `entries`). It
  applies to the whole site.
- **Section glossary** — a `glossary.md` inside a subfolder. By default
  it applies to pages in that folder and every folder below it, and
  nowhere else. That area is its **scope**.
- **Site-wide section glossary** — a section glossary that has chosen to
  apply to every page on the site, not just its own folder.
- **Page-local definition** — a `*[Term]: definition` line written in a
  page itself.

### Setup

Tell the plugin where your docs live with `root`, then drop a
`glossary.md` into any folder:

```ts
md.use(glossaryAbbr, {
  file: path.resolve(import.meta.dirname, "../glossary.md"), // master
  root: path.resolve(import.meta.dirname, ".."), // docs source dir
});
```

```text
docs/
├─ glossary.md             master: applies everywhere
├─ team-a/
│  ├─ glossary.md          section glossary: team-a/ and below
│  ├─ guides/
│  │  ├─ glossary.md       section glossary: team-a/guides/ and below
│  │  └─ deploy.md
│  └─ index.md
└─ team-b/
   └─ index.md
```

Section glossaries use the same format as the master. The plugin finds
them when the config loads (it skips `node_modules`, `dist`, and folders
starting with a dot, like `.vitepress`), so adding or editing one needs a
dev-server restart, just like the master. The master file is never
mistaken for a section glossary.

This needs a host that tells the plugin each page's path
(`env.relativePath`): VitePress does. See
[Without a page path](#without-a-page-path) for other setups.

### Applying a section glossary to the whole site

By default a section glossary stays in its own folder. To make it a
site-wide section glossary, set `glossary-scope` in its frontmatter:

```md
---
glossary-scope: site
---

### SLO

Service Level Objective — ...
```

Accepted values are `section` (the default) and `site`.

### Which definition wins

When the same term is defined in more than one glossary, the plugin uses
one rule: **the closest glossary wins**. "Closest" means closest to the
page being rendered, measured in folders. A glossary in the page's own
folder beats one a level up, which beats one above that, and so on, with
the master glossary last because it is the farthest from everything.

For each page the plugin ranks the glossaries that apply, highest
precedence first, and for each term the highest-ranked glossary that
defines it is used:

| Rank | Source                         | Applies to the page when…                                                      |
| ---- | ------------------------------ | ------------------------------------------------------------------------------ |
| 1    | **Page-local definition**      | the page has its own `*[Term]: …` line                                         |
| 2    | **Section glossary, closest**  | its folder contains the page; the deepest folder ranks highest                 |
| 3    | **Section glossary, farther**  | its folder contains the page, but a deeper section glossary also does          |
| 4    | **Site-wide section glossary** | it is marked `glossary-scope: site` and its folder does _not_ contain the page |
| 5    | **Master glossary**            | always, unless the page opts out                                               |

(Ranks 2 and 3 are one rule: the deeper the folder, the higher the rank.
They are split here only to show the order.)

Example, using the layout above, where `CI` is defined in the master,
in `team-a/glossary.md`, and in `team-a/guides/glossary.md`:

| Page                      | `CI` comes from             | Why                                  |
| ------------------------- | --------------------------- | ------------------------------------ |
| `team-a/guides/deploy.md` | `team-a/guides/glossary.md` | its own folder is the closest        |
| `team-a/index.md`         | `team-a/glossary.md`        | the closest glossary that covers it  |
| `team-b/index.md`         | the master glossary         | no section glossary covers `team-b/` |

Details worth knowing:

- **Only the conflicting term is replaced.** A closer glossary overrides
  the terms it defines. Every other term from farther glossaries still
  applies, so a section glossary adds to the master rather than replacing
  it.
- **Aliases count as terms.** `PO` and `Product Owner` each follow the
  rule on their own.
- **A "not tooltipped" entry counts as a definition.** If a closer
  glossary defines a term with a parenthetical qualifier
  (`### staging (git area)`), that term shows no tooltip on those pages,
  even if a farther glossary defines it. This is how a section says "this
  word means something else here."
- **Site-wide glossaries rank below the page's own sections.** On pages
  inside `team-a/`, `team-a`'s glossary beats a site-wide glossary from
  `team-b/`.
- **Two site-wide glossaries defining the same term** have no closer one
  to choose. The one whose folder name comes first alphabetically wins,
  and the plugin logs a warning at startup so you can resolve it.

### Opting out

The `glossary` frontmatter key controls which layers a page gets:

```md
---
glossary: false # nothing: no master, no section glossaries
---
```

```md
---
glossary:
  master: false # skip the master glossary, keep section glossaries
---
```

```md
---
glossary:
  local: false # skip all section glossaries, keep the master
---
```

`local: false` skips every section glossary, including site-wide ones
from other folders. The two keys can be combined, though that is the
same as `glossary: false`. Page-local `*[Term]: …` definitions work in
every case.

### Without a page path

A bare markdown-it setup does not tell the plugin which page is being
rendered, so folder scoping cannot work and only the master and
site-wide section glossaries apply. To use section glossaries with a
host that does provide `env.relativePath`, but with unconventional file
names, or to declare them explicitly, use `scopes`:

```ts
md.use(glossaryAbbr, {
  file: "glossary.md",
  scopes: [
    { dir: "team-a", file: "docs/team-a/terms.md" },
    { dir: "shared", entries: [{ term: "SLO", definition: "..." }], site: true },
  ],
});
```

`dir` is relative to the docs root, the same coordinate as
`env.relativePath`.

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

`glossary: false` turns off every glossary for that page. To drop only the
master, or only the section glossaries, see
[Section glossaries](#opting-out).

### Excluding single terms

To keep the glossary on a page but drop a few terms, list them under
`exclude`:

```md
---
glossary:
  exclude: [sharp, Homebrew]
---
```

- Spellings are matched ignoring case, and excluding any spelling of an
  entry drops its aliases too (`exclude: [PO]` also drops
  `Product Owner`).
- A farther glossary can't fill the gap: an excluded term shows no
  tooltip at all on that page.
- `exclude` combines with `master` and `local`. Page-local
  `*[Term]: …` definitions are not affected.

To turn a term off for a whole section or the whole site instead, use
`{.off}` in that section's glossary or the master (see
[Writing `glossary.md`](#writing-glossarymd)).

## First mention only

A term that appears 30 times on a page gets 30 tooltips. To tooltip only
the first mention of each term on a page, turn on `firstOnly`. It
inherits exactly like [case sensitivity](#case-sensitivity):

| Where                        | Setting                     | Applies to                            |
| ---------------------------- | --------------------------- | ------------------------------------- |
| Plugin options               | `firstOnly: true`           | the whole site (the base default)     |
| Master glossary frontmatter  | `glossary-first-only: true` | the whole site, overriding the option |
| Section glossary frontmatter | `glossary-first-only: true` | that folder and every folder below it |
| Any page's frontmatter       | `glossary-first-only: true` | that page only                        |

Use `false` at any level to turn it back off below that point.

- "First" means first in the page's source order, headings included.
- A term and its aliases count as one term, and so do different casings
  of a term matched in any case.
- Page-local `*[Term]: …` definitions follow the setting too.
- For explicit `scopes`, set `firstOnly` on the scope.

Opting out only turns off the **glossaries** for that page. The
page still has full [markdown-it-abbr](https://github.com/markdown-it/markdown-it-abbr)
support, so you can add tooltips by hand there. Write a definition line
anywhere in the page's Markdown, in the form `*[Term]: definition`:

```md
---
glossary: false
---

# Release notes

We cut a release every sprint, and each one is gated on CI passing.

*[CI]: Continuous Integration — only this page's definition applies.
```

Every occurrence of `CI` on that page (in any case, unless the page is
[case-sensitive](#case-sensitivity)) becomes an
`<abbr title="...">`, and nothing else from the glossary does. The
definition line itself isn't rendered. This is how you keep a few terms
on a page that is otherwise opted out, or define terms that aren't in the
glossary at all. The same syntax is what
[Overriding a term on one page](#overriding-a-term-on-one-page) uses on a
page that has _not_ opted out.

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

  // Section glossaries (all optional) — see "Section glossaries".
  root: string,                // docs source dir; enables folder discovery
  scopedFile: "glossary.md",   // file name that marks a section glossary
  scopes: ScopedGlossary[],    // explicit section glossaries

  caseSensitive: false,        // site-wide default — see "Case sensitivity"
  firstOnly: false,            // site-wide default — see "First mention only"
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
  /** Defaults to `true`. `false` = parsed, but never auto-tooltipped (a qualifier or `{.off}`). */
  tooltip?: boolean;
  /** Other spellings that tooltip with this same definition. */
  aliases?: string[];
  /** `true` = exact case only, `false` = any case; unset follows the page. */
  caseSensitive?: boolean;
}

interface ScopedGlossary {
  dir: string; // folder it covers, relative to the docs root
  file?: string; // glossary Markdown file (or `entries`)
  entries?: GlossaryEntry[];
  site?: boolean; // apply site-wide; defaults to the file's `glossary-scope`
  caseSensitive?: boolean; // for `dir` and below; defaults to the file's `glossary-case-sensitive`
  firstOnly?: boolean; // for `dir` and below; defaults to the file's `glossary-first-only`
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

---

## Feedback and support

Bug reports, feature requests and questions are all welcome. Please open them on this project's [GitHub issue tracker](https://github.com/binarynoir/markdown-it-glossary/issues):

- **Found a bug?** [Report it](https://github.com/binarynoir/markdown-it-glossary/issues/new?labels=bug&title=Bug%3A%20). Include your version and the steps to reproduce it.
- **Have an idea?** [Request a feature](https://github.com/binarynoir/markdown-it-glossary/issues/new?labels=enhancement&title=Feature%20request%3A%20). Tell us what you are trying to do.
- **Something else?** [Browse open issues](https://github.com/binarynoir/markdown-it-glossary/issues) to see if it has already been raised.

Pull requests are welcome too.

<!-- binarynoir:more:start (generated from binarynoir.github.io/products.json) -->

## More from BinaryNoir

<p align="center">
  <a href="https://binarynoir.tech">
    <img alt="BinaryNoir" src="https://binarynoir.tech/logo-horizontal.svg" width="320">
  </a>
</p>

Glossary Tooltips is one of a family of open-source tools from BinaryNoir.

**Pairs well with Glossary Tooltips**

- [Markdown Tags](https://binarynoir.tech/plugins/markdown-tags/): inline status badges and tagged-pages lists
- [Text Style](https://binarynoir.tech/plugins/text-style): colored and sized text inline
- [HTML Escape](https://binarynoir.tech/plugins/html-escape/): stray tags and braces shown as text, not build errors

**New:** [Blog](https://binarynoir.tech/plugins/blog/): posts anywhere, a main blog and section blogs, with RSS feeds

**See them all:** VitePress plugins, Vite plugins, editor extensions and command-line tools, with documentation and live demos, at **[binarynoir.tech](https://binarynoir.tech)**.

<!-- binarynoir:more:end -->

## Author

John Smith III, [BinaryNoir](https://binarynoir.tech). Thanks to all contributors and users for their support and feedback.
