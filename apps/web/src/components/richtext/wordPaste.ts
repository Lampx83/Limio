/**
 * Word (và Excel) dán vào trình duyệt kèm một bản HTML "văn phòng" cực kỳ dài
 * dòng: comment điều kiện `<!--[if ...]>`, thẻ namespace `<o:p>`/`<w:...>`/
 * `<v:...>` (VML vẽ viền ô), và hàng loạt khai báo `mso-*` nhét trong từng
 * `style="..."`. Editor không có schema cho phần lớn số đó nên chúng bị bỏ —
 * NHƯNG bảng thì không có extension Table nên rơi vào chế độ nguồn, giữ
 * nguyên y hệt đống rác này. Đưa thẳng cho AI định dạng, model không phân biệt
 * nổi ranh giới ô/hàng giữa hàng trăm ký tự `mso-*` nên né, để nguyên bảng.
 *
 * Dọn HTML này TRƯỚC khi ProseMirror parse (transformPastedHTML) — vậy vừa
 * WYSIWYG hiển thị bảng thật (nhờ Table extension), vừa HTML lưu lại sạch cho
 * AI xử lý.
 */

const WORD_MARKER = /mso-|urn:schemas-microsoft-com:office|<o:p\b/i;

export function isWordHtml(html: string): boolean {
  return WORD_MARKER.test(html);
}

function stripMsoStyleDeclarations(styleValue: string): string {
  return styleValue
    .split(";")
    .map((decl) => decl.trim())
    .filter((decl) => decl && !/^mso-/i.test(decl))
    .join("; ");
}

export function cleanWordHtml(html: string): string {
  if (!isWordHtml(html)) return html;

  return html
    // Comment thường + comment điều kiện <!--[if ...]>...<![endif]-->
    .replace(/<!--[\s\S]*?-->/g, "")
    // Thẻ namespace Word/Office: <o:p>, <w:sdt>, <m:oMath>, <v:shapetype>...
    .replace(/<\/?(?:o|w|m|v|st1):[a-zA-Z0-9]+(?:\s[^>]*)?\/?>/gi, "")
    // Khai báo namespace trên thẻ gốc: xmlns:o="...", xmlns:w="..."
    .replace(/\s+xmlns:[a-zA-Z0-9]+="[^"]*"/gi, "")
    // class="MsoNormal", class="MsoTableGrid"...
    .replace(/\s+class="Mso[^"]*"/gi, "")
    // mso-* bên trong style="...", giữ lại phần style thật (nếu còn)
    .replace(/\sstyle="([^"]*)"/gi, (match, styleValue: string) => {
      const cleaned = stripMsoStyleDeclarations(styleValue);
      return cleaned ? ` style="${cleaned}"` : "";
    });
}
