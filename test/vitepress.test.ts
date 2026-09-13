import MarkdownIt from "markdown-it";
import { describe, expect, it, vi } from "vitest";
import { withGlossary } from "../src/vitepress.js";
import type { GlossaryEntry } from "../src/types.js";
import type { UserConfig } from "vitepress";

const entries: GlossaryEntry[] = [{ term: "SSRS", definition: "SQL Server Reporting Services." }];

// VitePress 2's `markdown.config` is typed against `markdown-it-async`'s
// MarkdownIt, a structural superset of plain markdown-it's. A real
// `markdown-it` instance is fine at runtime for everything glossaryAbbr
// uses — this cast just bridges the two types for these tests.
function runMarkdownConfig(config: UserConfig, md: InstanceType<typeof MarkdownIt>): void {
  (config.markdown!.config as unknown as (md: InstanceType<typeof MarkdownIt>) => void)(md);
}

describe("withGlossary", () => {
  it("adds a markdown.config when the input config has none", () => {
    const config = withGlossary({} as UserConfig, { entries });
    expect(typeof config.markdown?.config).toBe("function");

    const md = new MarkdownIt();
    runMarkdownConfig(config, md);
    expect(md.render("We use SSRS.")).toContain("<abbr");
  });

  it("does not replace an existing markdown.config — it still runs", () => {
    const userConfigFn = vi.fn();
    const config = withGlossary({ markdown: { config: userConfigFn } } as unknown as UserConfig, {
      entries,
    });

    const md = new MarkdownIt();
    runMarkdownConfig(config, md);

    // The user's own function still ran, with the same md instance.
    expect(userConfigFn).toHaveBeenCalledTimes(1);
    expect(userConfigFn).toHaveBeenCalledWith(md);
    // And the glossary plugin still applied.
    expect(md.render("We use SSRS.")).toContain("<abbr");
  });

  it("lets the user's own markdown.config run its own md.use() calls too", () => {
    let userPluginRan = false;
    const config = withGlossary(
      {
        markdown: {
          config: (md) => {
            userPluginRan = true;
            md.use((instance) => {
              instance.renderer.rules.text = (tokens, idx) => tokens[idx].content.toUpperCase();
            });
          },
        },
      } as UserConfig,
      { entries },
    );

    const md = new MarkdownIt();
    runMarkdownConfig(config, md);

    expect(userPluginRan).toBe(true);
    // Both plugins' effects are present: glossary tooltip AND the
    // user's own uppercase-text rule.
    const html = md.render("plain text");
    expect(html).toContain("PLAIN TEXT");
  });

  it("returns the same config object, mutated in place", () => {
    const config = {} as UserConfig;
    const result = withGlossary(config, { entries });
    expect(result).toBe(config);
  });
});
