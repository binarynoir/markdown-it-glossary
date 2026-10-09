import MarkdownIt from "markdown-it";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { glossaryAbbr } from "../src/plugin.js";
import { parseGlossaryFrontmatter } from "../src/parse.js";

function site(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "glossary-scopes-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const entry = (term: string, def: string) => `### ${term}\n\n${def}\n\n`;

function renderAt(
  root: string,
  relativePath: string,
  src: string,
  frontmatter: Record<string, unknown> = {},
  extra: Record<string, unknown> = {},
) {
  const md = new MarkdownIt().use(glossaryAbbr, {
    file: path.join(root, "glossary.md"),
    root,
    ...extra,
  });
  return md.render(src, { relativePath, frontmatter });
}

afterEach(() => vi.restoreAllMocks());

describe("section glossaries", () => {
  const files = {
    "glossary.md": entry("CI", "Master CI.") + entry("API", "Master API."),
    "team-a/glossary.md": entry("CI", "Team A CI.") + entry("SLO", "Team A SLO."),
    "team-a/deep/glossary.md": entry("CI", "Deep CI."),
    "team-b/glossary.md": entry("SLO", "Team B SLO."),
    "team-b/page.md": "",
  };

  it("applies a folder glossary to pages in that folder and below", () => {
    const root = site(files);
    expect(renderAt(root, "team-a/index.md", "SLO")).toContain('title="Team A SLO."');
    expect(renderAt(root, "team-a/deep/x/y.md", "SLO")).toContain('title="Team A SLO."');
  });

  it("does not apply a folder glossary outside its folder", () => {
    const root = site(files);
    expect(renderAt(root, "team-b/page.md", "SLO")).toContain('title="Team B SLO."');
    expect(renderAt(root, "other.md", "SLO")).not.toContain("<abbr");
  });

  it("does not treat the master glossary as a section glossary", () => {
    const root = site(files);
    expect(renderAt(root, "team-b/page.md", "API")).toContain('title="Master API."');
  });

  it("closest folder wins over farther folders and the master", () => {
    const root = site(files);
    expect(renderAt(root, "team-a/deep/p.md", "CI")).toContain('title="Deep CI."');
    expect(renderAt(root, "team-a/p.md", "CI")).toContain('title="Team A CI."');
    expect(renderAt(root, "team-b/p.md", "CI")).toContain('title="Master CI."');
  });

  it("a page-local definition still beats every glossary", () => {
    const root = site(files);
    const html = renderAt(root, "team-a/p.md", "CI\n\n*[CI]: Local CI.");
    expect(html).toContain('title="Local CI."');
  });

  it("applies a site-wide glossary everywhere, below the page's own sections", () => {
    const root = site({
      ...files,
      "team-b/glossary.md": "---\nglossary-scope: site\n---\n" + entry("SLO", "Team B SLO."),
    });
    expect(renderAt(root, "other.md", "SLO")).toContain('title="Team B SLO."');
    expect(renderAt(root, "team-a/p.md", "SLO")).toContain('title="Team A SLO."');
  });

  it("a site-wide glossary beats the master", () => {
    const root = site({
      ...files,
      "team-b/glossary.md": "---\nglossary-scope: site\n---\n" + entry("API", "Team B API."),
    });
    expect(renderAt(root, "other.md", "API")).toContain('title="Team B API."');
  });

  it("warns when two site-wide glossaries define the same term", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const site2 = "---\nglossary-scope: site\n---\n";
    const root = site({
      "glossary.md": "",
      "a/glossary.md": site2 + entry("X", "A."),
      "b/glossary.md": site2 + entry("X", "B."),
    });
    expect(renderAt(root, "c.md", "X")).toContain('title="A."');
    expect(warn).toHaveBeenCalledOnce();
  });

  it("a tooltip: false term in a closer glossary hides the farther definition", () => {
    const root = site({
      "glossary.md": entry("staging", "Master staging."),
      "team-a/glossary.md": entry("staging (git area)", "Ambiguous here."),
    });
    expect(renderAt(root, "team-a/p.md", "staging")).not.toContain("<abbr");
    expect(renderAt(root, "p.md", "staging")).toContain("<abbr");
  });

  it("ignores node_modules and dot folders when scanning", () => {
    const root = site({
      "glossary.md": "",
      "node_modules/pkg/glossary.md": entry("NM", "No."),
      ".vitepress/glossary.md": entry("DOT", "No."),
    });
    expect(renderAt(root, "node_modules/pkg/p.md", "NM DOT")).not.toContain("<abbr");
  });

  it("supports explicit scopes without a root", () => {
    const md = new MarkdownIt().use(glossaryAbbr, {
      entries: [{ term: "CI", definition: "Master." }],
      scopes: [{ dir: "team-a", entries: [{ term: "CI", definition: "Team." }] }],
    });
    expect(md.render("CI", { relativePath: "team-a/p.md" })).toContain('title="Team."');
    expect(md.render("CI", { relativePath: "p.md" })).toContain('title="Master."');
  });
});

