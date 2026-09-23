import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import mammoth from "mammoth";
import JSZip from "jszip";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { lessonImageKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

/**
 * Upload 1 file .docx → convert sang HTML sạch bằng mammoth (đọc thẳng cấu
 * trúc XML thật của Word: bảng/đoạn/style rõ ràng, không phải đoán lại từ
 * clipboard HTML lộn xộn như paste). Ảnh nhúng trong docx được tách ra upload
 * riêng qua storage sẵn có (cùng chỗ RichTextEditor upload ảnh paste/kéo thả).
 *
 * Trả về HTML thô để FE đổ vào ô "Nội dung thô" của tile Văn bản — AI hỗ trợ —
 * GV vẫn chọn giao diện + bấm "Định dạng bằng AI" như dán tay bình thường.
 * Route này KHÔNG tự gọi AI, không ghi ContentItem nào.
 *
 * File .docx gốc KHÔNG được lưu ở đâu cả — chỉ nằm trong Buffer bộ nhớ trong
 * lúc xử lý request này, bị giải phóng ngay khi response trả về. Chỉ ẢNH
 * nhúng trong file mới được upload lên storage (bắt buộc — HTML kết quả
 * tham chiếu chúng qua URL, phải sống lâu hơn 1 request).
 */

const MAX_DOCX_MB = 5;
const MAX_DOCX_BYTES = MAX_DOCX_MB * 1024 * 1024;
const MAX_DOCX_PAGES = 5;

const DOCX_MIME =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Word không có khái niệm "trích dẫn" chuẩn — chỉ có tên style. Map 2 tên
// style hay dùng nhất sang <blockquote> thật; style khác vẫn ra <p> bình
// thường (AI format phía sau vẫn nhận diện được ý qua nội dung). "Title"
// cũng không nằm trong default style map của mammoth (chỉ có Heading 1-6) —
// map thêm để dòng tiêu đề tài liệu không rơi xuống <p> ngang hàng thân bài.
const STYLE_MAP = [
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='Title'] => h1:fresh",
];

/**
 * `docProps/app.xml` lưu số trang lúc Word save gần nhất — không phải phân
 * trang thời gian thực (không tồn tại khái niệm đó ở dạng XML), nhưng đủ tin
 * cho hầu hết file GV tải lên (Word tự cập nhật field này mỗi lần lưu). Thiếu
 * field (file từ nguồn khác không ghi field này) → bỏ qua kiểm tra, không
 * chặn — best-effort, không phải chốt chặn cứng.
 */
async function readDocxPageCount(buffer: Buffer): Promise<number | null> {
  try {
    const zip = await JSZip.loadAsync(buffer);
    const appXml = await zip.file("docProps/app.xml")?.async("string");
    if (!appXml) return null;
    const m = /<Pages>(\d+)<\/Pages>/.exec(appXml);
    return m ? Number(m[1]) : null;
  } catch {
    return null;
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "validation_failed", details: "empty_file" }, { status: 400 });
  }
  if (file.size > MAX_DOCX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MAX_DOCX_BYTES } },
      { status: 413 },
    );
  }
  const looksLikeDocx =
    file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
  if (!looksLikeDocx) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: [".docx"] } },
      { status: 415 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  const pages = await readDocxPageCount(buffer);
  if (pages !== null && pages > MAX_DOCX_PAGES) {
    return NextResponse.json(
      { error: "too_many_pages", details: { pages, maxPages: MAX_DOCX_PAGES } },
      { status: 400 },
    );
  }

  const now = new Date();
  const imageWarnings: string[] = [];

  let result: { value: string; messages: Array<{ type: string; message: string }> };
  try {
    result = await mammoth.convertToHtml(
      { buffer },
      {
        styleMap: STYLE_MAP,
        convertImage: mammoth.images.imgElement(async (image) => {
          const ext = IMAGE_EXT_BY_MIME[image.contentType];
          if (!ext) {
            imageWarnings.push(
              `Bỏ qua 1 ảnh định dạng không hỗ trợ (${image.contentType})`,
            );
            return { src: "" };
          }
          const buf = await image.readAsBuffer();
          const suffix = randomBytes(8).toString("hex");
          const filename = `${userId}-${now.getTime()}-${suffix}.${ext}`;
          const key = lessonImageKey(now, filename);
          await storageFor(key).put(key.key, buf, image.contentType);
          return { src: `/api/lesson-media/images/${filename}` };
        }),
      },
    );
  } catch (e) {
    console.error("[docx-import] mammoth convert failed", e);
    return NextResponse.json({ error: "convert_failed" }, { status: 400 });
  }

  if (!result.value.trim()) {
    return NextResponse.json({ error: "validation_failed", details: "empty_document" }, { status: 400 });
  }

  const warnings = [
    ...imageWarnings,
    ...result.messages.filter((m) => m.type === "warning").map((m) => m.message),
  ];

  return NextResponse.json({ html: result.value, warnings }, { status: 200 });
}
