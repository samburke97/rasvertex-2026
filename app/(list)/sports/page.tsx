import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import SportsPage from "@/components/sports/SportsPage";

export const metadata: Metadata = {
  title: "Sports | Bord Admin",
  description: "Manage sports for the Bord platform",
};

export default async function GroupsRoute() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <SportsPage />;
}
