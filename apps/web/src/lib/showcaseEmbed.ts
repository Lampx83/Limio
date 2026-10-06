// Dựng địa chỉ nhúng (iframe) cho link sản phẩm học viên nộp ở trang showcase.
// Luôn dựng lại từ ID trên host cố định, không bê nguyên URL người dán vào iframe.
// Trả về null khi không nhúng được (GitHub, trang ngoài...) — chỗ gọi rơi về thẻ link + nút mở tab mới.

import { extractVimeoId, extractYouTubeId } from "@/app/instructor/classroom/boardNoteStyle";
import { googleEmbedUrl } from "@/app/instructor/assignments/[id]/submissions/attachmentKind";

export type ShowcaseEmbed = {
  src: string;
  /** "video" = khung 16:9 (video, slide); "tall" = tài liệu cuộn dọc. */
  shape: "video" | "tall";
  /** Nhúng được nhưng cần người xem có quyền truy cập: hiện gợi ý dưới khung. */
  needsSharing: boolean;
};

const CANVA_VIEW = /^\/design\/([A-Za-z0-9_-]{6,})\/([A-Za-z0-9_-]{6,})\/(?:view|watch)$/;
const FIGMA_PATH = /^\/(?:file|design|proto|board|deck|slides)\/[A-Za-z0-9]+/;

export function showcaseEmbed(url: string | null | undefined): ShowcaseEmbed | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;

  const yt = extractYouTubeId(url);
  if (yt) return { src: `https://www.youtube.com/embed/${yt}`, shape: "video", needsSharing: false };
  const vimeo = extractVimeoId(url);
  if (vimeo && u.hostname.endsWith("vimeo.com")) {
    return { src: `https://player.vimeo.com/video/${vimeo}`, shape: "video", needsSharing: false };
  }

  const google = googleEmbedUrl(url);
  if (google) {
    const isSlides = google.includes("/presentation/");
    return { src: google, shape: isSlides ? "video" : "tall", needsSharing: true };
  }

  const host = u.hostname.replace(/^www\./, "");
  if (host === "canva.com") {
    const m = CANVA_VIEW.exec(u.pathname);
    if (m) {
      return {
        src: `https://www.canva.com/design/${m[1]}/${m[2]}/view?embed`,
        shape: "video",
        needsSharing: true,
      };
    }
  }
  if (host === "figma.com" && FIGMA_PATH.test(u.pathname)) {
    return {
      src: `https://www.figma.com/embed?embed_host=share&url=${encodeURIComponent(`https://www.figma.com${u.pathname}${u.search}`)}`,
      shape: "video",
      needsSharing: true,
    };
  }
  return null;
}

const YT_ID = /^[\w-]{6,20}$/;

/**
 * Ảnh bìa cho thẻ bài: YouTube (ytimg) hoặc file Google Drive (cần chia sẻ "ai có link"; ảnh lỗi thì
 * chỗ hiển thị rơi về nền màu). Không có ảnh bìa cho link khác.
 */
export function showcaseThumbnail(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const yt = extractYouTubeId(url);
  if (yt && YT_ID.test(yt)) return `https://i.ytimg.com/vi/${yt}/hqdefault.jpg`;
  if (u.protocol === "https:" && u.hostname === "drive.google.com") {
    const seg = u.pathname.split("/").filter(Boolean);
    const di = seg.indexOf("d");
    const id = seg[0] === "file" && di > 0 ? seg[di + 1] : seg[0] === "open" ? u.searchParams.get("id") : null;
    if (id && /^[A-Za-z0-9_-]{10,}$/.test(id)) return `https://drive.google.com/thumbnail?id=${id}&sz=w640`;
  }
  return null;
}
