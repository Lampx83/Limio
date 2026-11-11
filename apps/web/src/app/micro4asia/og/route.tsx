import { notFound } from "next/navigation";
import { getSpaceBySlug } from "@/lib/space/resolve";
import { renderSpaceOg } from "@/lib/space/og";

export const dynamic = "force-dynamic";

/** /micro4asia/og — bí danh của /s/micro4asia/og. */
export async function GET() {
  const cfg = await getSpaceBySlug("micro4asia");
  if (!cfg) notFound();
  return renderSpaceOg(cfg);
}
