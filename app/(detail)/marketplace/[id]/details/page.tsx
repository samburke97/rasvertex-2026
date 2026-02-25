"use client";

import DetailsEditPage from "../../../../../components/marketplace/setup/[id]/details/page";

interface DetailsPageProps {
  params: Promise<{ id: string }>;
}

export default function DetailsPage({ params }: DetailsPageProps) {
  return <DetailsEditPage />;
}
