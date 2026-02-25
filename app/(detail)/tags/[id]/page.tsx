import EditTagPage from "@/components/tags/EditTagPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

interface TagPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function EditTag({ params }: TagPageProps) {
  const resolvedParams = await params;
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <EditTagPage tagId={resolvedParams.id} />;
}
