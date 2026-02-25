import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import CreateGroupPage from "@/components/groups/CreateGroupPage";

export const metadata: Metadata = {
  title: "Create Group | Bord Admin",
  description: "Create a new group for the Bord platform",
};

export default async function CreateGroupRoute() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <CreateGroupPage />;
}
