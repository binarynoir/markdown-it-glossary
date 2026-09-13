import MarkdownIt from "markdown-it";
import { writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { glossaryAbbr } from "../src/plugin.js";
import type { GlossaryEntry } from "../src/types.js";

const entries: GlossaryEntry[] = [
  { term: "SSRS", definition: "SQL Server Reporting Services." },
  { term: "PBI", definition: "Product Backlog Item." },
  {
    term: "staging",
    definition: "AHC's production database.",
    tooltip: false,
  },
];

function render(
  md: InstanceType<typeof MarkdownIt>,
  src: string,
  env: Record<string, unknown> = {},
) {
  return md.render(src, env);
}

describe("glossaryAbbr", () => {
  it("wraps a matching term in <abbr title>", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    const html = render(md, "We use SSRS for reporting.");
    expect(html).toContain('<abbr title="SQL Server Reporting Services.">SSRS</abbr>');
  });

  it("wraps every occurrence of a term on the page", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    const html = render(md, "SSRS and more SSRS.");
    expect(html.match(/<abbr/g)).toHaveLength(2);
  });

  it("does not tooltip a term marked tooltip: false", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    const html = render(md, "The staging database is confusing.");
    expect(html).not.toContain("<abbr");
  });

  it("does not match text inside inline code spans", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    const html = render(md, "Run `SSRS` from the CLI.");
    expect(html).not.toContain("<abbr");
    expect(html).toContain("<code>SSRS</code>");
  });

  it("skips injection when the frontmatter opt-out key is false", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    const html = render(md, "We use SSRS.", {
      frontmatter: { glossary: false },
    });
    expect(html).not.toContain("<abbr");
  });

  it("still injects when frontmatter is present but the key is unset", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    const html = render(md, "We use SSRS.", {
      frontmatter: { title: "Some Page" },
    });
    expect(html).toContain("<abbr");
  });

  it("respects a custom frontmatterKey", () => {
    const md = new MarkdownIt().use(glossaryAbbr, {
      entries,
      frontmatterKey: "noGlossary",
    });
    const html = render(md, "We use SSRS.", {
      frontmatter: { noGlossary: false },
    });
    expect(html).not.toContain("<abbr");
  });

  it("disables the opt-out entirely when frontmatterKey is false", () => {
    const md = new MarkdownIt().use(glossaryAbbr, {
      entries,
      frontmatterKey: false,
    });
    const html = render(md, "We use SSRS.", {
      frontmatter: { glossary: false },
    });
    expect(html).toContain("<abbr");
  });

  it("lets a page-local *[Term]: definition override the site-wide one", () => {
    const md = new MarkdownIt().use(glossaryAbbr, { entries });
    const html = render(md, "*[PBI]: A totally different local definition\n\nSee PBI.");
    expect(html).toContain('title="A totally different local definition"');
  });

  it("loads entries from a file via the `file` option", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "glossary-test-"));
    const file = path.join(dir, "glossary.md");
    writeFileSync(file, "### SSRS\n\nSQL Server Reporting Services.\n");

    const md = new MarkdownIt().use(glossaryAbbr, { file });
    const html = render(md, "We use SSRS.");
    expect(html).toContain('<abbr title="SQL Server Reporting Services.">SSRS</abbr>');
  });

  it("throws if neither entries nor file is given", () => {
    expect(() => new MarkdownIt().use(glossaryAbbr, {})).toThrow(/pass either `entries` or `file`/);
  });

  it("throws if both entries and file are given", () => {
    expect(() => new MarkdownIt().use(glossaryAbbr, { entries, file: "x.md" })).toThrow(/not both/);
  });
});
