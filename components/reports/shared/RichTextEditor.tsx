"use client";
// components/reports/shared/RichTextEditor.tsx
// ─────────────────────────────────────────────────────────────────────────────
// WYSIWYG rich text editor using Tiptap.
// - Toolbar appears only when focused (slides in above the text area)
// - Light styling matching schedule table header — #f9f9f9 bg, dark text, border
// - Stores value as HTML — output directly into PDF, no markdown parsing needed
// - Used for: Summary comments/recommendations, Cover intro
// ─────────────────────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import styles from "./RichTextEditor.module.css";

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

// ── Icons ─────────────────────────────────────────────────────────────────────

const IconBold = () => (
  <span
    style={{
      fontWeight: 700,
      fontSize: 12,
      fontFamily: "Georgia, serif",
      lineHeight: 1,
    }}
  >
    B
  </span>
);
const IconItalic = () => (
  <span
    style={{
      fontStyle: "italic",
      fontSize: 12,
      fontFamily: "Georgia, serif",
      lineHeight: 1,
    }}
  >
    I
  </span>
);
const IconBullet = () => (
  <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
    <circle cx="1.8" cy="2.5" r="1.3" fill="currentColor" />
    <rect
      x="4.5"
      y="1.8"
      width="7.5"
      height="1.3"
      rx="0.65"
      fill="currentColor"
    />
    <circle cx="1.8" cy="6" r="1.3" fill="currentColor" />
    <rect
      x="4.5"
      y="5.3"
      width="7.5"
      height="1.3"
      rx="0.65"
      fill="currentColor"
    />
    <circle cx="1.8" cy="9.5" r="1.3" fill="currentColor" />
    <rect
      x="4.5"
      y="8.8"
      width="7.5"
      height="1.3"
      rx="0.65"
      fill="currentColor"
    />
  </svg>
);
const IconOrdered = () => (
  <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
    <text
      x="0"
      y="4"
      fontSize="3.8"
      fill="currentColor"
      fontFamily="sans-serif"
      fontWeight="600"
    >
      1.
    </text>
    <rect
      x="4.5"
      y="1.8"
      width="7.5"
      height="1.3"
      rx="0.65"
      fill="currentColor"
    />
    <text
      x="0"
      y="7.5"
      fontSize="3.8"
      fill="currentColor"
      fontFamily="sans-serif"
      fontWeight="600"
    >
      2.
    </text>
    <rect
      x="4.5"
      y="5.3"
      width="7.5"
      height="1.3"
      rx="0.65"
      fill="currentColor"
    />
    <text
      x="0"
      y="11"
      fontSize="3.8"
      fill="currentColor"
      fontFamily="sans-serif"
      fontWeight="600"
    >
      3.
    </text>
    <rect
      x="4.5"
      y="8.8"
      width="7.5"
      height="1.3"
      rx="0.65"
      fill="currentColor"
    />
  </svg>
);

// ── Component ─────────────────────────────────────────────────────────────────

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Click to edit…",
  label,
  className = "",
}: RichTextEditorProps) {
  const [focused, setFocused] = useState(false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        code: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
        emptyEditorClass: styles.isEmpty,
      }),
    ],
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
    onFocus: () => setFocused(true),
    onBlur: () => setFocused(false),
    editorProps: {
      attributes: { class: styles.editorContent },
    },
  });

  // Sync when value changes externally (SimPRO import populates fields)
  React.useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "", false);
    }
  }, [value, editor]);

  const Btn = ({
    onClick,
    active,
    title,
    children,
  }: {
    onClick: () => void;
    active?: boolean;
    title: string;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => {
        e.preventDefault(); // keep editor focused
        onClick();
      }}
      className={`${styles.btn} ${active ? styles.btnActive : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`${styles.wrap} ${focused ? styles.focused : ""} ${className}`}
    >
      {/* ── Toolbar — slides in above editor on focus ── */}
      <div
        className={`${styles.toolbar} ${focused ? styles.toolbarVisible : ""}`}
        aria-hidden={!focused}
      >
        {label && (
          <>
            <span className={styles.toolbarLabel}>{label}</span>
            <div className={styles.divider} />
          </>
        )}

        <Btn
          onClick={() => editor?.chain().focus().toggleBold().run()}
          active={editor?.isActive("bold")}
          title="Bold"
        >
          <IconBold />
        </Btn>

        <Btn
          onClick={() => editor?.chain().focus().toggleItalic().run()}
          active={editor?.isActive("italic")}
          title="Italic"
        >
          <IconItalic />
        </Btn>

        <div className={styles.divider} />

        <Btn
          onClick={() => editor?.chain().focus().toggleBulletList().run()}
          active={editor?.isActive("bulletList")}
          title="Bullet list"
        >
          <IconBullet />
        </Btn>

        <Btn
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}
          active={editor?.isActive("orderedList")}
          title="Numbered list"
        >
          <IconOrdered />
        </Btn>
      </div>

      {/* ── Editor ── */}
      <EditorContent editor={editor} className={styles.editorWrap} />
    </div>
  );
}
