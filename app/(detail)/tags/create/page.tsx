import CreateTagPage from "@/components/tags/CreateTagPage";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function NewTag() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  return <CreateTagPage />;
}
