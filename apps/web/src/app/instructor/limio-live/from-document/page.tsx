import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import FromDocumentForm from "./FromDocumentForm";

export const metadata = {
  title: "Tạo bài giảng từ tài liệu | Limio",
};

export default async function FromDocumentPage() {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");
  return <FromDocumentForm />;
}
