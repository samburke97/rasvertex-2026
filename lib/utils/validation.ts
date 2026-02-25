// lib/utils/validation.ts

export function validateJobId(jobId: number): void {
  if (!jobId || jobId <= 0 || !Number.isInteger(jobId)) {
    throw new Error("Invalid job ID: must be a positive integer");
  }
}

export function validateCompanyId(companyId: number): void {
  if (companyId < 0 || !Number.isInteger(companyId)) {
    throw new Error("Invalid company ID: must be a non-negative integer");
  }
}

export function validateFileId(fileId: string): void {
  if (!fileId || typeof fileId !== "string" || fileId.trim() === "") {
    throw new Error("Invalid file ID: must be a non-empty string");
  }
}
