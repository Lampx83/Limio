import { detectMediaKind } from "@/app/instructor/classroom/boardNoteStyle";

export type AttachmentKind =
  | "pdf"
  | "image"
  | "video"
  | "audio"
  | "youtube"
  | "vimeo"
  | "google"
  | "link";

const PDF_EXT = /\.pdf(\?|#|$)/i;
const GDOC_ID = /^[A-Za-z0-9_-]{10,}$/;

/**
 * Link Google Docs/Sheets/Slides/Drive → URL nhúng được. Dựng lại từ ID và host
 * cố định của Google (không bê nguyên URL người dán vào iframe). Chỉ chạy khi
 * file được chia sẻ "ai có link đều xem"; nếu không iframe sẽ hiện trang đăng
 * nhập — nút "Mở tab mới" ở AttachmentPreview là đường lùi.
 */
export function googleEmbedUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:") return null;
  const seg = u.pathname.split("/").filter(Boolean);

  if (u.hostname === "docs.google.com") {
    const [kind, d, id] = seg;
    if (d !== "d" || !id || !GDOC_ID.test(id)) return null;
    if (kind === "document" || kind === "spreadsheets")
      return `https://docs.google.com/${kind}/d/${id}/preview`;
    if (kind === "presentation")
      return `https://docs.google.com/presentation/d/${id}/embed`;
    return null;
  }

  if (u.hostname === "drive.google.com") {
    // /file/d/{id}/view, hoặc /file/u/0/d/{id}/view
    const di = seg.indexOf("d");
    if (seg[0] === "file" && di > 0 && GDOC_ID.test(seg[di + 1] ?? ""))
      return `https://drive.google.com/file/d/${seg[di + 1]}/preview`;
    if (seg[0] === "open") {
      const id = u.searchParams.get("id") ?? "";
      return GDOC_ID.test(id) ? `https://drive.google.com/file/d/${id}/preview` : null;
    }
    const fi = seg.indexOf("folders");
    if (seg[0] === "drive" && fi > 0 && GDOC_ID.test(seg[fi + 1] ?? ""))
      return `https://drive.google.com/embeddedfolderview?id=${seg[fi + 1]}#list`;
  }
  return null;
}

/**
 * Chọn cách hiện file đính kèm của bài nộp trong màn hình chấm.
 *
 * PDF chỉ nhúng khi là file nộp qua upload nội bộ (đường dẫn tương đối):
 * site ngoài có thể chặn iframe hoặc ép tải về, và GV không nên bị dẫn tới
 * trang lạ ngay trong khung chấm bài.
 */
export function detectAttachmentKind(url: string): AttachmentKind {
  if (googleEmbedUrl(url)) return "google";
  if (PDF_EXT.test(url)) return url.startsWith("/") ? "pdf" : "link";
  return detectMediaKind(url);
}
