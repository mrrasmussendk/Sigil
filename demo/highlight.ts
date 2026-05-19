import { escapeHtml } from "./format.js";

/**
 * Minimal JSON syntax highlighter producing HTML with `.k` (keyword/key),
 * `.s` (string), `.n` (number), `.p` (punctuation) span classes. The
 * design's CSS resolves those to the syntax tokens.
 */
const TOKEN_RE = /"(?:\\.|[^"\\])*"(?:\s*:)?|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null|[{}\[\],:]/g;

export function highlightJson(input: unknown): string {
  const json = typeof input === "string" ? input : JSON.stringify(input, null, 2);
  // Escape first; the regex below recognises only ASCII tokens that survive
  // escaping intact, so we can colour atop the escaped text safely.
  const text = escapeHtml(json);

  return text.replace(TOKEN_RE, (match) => {
    if (match.startsWith("&quot;")) {
      // string OR object key (key has trailing colon)
      const isKey = /:\s*$/.test(match);
      const cls = isKey ? "k" : "s";
      return `<span class="${cls}">${match}</span>`;
    }
    if (match === "true" || match === "false" || match === "null") {
      return `<span class="k">${match}</span>`;
    }
    if (/^[{}\[\],:]$/.test(match)) {
      return `<span class="p">${match}</span>`;
    }
    return `<span class="n">${match}</span>`;
  });
}
