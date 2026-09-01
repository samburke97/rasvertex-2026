"use client";
// components/workspace/DocEditor.tsx
//
// Notion-style editing: no persistent toolbar. Formatting a selection shows
// a small floating bubble menu (@tiptap/react/menus' BubbleMenu); inserting
// a block type is done by typing "/" for a filterable command menu (built on
// @tiptap/suggestion, the same utility Tiptap's own docs use for this exact
// pattern). The editor itself is borderless — it reads as part of the page,
// not a boxed form field.

import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { useEditor, EditorContent, ReactRenderer } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import { Extension } from "@tiptap/core";
import Suggestion, { type SuggestionProps, type SuggestionKeyDownProps } from "@tiptap/suggestion";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import type { Editor, Range } from "@tiptap/core";
import styles from "./DocEditor.module.css";

interface DocEditorProps {
  value: string;
  onChange: (html: string) => void;
}

// ── Slash-command palette ─────────────────────────────────────────────────────

interface CommandItem {
  title: string;
  description: string;
  icon: React.ReactNode;
  run: (editor: Editor, range: Range) => void;
}

const IconText = () => <span className={styles.slashIconGlyph}>T</span>;
const IconH2 = () => <span className={styles.slashIconGlyph}>H2</span>;
const IconBullet = () => (
  <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
    <circle cx="1.8" cy="2.5" r="1.3" fill="currentColor" />
    <rect x="4.5" y="1.8" width="7.5" height="1.3" rx="0.65" fill="currentColor" />
    <circle cx="1.8" cy="6" r="1.3" fill="currentColor" />
    <rect x="4.5" y="5.3" width="7.5" height="1.3" rx="0.65" fill="currentColor" />
    <circle cx="1.8" cy="9.5" r="1.3" fill="currentColor" />
    <rect x="4.5" y="8.8" width="7.5" height="1.3" rx="0.65" fill="currentColor" />
  </svg>
);
const IconOrdered = () => (
  <svg width="13" height="12" viewBox="0 0 13 12" fill="none">
    <text x="0" y="4" fontSize="3.8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">1.</text>
    <rect x="4.5" y="1.8" width="7.5" height="1.3" rx="0.65" fill="currentColor" />
    <text x="0" y="7.5" fontSize="3.8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">2.</text>
    <rect x="4.5" y="5.3" width="7.5" height="1.3" rx="0.65" fill="currentColor" />
    <text x="0" y="11" fontSize="3.8" fill="currentColor" fontFamily="sans-serif" fontWeight="600">3.</text>
    <rect x="4.5" y="8.8" width="7.5" height="1.3" rx="0.65" fill="currentColor" />
  </svg>
);
const IconTask = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="4" stroke="currentColor" strokeWidth="2" />
    <path d="M7 12l3 3 7-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconQuote = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
    <path d="M7 17h3l1-4V8H5v6h3zM16 17h3l1-4V8h-6v6h3z" fill="currentColor" />
  </svg>
);
const IconDivider = () => (
  <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
    <rect x="0" y="5.3" width="14" height="1.4" rx="0.7" fill="currentColor" />
  </svg>
);

const COMMAND_ITEMS: CommandItem[] = [
  {
    title: "Text",
    description: "Plain paragraph",
    icon: <IconText />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setParagraph().run(),
  },
  {
    title: "Heading",
    description: "Section heading",
    icon: <IconH2 />,
    run: (editor, range) =>
      editor.chain().focus().deleteRange(range).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Bullet list",
    description: "Simple bullet list",
    icon: <IconBullet />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    description: "List with numbering",
    icon: <IconOrdered />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleOrderedList().run(),
  },
  {
    title: "Checklist",
    description: "Track to-dos",
    icon: <IconTask />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleTaskList().run(),
  },
  {
    title: "Quote",
    description: "Capture a quote",
    icon: <IconQuote />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).toggleBlockquote().run(),
  },
  {
    title: "Divider",
    description: "Visual divider",
    icon: <IconDivider />,
    run: (editor, range) => editor.chain().focus().deleteRange(range).setHorizontalRule().run(),
  },
];

