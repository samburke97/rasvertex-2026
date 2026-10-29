// Recurring jobs moved into Caro. Kept as a redirect so old links (and the
// due-soon emails' ?action=quote deep link) still land in the right place.
import { redirect } from "next/navigation";
import { LINE_OF_CATEGORY } from "@/lib/caro/data";
import { isRecurringCategory } from "@/lib/recertifications/categories";

type Props = { searchParams: Promise<Record<string, string | undefined>> };

export default async function Page({ searchParams }: Props) {
  const params = await searchParams;
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  const category = params.category ?? null;
  const hash = isRecurringCategory(category) ? `#sites/${LINE_OF_CATEGORY[category]}` : "#overview";
  redirect(`/caro${params.action === "quote" && qs ? `?${qs}` : ""}${hash}`);
}
