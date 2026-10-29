// components/reports/proposal/v3/ctx.ts — what the shell hands to the steps.

import type { Derived } from "@/lib/reports/proposal/v3/derive";
import type { PageId, Proposal } from "@/lib/reports/proposal/v3/types";

export type Path = (string | number)[];

export interface PhotoFolderOption {
  id: string;
  name: string;
  photos: string[]; // photo refs
}

export interface BuilderCtx {
  p: Proposal;
  D: Derived;
  update: (fn: (p: Proposal) => Proposal) => void;
  /** Value at a path inside p.d. */
  get: (path: Path) => unknown;
  /** Sets a value at a path inside p.d. */
  set: (path: Path, v: unknown) => void;
  img: (ref: string) => string;
  /** Enabled folders (SimPRO, then library), with their photo refs. */
  folders: PhotoFolderOption[];
  /** Every folder, on or off — SimPRO ones flagged sp. */
  allFolders: { id: string; name: string; count: number; on: boolean; sp: boolean }[];
  enableFolder: (id: string, on?: boolean) => void;
  /** Re-fetch the quote's SimPRO folders and any new photos in them. */
  reloadSimpro: () => Promise<void>;
  reloading: boolean;
  loadingFolders: string[];
  /** Last field clicked on the page (path inside p.d); n bumps per click. */
  focusField: { path: string; n: number } | null;
  pickField: (id: PageId, path: string) => void;
  /** Key of the photo field whose picker is open. */
  picker: string | null;
  setPicker: (key: string | null) => void;
  pickFolder: string;
  setPickFolder: (id: string) => void;
  upload: (file: File) => Promise<string>;
  /** Deletes an upload, and takes it off any page that uses it. */
  removeUpload: (url: string) => void;
  captureAerial: () => Promise<void>;
  sel: PageId;
  select: (id: PageId, scroll: boolean) => void;
  toggleHide: (id: PageId) => void;
  /** The finding being edited (index into findings.items). */
  focusFinding: number | null;
  /** Edit a finding; with scroll, bring its photo into view. */
  pickFinding: (i: number | null, scroll: boolean) => void;
}

export function getIn(o: unknown, path: Path): unknown {
  return path.reduce<unknown>((a, k) => (a == null ? a : (a as Record<string | number, unknown>)[k]), o);
}

export function setIn<T>(o: T, path: Path, v: unknown): T {
  if (!path.length) return v as T;
  const [k, ...rest] = path;
  const src = o as unknown as Record<string | number, unknown>;
  const copy = (Array.isArray(o) ? [...(o as unknown[])] : { ...src }) as Record<string | number, unknown>;
  copy[k] = setIn(src?.[k], rest, v);
  return copy as unknown as T;
}
