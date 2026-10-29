// lib/reports/proposal/v3/rich.ts
//
// Text fields are edited with the Notion-style editor (DocEditor) and stored
// as HTML. Older drafts hold plain text with one item per line; both read
// the same here.
//
// The proposal allows only paragraphs, bullet and numbered lists, bold and
// italic — never a font, size or colour — so the document keeps its one
// type scale whatever is pasted in. Everything else is reduced to its text.

import { sanitizeNotesHtml } from "@/lib/reports/richText";

const KEEP = new Set(["p", "ul", "ol", "li", "strong", "b", "em", "i", "br"]);
const AS_PARAGRAPH = new Set(["h2", "h3", "blockquote", "div"]);

/** Sanitised HTML for a prose field. */
export function richHtml(v: string | null | undefined): string {
  const clean = sanitizeNotesHtml(v);
  return clean
    .replace(/<(\/?)([a-z0-9]+)[^>]*>/gi, (tag, close: string, name: string) => {
      const n = name.toLowerCase();
      if (AS_PARAGRAPH.has(n)) return `<${close}p>`;
      if (!KEEP.has(n)) return "";
      // Task-list attributes etc. aren't needed: bare tags only.
      return `<${close}${n === "b" ? "strong" : n === "i" ? "em" : n}>`;
    })
    .replace(/<p>\s*<\/p>/g, "");
}

const BLOCK = /<\/?(?:p|li|ul|ol)>/;

/** A list field's items, one per paragraph or list item, as inline HTML
 *  (bold and italic only). Empty items are dropped. */
export function richItems(v: string | null | undefined): string[] {
  return richHtml(v)
    .split(BLOCK)
    .map((x) => x.replace(/<br>/g, " ").trim())
    .filter((x) => x.replace(/<[^>]*>/g, "").trim());
}

/** Plain text, one block per line — for height estimates. */
export function richText(v: string | null | undefined): string {
  return richItems(v)
    .map((x) =>
      x
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">"),
    )
    .join("\n");
}

export const richEmpty = (v: string | null | undefined) => !richText(v).trim();

/** Stylesheet for rich text inside the document. Rendered with the pages
 *  (preview and PDF alike). Fonts, sizes and colours are inherited from the
 *  surrounding block, so formatting can't step outside the type scale. */
export const RICH_CSS = `
.pb3-rt>*{margin:0}
.pb3-rt>*+*{margin-top:0.6em}
.pb3-rt *{font-family:inherit;font-size:inherit;line-height:inherit;color:inherit;letter-spacing:inherit}
.pb3-rt strong{font-weight:700;color:#011955}
.pb3-rt em{font-style:italic}
.pb3-rt ul,.pb3-rt ol{padding:0 0 0 22px}
.pb3-rt ul{list-style:none}
.pb3-rt ul>li{position:relative}
.pb3-rt ul>li::before{content:"";position:absolute;left:-22px;top:0.72em;width:6px;height:6px;border-radius:50%;background:#011955}
.pb3-rt li>p{margin:0}
.pb3-rt li+li{margin-top:0.2em}
.pb3-build [data-edit]{cursor:pointer;border-radius:12px;transition:background-color 120ms,box-shadow 120ms,filter 120ms}
.pb3-build [data-edit]:hover{background-color:rgba(1,25,85,0.035);box-shadow:0 0 0 10px rgba(1,25,85,0.035)}
.pb3-build [data-edit][style*="background-image"]:hover{filter:brightness(0.96);box-shadow:none}
`;
