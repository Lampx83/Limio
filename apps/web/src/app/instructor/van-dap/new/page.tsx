import { redirect } from "next/navigation";
import { requireVanDapUser } from "@/lib/vanDapApi";
import NewVanDapForm from "./NewVanDapForm";

export const dynamic = "force-dynamic";

export default async function NewVanDapPage() {
  const userId = await requireVanDapUser();
  if (!userId) redirect("/instructor/dashboard");
  return (
    <main className="max-w-xl">
      <h1 className="text-h1">Tạo đề Limio Vấn đáp</h1>
      <p className="mt-1 text-sm text-faint">
        Bước sau là tải tài liệu, để AI đề xuất dàn câu hỏi rồi thầy/cô duyệt. Ngôn ngữ và thời lượng sửa được cho đến khi xuất bản.
      </p>
      <NewVanDapForm />
    </main>
  );
}