describe("section glossary opt-outs", () => {
  const root = () =>
    site({
      "glossary.md": entry("CI", "Master CI.") + entry("API", "Master API."),
      "team-a/glossary.md": entry("CI", "Team CI.") + entry("SLO", "Team SLO."),
    });

  it("glossary: false turns everything off", () => {
    expect(renderAt(root(), "team-a/p.md", "CI SLO API", { glossary: false })).not.toContain(
      "<abbr",
    );
  });

  it("{ master: false } drops only the master", () => {
    const html = renderAt(root(), "team-a/p.md", "CI SLO API", { glossary: { master: false } });
    expect(html).toContain('title="Team CI."');
    expect(html).toContain('title="Team SLO."');
    expect(html).not.toContain("Master API.");
  });

  it("renders no empty <abbr> when every layer is opted out or empty", () => {
    const r = site({ "glossary.md": entry("CI", "Master."), "team-a/p.md": "" });
    const html = renderAt(r, "team-a/p.md", "Plain text.", { glossary: { master: false } });
    expect(html).not.toContain("<abbr");
    expect(html).toContain("Plain text.");
  });

  it("{ local: false } drops only the folder glossaries", () => {
    const html = renderAt(root(), "team-a/p.md", "CI SLO API", { glossary: { local: false } });
    expect(html).toContain('title="Master CI."');
    expect(html).toContain('title="Master API."');
    expect(html).not.toContain("Team SLO.");
  });

  it("{ local: false } also drops site-wide folder glossaries", () => {
    const r = site({
      "glossary.md": "",
      "b/glossary.md": "---\nglossary-scope: site\n---\n" + entry("SLO", "B."),
    });
    expect(renderAt(r, "p.md", "SLO", { glossary: { local: false } })).not.toContain("<abbr");
  });
});

describe("without a page path", () => {
  it("applies only the master and site-wide glossaries", () => {
    const root = site({
      "glossary.md": entry("CI", "Master."),
      "a/glossary.md": entry("A", "Section only."),
      "b/glossary.md": "---\nglossary-scope: site\n---\n" + entry("B", "Site-wide."),
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
    const html = md.render("CI A B");
    expect(html).toContain("Master.");
    expect(html).toContain("Site-wide.");
    expect(html).not.toContain("Section only.");
  });
});

describe("parseGlossaryFrontmatter", () => {
  it("reads flat key/value pairs and strips quotes", () => {
    expect(parseGlossaryFrontmatter('---\nglossary-scope: "site"\ntitle: T\n---\n# x')).toEqual({
      "glossary-scope": "site",
      title: "T",
    });
  });
  it("returns {} without frontmatter", () => {
    expect(parseGlossaryFrontmatter("### Term\n\nDef.")).toEqual({});
  });
});
