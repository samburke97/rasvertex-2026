// lib/reports/techNotes.ts
// Technician notes from SimPRO, tidied for a report: each line the
// technician typed becomes a sentence in a bulleted list (capital letter,
// full stop, stray spaces gone). The wording is theirs and isn't rewritten.

import type { TechnicianNote } from "@/lib/simpro/client";

const decode = (s: string) =>
  s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&rsquo;|&lsquo;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&ndash;/g, "–")
    .replace(/&mdash;/g, "—");
const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** One note's lines, as sentences. */
export function noteLines(html: string): string[] {
  return html
    .split(/<\/(?:div|p|li)>|<br\s*\/?>|\n/i)
    .map((seg) => decode(seg.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim())
    .map((s) => s.replace(/^([-–•*·]|\d+[.)])\s*/, ""))
    .filter(Boolean)
    .map((s) => {
      const t = s.charAt(0).toUpperCase() + s.slice(1);
      return /[.!?:;]$/.test(t) ? t : t + ".";
    });
}

/** Every note's lines in one list, oldest note first; "" when there are none. */
export function formatTechNotes(notes: TechnicianNote[]): string {
  const lines = notes.flatMap((n) => noteLines(n.html));
  return lines.length ? `<ul>${lines.map((l) => `<li><p>${escape(l)}</p></li>`).join("")}</ul>` : "";
}
