// components/layouts/topNavSlot.ts
//
// Lets a page add to the top bar: more breadcrumb steps after the section's
// own, and a status on the right (e.g. Reports › Settings' "All changes
// saved"). A page sets it while mounted and clears it on the way out.

"use client";

import { useSyncExternalStore, type ReactNode } from "react";

/** A breadcrumb step: text, and where clicking it goes (none for the page
 *  you're on). */
export interface Crumb {
  label: string;
  href?: string;
}

export interface TopNavExtra {
  crumbs?: Crumb[];
  status?: ReactNode;
}

let state: TopNavExtra = {};
const subs = new Set<() => void>();

export function setTopNav(next: TopNavExtra) {
  state = next;
  subs.forEach((f) => f());
}

const subscribe = (f: () => void) => {
  subs.add(f);
  return () => subs.delete(f);
};

export function useTopNav(): TopNavExtra {
  return useSyncExternalStore(subscribe, () => state, () => state);
}
