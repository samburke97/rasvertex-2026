"use client";
// components/reports/shared/builder/useHistory.ts
//
// Undo and redo for every report builder: a drop-in for the document's
// useState. Each change made through `set` is a step (changes in quick
// succession, like typing, are one step); `silent` applies a change with no
// step (SimPRO imports, autosave bookkeeping); `reset` starts a new history
// (a job loaded, a draft resumed).
//
// Keys: Ctrl/⌘+Z undoes, Shift+Ctrl/⌘+Z or Ctrl+Y redoes, except while
// typing in a field (the browser undoes the text there) and when a pop-up
// handles the key itself (it calls preventDefault, e.g. the anchor map).

import { useCallback, useEffect, useRef, useState, type SetStateAction } from "react";

export interface History<T> {
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  /** Apply a change without an undo step. */
  silent: (v: SetStateAction<T>) => void;
  /** A new document: the undo history starts again. */
  reset: (v: SetStateAction<T>) => void;
}

const resolve = <T,>(v: SetStateAction<T>, prev: T): T => (typeof v === "function" ? (v as (p: T) => T)(prev) : v);

const typing = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function useHistory<T>(
  initial: T | (() => T),
  { merge = 600, limit = 100, keys = true }: { merge?: number; limit?: number; keys?: boolean } = {},
): [T, (v: SetStateAction<T>) => void, History<T>] {
  const [state, setState] = useState<T>(initial);
  const cur = useRef(state);
  const past = useRef<T[]>([]);
  const future = useRef<T[]>([]);
  const lastAt = useRef(0);
  // Re-render when undo/redo availability changes.
  const [, bump] = useState(0);
  const tick = () => bump((n) => n + 1);

  const apply = (next: T) => {
    cur.current = next;
    setState(next);
  };

  const set = useCallback((v: SetStateAction<T>) => {
    const next = resolve(v, cur.current);
    if (Object.is(next, cur.current)) return;
    const now = Date.now();
    // A burst of changes (typing, dragging) is one step: keep its start.
    if (!(now - lastAt.current < merge && past.current.length)) {
      past.current.push(cur.current);
      if (past.current.length > limit) past.current.shift();
    }
    lastAt.current = now;
    future.current = [];
    apply(next);
    tick();
  }, [merge, limit]);

  const silent = useCallback((v: SetStateAction<T>) => {
    const next = resolve(v, cur.current);
    if (!Object.is(next, cur.current)) apply(next);
  }, []);

  const reset = useCallback((v: SetStateAction<T>) => {
    past.current = [];
    future.current = [];
    lastAt.current = 0;
    apply(resolve(v, cur.current));
    tick();
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.pop();
    if (prev === undefined) return;
    future.current.push(cur.current);
    lastAt.current = 0;
    apply(prev);
    tick();
  }, []);

  const redo = useCallback(() => {
    const next = future.current.pop();
    if (next === undefined) return;
    past.current.push(cur.current);
    lastAt.current = 0;
    apply(next);
    tick();
  }, []);

  useEffect(() => {
    if (!keys) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || typing(e.target)) return;
      const k = e.key.toLowerCase();
      const isRedo = (k === "z" && e.shiftKey) || (k === "y" && !e.shiftKey);
      const isUndo = k === "z" && !e.shiftKey;
      if (!isUndo && !isRedo) return;
      // After every other listener: a pop-up with its own undo (the anchor
      // map) marks the key handled with preventDefault, and keeps it.
      setTimeout(() => {
        if (e.defaultPrevented) return;
        if (isUndo) undo();
        else redo();
      }, 0);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [keys, undo, redo]);

  return [state, set, { undo, redo, canUndo: past.current.length > 0, canRedo: future.current.length > 0, silent, reset }];
}
