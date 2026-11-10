import { NextResponse } from "next/server";
import { deletePassage, updatePassage } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { storageFor } from "@/lib/storage";
import { examAssetKeyFromFilename } from "@/lib/storage-keys";

export const runtime = "nodejs";

/** Xoá khỏi kho các tệp ảnh/audio không còn dòng nào trỏ tới (lõi đã dọn bảng). Lỗi xoá tệp không làm hỏng việc lưu đoạn. */
async function deleteStoredFiles(filenames: string[]) {
  for (const f of filenames) {
    const key = examAssetKeyFromFilename(f);
    if (!key) continue;
    await storageFor(key).delete(key.key).catch((e) => console.error("[passages] không xoá được tệp", f, e));
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const { removedFiles } = await updatePassage(userId, params.id, body);
    await deleteStoredFiles(removedFiles);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const { removedFiles } = await deletePassage(userId, params.id);
    await deleteStoredFiles(removedFiles);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
