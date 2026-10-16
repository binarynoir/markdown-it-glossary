import MarkdownIt from "markdown-it";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { glossaryAbbr } from "../src/plugin.js";
import type { GlossaryAbbrOptions, GlossaryEntry } from "../src/types.js";

const entries: GlossaryEntry[] = [
  { term: "API", definition: "Application Programming Interface." },
  { term: "standup", definition: "A daily sync." },
];

const render = (options: GlossaryAbbrOptions, src: string, env: Record<string, unknown> = {}) =>
  new MarkdownIt().use(glossaryAbbr, options).render(src, env);

function site(files: Record<string, string>): string {
  const root = mkdtempSync(path.join(tmpdir(), "glossary-case-"));
  for (const [rel, content] of Object.entries(files)) {
    const abs = path.join(root, rel);
    mkdirSync(path.dirname(abs), { recursive: true });
    writeFileSync(abs, content);
  }
  return root;
}

const entry = (term: string, def: string) => `### ${term}\n\n${def}\n\n`;
const fm = (value: boolean) => `---\nglossary-case-sensitive: ${value}\n---\n\n`;

afterEach(() => vi.restoreAllMocks());

describe("case-insensitive matching (default)", () => {
  it("matches any casing and keeps the text as written", () => {
    const html = render({ entries }, "The api, the Api and the API. Standup at 9.");
    expect(html.match(/<abbr/g)).toHaveLength(4);
    expect(html).toContain('<abbr title="Application Programming Interface.">api</abbr>');
    expect(html).toContain('<abbr title="Application Programming Interface.">Api</abbr>');
    expect(html).toContain('<abbr title="A daily sync.">Standup</abbr>');
  });

  it("still matches whole words only", () => {
    expect(render({ entries }, "Rapid apiary.")).not.toContain("<abbr");
  });

  it("prefers an exact-case definition over a case-folded one", () => {
    const html = render(
      { entries: [...entries, { term: "Api", definition: "Other." }] },
      "Api and API.",
    );
    expect(html).toContain('<abbr title="Application Programming Interface.">Api</abbr>');
    expect(html).toContain('<abbr title="Application Programming Interface.">API</abbr>');
  });

  it("lets a page-local definition win over every casing of a term", () => {
    const html = render({ entries }, "The API and api.\n\n*[api]: Page-local.");
    expect(html.match(/title="Page-local\."/g)).toHaveLength(2);
    expect(html).not.toContain("Application Programming Interface.");
  });

  it("applies to page-local definitions on an opted-out page", () => {
    const html = render({ entries }, "CI and ci.\n\n*[CI]: Local.", {
      frontmatter: { glossary: false },
    });
    expect(html.match(/<abbr/g)).toHaveLength(2);
  });
});

describe("case-sensitive matching", () => {
  it("is turned on site-wide with the caseSensitive option", () => {
    const html = render({ entries, caseSensitive: true }, "The api and the API.");
    expect(html.match(/<abbr/g)).toHaveLength(1);
    expect(html).toContain(">API</abbr>");
  });

  it("is turned on for one page with frontmatter", () => {
    const html = render({ entries }, "The api and the API.", {
      frontmatter: { "glossary-case-sensitive": true },
    });
    expect(html.match(/<abbr/g)).toHaveLength(1);
  });

  it("is turned off for one page, overriding the option", () => {
    const html = render({ entries, caseSensitive: true }, "The api and the API.", {
      frontmatter: { "glossary-case-sensitive": false },
    });
    expect(html.match(/<abbr/g)).toHaveLength(2);
  });

  it("accepts string values in page frontmatter", () => {
    const html = render({ entries }, "The api.", {
      frontmatter: { "glossary-case-sensitive": "true" },
    });
    expect(html).not.toContain("<abbr");
  });

  it("warns about and ignores an invalid value", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const html = render({ entries }, "The api.", {
      frontmatter: { "glossary-case-sensitive": "sometimes" },
    });
    expect(html).toContain("<abbr");
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('"sometimes"'));
  });
});

