import { describe, expect, it } from "vitest";
import { parseGlossaryMarkdown } from "../src/parse.js";

describe("parseGlossaryMarkdown", () => {
  it("parses a term and its definition paragraph", () => {
    const entries = parseGlossaryMarkdown(`
### SSRS

SQL Server Reporting Services — Microsoft's reporting platform.
`);
    expect(entries).toEqual([
      {
        term: "SSRS",
        definition: "SQL Server Reporting Services — Microsoft's reporting platform.",
        tooltip: true,
      },
    ]);
  });

  it("marks a parenthetical-qualified heading as tooltip: false", () => {
    const entries = parseGlossaryMarkdown(`
### staging (AHC database)

AHC's production database, confusingly named.
`);
    expect(entries).toEqual([
      {
        term: "staging",
        definition: "AHC's production database, confusingly named.",
        tooltip: false,
      },
    ]);
  });

  it("strips markdown formatting from the definition", () => {
    const entries = parseGlossaryMarkdown(`
### PBI

**Product Backlog Item** — see [Azure DevOps](https://example.com) and \`code\`.
`);
    expect(entries[0].definition).toBe("Product Backlog Item — see Azure DevOps and code.");
  });

  it("joins a multi-line paragraph into one line", () => {
    const entries = parseGlossaryMarkdown(`
### EMR

Electronic Medical Record — the category of system a client's
clinical data lives in.
`);
    expect(entries[0].definition).toBe(
      "Electronic Medical Record — the category of system a client's clinical data lives in.",
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

### RDL

Report Definition Language.
`);
    expect(entries).toHaveLength(1);
    expect(entries[0].term).toBe("RDL");
  });

  it("respects a custom heading level", () => {
    const entries = parseGlossaryMarkdown(
      `
## SSRS

SQL Server Reporting Services.
`,
      2,
    );
    expect(entries).toEqual([
      {
        term: "SSRS",
        definition: "SQL Server Reporting Services.",
        tooltip: true,
      },
    ]);
  });

  it("returns an empty array for a file with no matching headings", () => {
    expect(parseGlossaryMarkdown("# Title\n\nJust prose, no terms.")).toEqual([]);
  });
});
