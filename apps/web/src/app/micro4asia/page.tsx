import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SpaceHome, { spaceMetadata, type SpaceSearchParams } from "@/components/space/SpaceHome";
import { getSpaceBySlug } from "@/lib/space/resolve";

// /micro4asia là bí danh ngắn của space "micro4asia" (xem lib/space/builtin.ts).
export const dynamic = "force-dynamic";

type Props = { searchParams: SpaceSearchParams };

export async function generateMetadata({ searchParams }: Props): Promise<Metadata> {
  const cfg = await getSpaceBySlug("micro4asia");
  if (!cfg) return { title: "Not found", robots: { index: false } };
  return spaceMetadata(cfg, searchParams);
}

export default async function Micro4AsiaPage({ searchParams }: Props) {
  const cfg = await getSpaceBySlug("micro4asia");
  if (!cfg) notFound();
  return <SpaceHome cfg={cfg} searchParams={searchParams} />;
}
