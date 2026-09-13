# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2026-09-13

### Added

- `glossaryAbbr(md, options)` — markdown-it plugin that turns a glossary into site-wide `<abbr title="...">` hover tooltips, with a Markdown-frontmatter opt-out per page.
- `parseGlossaryMarkdown` / `loadGlossaryFile` — parse a `### Term` + paragraph glossary file into entries, exported for advanced/custom sourcing.
- `withGlossary(config, options)` (`markdown-it-glossary/vitepress`) — wraps a VitePress config the same way `withMermaid` does, composing onto an existing `markdown.config` instead of replacing it.
