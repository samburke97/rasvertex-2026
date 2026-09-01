import { notFound } from "next/navigation";
import DocView from "@/components/workspace/DocView";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Workspace | RAS-VERTEX",
};

type Params = { params: Promise<{ id: string }> };

export default async function WorkspaceDocPage({ params }: Params) {
  const { id } = await params;
  const itemId = parseInt(id, 10);
  if (isNaN(itemId) || itemId <= 0) notFound();

  return <DocView itemId={itemId} />;
}
