import { describe, expect, it } from "vitest";
import { parseGlossaryMarkdown } from "../src/parse.js";

describe("parseGlossaryMarkdown", () => {
  it("parses a term and its definition paragraph", () => {
    const entries = parseGlossaryMarkdown(`
### CI

Continuous Integration — automatically building and testing every commit.
`);
    expect(entries).toEqual([
      {
        term: "CI",
        definition: "Continuous Integration — automatically building and testing every commit.",
        tooltip: true,
      },
    ]);
  });

  it("marks a parenthetical-qualified heading as tooltip: false", () => {
    const entries = parseGlossaryMarkdown(`
### staging (pre-production environment)

Not to be confused with git's staging area, an unrelated meaning of the same word.
`);
    expect(entries).toEqual([
      {
        term: "staging",
        definition:
          "Not to be confused with git's staging area, an unrelated meaning of the same word.",
        tooltip: false,
      },
    ]);
  });

  it("strips markdown formatting from the definition", () => {
    const entries = parseGlossaryMarkdown(`
### PBI

**Product Backlog Item** — see [the Scrum Guide](https://example.com) and \`code\`.
`);
    expect(entries[0].definition).toBe("Product Backlog Item — see the Scrum Guide and code.");
  });

  it("joins a multi-line paragraph into one line", () => {
    const entries = parseGlossaryMarkdown(`
### Sprint

A fixed-length iteration, typically one to four weeks, during which
a Scrum team commits to a set amount of backlog work.
`);
    expect(entries[0].definition).toBe(
      "A fixed-length iteration, typically one to four weeks, during which a Scrum team commits to a set amount of backlog work.",
    );
  });

  it("ignores headings at other levels", () => {
    const entries = parseGlossaryMarkdown(`
## Company & HR

### ATS

Applicant Tracking System.

#### Not a term

Should be ignored.
`);
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe("ATS");
  });

  it("skips a heading with no following paragraph", () => {
    const entries = parseGlossaryMarkdown(`
### Orphan

### DoD

Definition of Done.
`);
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe("DoD");
  });

  it("respects a custom heading level", () => {
    const entries = parseGlossaryMarkdown(
      `
## CI

Continuous Integration.
`,
      2,
    );
    expect(entries).toEqual([
      {
        term: "CI",
        definition: "Continuous Integration.",
        tooltip: true,
      },
    ]);
  });

  it("returns an empty array for a file with no matching headings", () => {
    expect(parseGlossaryMarkdown("# Title\n\nJust prose, no terms.")).toEqual([]);
  });

  it("parses a comma-separated heading into a term with aliases", () => {
    const entries = parseGlossaryMarkdown(`
### PO, Product Owner

The person who owns the product backlog and represents the customer's interests to the Scrum team.
`);
    expect(entries).toEqual([
      {
        term: "PO",
        definition:
          "The person who owns the product backlog and represents the customer's interests to the Scrum team.",
        tooltip: true,
        aliases: ["Product Owner"],
      },
    ]);
  });

  it("supports more than one alias", () => {
    const entries = parseGlossaryMarkdown(`
### PBI, Product Backlog Item, backlog item

Scrum's unit of work below a Feature/Epic.
`);
    expect(entries[0].term).toBe("PBI");
    expect(entries[0].aliases).toEqual(["Product Backlog Item", "backlog item"]);
  });

  it("applies a parenthetical qualifier to the whole comma-separated heading", () => {
    const entries = parseGlossaryMarkdown(`
### staging, stage (pre-production environment)

Not to be confused with git's staging area, an unrelated meaning of the same word.
`);
    expect(entries).toEqual([
      {
        term: "staging",
        definition:
          "Not to be confused with git's staging area, an unrelated meaning of the same word.",
        tooltip: false,
        aliases: ["stage"],
      },
    ]);
  });
});
