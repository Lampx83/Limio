import { NextResponse } from "next/server";
import { DeleteUserError, deleteUser } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { submissionKeyFromFilename } from "@/lib/storage-keys";

export async function DELETE(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  try {
    const { removedFiles } = await deleteUser(adminId, params.userId);
    // LANG G7e.1 — file ghi âm bài nói của người dùng bị xoá khỏi kho (sổ dung lượng tự đánh dấu đã xoá).
    // Hỏng một file không được làm hỏng cả yêu cầu xoá tài khoản (đã hoàn tất ở DB).
    for (const name of removedFiles) {
      const key = submissionKeyFromFilename(name);
      if (!key) continue;
      try {
        await storageFor(key).delete(key.key);
      } catch (err) {
        console.error("[deleteUser] không xoá được file ghi âm", name, err);
      }
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof DeleteUserError) {
      const status =
        e.code === "user_not_found" ? 404 : e.code === "has_ownership" ? 409 : 400;
      return NextResponse.json({ error: e.code, blockers: e.blockers }, { status });
    }
    throw e;
  }
}