describe("case sensitivity inheritance", () => {
  const files = {
    "glossary.md": fm(true) + entry("API", "Master API."),
    "loose/glossary.md": fm(false) + entry("SLO", "Loose SLO."),
    "loose/strict/glossary.md": fm(true) + entry("SLA", "Strict SLA."),
    "loose/inherit/glossary.md": entry("SLI", "Inherit SLI."),
  };
  const root = site(files);
  const at = (relativePath: string, src: string, frontmatter: Record<string, unknown> = {}) =>
    new MarkdownIt()
      .use(glossaryAbbr, { file: path.join(root, "glossary.md"), root })
      .render(src, { relativePath, frontmatter });

  it("the master glossary's frontmatter overrides the option", () => {
    const md = new MarkdownIt().use(glossaryAbbr, {
      file: path.join(root, "glossary.md"),
      caseSensitive: false,
    });
    expect(md.render("api", { relativePath: "page.md" })).not.toContain("<abbr");
  });

  it("a section glossary overrides the master for its folder and below", () => {
    expect(at("loose/page.md", "api and slo")).toMatch(/>api<.*>slo</);
    expect(at("loose/inherit/deeper/page.md", "api and sli").match(/<abbr/g)).toHaveLength(2);
  });

  it("does not apply outside the section", () => {
    expect(at("other/page.md", "api")).not.toContain("<abbr");
  });

  it("a deeper section glossary overrides a shallower one", () => {
    const html = at("loose/strict/page.md", "api, API, sla and SLA");
    expect(html.match(/<abbr/g)).toHaveLength(2);
    expect(html).toContain(">API</abbr>");
    expect(html).toContain(">SLA</abbr>");
  });

  it("a page overrides its section", () => {
    expect(at("loose/page.md", "api", { "glossary-case-sensitive": true })).not.toContain("<abbr");
    expect(at("loose/strict/page.md", "sla", { "glossary-case-sensitive": false })).toContain(
      "<abbr",
    );
  });

  it("a section glossary's own setting is not tied to glossary-scope: site", () => {
    const r = site({
      "glossary.md": entry("API", "Master API."),
      "shared/glossary.md": "---\nglossary-scope: site\nglossary-case-sensitive: true\n---\n\n",
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(r, "glossary.md"), root: r });
    expect(md.render("api", { relativePath: "other/page.md" })).toContain("<abbr");
    expect(md.render("api", { relativePath: "shared/page.md" })).not.toContain("<abbr");
  });

  it("explicit scopes take caseSensitive", () => {
    const md = new MarkdownIt().use(glossaryAbbr, {
      entries,
      scopes: [{ dir: "strict", entries: [], caseSensitive: true }],
    });
    expect(md.render("api", { relativePath: "strict/page.md" })).not.toContain("<abbr");
    expect(md.render("api", { relativePath: "page.md" })).toContain("<abbr");
  });
});

describe("closest glossary wins across casings", () => {
  it("a closer glossary's spelling decides the term when case is ignored", () => {
    const root = site({
      "glossary.md": entry("API", "Master API."),
      "team/glossary.md": entry("api", "Team api."),
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
    const html = md.render("API", { relativePath: "team/page.md" });
    expect(html).toContain('<abbr title="Team api.">API</abbr>');
  });

  it("a closer not-tooltipped entry hides every casing of the term", () => {
    const root = site({
      "glossary.md": entry("API", "Master API."),
      "team/glossary.md": entry("api (internal)", "Not this one."),
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
    expect(md.render("API", { relativePath: "team/page.md" })).not.toContain("<abbr");
  });

  it("keeps both spellings apart when case-sensitive", () => {
    const root = site({
      "glossary.md": entry("API", "Master API."),
      "team/glossary.md": fm(true) + entry("api", "Team api."),
    });
    const md = new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
    const html = md.render("API and api", { relativePath: "team/page.md" });
    expect(html).toContain('<abbr title="Master API.">API</abbr>');
    expect(html).toContain('<abbr title="Team api.">api</abbr>');
  });
});

describe("per-term case flags", () => {
  const flagged = (heading: string) => `### ${heading}\n\nDef of ${heading.split(" ")[0]}.\n\n`;

  function siteWith(master: string, extra: Record<string, string> = {}) {
    const root = site({ "glossary.md": master, ...extra });
    return new MarkdownIt().use(glossaryAbbr, { file: path.join(root, "glossary.md"), root });
  }

  it("{.exact} matches only the written case on an any-case site", () => {
    const md = siteWith(flagged("IT {.exact}") + flagged("API"));
    const html = md.render("IT and it, API and api.", { relativePath: "page.md" });
    expect(html.match(/<abbr/g)).toHaveLength(3);
    expect(html).toContain(">IT</abbr>");
    expect(html).not.toContain(">it</abbr>");
  });

  it("{.exact} beats a page that ignores case", () => {
    const md = siteWith(fm(true) + flagged("IT {.exact}"));
    const html = md.render("it", {
      relativePath: "page.md",
      frontmatter: { "glossary-case-sensitive": false },
    });
    expect(html).not.toContain("<abbr");
  });

  it("{.anycase} matches any case on a case-sensitive site", () => {
    const md = siteWith(fm(true) + flagged("standup {.anycase}") + flagged("API"));
    const html = md.render("Standup and api.", { relativePath: "page.md" });
    expect(html.match(/<abbr/g)).toHaveLength(1);
    expect(html).toContain(">Standup</abbr>");
  });

  it("the flag covers every alias in the heading", () => {
    const md = siteWith(flagged("IT, Info Tech {.exact}"));
    const html = md.render("it, info tech, IT, Info Tech", { relativePath: "page.md" });
    expect(html.match(/<abbr/g)).toHaveLength(2);
  });

  it("an exact term claims only its own spelling", () => {
    const md = siteWith(flagged("it"), { "team/glossary.md": flagged("IT {.exact}") });
    const html = md.render("IT and it", { relativePath: "team/page.md" });
    expect(html).toContain('<abbr title="Def of IT.">IT</abbr>');
    expect(html).toContain('<abbr title="Def of it.">it</abbr>');
  });

  it("an any-case term claims every casing from farther glossaries", () => {
    const md = siteWith(flagged("IT {.exact}"), { "team/glossary.md": flagged("it") });
    const html = md.render("IT", { relativePath: "team/page.md" });
    expect(html).toContain('<abbr title="Def of it.">IT</abbr>');
  });

  it("works with entries", () => {
    const html = render(
      { entries: [{ term: "IT", definition: "Info Tech.", caseSensitive: true }] },
      "it and IT",
    );
    expect(html.match(/<abbr/g)).toHaveLength(1);
  });
});
