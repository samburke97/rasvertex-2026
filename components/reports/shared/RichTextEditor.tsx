"use client";
// components/reports/shared/RichTextEditor.tsx

import React, { useState, useRef } from "react";
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

const IconBold = () => (
  <span style={{ fontWeight: 700, fontSize: 12, fontFamily: "Georgia,serif" }}>
    B
  </span>
);
const IconItalic = () => (
  <span
    style={{ fontStyle: "italic", fontSize: 12, fontFamily: "Georgia,serif" }}
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

export default function RichTextEditor({
  value,
  onChange,
  placeholder = "Click to edit…",
  label,
  className = "",
}: RichTextEditorProps) {
  const [focused, setFocused] = useState(false);
  // Track focus in a ref so the sync effect can read it without
  // becoming a stale closure — avoids key-repeat interruption.
  const focusedRef = useRef(false);

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
    onFocus: () => {
      setFocused(true);
      focusedRef.current = true;
    },
    onBlur: () => {
      setFocused(false);
      focusedRef.current = false;
    },
    editorProps: {
      attributes: { class: styles.editorContent },
    },
  });

  // Sync when value changes externally (SimPRO import or parent reset).
  // CRITICAL: skip when the editor is focused — the user is typing and
  // calling setContent would interrupt key-repeat and cursor position.
  React.useEffect(() => {
    if (!editor) return;
    if (focusedRef.current) return; // ← key fix: don't reset while typing
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
        e.preventDefault(); // prevent blur
        onClick();
      }}
      className={`${styles.btn} ${active ? styles.btnActive : ""}`}
    >
      {children}
    </button>
  );

  return (
    <div
      className={`${styles.wrap} ${focused ? styles.wrapFocused : ""} ${className}`}
    >
      {/* ── Toolbar — ONLY rendered when focused ── */}
      {focused && (
        <div className={styles.toolbar}>
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
      )}

      <EditorContent editor={editor} className={styles.editorWrap} />
    </div>
  );
}
