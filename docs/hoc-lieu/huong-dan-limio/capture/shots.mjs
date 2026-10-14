/**
 * Cách chụp từng ảnh của khoá. Khoá là tên ảnh trong `shot(name, …)` ở bài; giá trị là
 * hàm nhận `page` (xem shoot.mjs) và gọi page.save(name, clip).
 */
export const SHOTS = {
  "1-1-thanh-dieu-huong": async (p) => {
    await p.resize(1360, 640);
    await p.goto("/instructor/courses");
    await p.marks([
      { sel: 'a[aria-label="LMS"]', at: "r", dx: 6, ring: true },
      { text: "Khoá học của tôi", at: "r", dx: 14 },
      { text: "Giảng viên Mẫu", at: "l", dx: -52 },
    ]);
    await p.save("1-1-thanh-dieu-huong", { x: 0, y: 0, width: 1360, height: 560 });
  },

  "1-2-bieu-mau-tao-khoa": async (p) => {
    await p.resize(1360, 1330);
    await p.goto("/instructor/courses/new");
    await p.fill('input[placeholder^="Ví dụ"]', "Nhập môn Lập trình");
    await p.eval(`(() => { const e = document.querySelector('[contenteditable="true"]'); e.focus();
      document.execCommand('insertText', false, 'Python cho sinh viên năm nhất ngành Công nghệ thông tin: biến, cấu trúc điều khiển và hàm.'); })()`);
    await p.fill('input[placeholder="data-science"]', "Công nghệ thông tin");
    await p.sleep(400);
    await p.marks([
      { text: "Tiêu đề*", starts: true, at: "r", dx: 18 },
      { text: "Mô tả*", starts: true, at: "r", dx: 18 },
      { sel: "select", idx: 0, at: "tr", dx: -4, dy: 2 },
      { sel: "select", idx: 1, at: "tr", dx: -4, dy: 2 },
      { sel: 'input[placeholder="data-science"]', at: "tr", dx: -4, dy: 2 },
      { text: "Bật cá nhân hoá học tập", at: "r", dx: 18 },
      { text: "Ai vào được khoá này", starts: true, at: "r", dx: 18 },
      { text: "Tạo và tiếp tục", at: "r", dx: 18 },
    ]);
    await p.save("1-2-bieu-mau-tao-khoa", { x: 300, y: 80, width: 1060, height: 1130 });
  },

  // ── Chương 1 ──
  "1-3-tab-noi-dung": async (p) => {
    await p.resize(1360, 1000);
    await p.openCourse("Hướng dẫn sử dụng Limio", "content");
    await p.hover("Chương 1 · Dựng khoá học đầu tiên");
    await p.marks([
      { sel: 'input[placeholder*="Tìm bài học"]', at: "tr", dx: -10, dy: 6 },
      { text: "Xem trước", at: "l", dx: -8 },
      { sel: '[title="Sửa module"]', at: "tr", dx: 2, dy: 2, ring: true },
      { text: "Bài 1.2 · Tạo khoá học đầu tiên", at: "r", dx: 20 },
      { text: "+ Thêm lesson", idx: 0, at: "l", dx: 70 },
    ]);
    await p.save("1-3-tab-noi-dung", { x: 100, y: 110, width: 1160, height: 640 });
  },
  "1-3-trang-bai-hoc": async (p) => {
    await p.resize(1360, 1100);
    await p.openCourse("Hướng dẫn sử dụng Limio", "content");
    await p.clickText("Bài 1.1 · Làm quen với Limio");
    await p.sleep(2200);
    await p.marks([
      { text: "Xem như học viên", at: "l", dx: -6 },
      { text: "1 chủ đề", at: "r", dx: 26 },
      { sel: "[aria-label='Kéo để sắp xếp']", idx: 0, at: "l", dx: -24 },
      { text: "Mở trình soạn", idx: 0, at: "tl", dx: 4, dy: 2 },
      { text: "+ Thêm hoạt động/tài nguyên", at: "l", dx: 90 },
    ]);
    await p.save("1-3-trang-bai-hoc", { x: 100, y: 110, width: 1160, height: 1000 });
  },
  "1-3-menu-bai-hoc": async (p) => {
    await p.resize(1360, 1100);
    await p.openCourse("Hướng dẫn sử dụng Limio", "content");
    await p.clickText("Bài 1.1 · Làm quen với Limio");
    await p.sleep(2200);
    await p.eval(`(() => { const b=[...document.querySelectorAll('button')].filter(e=>{const r=e.getBoundingClientRect();return r.x>1100&&r.y>380&&r.y<480&&r.width<60}); if(b[0]) b[0].click(); })()`);
    await p.sleep(700);
    await p.marks([
      { text: "Hiện bài này", at: "tl", dx: -22, dy: 10 },
      { text: "Khoá nội dung", at: "tl", dx: -22, dy: 10 },
      { text: "Cho xem thử", at: "tl", dx: -22, dy: 10 },
      { text: "Chuyển sang module khác", at: "tl", dx: -22, dy: 10 },
      { text: "Xóa bài học", at: "tl", dx: -22, dy: 10 },
    ]);
    await p.save("1-3-menu-bai-hoc", { x: 690, y: 240, width: 590, height: 700 });
  },
  "1-3-chon-khoi-noi-dung": async (p) => {
    await p.resize(1360, 1250);
    await p.openCourse("Hướng dẫn sử dụng Limio", "content");
    await p.clickText("Bài 1.1 · Làm quen với Limio");
    await p.sleep(2200);
    await p.clickText("+ Thêm hoạt động/tài nguyên");
    await p.sleep(1200);
    await p.marks([
      { sel: 'input[placeholder*="Tìm hoạt động"]', at: "tr", dx: -12, dy: 6 },
      { text: "Tất cả", at: "tr", dx: 10, dy: -2 },
      { text: "Văn bản — AI hỗ trợ", closest: "button", at: "tl", dx: 14, dy: 14 },
      { text: "Ghi chú giảng viên", closest: "button", at: "tl", dx: 14, dy: 14 },
      { text: "Quiz", idx: -1, closest: "button", at: "tl", dx: 14, dy: 14 },
    ]);
    await p.save("1-3-chon-khoi-noi-dung", { x: 195, y: 25, width: 975, height: 1190 });
  },
  "1-4-dau-trang-khoa-nhap": async (p) => {
    await p.resize(1360, 900);
    await p.openCourse("Hướng dẫn sử dụng Limio", "content");
    await p.marks([
      { text: "Nháp", at: "tr", dx: 10, dy: -2 },
      { text: "Chế độ đứng lớp", at: "tr", dx: 16, dy: -2, ring: true },
      { text: "Publish", at: "tl", dx: -10, dy: 6 },
      { text: "Tổng quan", at: "bl", dx: 30, dy: 20 },
      { text: "Xem trước", at: "tl", dx: 6, dy: 4 },
    ]);
    await p.save("1-4-dau-trang-khoa-nhap", { x: 100, y: 110, width: 1160, height: 480 });
  },

  "1-4-o-cong-khai": async (p) => {
    await p.resize(1360, 1900);
    await p.openCourse("Nhập môn Lập trình", "content");
    await p.clickText("Tổng quan");
    await p.sleep(2000);
    await p.clickText("Sửa");
    await p.sleep(1500);
    await p.marks([
      { text: "Ai vào được khoá này", at: "r", dx: 18 },
      { sel: 'input[placeholder*="miễn phí"]', at: "tr", dx: -8, dy: 4 },
      { text: "Công khai — xem được không cần đăng nhập", at: "r", dx: 18 },
    ]);
    await p.save("1-4-o-cong-khai", { x: 110, y: 890, width: 1140, height: 380 });
  },

  // ── Chương 2 ──
  "2-1-trinh-soan-cau-hoi": async (p) => {
    await p.resize(1360, 1100);
    await p.goto("/instructor/courses/fc4deaae-227f-4b2d-b7e8-227e08c72fec/quizzes/36797ed1-5456-457a-aec5-4b5dd7e32357/edit");
    await p.marks([
      { text: "Cài đặt", at: "l", dx: -8 },
      { text: "AI import", at: "tl", dx: 6, dy: 4 },
      { text: "Câu hỏi (3)", at: "r", dx: 16 },
    ]);
    await p.save("2-1-trinh-soan-cau-hoi", { x: 340, y: 105, width: 990, height: 700 });
  },
  "2-2-trang-bat-dau": async (p) => {
    await p.resize(1360, 900);
    await p.goto("/instructor/assessment");
    await p.marks([
      { text: "Đã xong", at: "r", dx: 18 },
      { text: "Làm tiếp bước này", at: "r", dx: 18 },
      { text: "Tạo đề thi →", at: "l", dx: -14 },
      { text: "Chưa tới bước này", at: "r", dx: 18 },
    ]);
    await p.save("2-2-trang-bat-dau", { x: 320, y: 100, width: 1015, height: 600 });
  },
  "2-2-bang-ngan-hang-cau-hoi": async (p) => {
    await p.resize(1360, 1100);
    await p.goto("/instructor/question-banks/8d671f0a-cdc6-427d-8559-816159e317e2");
    await p.marks([
      { text: "+ Nhập thủ công", at: "tl", dx: 6, dy: 4 },
      { text: "Trạng thái", idx: -1, at: "tr", dx: 8, dy: -2 },
      { text: "Thẩm định", idx: -1, at: "tr", dx: 8, dy: -2 },
    ]);
    await p.save("2-2-bang-ngan-hang-cau-hoi", { x: 330, y: 95, width: 1000, height: 760 });
  },
  "2-3-ban-dinh-to-chuc-kieu-gi": async (p) => {
    await p.resize(1360, 700);
    await p.goto("/instructor/organize");
    await p.marks([
      { text: "Link thi nhanh", starts: true, at: "r", dx: -26 },
      { text: "Thử nghiệm câu hỏi", starts: true, at: "r", dx: -26 },
      { text: "Kỳ thi chính thức", starts: true, at: "r", dx: -26 },
    ]);
    await p.save("2-3-ban-dinh-to-chuc-kieu-gi", { x: 320, y: 100, width: 1015, height: 330 });
  },

  // ── Chương 3 ──
  "3-1-man-hinh-bai-tap": async (p) => {
    await p.resize(1360, 900);
    await p.goto("/instructor/assignments");
    await p.marks([
      { text: "Danh sách assignment", at: "tl", dx: 4, dy: -6 },
      { text: "Đang chờ chấm", closest: "div[class*=rounded]", at: "tr", dx: -6, dy: 10 },
      { text: "Cần chấm", starts: true, at: "tr", dx: 44, dy: -4 },
    ]);
    await p.save("3-1-man-hinh-bai-tap", { x: 320, y: 100, width: 1015, height: 520 });
  },

  "2-1-cai-dat-bai-kiem-tra": async (p) => {
    await p.resize(1360, 1100);
    await p.goto("/instructor/courses/fc4deaae-227f-4b2d-b7e8-227e08c72fec/quizzes/36797ed1-5456-457a-aec5-4b5dd7e32357/edit");
    await p.clickText("Cài đặt");
    await p.sleep(1200);
    await p.marks([
      { text: "Thời gian làm bài", at: "tr", dx: 40, dy: 4 },
      { text: "Hạn mở", at: "tr", dx: 40, dy: 4 },
      { text: "Cách tính điểm khi làm nhiều lần", at: "r", dx: 16 },
      { text: "Lịch theo lớp", at: "r", dx: 18 },
    ]);
    await p.save("2-1-cai-dat-bai-kiem-tra", { x: 340, y: 105, width: 990, height: 610 });
  },
  "3-1-cua-so-cham-bai": async (p) => {
    await p.resize(1360, 1300);
    await p.goto("/instructor/assignments/42edf779-3ccc-435d-9045-c8d80c26b0bf/submissions");
    await p.clickText("Xem bài làm", "body", 1);
    await p.sleep(1800);
    await p.marks([
      { text: "Gợi ý điểm bằng AI", starts: false, at: "r", dx: 18, ring: false, text: "✨ Gợi ý điểm bằng AI" },
      { text: "Điểm", idx: -1, at: "l", dx: -20 },
      { text: "Nhận xét", idx: -1, at: "l", dx: -20 },
      { text: "✓ Chấm điểm", at: "r", dx: 18 },
    ]);
    const box = await p.boxOfText("← Quay lại danh sách", 600, 900, 6);
    await p.save("3-1-cua-so-cham-bai", box);
  },

  // ── Chương 4 ──
  "4-1-the-link-moi-lop": async (p) => {
    await p.resize(1360, 1300);
    await p.openCourse("Nhập môn Lập trình", "content");
    await p.clickText("Lớp học");
    await p.sleep(2500);
    await p.rewrite("http://localhost:3000", "https://limio.vn");
    await p.marks([
      { text: "Link mời vào lớp", idx: 0, at: "r", dx: 18 },
      { text: "Mã QR", idx: 0, at: "tr", dx: 4, dy: -6 },
      { text: "Nhập học viên", idx: 0, at: "tl", dx: 6, dy: -6 },
      { text: "Xem danh sách", idx: 0, at: "r", dx: 20 },
    ]);
    await p.save("4-1-the-link-moi-lop", { x: 110, y: 560, width: 1130, height: 300 });
  },
  "4-2-dien-dan-hoi-dap": async (p) => {
    await p.resize(1360, 1000);
    await p.goto("/instructor/forum");
    await p.clickText("Chưa giải đáp", "body", 1);
    await p.sleep(1200);
    await p.marks([
      { text: "Chưa giải đáp", idx: 1, at: "tr", dx: 6, dy: -6 },
      { text: "Đặt tên biến thế nào cho dễ đọc?", at: "r", dx: 18 },
      { text: "Mở thread", idx: 0, at: "l", dx: -14 },
    ]);
    await p.save("4-2-dien-dan-hoi-dap", { x: 320, y: 100, width: 1015, height: 700 });
  },
  "4-3-trang-chu-giang-vien": async (p) => {
    await p.resize(1360, 1000);
    await p.goto("/instructor/dashboard");
    await p.marks([
      { text: "Cần xử lý gấp", starts: true, at: "r", dx: 60 },
      { text: "Hoạt động gần đây", at: "r", dx: 60 },
      { text: "Lịch", at: "l", dx: -16 },
    ]);
    await p.save("4-3-trang-chu-giang-vien", { x: 90, y: 80, width: 1215, height: 780 });
  },
  "4-3-muc-gamification": async (p) => {
    await p.resize(1360, 1300);
    await p.openCourse("Nhập môn Lập trình", "content");
    await p.clickText("Gamification");
    await p.sleep(2500);
    await p.marks([
      { text: "Lớp", idx: 0, at: "tl", dx: -4, dy: -10 },
      { text: "Tải CSV", at: "l", dx: -8 },
      { text: "Tổng XP", at: "r", dx: 28 },
      { text: "Học viên", idx: -1, at: "tr", dx: -2, dy: -8 },
    ]);
    await p.save("4-3-muc-gamification", { x: 100, y: 110, width: 1180, height: 840 });
  },
  "4-2-menu-chuot-phai": async (p) => {
    await p.resize(1360, 1000);
    await p.relogin("sv.demo.01@feedbackme.dev", process.env.DEMO_PASSWORD);
    await p.goto("/learn/nhap-mon-lap-trinh/lessons/665032f9-a1b8-447b-8c57-6ac1596ba844");
    await p.sleep(2500);
    const pt = await p.selectAndRightClick("biến đếm nhận các giá trị từ", 0, 60);
    await p.marks([
      { abs: [pt.x + 156, pt.y - 4] },
      { text: "Viết annotation", starts: true, at: "l", dx: -34 },
      { text: "Hỏi AI về đoạn này", starts: true, at: "l", dx: -34 },
    ]);
    await p.save("4-2-menu-chuot-phai", { x: Math.max(0, pt.x - 400), y: Math.max(0, pt.y - 70), width: 780, height: 330 });
  },
  "2-3-tong-quan-dot-thi": async (p) => {
    await p.resize(1360, 1000);
    await p.goto("/instructor/exam-rounds/7f23034f-df28-4ccf-ae64-44858c33cb4d");
    await p.sleep(2500);
    await p.marks([
      { text: "Ca thi", at: "tr", dx: 6, dy: -8 },
      { text: "Nháp", idx: 0, at: "tr", dx: 12, dy: -6 },
      { text: "Đổi trạng thái", at: "l", dx: -22 },
    ]);
    await p.save("2-3-tong-quan-dot-thi", { x: 320, y: 90, width: 1010, height: 900 });
  },
  "3-2-gan-quan-niem-sai": async (p) => {
    await p.resize(1360, 1700);
    await p.goto("/instructor/courses/fc4deaae-227f-4b2d-b7e8-227e08c72fec/quizzes/36797ed1-5456-457a-aec5-4b5dd7e32357/edit");
    await p.sleep(1500);
    await p.marks([
      { text: "Đáp án 1", at: "l", dx: -24 },
      { sel: "select", idx: 0, at: "tr", dx: -4, dy: 2 },
      { sel: "select", idx: 1, at: "tr", dx: -4, dy: 2 },
    ]);
    await p.save("3-2-gan-quan-niem-sai", { x: 560, y: 700, width: 770, height: 800 });
  },
  "3-2-lo-trinh-cua-hoc-vien": async (p) => {
    await p.resize(1360, 1500);
    await p.relogin("sv.demo.01@feedbackme.dev", process.env.DEMO_PASSWORD);
    await p.goto("/learn/nhap-mon-lap-trinh");
    await p.sleep(2500);
    await p.marks([
      { text: "Ôn lại trước khi học tiếp", at: "l", dx: -44 },
      { text: "Cần ôn", idx: 0, at: "l", dx: -10 },
      { text: "Nên luyện thêm", idx: 0, at: "l", dx: -10 },
    ]);
    await p.save("3-2-lo-trinh-cua-hoc-vien", { x: 220, y: 480, width: 560, height: 500 });
  },
  "4-1-han-theo-lop": async (p) => {
    await p.resize(1360, 2600);
    await p.openCourse("Nhập môn Lập trình", "content");
    await p.clickText("Câu lệnh if");
    await p.sleep(2500);
    await p.eval(`(() => { const card = [...document.querySelectorAll('div')].filter(d => (d.textContent||'').includes('Xem bài nộp') && d.querySelector('button[title="Sửa"], button[aria-label="Sửa"]')).pop(); const b = card && card.querySelector('button[title="Sửa"], button[aria-label="Sửa"]'); if (b) b.click(); })()`);
    await p.sleep(1500);
    await p.eval(`(() => { const t = [...document.querySelectorAll('body *')].filter(e => (e.textContent||'').trim() === 'Hạn theo lớp'); const e = t[t.length - 1]; (e.closest('button,summary,[role=button]') || e).click(); })()`);
    await p.sleep(1800);
    // tích chọn hai lớp đầu để hiện các nút áp dụng
    await p.eval(`(() => { for (const name of ['K65-CS1', 'K65-CS2']) { const el = [...document.querySelectorAll('body *')].find(e => (e.textContent||'').trim().startsWith(name) && e.children.length < 3);
      const row = el && el.closest('div[class*="border"], li, label') ; const cb = row && row.querySelector('input[type="checkbox"]'); if (cb) cb.click(); } })()`);
    await p.sleep(1200);
    await p.marks([
      { text: "Hạn chung", starts: true, at: "tr", dx: 6, dy: -8 },
      { text: "Chọn tất cả lớp", at: "r", dx: 18 },
      { text: "K65-CS1", starts: true, at: "r", dx: 60 },
      { text: "Sửa", idx: 0, at: "r", dx: 16 },
    ]);
    const r = await p.rectOfText("Hạn theo lớp");
    await p.save("4-1-han-theo-lop", { x: Math.max(0, r.x - 14), y: Math.max(0, r.y - 14), width: 700, height: 600 });
  },
};
