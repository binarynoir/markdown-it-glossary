import MarkdownIt from "markdown-it";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { parseGlossaryMarkdown } from "../src/parse.js";
import { glossaryAbbr } from "../src/plugin.js";
import type { GlossaryAbbrOptions, GlossaryEntry } from "../src/types.js";

const entries: GlossaryEntry[] = [
  { term: "CI", definition: "Continuous Integration." },
  { term: "PO", definition: "Product Owner.", aliases: ["Product Owner"] },
  { term: "sharp", definition: "An image library." },
];

const render = (
  src: string,
  frontmatter: Record<string, unknown> = {},
  options: GlossaryAbbrOptions = {},
) => new MarkdownIt().use(glossaryAbbr, { entries, ...options }).render(src, { frontmatter });

const count = (html: string) => (html.match(/<abbr/g) ?? []).length;

function site(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "glossary-exclude-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const entry = (heading: string, def: string) => `### ${heading}\n\n${def}\n\n`;

afterEach(() => vi.restoreAllMocks());

describe("{.off}", () => {
  it("parses as not tooltipped, and combines with other flags", () => {
    const [off, both] = parseGlossaryMarkdown(
      entry("sharp {.off}", "Lib.") + entry("IT {#it .off .exact}", "Tech."),
    );
    expect(off).toMatchObject({ term: "sharp", tooltip: false });
    expect(both).toMatchObject({ term: "IT", tooltip: false, caseSensitive: true });
  });

  it("hides a farther glossary's definition, like a parenthetical", () => {
    const root = site({
      "glossary.md": entry("sharp", "Master sharp."),
      "team/glossary.md": entry("sharp {.off}", "Not here."),
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
    expect(md.render("sharp", { relativePath: "team/page.md" })).not.toContain("<abbr");
    expect(md.render("sharp", { relativePath: "page.md" })).toContain("<abbr");
  });
});

describe("glossary: { exclude }", () => {
  it("drops the listed terms on that page only", () => {
    expect(count(render("CI and sharp.", { glossary: { exclude: ["sharp"] } }))).toBe(1);
    expect(count(render("CI and sharp."))).toBe(2);
  });

  it("accepts a single string", () => {
    expect(count(render("CI and sharp.", { glossary: { exclude: "sharp" } }))).toBe(1);
  });

  it("ignores case when matching the list", () => {
    expect(count(render("Sharp and sharp.", { glossary: { exclude: ["SHARP"] } }))).toBe(0);
  });

  it("drops a term's aliases too", () => {
    expect(
      count(render("PO and Product Owner.", { glossary: { exclude: ["Product Owner"] } })),
    ).toBe(0);
  });

  it("is not filled in by a farther glossary", () => {
    const root = site({
      "glossary.md": entry("sharp", "Master sharp."),
      "team/glossary.md": entry("sharp", "Team sharp."),
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
    const html = md.render("sharp", {
      relativePath: "team/page.md",
      frontmatter: { glossary: { exclude: ["sharp"] } },
    });
    expect(html).not.toContain("<abbr");
  });

  it("leaves page-local definitions alone", () => {
    const html = render("sharp\n\n*[sharp]: Page-local.", { glossary: { exclude: ["sharp"] } });
    expect(html).toContain('title="Page-local."');
  });

  it("combines with master/local opt-outs", () => {
    expect(count(render("CI and sharp.", { glossary: { master: true, exclude: ["CI"] } }))).toBe(1);
  });

  it("warns about and ignores a value that is not a list", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(count(render("CI and sharp.", { glossary: { exclude: { sharp: true } } }))).toBe(2);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("exclude"));
  });

  it("does not leak between pages that share a renderer", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    md.render("sharp", { frontmatter: { glossary: { exclude: ["sharp"] } } });
    expect(md.render("sharp", { frontmatter: {} })).toContain("<abbr");
  });
});

describe("first-mention-only tooltips", () => {
  it("is off by default", () => {
    expect(count(render("CI, CI and CI."))).toBe(3);
  });

  it("tooltips only the first mention with the firstOnly option", () => {
    const html = render("CI, CI and CI.", {}, { firstOnly: true });
    expect(count(html)).toBe(1);
    expect(html).toMatch(/^<p><abbr[^>]*>CI<\/abbr>, CI and CI\.<\/p>/);
  });

  it("keeps the first mention in document order across blocks and inline markup", () => {
    const html = render("First **CI** here.\n\nThen CI and [CI](/x).", {}, { firstOnly: true });
    expect(count(html)).toBe(1);
    expect(html).toContain("<strong><abbr");
  });

  it("counts each term separately", () => {
    expect(count(render("CI, sharp, CI, sharp.", {}, { firstOnly: true }))).toBe(2);
  });

  it("treats a term and its aliases as one term", () => {
    expect(count(render("PO, then Product Owner.", {}, { firstOnly: true }))).toBe(1);
  });

  it("treats different casings as one term", () => {
    expect(count(render("CI and ci.", {}, { firstOnly: true }))).toBe(1);
  });

  it("applies to page-local definitions", () => {
    expect(count(render("X and X.\n\n*[X]: Local.", {}, { firstOnly: true }))).toBe(1);
  });

  it("is turned on or off per page with frontmatter", () => {
    expect(count(render("CI, CI.", { "glossary-first-only": true }))).toBe(1);
    expect(count(render("CI, CI.", { "glossary-first-only": false }, { firstOnly: true }))).toBe(2);
  });

  it("is inherited from the master and section glossaries", () => {
    const root = site({
      "glossary.md": "---\nglossary-first-only: true\n---\n\n" + entry("CI", "Master CI."),
      "loose/glossary.md": "---\nglossary-first-only: false\n---\n\n",
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
    expect(count(md.render("CI, CI.", { relativePath: "page.md" }))).toBe(1);
    expect(count(md.render("CI, CI.", { relativePath: "loose/deep/page.md" }))).toBe(2);
  });

  it("explicit scopes take firstOnly", () => {
    const md = new MarkdownIt().use(glossaryAbbr, {
      entries,
      scopes: [{ dir: "once", entries: [], firstOnly: true }],
    });
    expect(count(md.render("CI, CI.", { relativePath: "once/page.md" }))).toBe(1);
    expect(count(md.render("CI, CI.", { relativePath: "page.md" }))).toBe(2);
  });
});
