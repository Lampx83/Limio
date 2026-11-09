import { notFound, redirect } from "next/navigation";
import { VanDapError, getVanDapExamForEditor } from "@feedbackme/core-lms";
import { requireVanDapUser } from "@/lib/vanDapApi";
import VanDapEditor from "./VanDapEditor";
import type { EditorData } from "./types";

export const dynamic = "force-dynamic";

export default async function VanDapExamPage({ params }: { params: { id: string } }) {
  const userId = await requireVanDapUser();
  if (!userId) redirect("/instructor/dashboard");

  let detail;
  try {
    detail = await getVanDapExamForEditor(userId, params.id);
  } catch (e) {
    // Người không sửa được đề thì không biết đề có tồn tại hay không.
    if (e instanceof VanDapError) notFound();
    throw e;
  }
  // Đi qua JSON để Date thành chuỗi, đúng như dữ liệu client sẽ nhận từ API.
  const initial = JSON.parse(JSON.stringify(detail)) as EditorData;
  return <VanDapEditor initial={initial} />;
}
