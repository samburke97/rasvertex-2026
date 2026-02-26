// lib/reports/works-agreement/store.ts
// In production, replace this with a real database (Postgres/Prisma).
// For now, a module-level Map persists across Next.js hot reloads in dev
// and across requests within the same server process.

import type { WorksAgreementData } from "./types";

declare global {
  // eslint-disable-next-line no-var
  var __worksAgreementStore: Map<string, WorksAgreementData> | undefined;
}

function getStore(): Map<string, WorksAgreementData> {
  if (!global.__worksAgreementStore) {
    global.__worksAgreementStore = new Map();
  }
  return global.__worksAgreementStore;
}

export function saveAgreement(agreement: WorksAgreementData): void {
  getStore().set(agreement.jobId, agreement);
}

export function getAgreement(jobId: string): WorksAgreementData | undefined {
  return getStore().get(jobId);
}

export function getAllAgreements(): WorksAgreementData[] {
  return Array.from(getStore().values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function updateAgreement(
  jobId: string,
  updates: Partial<WorksAgreementData>,
): WorksAgreementData | null {
  const existing = getStore().get(jobId);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  getStore().set(jobId, updated);
  return updated;
}

export function deleteAgreement(jobId: string): boolean {
  return getStore().delete(jobId);
}
