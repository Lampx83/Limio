import { describe, expect, it } from "vitest";
import { emailize } from "../emailize";

describe("emailize — biến HTML gọn thành HTML an toàn cho email", () => {
  it("thêm style inline cho thẻ cơ bản, giữ nguyên nội dung và thuộc tính khác", () => {
    const out = emailize('<h1>Tiêu đề</h1><p class="x">Xin chào</p><ul><li>Một</li></ul>');
    expect(out).toMatch(/<h1 style="[^"]*font-size:26px[^"]*">Tiêu đề<\/h1>/);
    expect(out).toMatch(/<p class="x" style="[^"]*">Xin chào<\/p>/);
    expect(out).toMatch(/<li style="[^"]*">Một<\/li>/);
  });

  it("không đè style admin đã tự viết", () => {
    const html = '<p style="color:red">A</p>';
    expect(emailize(html)).toBe(html);
  });

  it('<a class="button"> → nút bulletproof (td bgcolor + a), giữ href và nhãn', () => {
    const out = emailize('<a class="button" href="https://x.vn/a?b=1&amp;c=2">Xác thực email</a>');
    expect(out).toContain('bgcolor="#4d7c0f"');
    expect(out).toContain('href="https://x.vn/a?b=1&amp;c=2"');
    expect(out).toContain(">Xác thực email</a>");
    expect(out).not.toContain('class="button"');
  });

  it("note thường và note warn dùng hai bảng màu khác nhau", () => {
    const a = emailize('<div class="note">Ghi chú</div>');
    const b = emailize('<div class="note warn">Cẩn thận</div>');
    expect(a).toContain("#f7fee7");
    expect(b).toContain("#fffbeb");
    expect(b).toContain("Cẩn thận");
  });

  it("hộp mã: lấy nhãn từ data-label, hiển thị giá trị", () => {
    const out = emailize('<div class="code" data-label="Mã dự thi">X65DMJZD</div>');
    expect(out).toContain("Mã dự thi");
    expect(out).toContain("X65DMJZD");
    expect(out).toContain("letter-spacing:6px");
  });

  it("linkbox → dùng URL làm cả href lẫn chữ hiển thị", () => {
    const out = emailize('<div class="linkbox">https://limio.vn/verify?token=abc</div>');
    expect(out).toContain('href="https://limio.vn/verify?token=abc"');
    expect(out).toContain("Nếu nút không hoạt động");
  });

  it("bảng facts → từng hàng nhãn/giá trị", () => {
    const out = emailize('<table class="facts">\n<tr><td>Mở thi</td><td>08:00</td></tr>\n<tr><td>Đóng thi</td><td>10:00</td></tr>\n</table>');
    expect(out).toContain("Mở thi");
    expect(out).toContain(">08:00<");
    expect(out).toContain("Đóng thi");
    expect(out).not.toContain('class="facts"');
  });

  it("p.small → chú thích nhỏ (13px)", () => {
    expect(emailize('<p class="small">nhỏ</p>')).toContain("font-size:13px");
  });

  it("không chạm vào nội dung chèn từ biến đã bị escape (không tạo thẻ mới)", () => {
    const out = emailize("<p>Xin chào &lt;script&gt;alert(1)&lt;/script&gt;</p>");
    expect(out).not.toContain("<script>");
  });
});
