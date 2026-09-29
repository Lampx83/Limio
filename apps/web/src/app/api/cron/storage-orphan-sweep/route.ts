import { NextResponse } from "next/server";
import {
  deleteH5pPackage,
  deleteScormPackage,
  OrphanSweepError,
  runOrphanSweep,
  runPackageOrphanSweep,
} from "@feedbackme/core-lms";
import { getLayerStorage } from "@/lib/storage";
import type { StorageLayer } from "@/lib/storage-keys";

export const runtime = "nodejs";
// Quét mọi cột văn bản của DB rồi xoá file — không được để Next cache/prerender.
export const dynamic = "force-dynamic";

function intFromEnv(name: string, fallback: number): number {
  const n = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

// Sàn số ngày chờ: cấu hình nhầm (0, 1…) sẽ xoá cả video vừa upload mà giảng viên
// chưa kịp lưu vào bài. Không cho hạ dưới mức này bằng biến môi trường.
const MIN_DAYS = 7;
// Xoá gói SCORM/H5P mạnh tay hơn xoá file lẻ (mỗi gói là cả thư mục hàng trăm file),
// nên trần thấp hơn và cố định — không mở ra cấu hình.
const MAX_PACKAGES_PER_RUN = 50;

/**
 * Dọn file mồ côi (xem core-lms/src/storage/orphans.ts).
 *
 * MẶC ĐỊNH CHỈ BÁO CÁO. Muốn xoá thật phải đặt STORAGE_ORPHAN_SWEEP=apply trên
 * server — xoá file không hoàn tác được nên cần một quyết định có chủ ý.
 *
 * Khác các cron còn lại: bắt buộc có CRON_SECRET. Các job kia bỏ qua kiểm tra khi
 * chưa đặt biến (`if (expected && …)`), tức là mở cho mọi người; với job xoá file
 * thì thiếu bí mật phải là lỗi, không phải "cho qua".
 */
export async function GET(req: Request) {
  const expected = process.env.CRON_SECRET;
  if (!expected || req.headers.get("authorization") !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const apply = process.env.STORAGE_ORPHAN_SWEEP === "apply";
  const olderThanDays = Math.max(MIN_DAYS, intFromEnv("STORAGE_ORPHAN_DAYS", 30));
  const maxDelete = intFromEnv("STORAGE_ORPHAN_MAX_DELETE", 500);

  try {
    const result = await runOrphanSweep({ apply, olderThanDays, maxDelete }, (layer, key) =>
      // Adapter đã bọc sổ ghi dung lượng: xoá xong tự đánh dấu deletedAt.
      getLayerStorage(layer as StorageLayer).delete(key),
    );
    // Gói SCORM/H5P: sổ ghi/adapter không quản lý (ghi thẳng ra thư mục giải nén),
    // nên dọn theo từng gói bằng đúng hàm xoá của module — hàm này tự từ chối gói
    // đang được dùng hoặc đã có lượt học.
    const packages = await runPackageOrphanSweep(
      { apply, olderThanDays, maxDelete: MAX_PACKAGES_PER_RUN },
      { scorm: (id) => deleteScormPackage(id), h5p: (id) => deleteH5pPackage(id) },
    );
    // Nhật ký bền: container log giữ lại danh sách mẫu + số liệu của mỗi lần chạy.
    console.log(
      "[storage-orphan-sweep]",
      JSON.stringify({ olderThanDays, maxDelete, files: result, packages }),
    );
    return NextResponse.json({ ok: true, olderThanDays, maxDelete, ...result, packages });
  } catch (e) {
    if (e instanceof OrphanSweepError) {
      console.error("[storage-orphan-sweep] dừng an toàn:", e.code);
      return NextResponse.json({ ok: false, error: e.code }, { status: 500 });
    }
    throw e;
  }
}
