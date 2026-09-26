/**
 * Linh kiện HTML "an toàn cho email client" (nút, hộp mã, bảng thông tin…).
 * Được `emailize()` gọi lúc gửi để biến markup GỌN trong DB thành HTML style inline —
 * nhờ vậy admin chỉ phải sửa `<a class="button">…</a>` chứ không phải đống `style="…"`.
 * Tham số là giá trị THỰC (đã qua Handlebars), không phải tên biến.
 *
 * Ràng buộc của email client quyết định cách viết: bố cục <table>, style inline,
 * nút "bulletproof" (<td bgcolor> + <a>), không dùng ảnh/SVG.
 */

// Bảng màu lấy từ tailwind.config (brand = lime, accent = pink của "quả dưa hấu").
export const C = {
  ink: "#1a2e05", // chữ tiêu đề
  text: "#3f4a36", // chữ thân
  muted: "#6b7560", // chữ phụ / footer
  line: "#e4e9dc", // đường kẻ
  page: "#f3f6ee", // nền ngoài
  card: "#ffffff",
  brand: "#4d7c0f", // brand-700: nền nút, đạt tương phản AA với chữ trắng
  brandSoft: "#f7fee7", // brand-50
  brandLine: "#d9f99d", // brand-200
  pink: "#ec4899",
  warnBg: "#fffbeb",
  warnLine: "#fde68a",
  warnText: "#92400e",
} as const;

export const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif";

export const ui = {
  /** Tiêu đề chính của thư. */
  title(text: string): string {
    return `<h1 style="margin:0 0 16px;font-family:${FONT};font-size:26px;line-height:1.25;font-weight:800;letter-spacing:-0.3px;color:${C.ink};">${text}</h1>`;
  },

  /** Đoạn văn thường. */
  p(html: string): string {
    return `<p style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:1.65;color:${C.text};">${html}</p>`;
  },

  /** Nút hành động chính. `urlVar` là tên biến Handlebars chứa link. */
  button(href: string, label: string): string {
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" class="btn-wrap" style="margin:8px 0 24px;"><tr>
<td align="center" bgcolor="${C.brand}" style="border-radius:10px;background:${C.brand};">
<a href="${href}" target="_blank" class="btn" style="display:inline-block;padding:14px 32px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1;color:#ffffff;text-decoration:none;border-radius:10px;">${label}</a>
</td></tr></table>`;
  },

  /** Khối "nếu nút không bấm được": in lại link dạng chữ. */
  linkFallback(url: string): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 8px;"><tr>
<td class="soft" style="padding:14px 16px;background:${C.brandSoft};border:1px solid ${C.brandLine};border-radius:10px;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">
Nếu nút không hoạt động, hãy sao chép liên kết này vào trình duyệt:<br>
<a href="${url}" style="color:${C.brand};word-break:break-all;">${url}</a>
</td></tr></table>`;
  },

  /** Ô hiển thị một mã (mã dự thi, mã xác nhận…). */
  codeCard(label: string, value: string): string {
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 24px;"><tr>
<td align="center" class="soft" style="padding:22px 16px;background:${C.brandSoft};border:2px dashed ${C.brand};border-radius:14px;">
<div style="font-family:${FONT};font-size:12px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};margin:0 0 8px;">${label}</div>
<div style="font-family:'SF Mono',Menlo,Consolas,'Courier New',monospace;font-size:34px;line-height:1.1;font-weight:800;letter-spacing:6px;color:${C.ink};">${value}</div>
</td></tr></table>`;
  },

  /** Bảng thông tin dạng "nhãn — giá trị". */
  facts(rows: Array<[label: string, valueHtml: string]>): string {
    const tr = rows
      .map(
        ([k, v], i) =>
          `<tr><td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:14px;color:${C.muted};width:38%;vertical-align:top;">${k}</td>` +
          `<td style="padding:12px 0;${i ? `border-top:1px solid ${C.line};` : ""}font-family:${FONT};font-size:15px;font-weight:600;color:${C.ink};vertical-align:top;">${v}</td></tr>`,
      )
      .join("");
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;border-top:1px solid ${C.line};border-bottom:1px solid ${C.line};">${tr}</table>`;
  },

  /** Ô lưu ý (tone "warn" cho điều cần chú ý, "info" cho ghi chú nhẹ). */
  note(html: string, tone: "info" | "warn" = "info"): string {
    const bg = tone === "warn" ? C.warnBg : C.brandSoft;
    const line = tone === "warn" ? C.warnLine : C.brandLine;
    const color = tone === "warn" ? C.warnText : C.text;
    return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 16px;"><tr>
<td class="${tone === "warn" ? "warn" : "soft"}" style="padding:14px 16px;background:${bg};border:1px solid ${line};border-radius:10px;font-family:${FONT};font-size:14px;line-height:1.6;color:${color};">${html}</td></tr></table>`;
  },

  /** Đoạn phụ nhỏ (dòng cuối nội dung: "Nếu không phải bạn, hãy bỏ qua…"). */
  small(html: string): string {
    return `<p style="margin:0 0 8px;font-family:${FONT};font-size:13px;line-height:1.6;color:${C.muted};">${html}</p>`;
  },
};

