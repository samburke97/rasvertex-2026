import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import GroupsPage from "@/components/groups/GroupsPage";

export const metadata: Metadata = {
  title: "Groups | Bord Admin",
  description: "Manage groups for the Bord platform",
};

export default async function GroupsRoute() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <GroupsPage />;
}
