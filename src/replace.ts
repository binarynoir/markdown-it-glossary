import type { MarkdownIt, StateCore } from "markdown-it";

/**
 * Case-insensitive pages, keyed by `state.env`. The inject rule records
 * each page's mode here and the replace rule reads it.
 */
export const caseInsensitiveEnvs = new WeakSet<object>();

/** Normalizes an abbreviation key for case-insensitive comparison. */
export const foldCase = (key: string): string => key.toLowerCase();

/**
 * A drop-in replacement for markdown-it-abbr's `abbr_replace` rule that
 * can also match case-insensitively. In that mode the text keeps the
 * casing it was written in, and its definition is looked up by exact
 * key first, then case-folded.
 */
export function abbrReplace(md: MarkdownIt): (state: StateCore) => void {
  const { escapeRE, arrayReplaceAt } = md.utils;

  // Same boundaries as markdown-it-abbr: punctuation, spaces and these
  // ASCII symbols end a term.
  const OTHER_CHARS = " \r\n$+<=>^`|~";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ucmicro = (md.utils as any).lib.ucmicro;
  const boundary =
    "(?:" +
    ucmicro.P.source +
    "|" +
    ucmicro.Z.source +
    "|[" +
    OTHER_CHARS.split("").map(escapeRE).join("") +
    "])";

  return (state: StateCore) => {
    const abbreviations = state.env?.abbreviations as Record<string, string> | undefined;
    if (!abbreviations) return;

    const insensitive = caseInsensitiveEnvs.has(state.env);
    const labels = Object.keys(abbreviations)
      .map((key) => key.slice(1))
      .sort((a, b) => b.length - a.length)
      .map(escapeRE)
      .join("|");
    if (!labels) return;

    const flags = insensitive ? "i" : "";
    const regSimple = new RegExp(`(?:${labels})`, flags);
    const reg = new RegExp(`(^|${boundary})(${labels})($|${boundary})`, "g" + flags);

    // The first key for each folded spelling wins, matching the order
    // definitions were added (page-local first, then closest glossary).
    const folded = new Map<string, string>();
    if (insensitive) {
      for (const [key, definition] of Object.entries(abbreviations)) {
        if (!folded.has(foldCase(key))) folded.set(foldCase(key), definition);
      }
    }
    const definitionFor = (text: string): string | undefined =>
      abbreviations[":" + text] ?? (insensitive ? folded.get(foldCase(":" + text)) : undefined);

    for (const blockToken of state.tokens) {
      if (blockToken.type !== "inline" || !blockToken.children) continue;
      let tokens = blockToken.children;

      // Scan from the end so earlier indexes stay valid as tokens are added.
      for (let i = tokens.length - 1; i >= 0; i--) {
        const current = tokens[i];
        if (current.type !== "text") continue;

        const text = current.content;
        if (!regSimple.test(text)) continue;

        const nodes: InstanceType<typeof state.Token>[] = [];
        let pos = 0;
        let m: RegExpExecArray | null;
        reg.lastIndex = 0;

        while ((m = reg.exec(text))) {
          // Back up over the trailing boundary so it can start the next match.
          reg.lastIndex -= m[3].length;
          const definition = definitionFor(m[2]);
          if (definition === undefined) continue;

          const start = m.index + m[1].length;
          if (start > pos) {
            const before = new state.Token("text", "", 0);
            before.content = text.slice(pos, start);
            nodes.push(before);
          }

          const open = new state.Token("abbr_open", "abbr", 1);
          open.attrs = [["title", definition]];
          nodes.push(open);

          const inner = new state.Token("text", "", 0);
          inner.content = m[2];
          nodes.push(inner);

          nodes.push(new state.Token("abbr_close", "abbr", -1));
          pos = reg.lastIndex;
        }

        if (nodes.length === 0) continue;

        if (pos < text.length) {
          const after = new state.Token("text", "", 0);
          after.content = text.slice(pos);
          nodes.push(after);
        }

        blockToken.children = tokens = arrayReplaceAt(tokens, i, nodes);
      }
    }
  };
}
