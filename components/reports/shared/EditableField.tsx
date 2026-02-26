"use client";
// components/reports/shared/EditableField.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Grammarly-style inline editable field.
//
// Read state:  text renders in-place, green highlight on hover
// Active state: text becomes an input/textarea + floating dark toolbar appears
//               above with context actions (clear, done, and optional extras)
//
// Usage:
//   <EditableField value={val} onChange={setVal} label="Address" />
//   <EditableField value={val} onChange={setVal} multiline label="Comments" />
// ─────────────────────────────────────────────────────────────────────────────

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  type KeyboardEvent,
} from "react";
import styles from "./EditableField.module.css";

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
  label?: string; // shown in toolbar as context
  className?: string;
  extraActions?: ToolbarAction[]; // inject extra toolbar buttons
}

// ── Icons (inline SVG so no extra deps) ──────────────────────────────────────

const IconCheck = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M2.5 7l3 3 6-6"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

const IconClear = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path
      d="M2 2l8 8M10 2l-8 8"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
    />
  </svg>
);

const IconEdit = () => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
    <path
      d="M8.5 1.5l2 2L3 11H1V9L8.5 1.5z"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
    />
  </svg>
);

// ── Auto-resize textarea hook ─────────────────────────────────────────────────

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

// ── Component ─────────────────────────────────────────────────────────────────

export default function EditableField({
  value,
  onChange,
  multiline = false,
  placeholder = "Click to edit",
  label,
  className = "",
  extraActions = [],
}: EditableFieldProps) {
  const [active, setActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useAutoResize(textareaRef, value);

  const activate = useCallback(() => {
    setActive(true);
    // Focus happens via autoFocus on the input/textarea
  }, []);

  const commit = useCallback(() => {
    setActive(false);
  }, []);

  const clear = useCallback(() => {
    onChange("");
  }, [onChange]);

  // Close on outside click
  useEffect(() => {
    if (!active) return;
    const handleDown = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        commit();
      }
    };
    document.addEventListener("mousedown", handleDown);
    return () => document.removeEventListener("mousedown", handleDown);
  }, [active, commit]);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (!multiline && e.key === "Enter") {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") commit();
  };

  const isEmpty = !value || value.trim() === "";

  return (
    <div
      ref={wrapRef}
      className={`${multiline ? styles.wrapBlock : styles.wrap} ${className}`}
    >
      {/* ── Floating toolbar (shown when active) ── */}
      {active && (
        <div
          className={styles.toolbar}
          role="toolbar"
          aria-label={`Edit ${label ?? "field"}`}
        >
          {/* Label context */}
          {label && (
            <>
              <span
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontSize: "0.65rem",
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  padding: "0 4px",
                  userSelect: "none",
                }}
              >
                {label}
              </span>
              <div className={styles.toolbarDivider} />
            </>
          )}

          {/* Extra actions injected by parent */}
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

          {extraActions.length > 0 && <div className={styles.toolbarDivider} />}

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
            title="Done (Enter)"
            type="button"
          >
            <IconCheck />
          </button>
        </div>
      )}

      {/* ── Active: input or textarea ── */}
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
          {/* Subtle edit hint on hover — CSS handles visibility */}
        </span>
      )}
    </div>
  );
}
