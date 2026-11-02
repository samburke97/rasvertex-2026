"use client";
// The "/" editor for a multi-line builder field: paragraphs (Enter makes a
// new one), and "/" for bullet or numbered lists; select text for bold or
// italic. Stores HTML; older plain-text values open one paragraph per line.
// `list` keeps it to one item per line (bullets on the page).

import DocEditor from "@/components/workspace/DocEditor";
import { sanitizeNotesHtml } from "@/lib/reports/richText";
import styles from "./RichBox.module.css";

export default function RichBox({
  value,
  onChange,
  list,
  placeholder,
}: {
  value: string;
  onChange: (html: string) => void;
  list?: boolean;
  placeholder?: string;
}) {
  const html = value && !value.trim().startsWith("<") ? sanitizeNotesHtml(value) : value;
  return (
    <div
      className={`${styles.rich} ${list ? styles.richList : ""}`}
      // Clicking anywhere in the box, not just on the text, puts the cursor in it.
      onMouseDown={(e) => {
        const ed = e.currentTarget.querySelector<HTMLElement>(".tiptap");
        if (ed && !ed.contains(e.target as Node)) {
          e.preventDefault();
          ed.focus();
        }
      }}
    >
      <DocEditor
        variant={list ? "list" : "prose"}
        value={html}
        placeholder={placeholder ?? (list ? "One per line" : "Type, or “/” for a list")}
        onChange={onChange}
      />
    </div>
  );
}
