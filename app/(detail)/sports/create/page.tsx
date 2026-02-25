import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import CreateSportPage from "@/components/sports/CreateSportPage";

export const metadata: Metadata = {
  title: "Create Sport | Bord Admin",
  description: "Create a new sport for the Bord platform",
};

export default async function CreateGroupRoute() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <CreateSportPage />;
}
