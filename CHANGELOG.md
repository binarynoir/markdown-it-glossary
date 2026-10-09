# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-10-09

### Added

- Section glossaries: with the new `root` option, a `glossary.md` in any subfolder applies to that folder and everything below it. The closest glossary to the page wins when a term is defined more than once
- `glossary-scope: site` in a section glossary's frontmatter applies it to the whole site instead of its own folder
- Per-layer opt-outs: `glossary: { master: false }` and `glossary: { local: false }` (`glossary: false` still turns everything off)
- `scopedFile` and `scopes` options for custom file names and explicit declarations; `parseGlossaryFrontmatter` export
- A term marked "not tooltipped" in a closer glossary now hides the same term from farther glossaries
- `hoverDelay` option for `enableGlossaryTooltips()` (default `500` ms): the popover now waits for the mouse to rest on a term, like a native tooltip, instead of opening instantly. A click still opens it immediately; `0` restores the old behavior

### Fixed

- Terms show the `help` (question mark) cursor for mouse users again. The forced `cursor: pointer` that makes taps work on iOS Safari is now limited to touch screens, and the `help` cursor stays on a term while its popover is open
- Headings inside fenced code blocks are no longer parsed as glossary terms, so a page can show example glossary syntax

## [0.3.7] - 2026-10-09

### Changed

- Renamed `enableGlossaryTouch()` to `enableGlossaryTooltips()` since it is no longer touch-only; the options type is now `GlossaryTooltipOptions`
- `enableGlossaryTooltips()` now shows the popover for every input: mouse hover (click to pin), click, and tap. The native `title` tooltip is lifted while the popover is open so the two don't overlap. `touchOnly` now defaults to `false`; new `hover` option (default `true`)
- Touch detection runs per event instead of once at load, so it also works when device emulation is toggled after the page loads or on hybrid devices

### Fixed

- `enableGlossaryTooltips()` now works on iOS Safari, which doesn't dispatch `click` on non-clickable elements like a bare `<abbr>`; terms get `cursor: pointer`
- Detect touch devices with `(hover: none), (pointer: coarse)` so iPads in "desktop site" mode are covered

## [0.3.6] - 2026-10-09

### Changed

- Moved touch devices section under VitePress setup

## [0.3.5] - 2026-10-09

### Added

- `markdown-it-glossary/client` with `enableGlossaryTouch()`: tap a term to show its definition in a popover on touch devices, where `<abbr title>` never shows because there is no hover

## [0.3.4] - 2026-10-08

### Changed

- Add a link to the documentation site in README

## [0.3.3] - 2026-10-06

### Changed

- Add support, author, and acknowledgments sections to README

## [0.3.2] - 2026-10-06

### Changed

- Add support and website badges to README

## [0.3.1] - 2026-10-05

### Changed

- README: configure `glossaryAbbr` through VitePress's own `markdown.config` hook, with `withGlossary` documented as the shortcut.

## [0.3.0] - 2026-09-21

### Added

- `GlossaryEntry.aliases` — other exact-text spellings (an abbreviation, a full expansion, etc.) that tooltip with the same definition as their term, without duplicating it under a separate heading. Written as a comma-separated glossary heading, e.g. `### PO, Product Owner`.

## [0.2.4] - 2026-09-21

### Changed

- Rewrote the README's introduction and feature summary for clarity.

## [0.2.3] - 2026-09-21

### Changed

- Updated dev dependencies to their latest compatible versions.

## [0.2.2] - 2026-09-21

### Changed

- **Breaking:** raised the minimum supported Node.js version from `>=20` to `>=22`. CI now tests against Node 22, 24, and 26, and releases publish on Node 26.

## [0.2.1] - 2026-09-13

### Fixed

- fixed README.md license badge

## [0.2.0] - 2026-09-13

### Changed

- **Breaking:** raised the `markdown-it` peer dependency to `^15.0.0` (dropped `^13.0.0 || ^14.0.0`). markdown-it 15 restructured its package into a single bundled entry point with its own native types, dropping the old `lib/` subpath exports; earlier versions have no built-in types at all and can't satisfy the type imports this package now uses. Upgrade `markdown-it` to 15.x to use this version.

## [0.1.0] - 2026-09-13

### Added

- `glossaryAbbr(md, options)` — markdown-it plugin that turns a glossary into site-wide `<abbr title="...">` hover tooltips, with a Markdown-frontmatter opt-out per page.
- `parseGlossaryMarkdown` / `loadGlossaryFile` — parse a `### Term` + paragraph glossary file into entries, exported for advanced/custom sourcing.
- `withGlossary(config, options)` (`markdown-it-glossary/vitepress`) — wraps a VitePress config the same way `withMermaid` does, composing onto an existing `markdown.config` instead of replacing it.
