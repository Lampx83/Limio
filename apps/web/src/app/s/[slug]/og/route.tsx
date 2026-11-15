import { notFound } from "next/navigation";
import { getSpaceBySlug } from "@/lib/space/resolve";
import { renderSpaceOg } from "@/lib/space/og";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const cfg = await getSpaceBySlug(params.slug);
  if (!cfg) notFound();
  return renderSpaceOg(cfg);
}
