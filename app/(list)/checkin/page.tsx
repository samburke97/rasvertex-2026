// Client check-in moved into Caro (Clients). Kept as a redirect for old links.
import { redirect } from "next/navigation";

export default function Page() {
  redirect("/caro#clients");
}
