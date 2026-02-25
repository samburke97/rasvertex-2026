"use client";

import GalleryEditPage from "../../../../../components/marketplace/setup/[id]/gallery/page";

interface GalleryPageProps {
  params: Promise<{ id: string }>;
}

export default function GalleryPage({ params }: GalleryPageProps) {
  return <GalleryEditPage params={params} />;
}
