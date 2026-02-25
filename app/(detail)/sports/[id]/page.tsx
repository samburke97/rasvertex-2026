import { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import EditSportPage from "@/components/sports/EditSportPage";

interface SportsPageProps {
  params: Promise<{
    id: string;
  }>;
}

export async function generateMetadata({
  params,
}: SportsPageProps): Promise<Metadata> {
  const resolvedParams = await params;
  return {
    title: "Edit Sport | Bord Admin",
    description: "Edit sports and manage tags for the Bord platform",
  };
}

export default async function GroupEditRoute({ params }: SportsPageProps) {
  const resolvedParams = await params;
  const { id } = resolvedParams;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <EditSportPage sportId={id} />;
}
