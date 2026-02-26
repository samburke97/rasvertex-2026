"use client";
// components/reports/shared/EditableField.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Grammarly-style inline editable field.
//
// Read state:  text renders in-place, subtle green highlight on hover.
// Active state: floating dark toolbar appears above with:
//               - field label (context)
//               - Bold / Italic toggles  (wraps selection in ** / * markers
//                 which are stripped for plain-text fields but kept for
//                 multiline/rich fields that feed into print HTML)
//               - Font size picker (xs / sm / md / lg)
//               - Clear
//               - Done ✓
//
// For multiline fields, "bold" and "italic" wrap selected text in markers and
// the print layer renders them. Single-line fields just edit the raw string.
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import styles from "./EditableField.module.css";

export type TextSize = "xs" | "sm" | "md" | "lg";

export interface ToolbarAction {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}

interface EditableFieldProps {
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
  /** Show bold/italic/size controls. Default true for multiline, false for single-line */
  richText?: boolean;
  extraActions?: ToolbarAction[];
}

// ── Inline SVG icons ──────────────────────────────────────────────────────────

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M2.5 7l3 3 6-6"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconClear = () => (
  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
    <path
      d="M1.5 1.5l8 8M9.5 1.5l-8 8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const IconSize = () => (
  <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
    <text
      x="0"
      y="11"
      fontSize="11"
      fontWeight="700"
      fill="currentColor"
      fontFamily="inherit"
    >
      Aa
    </text>
  </svg>
);

const SIZE_OPTIONS: { label: string; value: TextSize }[] = [
  { label: "Small", value: "sm" },
  { label: "Normal", value: "md" },
  { label: "Large", value: "lg" },
  { label: "X-Large", value: "xs" }, // xs = "extra-scale" in our context
];

// ── Auto-resize textarea ──────────────────────────────────────────────────────

function useAutoResize(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
) {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value, ref]);
}

// ── Wrap selected text in a marker ───────────────────────────────────────────

function wrapSelection(
  textarea: HTMLTextAreaElement,
  marker: string,
  onChange: (v: string) => void,
) {
  const { selectionStart: start, selectionEnd: end, value } = textarea;
  if (start === end) return; // nothing selected
  const selected = value.slice(start, end);
  const already = selected.startsWith(marker) && selected.endsWith(marker);
  const newText = already
    ? value.slice(0, start) +
      selected.slice(marker.length, -marker.length) +
      value.slice(end)
    : value.slice(0, start) + marker + selected + marker + value.slice(end);
  onChange(newText);
  // Restore selection after state update
  requestAnimationFrame(() => {
    textarea.setSelectionRange(
      already ? start : start + marker.length,
      already ? end - marker.length * 2 : end + marker.length,
    );
    textarea.focus();
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditableField({
  value,
  onChange,
  multiline = false,
  placeholder = "Click to edit",
  label,
  className = "",
  richText,
  extraActions = [],
}: EditableFieldProps) {
  const showRich = richText ?? multiline;

  const [active, setActive] = useState(false);
  const [showSizeMenu, setShowSizeMenu] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const sizeMenuRef = useRef<HTMLDivElement>(null);

  useAutoResize(textareaRef, value);

  const activate = useCallback(() => setActive(true), []);

  const commit = useCallback(() => {
    setActive(false);
    setShowSizeMenu(false);
  }, []);

  const clear = useCallback(() => onChange(""), [onChange]);

  // Close on outside click
  useEffect(() => {
    if (!active) return;
    const down = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commit();
      }
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [active, commit]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") commit();
  };

  const handleBold = () => {
    const ta = textareaRef.current;
    if (ta) wrapSelection(ta, "**", onChange);
  };

  const handleItalic = () => {
    const ta = textareaRef.current;
    if (ta) wrapSelection(ta, "_", onChange);
  };

  const isEmpty = !value || value.trim() === "";

  return (
    <div
      ref={wrapRef}
      className={`${multiline ? styles.wrapBlock : styles.wrap} ${className}`}
    >
      {/* ── Floating toolbar ── */}
      {active && (
        <div
          className={styles.toolbar}
          role="toolbar"
          aria-label={`Edit ${label ?? "field"}`}
        >
          {/* Label */}
          {label && (
            <>
              <span
                style={{
                  color: "rgba(255,255,255,0.38)",
                  fontSize: "0.62rem",
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  padding: "0 3px",
                  userSelect: "none",
                  fontWeight: 600,
                }}
              >
                {label}
              </span>
              <div className={styles.toolbarDivider} />
            </>
          )}

          {/* Rich text controls */}
          {showRich && (
            <>
              <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleBold();
                }}
                title="Bold selected text (wrap in **)"
                type="button"
                style={{ fontWeight: 700, fontSize: 13 }}
              >
                B
              </button>

              <button
                className={styles.toolbarBtn}
                onMouseDown={(e) => {
                  e.preventDefault();
                  handleItalic();
                }}
                title="Italic selected text (wrap in _)"
                type="button"
                style={{ fontStyle: "italic", fontSize: 13 }}
              >
                I
              </button>

              {/* Size picker */}
              <div style={{ position: "relative" }} ref={sizeMenuRef}>
                <button
                  className={styles.toolbarBtn}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    setShowSizeMenu((v) => !v);
                  }}
                  title="Font size"
                  type="button"
                >
                  <IconSize />
                </button>
                {showSizeMenu && (
                  <div className={styles.sizeMenu}>
                    {SIZE_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        className={styles.sizeOption}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          // Prefix the entire value with a size marker that print/display layers can consume
                          const stripped = value.replace(
                            /^\[(xs|sm|md|lg)\]/,
                            "",
                          );
                          onChange(
                            opt.value === "md"
                              ? stripped
                              : `[${opt.value}]${stripped}`,
                          );
                          setShowSizeMenu(false);
                          textareaRef.current?.focus();
                        }}
                        type="button"
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className={styles.toolbarDivider} />
            </>
          )}

          {/* Extra injected actions */}
          {extraActions.map((action, i) => (
            <button
              key={i}
              className={`${styles.toolbarBtn} ${action.danger ? styles.toolbarBtnDanger : ""}`}
              onMouseDown={(e) => {
                e.preventDefault();
                action.onClick();
              }}
              title={action.label}
              type="button"
            >
              {action.icon}
            </button>
          ))}

          {/* Clear */}
          {!isEmpty && (
            <button
              className={`${styles.toolbarBtn} ${styles.toolbarBtnDanger}`}
              onMouseDown={(e) => {
                e.preventDefault();
                clear();
              }}
              title="Clear field"
              type="button"
            >
              <IconClear />
            </button>
          )}

          {/* Done */}
          <button
            className={styles.toolbarBtn}
            onMouseDown={(e) => {
              e.preventDefault();
              commit();
            }}
            title="Done"
            type="button"
          >
            <IconCheck />
          </button>
        </div>
      )}

      {/* ── Input / Textarea ── */}
      {active ? (
        multiline ? (
          <textarea
            ref={textareaRef}
            autoFocus
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.textarea}
            rows={3}
            placeholder={placeholder}
          />
        ) : (
          <input
            ref={inputRef}
            autoFocus
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={styles.input}
            placeholder={placeholder}
          />
        )
      ) : (
        /* ── Read state ── */
        <span
          className={`${styles.display} ${isEmpty ? styles.placeholder : ""}`}
          onClick={activate}
          title={`Click to edit${label ? ` ${label}` : ""}`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") activate();
          }}
        >
          {isEmpty ? placeholder : value}
        </span>
      )}
    </div>
  );
}
