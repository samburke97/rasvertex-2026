// components/reports/proposal/builder/context.ts
// What ProposalBuilder hands down to each step and section editor.

import type {
  ProposalData,
  ProposalPhoto,
  SectionId,
} from "@/lib/reports/proposal.types";

export type Updater = (fn: (p: ProposalData) => ProposalData) => void;

export interface BuilderCtx {
  p: ProposalData;
  update: Updater;
  photoUrl: (id: string | null) => string | null;
  /** Photos in the selected folders. */
  pool: ProposalPhoto[];
  /** pool, narrowed by the editor's folder filter. */
  pickPool: ProposalPhoto[];
  pickFolder: string; // "all" or a folder id
  setPickFolder: (id: string) => void;
  folderName: (folderId: string) => string;
  goStart: () => void;
  /** Re-fetch the quote's pricing, keeping label edits and shown items. */
  refreshPricing: () => Promise<void>;
  /** Satellite capture of the site address for the access plan aerial. */
  captureAerial: () => Promise<void>;
  select: (id: SectionId, scroll: boolean) => void;
}

/** Shallow-merges a patch into one of the proposal's top-level groups. */
export function patch<K extends keyof ProposalData>(
  update: Updater,
  key: K,
  value: Partial<ProposalData[K]>,
) {
  update((p) => ({ ...p, [key]: { ...(p[key] as object), ...value } }));
}
