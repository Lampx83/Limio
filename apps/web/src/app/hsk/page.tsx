import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SpaceHome, { spaceMetadata, type SpaceSearchParams } from "@/components/space/SpaceHome";
import { getSpaceBySlug } from "@/lib/space/resolve";

// /hsk là bí danh ngắn của space "hsk" (xem lib/space/builtin.ts).
export const dynamic = "force-dynamic";

type Props = { searchParams: SpaceSearchParams };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const cfg = await getSpaceBySlug("hsk");
  if (!cfg) return { title: "Not found", robots: { index: false } };
  return spaceMetadata(cfg, searchParams);
}

export default async function HskPage({ searchParams }: Props) {
  const cfg = await getSpaceBySlug("hsk");
  if (!cfg) notFound();
  return <SpaceHome cfg={cfg} searchParams={searchParams} />;
}
