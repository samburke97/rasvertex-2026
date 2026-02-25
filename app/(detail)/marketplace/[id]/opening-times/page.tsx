"use client";

import OpeningTimesEditPage from "../../../../../components/marketplace/setup/[id]/opening-times/page";

interface OpeningTimesPageProps {
  params: Promise<{ id: string }>;
}

export default function OpeningTimesPage({ params }: OpeningTimesPageProps) {
  return <OpeningTimesEditPage params={params} />;
}
