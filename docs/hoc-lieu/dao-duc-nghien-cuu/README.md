# Khoá Đạo đức nghiên cứu khoa học — học liệu

Đối tượng: **dùng chung cho sinh viên, học viên cao học và nghiên cứu sinh** — khoá thứ 5
trong bộ kỹ năng nghiên cứu, cùng Nhập môn NCKH (101), Phương pháp nghiên cứu (201), NCKH nâng
cao & Công bố quốc tế (301), Xử lý & Phân tích dữ liệu (401).

**Khác biệt có chủ đích so với nội dung đạo đức đã có ở 3 khoá kia**: Khóa 2 (Phương pháp nghiên
cứu) Bài 6 dạy CƠ BẢN — consent, ẩn danh (chỉ đổi tên), thời điểm xin phê duyệt đạo đức. Khóa 3
(NCKH nâng cao) Bài 5 dạy quyền tác giả theo ICMJE và tạp chí săn mồi. Khóa 3 Bài 6 dạy dùng AI
khi VIẾT bài báo. Khoá này KHÔNG dạy lại các phần đó — đào sâu góc khác: liêm chính học thuật
(FFP, tự đạo văn), quy trình hội đồng đạo đức đầy đủ (Belmont, phân loại rủi ro, nhóm dễ bị tổn
thương), đạo đức dữ liệu (ẩn danh hoá kỹ thuật thật sự + Luật Bảo vệ dữ liệu cá nhân 2025 của
Việt Nam), xung đột lợi ích (rộng hơn quyền tác giả), đạo đức dùng AI ở khâu thu thập/phân tích
dữ liệu (không chỉ viết), và văn hoá liêm chính/báo cáo sai phạm.

Nguồn của khoá nằm ở `src/*.py`, không phải ở file JSON. `khoa-dao-duc-nghien-cuu.json`
là **sản phẩm sinh ra**, đừng sửa tay — sửa xong chạy build là mất.

```bash
python3 docs/hoc-lieu/dao-duc-nghien-cuu/src/build.py
```

## Cấu trúc khoá

**Một module duy nhất**, 6 bài.

| # | Bài | Trạng thái |
|---|---|---|
| 1 | Liêm chính học thuật: đạo văn, tự đạo văn và ngụy tạo dữ liệu | ✅ |
| 2 | Hội đồng đạo đức nghiên cứu (IRB) — quy trình đầy đủ | ✅ |
| 3 | Đạo đức dữ liệu nghiên cứu | ✅ |
| 4 | Xung đột lợi ích trong nghiên cứu | ✅ |
| 5 | Đạo đức khi dùng AI trong toàn bộ quy trình nghiên cứu | ✅ |
| 6 | Báo cáo sai phạm và văn hoá liêm chính nghiên cứu | ✅ |

**Khoá đã soạn xong toàn bộ 6 bài.** Câu hỏi cuối bài **soạn mới**, gắn mã lỗi tư duy (`dd.*`) để
Feedback Engine nói được học viên sai ở đâu.

## Nhập vào hệ thống

Khoá chỉ có một module nên nhập một lần, không cần `--into`.

```bash
pnpm import:course -- --file docs/hoc-lieu/dao-duc-nghien-cuu/khoa-dao-duc-nghien-cuu.json \
  --owner <email-gv> --dry-run
pnpm import:course -- --file docs/hoc-lieu/dao-duc-nghien-cuu/khoa-dao-duc-nghien-cuu.json \
  --owner <email-gv>
```

Vào production thì đổi lệnh thành `import:course:prod` và mở hầm SSH trước — xem đầu file
`packages/core-lms/scripts/import-course.ts`.

Khoá nhập xong ở trạng thái **nháp**; publish là việc của người duyệt nội dung.

## Quy ước khi soạn tiếp

Giống các khoá kia: tối đa 5 mục cấp 2 mỗi bài, kết bằng *Luyện tập và tài liệu tham khảo* ba lớp,
mọi phương án sai đáng chú ý gắn `misconception`, sơ đồ/bảng số liệu vẽ bằng khối ```html hoặc
bảng Markdown thay vì ảnh ngoài, nguồn tham khảo dùng sách/bài báo/văn bản pháp luật kinh điển dễ
kiểm chứng (Belmont Report, ICMJE, COPE, Luật 91/2025/QH15...).

Mã lỗi tư duy dùng tiền tố `dd.` để không đụng `ppnc.`, `cbqt.`, `nckh.`, `xldl.`, hay `knm.`
trong cùng DB.

**Trước khi soạn thêm bài đạo đức ở khoá này hoặc khoá khác**: kiểm lại 3 khoá kia có đã dạy góc
đó chưa (Khóa 2 Bài 6, Khóa 3 Bài 5-6) để tránh dạy lại — nguyên tắc đã áp dụng khi thiết kế 6 bài
hiện tại, xem đối chiếu chi tiết ở đầu README này.

## Trạng thái trên hệ thống

Đã nhập vào **production** (server 224), trạng thái **nháp**, chưa publish.
Course id: `beceb447-b777-4197-a09a-f1d84a77c8a8`, slug `dao-duc-nghien-cuu`, owner `joynguyen7@gmail.com`.
(ID đổi mỗi lần chạy `--replace` — xem lịch sử git nếu cần ID cũ.)
