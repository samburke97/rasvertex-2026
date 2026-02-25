import { redirect } from "next/navigation"; // ← fix wrong import

export default function Home() {
  redirect("/dashboard");
}
