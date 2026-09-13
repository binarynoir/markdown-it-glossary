import type { UserConfig } from "vitepress";
import type { MarkdownIt } from "markdown-it";
import { glossaryAbbr } from "./plugin.js";
import type { GlossaryAbbrOptions } from "./types.js";

/**
 * Wraps a VitePress config with glossary hover tooltips, the same way
 * `withMermaid` from `vitepress-plugin-mermaid` wraps one for Mermaid
 * diagrams — no `markdown-it` knowledge required.
 *
 * ```ts
 * // .vitepress/config.mts
 * import { defineConfig } from "vitepress";
 * import { withGlossary } from "markdown-it-glossary/vitepress";
 * import path from "node:path";
 *
 * export default withGlossary(
 *   defineConfig({
 *     // ...your normal config — including your own `markdown.config`,
 *     // if you have one; it still runs, untouched.
 *   }),
 *   { file: path.resolve(import.meta.dirname, "../glossary.md") },
 * );
 * ```
 *
 * If `config.markdown.config` is already set (by you, or by another
 * `withX()` wrapper composed the same way — `withMermaid`, etc.),
 * `withGlossary` **does not replace it**. It installs the glossary
 * plugin first, then calls your existing function with the same
 * arguments, so both apply. Order your `withX(...)` wrappers however
 * you like — each one composes onto whatever's already there instead of
 * overwriting it, as long as it follows this same pattern.
 */
export function withGlossary(config: UserConfig, options: GlossaryAbbrOptions): UserConfig {
  config.markdown ??= {};
  const existingConfig = config.markdown.config ?? (() => {});

  config.markdown.config = (md) => {
    // VitePress 2 types this callback against `markdown-it-async`'s
    // MarkdownIt, a structural superset of plain markdown-it's. A real
    // `markdown-it` instance is fine at runtime for everything
    // glossaryAbbr uses — this cast just bridges the two types.
    glossaryAbbr(md as unknown as MarkdownIt, options);
    existingConfig(md);
  };

  return config;
}
