import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SpaceHome, { spaceMetadata, type SpaceSearchParams } from "@/components/space/SpaceHome";
import { getSpaceBySlug } from "@/lib/space/resolve";

// Cần DB để biết khoá nào đã published, giống /catalog.
export const dynamic = "force-dynamic";

type Props = { params: { slug: string }; searchParams: SpaceSearchParams };

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const cfg = await getSpaceBySlug(params.slug);
  if (!cfg) return { title: "Not found", robots: { index: false } };
  return spaceMetadata(cfg, searchParams);
}

export default async function SpacePage({ params, searchParams }: Props) {
  const cfg = await getSpaceBySlug(params.slug);
  if (!cfg) notFound();
  return <SpaceHome cfg={cfg} searchParams={searchParams} />;
}
