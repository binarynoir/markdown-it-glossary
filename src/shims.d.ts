// markdown-it-abbr ships no TypeScript types and has no @types package.
declare module "markdown-it-abbr" {
  import type { MarkdownIt } from "markdown-it";
  const abbr: (md: MarkdownIt) => void;
  export default abbr;
}
