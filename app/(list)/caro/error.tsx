"use client";

import ErrorState from "@/components/ui/ErrorState";

export default function CaroError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return <ErrorState error={error} reset={reset} area="Caro" />;
}
