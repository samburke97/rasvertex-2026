"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function ReportsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} area="reports" />;
}
