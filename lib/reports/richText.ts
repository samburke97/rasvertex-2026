// lib/reports/richText.ts
//
// Technician notes are HTML from the Notion-style editor (DocEditor). The
// report renders them with dangerouslySetInnerHTML — in the builder and in
// headless Chrome — so this keeps only the tags and attributes that editor
// produces, and turns notes saved before it existed (plain text) into
// paragraphs.

const ALLOWED = new Set([
  "p", "br", "strong", "b", "em", "i", "s", "code", "h2", "h3",
  "ul", "ol", "li", "blockquote", "hr", "label", "input", "span", "div",
]);
const DROP_WITH_CONTENT = /<(script|style|iframe|object|embed|svg|math|template)\b[\s\S]*?<\/\1\s*>/gi;

function escapeText(s: string): string {
  return s.replace(/&(?![a-z]+;|#\d+;|#x[0-9a-f]+;)/gi, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cleanTag(tag: string): string {
  const m = tag.match(/^<\s*(\/?)\s*([a-z0-9]+)([^>]*)>$/i);
  if (!m) return "";
  const [, close, rawName, rest] = m;
  const name = rawName.toLowerCase();
  if (!ALLOWED.has(name)) return "";
  if (close) return `</${name}>`;
  const attrs: string[] = [];
  const type = rest.match(/\bdata-type\s*=\s*"(taskList|taskItem)"/);
  if (type && (name === "ul" || name === "li")) attrs.push(`data-type="${type[1]}"`);
  const checked = rest.match(/\bdata-checked\s*=\s*"(true|false)"/);
  if (checked && name === "li") attrs.push(`data-checked="${checked[1]}"`);
  if (name === "input") {
    attrs.push('type="checkbox" disabled');
    if (/\bchecked\b(?!\s*=\s*"false")/.test(rest.replace(/data-checked\s*=\s*"[^"]*"/g, ""))) attrs.push("checked");
  }
  return `<${name}${attrs.length ? " " + attrs.join(" ") : ""}>`;
}

export function sanitizeNotesHtml(raw: string | null | undefined): string {
  const v = (raw ?? "").trim();
  if (!v) return "";
  if (!v.startsWith("<")) {
    // One paragraph per line; a blank line stays a blank line.
    return v
      .split("\n")
      .map((l) => `<p>${escapeText(l.trim())}</p>`)
      .join("");
  }
  return v
    .replace(DROP_WITH_CONTENT, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .split(/(<[^>]*>)/)
    .map((part) => (part.startsWith("<") ? cleanTag(part) : escapeText(part)))
    .join("");
}

/** Rough line count for pagination: each block, plus wrapping at ~100 chars. */
export function notesLineCount(html: string): number {
  const blocks = html
    .split(/<\/(?:p|h2|h3|li|blockquote)>|<br>|<hr>/)
    .map((b) => b.replace(/<[^>]*>/g, "").trim());
  // Empty paragraphs are blank lines on the page, so they count too.
  const blank = html.match(/<p>\s*(?:<br>)?\s*<\/p>/g)?.length ?? 0;
  return blocks.reduce((t, b) => t + (b ? Math.ceil(b.length / 100) : 0), 0) + blank + (html.match(/<hr>/g)?.length ?? 0);
}

export function notesIsEmpty(html: string): boolean {
  return !html.replace(/<[^>]*>/g, "").trim() && !/<hr>/.test(html);
}

/** The items of a one-per-line field (list or paragraphs) as inline HTML,
 *  empty ones dropped. */
export function htmlItems(raw: string | null | undefined): string[] {
  return sanitizeNotesHtml(raw)
    .split(/<\/?(?:p|li|ul|ol)>/)
    .map((x) => x.replace(/<br>/g, " ").trim())
    .filter((x) => x.replace(/<[^>]*>/g, "").trim());
}

/** The first letter capitalised ("awning screws backing out" → "Awning…"),
 *  past any leading tags in rich text. Photo titles and descriptions read
 *  as sentences however they were typed. */
export const capFirst = (s: string): string =>
  s ? s.replace(/^((?:\s|<[^>]*>)*)(\p{Ll})/u, (_m, lead: string, c: string) => lead + c.toUpperCase()) : s;
