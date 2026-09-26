/**
 * Biến HTML GỌN của template (thứ admin nhìn thấy và sửa trong DB) thành HTML
 * "an toàn cho email client" (style inline, bố cục bảng) ngay lúc gửi/xem trước.
 *
 * Bộ thẻ admin dùng:
 *   <h1>Tiêu đề</h1>   <h2>…</h2>   <p>…</p>   <ul><li>…</li></ul>   <a href="…">liên kết</a>
 *   <a class="button" href="{{url}}">Nhãn nút</a>            → nút hành động
 *   <div class="note">…</div>  /  <div class="note warn">…</div>   → ô lưu ý (xanh / vàng)
 *   <div class="code" data-label="Mã dự thi">{{accessCode}}</div>  → hộp mã
 *   <div class="linkbox">{{url}}</div>                         → "nếu nút không bấm được…"
 *   <table class="facts"><tr><td>Nhãn</td><td>Giá trị</td></tr></table>  → bảng thông tin
 *   <p class="small">…</p>                                     → dòng chú thích nhỏ
 *
 * Thẻ đã có `style="…"` được giữ nguyên, nên mẫu cũ/HTML tự viết vẫn chạy bình thường.
 * Chỉ dùng regex vì tập thẻ hẹp và các khối không lồng nhau; không kéo thêm parser HTML.
 */
import { C, FONT, ui } from "./components";

const attr = (openTag: string, name: string): string | null => {
  const m = new RegExp(`\\b${name}="([^"]*)"`, "i").exec(openTag);
  return m ? m[1]! : null;
};

const hasClass = (openTag: string, cls: string): boolean => {
  const c = attr(openTag, "class");
  return !!c && c.split(/\s+/).includes(cls);
};

/** Khớp `<tag ...class="cls"...>inner</tag>` (không lồng cùng loại thẻ). */
function replaceBlock(
  html: string,
  tag: string,
  cls: string,
  fn: (openTag: string, inner: string) => string,
): string {
  const re = new RegExp(`(<${tag}\\b[^>]*>)([\\s\\S]*?)</${tag}>`, "gi");
  return html.replace(re, (whole, open: string, inner: string) =>
    hasClass(open, cls) ? fn(open, inner.trim()) : whole,
  );
}

const BASE: Record<string, string> = {
  h1: `margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-0.3px;color:${C.ink};`,
  h2: `margin:24px 0 12px;font-family:${FONT};font-size:20px;line-height:1.3;font-weight:700;color:${C.ink};`,
  p: `margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.text};`,
  ul: `margin:0 0 16px;padding-left:22px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.text};`,
  ol: `margin:0 0 16px;padding-left:22px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.text};`,
  li: `margin:0 0 6px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.text};`,
  a: `color:${C.brand};`,
};

export function emailize(html: string): string {
  let out = html;

  out = replaceBlock(out, "a", "button", (open, label) => ui.button(attr(open, "href") ?? "#", label));
  out = replaceBlock(out, "div", "code", (open, value) => ui.codeCard(attr(open, "data-label") ?? "", value));
  out = replaceBlock(out, "div", "linkbox", (_o, url) => ui.linkFallback(url));
  out = replaceBlock(out, "div", "note", (open, inner) => ui.note(inner, hasClass(open, "warn") ? "warn" : "info"));
  out = replaceBlock(out, "p", "small", (_o, inner) => ui.small(inner));
  out = replaceBlock(out, "table", "facts", (_o, body) => {
    const rows = [...body.matchAll(/<tr[^>]*>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*>([\s\S]*?)<\/td>\s*<\/tr>/gi)].map(
      (m): [string, string] => [m[1]!.trim(), m[2]!.trim()],
    );
    return ui.facts(rows);
  });

  // Thẻ cơ bản chưa có style → thêm style mặc định (giữ nguyên các thuộc tính khác như class).
  out = out.replace(/<(h1|h2|p|ul|ol|li|a)\b([^>]*)>/gi, (whole, tag: string, attrs: string) => {
    if (/\bstyle\s*=/i.test(attrs)) return whole;
    return `<${tag}${attrs} style="${BASE[tag.toLowerCase()]}">`;
  });

  return out;
}
