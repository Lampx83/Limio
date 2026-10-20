import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import PptxImportFlow from "./PptxImportFlow";

export const metadata = {
  title: "Tạo slide từ PowerPoint | Limio",
};

export default async function FromPptxPage() {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");
  return <PptxImportFlow />;
}
