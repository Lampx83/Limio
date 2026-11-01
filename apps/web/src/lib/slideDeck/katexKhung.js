/**
 * Công thức Toán cho khung slide HTML (xem docs/demo-toan10/HOP-DONG.md, mục 2).
 *
 * Chữ của slide viết `\( … \)` (công thức dòng) và `\[ … \]` (công thức khối). `datToan` thay chúng bằng HTML KaTeX
 * Ở TRANG CHA, trước khi dựng srcdoc của iframe — khung trong iframe không phải chạy KaTeX và không cần mạng.
 * Chỉ đụng vào phần chữ giữa các thẻ: thuộc tính (kể cả `data-du-lieu`) giữ nguyên từng byte; nội dung trong
 * `pre`, `code`, `script`, `style`, `textarea` cũng không đụng (ví dụ mã nguồn có thể chứa `\(`).
 * KaTeX chạy với trust:false (không \href, \htmlClass…), lỗi TeX không làm vỡ trang mà hiện mã nguồn tô đỏ.
 */
import katex from "katex";
import { CSS_KATEX } from "./katexKhungDuLieu.generated.js";

export { CSS_KATEX };

/** Thẻ HTML (thuộc tính có thể chứa ">" trong dấu nháy), chú thích, hoặc doctype. */
const RE_THE = /<!--[\s\S]*?-->|<(?:[^>"']|"[^"]*"|'[^']*')*>/g;
// Công thức dòng kèm dấu câu đứng liền sau (".", ",", ";"…): bọc chung để dấu câu không bị rớt xuống dòng riêng.
const RE_CONG_THUC = /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)([.,;:!?…)]*)/g;
const THE_BO_QUA = new Set(["pre", "code", "script", "style", "textarea"]);

const giaiThucThe = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0*39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&amp;/g, "&");

const thoat = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Một công thức → HTML. Không bao giờ ném lỗi. */
export function veCongThuc(tex, khoi = false) {
  const nguon = giaiThucThe(String(tex || "")).trim();
  try {
    return katex.renderToString(nguon, {
      displayMode: khoi,
      throwOnError: false,
      errorColor: "#d64545",
      trust: false,
      strict: "ignore",
      output: "html",
      maxSize: 20,
      maxExpand: 500,
    });
  } catch {
    const mo = khoi ? "\\[" : "\\(";
    const dong = khoi ? "\\]" : "\\)";
    return `<span class="katex-loi" style="color:#d64545">${thoat(mo + nguon + dong)}</span>`;
  }
}

/** Thay công thức trong một đoạn chữ (không chứa thẻ). */
function thayTrongChu(chu, dem) {
  if (chu.indexOf("\\(") < 0 && chu.indexOf("\\[") < 0) return chu;
  return chu.replace(RE_CONG_THUC, (_, khoi, dong, dau) => {
    dem.n++;
    if (khoi !== undefined) return veCongThuc(khoi, true);
    const ct = veCongThuc(dong, false);
    return dau ? `<span class="katex-dinh">${ct}${dau}</span>` : ct;
  });
}

/**
 * Thay `\(…\)`/`\[…\]` trong html bằng HTML KaTeX.
 * @returns {{html: string, soCongThuc: number}} html đã thay và số công thức đã thay.
 */
export function datToanDem(html) {
  // "\(x=2\)</span>." — dấu câu nằm sau thẻ đóng thì trình duyệt cho xuống dòng riêng; đưa dấu câu vào trước thẻ đóng
  // để nó được bọc nowrap cùng công thức (chỉ đổi chỗ hiển thị, không đổi chữ).
  const s = String(html ?? "").replace(/(\\\))((?:<\/(?:span|b|strong|em|i|mark|u)>)+)([.,;:!?…]+)/g, "$1$3$2");
  const dem = { n: 0 };
  if (s.indexOf("\\(") < 0 && s.indexOf("\\[") < 0) return { html: s, soCongThuc: 0 };
  let ra = "";
  let cuoi = 0;
  const boQua = [];
  RE_THE.lastIndex = 0;
  let m;
  const xuLyChu = (chu) => (boQua.length ? chu : thayTrongChu(chu, dem));
  while ((m = RE_THE.exec(s))) {
    const chu = s.slice(cuoi, m.index);
    ra += xuLyChu(chu);
    ra += m[0];
    cuoi = m.index + m[0].length;
    const ten = /^<(\/?)([a-zA-Z][\w-]*)/.exec(m[0]);
    if (ten) {
      const t = ten[2].toLowerCase();
      if (THE_BO_QUA.has(t) && !/\/>$/.test(m[0])) {
        if (ten[1]) {
          const k = boQua.lastIndexOf(t);
          if (k >= 0) boQua.length = k;
        } else boQua.push(t);
      }
    }
  }
  ra += xuLyChu(s.slice(cuoi));
  return { html: ra, soCongThuc: dem.n };
}

/** Như datToanDem nhưng chỉ trả chuỗi html. */
export function datToan(html) {
  return datToanDem(html).html;
}
