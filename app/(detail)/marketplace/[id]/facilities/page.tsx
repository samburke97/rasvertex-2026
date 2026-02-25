"use client";

import FacilitiesEditPage from "../../../../../components/marketplace/setup/[id]/facilities/page";

interface FacilitiesPageProps {
  params: Promise<{ id: string }>;
}

export default function FacilitiesPage({ params }: FacilitiesPageProps) {
  return <FacilitiesEditPage params={params} />;
}