interface SlashListHandle {
  onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

const SlashCommandList = forwardRef<
  SlashListHandle,
  { items: CommandItem[]; command: (item: CommandItem) => void }
>(({ items, command }, ref) => {
  const [selected, setSelected] = useState(0);

  useEffect(() => setSelected(0), [items]);

  useImperativeHandle(
    ref,
    () => ({
      onKeyDown: ({ event }) => {
        if (event.key === "ArrowDown") {
          setSelected((s) => (s + 1) % items.length);
          return true;
        }
        if (event.key === "ArrowUp") {
          setSelected((s) => (s - 1 + items.length) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          if (items[selected]) command(items[selected]);
          return true;
        }
        return false;
      },
    }),
    [items, selected, command],
  );

  if (items.length === 0) return null;

  return (
    <div className={styles.slashMenu}>
      {items.map((item, i) => (
        <button
          key={item.title}
          type="button"
          className={`${styles.slashItem} ${i === selected ? styles.slashItemActive : ""}`}
          onMouseEnter={() => setSelected(i)}
          onClick={() => command(item)}
        >
          <span className={styles.slashIcon}>{item.icon}</span>
          <div className={styles.slashText}>
            <b>{item.title}</b>
            <i>{item.description}</i>
          </div>
        </button>
      ))}
    </div>
  );
});
SlashCommandList.displayName = "SlashCommandList";

const SlashCommand = Extension.create({
  name: "slashCommand",
  addOptions() {
    return {
      suggestion: {
        char: "/",
        startOfLine: false,
        command: ({
          editor,
          range,
          props,
        }: {
          editor: Editor;
          range: Range;
          props: CommandItem;
        }) => {
          props.run(editor, range);
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        items: ({ query }: { query: string }) =>
          COMMAND_ITEMS.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())).slice(
            0,
            8,
          ),
        render: () => {
          let component: ReactRenderer<SlashListHandle> | undefined;
          let popup: HTMLElement | undefined;

          const position = (clientRect?: (() => DOMRect | null) | null) => {
            const rect = clientRect?.();
            if (!rect || !popup) return;
            popup.style.left = `${rect.left}px`;
            popup.style.top = `${rect.bottom + 6}px`;
          };

          return {
            onStart: (props: SuggestionProps<CommandItem>) => {
              component = new ReactRenderer(SlashCommandList, {
                props: { items: props.items, command: props.command },
                editor: props.editor,
              });
              popup = component.element as HTMLElement;
              popup.style.position = "fixed";
              popup.style.zIndex = "80";
              document.body.appendChild(popup);
              position(props.clientRect);
            },
            onUpdate: (props: SuggestionProps<CommandItem>) => {
              component?.updateProps({ items: props.items, command: props.command });
              position(props.clientRect);
            },
            onKeyDown: (props: SuggestionKeyDownProps) => {
              if (props.event.key === "Escape") {
                popup?.remove();
                return true;
              }
              return component?.ref?.onKeyDown(props) ?? false;
            },
            onExit: () => {
              popup?.remove();
              component?.destroy();
            },
          };
        },
        ...this.options.suggestion,
      }),
    ];
  },
});

// ── Editor ────────────────────────────────────────────────────────────────────

export default function DocEditor({ value, onChange }: DocEditorProps) {
  const focusedRef = useRef(false);

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [2] } }),
      Placeholder.configure({
        placeholder: "Type '/' for commands",
        emptyEditorClass: styles.isEmpty,
      }),
      TaskList,
      TaskItem.configure({ nested: false }),
      SlashCommand,
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: value || "",
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      onChange(editor.isEmpty ? "" : editor.getHTML());
    },
    onFocus: () => {
      focusedRef.current = true;
    },
    onBlur: () => {
      focusedRef.current = false;
    },
    editorProps: {
      attributes: { class: styles.editorContent },
    },
  });

  // Sync external value changes — skip while the user is actively typing so
  // we never stomp on cursor position / key-repeat.
  useEffect(() => {
    if (!editor) return;
    if (focusedRef.current) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (value !== current) {
      editor.commands.setContent(value || "");
    }
  }, [value, editor]);

  return (
    <div className={styles.wrap}>
      {editor && (
        <BubbleMenu editor={editor} className={styles.bubbleMenu}>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBold().run()}
            className={editor.isActive("bold") ? styles.bubbleBtnActive : styles.bubbleBtn}
          >
            <span style={{ fontWeight: 700 }}>B</span>
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleItalic().run()}
            className={editor.isActive("italic") ? styles.bubbleBtnActive : styles.bubbleBtn}
          >
            <span style={{ fontStyle: "italic" }}>I</span>
          </button>
          <div className={styles.bubbleDivider} />
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            className={
              editor.isActive("heading", { level: 2 }) ? styles.bubbleBtnActive : styles.bubbleBtn
            }
          >
            H2
          </button>
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => editor.chain().focus().toggleBlockquote().run()}
            className={editor.isActive("blockquote") ? styles.bubbleBtnActive : styles.bubbleBtn}
          >
            <IconQuote />
          </button>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} className={styles.editorWrap} />
    </div>
  );
}
