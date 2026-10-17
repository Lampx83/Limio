// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { convertLegacyAiHtml, looksLegacyAi } from "./legacyLessonConvert";

/** Mẫu đúng theo quy tắc "Định dạng bằng AI" kiểu cũ (core-feedback STYLE_GUIDES). */
const P = 'style="color:#374151;font-size:1.25rem;line-height:1.7"';
const CLEAN =
  '<div class="lesson-objectives" style="background:#eff6ff;border-left:4px solid #1e40af;padding:12px">' +
  '<h3 style="color:#1e40af;font-size:1.42rem">Mục tiêu học tập</h3><ul style="font-size:1.25rem">' +
  `<li ${P}>Trình bày được nguyên tắc gần nhau.</li><li ${P}>Phân biệt được hai cách nhóm.</li></ul></div>` +
  '<h2 style="color:#1e40af;font-size:1.7rem">1. Nguyên tắc gần nhau</h2>' +
  `<p ${P}>Mắt người gom các phần tử gần nhau thành <strong>một nhóm</strong>.</p>` +
  '<h3 style="color:#1e40af">Khoảng trắng</h3>' +
  `<p ${P}>Khoảng trắng đánh dấu ranh giới.</p>` +
  '<div class="callout" style="background:#eff6ff;border-left:4px solid #1e40af">' +
  `<p ${P}><strong>Lưu ý:</strong> thử khoảng cách trước.</p></div>` +
  '<h2 style="color:#1e40af">2. So sánh</h2>' +
  '<div style="overflow-x:auto"><table style="border-collapse:collapse"><tbody><tr><th style="border:1px solid">Cách</th><th>Ưu điểm</th></tr>' +
  '<tr><td style="color:#374151">Khoảng cách</td><td>Thoáng</td></tr></tbody></table></div>' +
  `<p ${P}><img src="/api/lesson-media/images/a.png" alt="Hình A" style="max-width:100%"></p>` +
  '<div class="lesson-summary" style="background:#eff6ff"><h3 style="color:#1e40af">Tổng kết</h3>' +
  `<ul><li ${P}>Gần nhau là một nhóm.</li></ul></div>`;

describe("chuyển bài AI định dạng kiểu cũ sang dạng mới (S5)", () => {
  it("nhận ra bài kiểu cũ, bỏ qua bài thường", () => {
    expect(looksLegacyAi(CLEAN)).toBe(true);
    expect(looksLegacyAi("<h2>Tiêu đề</h2><p>Chữ</p>")).toBe(false);
    // Bài nhập bằng script khoá học: cũng có style nhưng là thiết kế có chủ ý — không đụng.
    expect(
      looksLegacyAi(
        '<nav aria-label="Mục lục bài học" style="border:1px solid"><ol><li>A</li></ol></nav><h2 id="muc-a" style="color:rgb(138,91,246)">A</h2><div class="callout" style="x"><p>y</p></div>',
      ),
    ).toBe(false);
    expect(looksLegacyAi('<h2 style="color:#1e40af">A</h2><p style="color:#374151">B</p>')).toBe(false);
    expect(looksLegacyAi('<h2 style="font-family:Inter, ui-sans-serif;color:#1e40af">A</h2>')).toBe(true);
    expect(convertLegacyAiHtml("<p>Chữ</p>")).toEqual({ ok: false, reason: "not_legacy" });
  });

  it("thành hộp Mục tiêu/Lưu ý/Tổng kết, mỗi h2 một mục, h3 một phần; bỏ hết style; giữ chữ, bảng, ảnh", () => {
    const r = convertLegacyAiHtml(CLEAN);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.look).toEqual({ palette: "limio", font: "modern" });
    expect(r.html).not.toContain("style=");
    expect(r.html).not.toContain(">Mục tiêu học tập</h3>");
    expect(r.html).toMatch(/^<div class="lesson-box" data-kind="objectives" data-title="Mục tiêu học tập"><ul>/);
    expect(r.html).toContain('<section class="lesson-section" data-layout="text"><h2>1. Nguyên tắc gần nhau</h2>');
    expect(r.html).toContain('<div class="lesson-part"><h3>Khoảng trắng</h3><p>Khoảng trắng đánh dấu ranh giới.</p><div class="lesson-box" data-kind="note"');
    expect(r.html).toContain("<table><tbody>");
    expect(r.html).toContain('<img src="/api/lesson-media/images/a.png" alt="Hình A">');
    expect(r.html).toMatch(/<\/section><div class="lesson-box" data-kind="summary" data-title="Tổng kết"><ul>/);
  });

  it("đổi giao diện cũ sang bảng màu gần nhất", () => {
    const vibrant = CLEAN.replace('<h2 style="color:#1e40af;font-size:1.7rem">', '<h2 style="color:rgb(40,118,245);border-left:4px solid rgb(40,118,245)">').replace(
      '<h2 style="color:#1e40af">2.',
      '<h2 style="color:rgb(138,91,246);border-left:4px solid rgb(138,91,246)">2.',
    );
    expect(convertLegacyAiHtml(vibrant)).toMatchObject({ ok: true, look: { palette: "vibrant" } });
    const academic = CLEAN.replace(/<h2 style="/g, '<h2 style="font-family:Georgia,serif;');
    expect(convertLegacyAiHtml(academic)).toMatchObject({ ok: true, look: { palette: "plain", font: "academic" } });
    const modern = CLEAN.replace(/<h2 style="/g, '<h2 style="background:linear-gradient(135deg,#0d9488,#0369a1);');
    expect(convertLegacyAiHtml(modern)).toMatchObject({ ok: true, look: { palette: "sunset" } });
  });

  it("có thứ trình soạn không biểu diễn được (khung lạ) thì KHÔNG chuyển, bài giữ nguyên", () => {
    const odd = CLEAN.replace("<h2", '<iframe src="https://x.test"></iframe><h2');
    const r = convertLegacyAiHtml(odd);
    expect(r.ok).toBe(false);
  });
});
