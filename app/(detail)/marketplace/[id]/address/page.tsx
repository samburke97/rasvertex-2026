"use client";

import AddressEditPage from "../../../../../components/marketplace/setup/[id]/address/page";

interface AddressPageProps {
  params: Promise<{ id: string }>;
}

export default function AddressPage({ params }: AddressPageProps) {
  return <AddressEditPage />;
}
