import { redirect } from "next/navigation";
import { requireFeature } from "@/lib/session";
import { getWebSearchProvider } from "@/lib/webSearch";
import FromDocumentForm from "./FromDocumentForm";

export const metadata = {
  title: "Tạo slide tương tác | Limio",
};

export default async function FromDocumentPage() {
  const userId = await requireFeature("limio_live.access");
  if (!userId) redirect("/instructor/dashboard?blocked=limio_live");
  // Công tắc nguồn internet chỉ hiện khi quản trị viên đã cấu hình dịch vụ tìm kiếm.
  return <FromDocumentForm webAvailable={(await getWebSearchProvider()) !== null} />;
}
