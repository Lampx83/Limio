/**
 * Khung HTML dùng chung cho mọi email của Limio (thương hiệu, thẻ nội dung, chân thư).
 * Linh kiện dựng nội dung (nút, hộp mã…) nằm ở packages/db/src/emailUi.ts.
 *
 * Ràng buộc của email client (Gmail/Outlook/Apple Mail) quyết định cách viết ở đây:
 *  - bố cục bằng <table>, style inline (Gmail bỏ <style> ở một số ngữ cảnh);
 *  - nút "bulletproof": <td bgcolor> + <a> — hiển thị đúng cả trên Outlook;
 *  - không dùng ảnh/SVG cho logo: chặn ảnh mặc định là chuyện thường, và SVG bị Gmail loại;
 *  - font hệ thống có hỗ trợ tiếng Việt đầy đủ dấu;
 *  - @media chỉ là phần nâng cấp (mobile, dark mode) — bỏ đi thì thư vẫn đẹp.
 *
 * Handlebars render nội dung trước, `wrapEmail` bọc khung sau — nên CSS trong khung
 * không đụng cú pháp `{{ }}`.
 */

// Bảng màu lấy từ tailwind.config (brand = lime, accent = pink của "quả dưa hấu").
const C = {
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

const FONT =
  "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,'Noto Sans',sans-serif";

const escapeHtml = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ---------------------------------------------------------------------------
// Khung bao ngoài
// ---------------------------------------------------------------------------

export type WrapInput = {
  /** HTML nội dung đã render (đã qua Handlebars). */
  bodyHtml: string;
  /** Tiêu đề thư (đã render) — dùng làm <title>. */
  subject: string;
  /** Dòng xem trước hiển thị cạnh tiêu đề trong hộp thư. */
  preheader?: string;
  /** Origin công khai, mặc định lấy NEXTAUTH_URL → https://limio.vn. */
  siteUrl?: string;
};

export function wrapEmail(input: WrapInput): string {
  const site = (input.siteUrl ?? process.env.SITE_URL ?? process.env.NEXTAUTH_URL ?? "https://limio.vn").replace(/\/$/, "");
  const pre = input.preheader
    ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;mso-hide:all;">${escapeHtml(input.preheader)}${"&nbsp;&zwnj;".repeat(60)}</div>`
    : "";

  return `<!doctype html>
<html lang="vi" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.subject)}</title>
<style>
  body{margin:0;padding:0;-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;}
  table{border-collapse:collapse;}
  a{color:${C.brand};}
  /* Kiểu nền cho nội dung thô chưa có style inline (mẫu dự phòng, mẫu admin tự gõ). */
  .card-in h1,.card-in h2{font-family:${FONT};color:${C.ink};letter-spacing:-0.3px;line-height:1.25;margin:0 0 16px;}
  .card-in p,.card-in li{font-family:${FONT};font-size:16px;line-height:1.65;color:${C.text};}
  .card-in p{margin:0 0 16px;}
  @media (max-width:620px){
    .outer{padding:12px 8px !important;}
    .card-in{padding:28px 22px !important;}
    .btn-wrap,.btn-wrap td{width:100% !important;}
    .btn{display:block !important;padding:16px 12px !important;}
  }
  @media (prefers-color-scheme:dark){
    .bg-page{background:#0f1509 !important;}
    .card{background:#182010 !important;border-color:#2b3a1c !important;}
    h1,.brand-name{color:#f3f9e6 !important;}
    p,td,div{color:#d3dcc4 !important;}
    .soft{background:#1f2c12 !important;border-color:#3b5320 !important;}
    .warn{background:#2f2508 !important;border-color:#6b5411 !important;}
    .foot,.foot a{color:#8e9a7e !important;}
  }
</style>
</head>
<body class="bg-page" style="margin:0;padding:0;background:${C.page};">
${pre}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="bg-page" style="background:${C.page};">
<tr><td align="center" class="outer" style="padding:32px 16px;">

  <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
    <!-- Thương hiệu: đúng logo web (LimeSliceIcon xuất PNG) + chữ "Lim" + "io" hồng-500 như AppHeader -->
    <tr><td style="padding:0 4px 18px;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
        <td width="48" valign="middle" style="width:48px;line-height:0;">
          <img src="${site}/email/logo-lime.png" width="48" height="48" alt="" style="display:block;width:48px;height:48px;border:0;outline:none;text-decoration:none;">
        </td>
        <td class="brand-name" valign="middle" style="padding-left:12px;font-family:${FONT};font-size:34px;line-height:1;font-weight:700;letter-spacing:-0.85px;color:${C.ink};">Lim<span style="color:${C.pink};">io</span></td>
      </tr></table>
    </td></tr>

    <!-- Thẻ nội dung -->
    <tr><td class="card" style="background:${C.card};border:1px solid ${C.line};border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(26,46,5,0.04),0 12px 32px -16px rgba(26,46,5,0.18);">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td height="5" bgcolor="${C.brand}" style="height:5px;line-height:5px;font-size:0;background:${C.brand};background-image:linear-gradient(90deg,#84cc16 0%,#65a30d 55%,${C.pink} 100%);">&nbsp;</td></tr>
        <tr><td class="card-in" style="padding:36px 40px 32px;">
${input.bodyHtml}
        </td></tr>
      </table>
    </td></tr>

    <!-- Chân thư -->
    <tr><td class="foot" style="padding:22px 8px 0;font-family:${FONT};font-size:12px;line-height:1.7;color:${C.muted};text-align:center;">
      Thư này được gửi tự động từ <a href="${site}" style="color:${C.muted};text-decoration:underline;">Limio.vn</a> — vui lòng không trả lời trực tiếp.<br>
      Nếu bạn không thực hiện yêu cầu liên quan đến thư này, bạn có thể bỏ qua nó một cách an toàn.
    </td></tr>
  </table>

</td></tr>
</table>
</body>
</html>`;
}
