# Khoá NCKH nâng cao & Công bố quốc tế — học liệu

Đối tượng: **nghiên cứu sinh** — khác với khoá Phương pháp nghiên cứu (học viên cao học, đích là
một luận văn) và khoá Nhập môn NCKH (SV đại học). Đây là khoá cuối trong bộ 3 khoá kỹ năng nghiên
cứu theo trình độ (SV → học viên cao học → **nghiên cứu sinh**); còn khóa chuyên đề xử lý dữ liệu
(dự kiến dùng chung cho học viên cao học + nghiên cứu sinh) chưa soạn.

Nguồn của khoá nằm ở `src/*.py`, không phải ở file JSON. `khoa-cong-bo-quoc-te.json`
là **sản phẩm sinh ra**, đừng sửa tay — sửa xong chạy build là mất.

```bash
python3 docs/hoc-lieu/cong-bo-quoc-te/src/build.py
```

## Cấu trúc khoá

**Một module duy nhất**, 7 bài — đích không phải một luận văn mà một hoặc nhiều **bài báo công bố
quốc tế**, đặt trong một research agenda dài hơi. Dùng đúng đề tài nghiên cứu và bản thảo bài báo
thật của nghiên cứu sinh xuyên suốt cả 7 bài.

| # | Bài | Trạng thái |
|---|---|---|
| 1 | Định vị nghiên cứu và xác định đóng góp | ✅ |
| 2 | Tổng quan tài liệu hệ thống đầy đủ | ✅ |
| 3 | Phương pháp nghiên cứu nâng cao | ✅ |
| 4 | Viết bài báo khoa học tiếng Anh và trả lời phản biện | ✅ |
| 5 | Chọn venue và quy trình xuất bản | ✅ |
| 6 | Dùng AI hỗ trợ viết có kiểm soát | ✅ |
| 7 | Viết đề xuất xin tài trợ và networking học thuật | ✅ |

**Khoá đã soạn xong toàn bộ 7 bài.** Câu hỏi cuối bài **soạn mới**, gắn mã lỗi tư duy (`cbqt.*`) để
Feedback Engine nói được nghiên cứu sinh sai ở đâu.

## Nhập vào hệ thống

Khoá chỉ có một module nên nhập một lần, không cần `--into`.

```bash
pnpm import:course -- --file docs/hoc-lieu/cong-bo-quoc-te/khoa-cong-bo-quoc-te.json \
  --owner <email-gv> --dry-run
pnpm import:course -- --file docs/hoc-lieu/cong-bo-quoc-te/khoa-cong-bo-quoc-te.json --owner <email-gv>
```

Vào production thì đổi lệnh thành `import:course:prod` và mở hầm SSH trước — xem đầu file
`packages/core-lms/scripts/import-course.ts`.

Khoá nhập xong ở trạng thái **nháp**; publish là việc của người duyệt nội dung.

## Quy ước khi soạn tiếp

Giống hoàn toàn quy ước ở khoá Nhập môn NCKH và Phương pháp nghiên cứu: tối đa 5 mục cấp 2 mỗi
bài, kết bằng *Luyện tập và tài liệu tham khảo* ba lớp, mọi phương án sai đáng chú ý gắn
`misconception`, sơ đồ vẽ bằng khối ```html thay vì ảnh ngoài, nguồn tham khảo dùng sách/bài báo
kinh điển dễ kiểm chứng — không bịa DOI hay link.

Mã lỗi tư duy dùng tiền tố `cbqt.` để không đụng `ppnc.` (Phương pháp nghiên cứu), `nckh.` (Nhập
môn NCKH), hay `knm.` (Kỹ năng mềm) trong cùng DB. Nội dung ở mức nghiên cứu sinh sâu hơn cả khoá
cao học — moderated mediation, multi-group analysis, PRISMA đầy đủ, quy trình xuất bản quốc tế —
và một số bài (4, 6) dạy kỹ năng viết **tiếng Anh** dù phần giải thích trong bài vẫn bằng tiếng
Việt, giống cách các khoá tiếng Trung dạy ngoại ngữ qua tiếng Việt.

## Trạng thái trên hệ thống

Chưa nhập vào hệ thống nào (local hoặc prod) — chỉ mới build manifest + dry-run local.
