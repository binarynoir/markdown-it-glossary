# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
