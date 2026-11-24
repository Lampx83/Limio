import { notFound } from "next/navigation";
import { getSpaceBySlug } from "@/lib/space/resolve";
import { renderSpaceOg } from "@/lib/space/og";

export const dynamic = "force-dynamic";

/** /hsk/og — bí danh của /s/hsk/og. */
export async function GET() {
  const cfg = await getSpaceBySlug("hsk");
  if (!cfg) notFound();
  return renderSpaceOg(cfg);
}
