import { randomBytes } from "node:crypto";
import mammoth from "mammoth";
import { storageFor } from "@/lib/storage";
import { lessonImageKey } from "@/lib/storage-keys";

/**
 * .docx → HTML sạch bằng mammoth (đọc thẳng cấu trúc XML của Word: bảng, đoạn,
 * style rõ ràng — không phải đoán lại từ HTML clipboard). Ảnh nhúng được tách
 * ra tải lên kho ảnh bài học (cùng chỗ RichTextEditor tải ảnh dán/kéo thả),
 * HTML trỏ tới chúng bằng URL. File .docx gốc không được lưu ở đâu cả.
 *
 * Dùng chung cho "Nhập từ Word" (api/lesson-media/docx-import) và "Tạo bài từ
 * tài liệu" (api/lessons/[lessonId]/drafts). Chỉ chạy phía server.
 */

const IMAGE_EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

// Word không có khái niệm "trích dẫn" chuẩn — chỉ có tên style. Map 2 tên
// style hay dùng nhất sang <blockquote> thật; style khác vẫn ra <p> bình
// thường. "Title" cũng không nằm trong default style map của mammoth (chỉ có
// Heading 1-6) — map thêm để dòng tiêu đề tài liệu không rơi xuống <p> ngang
// hàng thân bài.
const STYLE_MAP = [
  "p[style-name='Quote'] => blockquote:fresh",
  "p[style-name='Intense Quote'] => blockquote:fresh",
  "p[style-name='Title'] => h1:fresh",
];

export async function convertDocxToHtml(
  buffer: Buffer,
  userId: string,
): Promise<{ html: string; warnings: string[] }> {
  const now = new Date();
  const imageWarnings: string[] = [];
  const result = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: STYLE_MAP,
      convertImage: mammoth.images.imgElement(async (image) => {
        const ext = IMAGE_EXT_BY_MIME[image.contentType];
        if (!ext) {
          imageWarnings.push(`Bỏ qua 1 ảnh định dạng không hỗ trợ (${image.contentType})`);
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
  return {
    html: result.value,
    warnings: [...imageWarnings, ...result.messages.filter((m) => m.type === "warning").map((m) => m.message)],
  };
}
