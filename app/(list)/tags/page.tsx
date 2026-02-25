import TagsPage from "@/components/tags/TagsPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function Tags() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <TagsPage />;
}
