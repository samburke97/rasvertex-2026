import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import EditGroupPage from "@/components/groups/EditGroupPage";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: `Edit Group ${resolvedParams.id} | Bord Admin`,
    description: `Edit group ${resolvedParams.id} and manage tags for the Bord platform`,
  };
}

export default async function GroupEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <EditGroupPage groupId={id} />;
}
