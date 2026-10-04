# Khoá Xử lý & Phân tích dữ liệu nghiên cứu — học liệu

Đối tượng: **dùng chung cho học viên cao học và nghiên cứu sinh** — khoá thứ 4 trong bộ kỹ năng
nghiên cứu, cùng Nhập môn NCKH (SV đại học), Phương pháp nghiên cứu (HVCH), NCKH nâng cao & Công
bố quốc tế (NCS).

**Khác biệt có chủ đích so với 3 khoá kia**: đây không dạy lại "khi nào dùng phương pháp nào" (đã
có ở khoá Phương pháp nghiên cứu `ppnc.` và NCKH nâng cao `cbqt.`), mà là khoá **thực hành công
cụ trên dữ liệu thật**. Một bộ dữ liệu khảo sát mẫu 10-11 dòng có đủ 5 loại lỗi thật (thiếu, trùng
lặp, ngoài khoảng, straight-lining, chưa đảo hướng) được dùng xuyên suốt các bài — người học tự
tay tính công thức, đọc output SPSS/R thật, tính Cohen's Kappa bằng tay, không chỉ đọc lý thuyết.

Nguồn của khoá nằm ở `src/*.py`, không phải ở file JSON. `khoa-xu-ly-du-lieu-nghien-cuu.json`
là **sản phẩm sinh ra**, đừng sửa tay — sửa xong chạy build là mất.

```bash
python3 docs/hoc-lieu/xu-ly-du-lieu-nghien-cuu/src/build.py
```

## Cấu trúc khoá

**Một module duy nhất**, 5 bài.

| # | Bài | Trạng thái |
|---|---|---|
| 1 | Làm sạch một bộ dữ liệu khảo sát thật | ✅ |
| 2 | Thống kê mô tả và kiểm định giả thuyết | ✅ |
| 3 | Đọc bảng EFA và độ tin cậy | ✅ |
| 4 | Mã hóa dữ liệu định tính và độ tin cậy giữa người mã hóa | ✅ |
| 5 | Trực quan hóa dữ liệu và đóng gói để tái lập kết quả | ✅ |

**Khoá đã soạn xong toàn bộ 5 bài.** Câu hỏi cuối bài **soạn mới**, gắn mã lỗi tư duy (`xldl.*`) để
Feedback Engine nói được học viên sai ở đâu.

## Nhập vào hệ thống

Khoá chỉ có một module nên nhập một lần, không cần `--into`.

```bash
pnpm import:course -- --file docs/hoc-lieu/xu-ly-du-lieu-nghien-cuu/khoa-xu-ly-du-lieu-nghien-cuu.json \
  --owner <email-gv> --dry-run
pnpm import:course -- --file docs/hoc-lieu/xu-ly-du-lieu-nghien-cuu/khoa-xu-ly-du-lieu-nghien-cuu.json \
  --owner <email-gv>
```

Vào production thì đổi lệnh thành `import:course:prod` và mở hầm SSH trước — xem đầu file
`packages/core-lms/scripts/import-course.ts`.

Khoá nhập xong ở trạng thái **nháp**; publish là việc của người duyệt nội dung.

## Quy ước khi soạn tiếp

Giống các khoá kia: tối đa 5 mục cấp 2 mỗi bài, kết bằng *Luyện tập và tài liệu tham khảo* ba lớp,
mọi phương án sai đáng chú ý gắn `misconception`, sơ đồ vẽ bằng khối ```html thay vì ảnh ngoài,
nguồn tham khảo dùng sách/bài báo kinh điển dễ kiểm chứng.

Điểm khác: mọi ví dụ nên có **số liệu cụ thể** (bảng dữ liệu thật, output SPSS/R thật với số) để
người học tự tay tính hoặc đọc, không dừng ở mô tả chung. Bộ dữ liệu mẫu ở Bài 1 (10-11 người,
5 loại lỗi) được tham chiếu lại ở Bài 2-3 — khi soạn thêm bài, ưu tiên dùng lại cùng bộ dữ liệu đó
để giữ tính liên tục, trừ Bài 4 (dữ liệu định tính, cần transcript riêng) và Bài 5 (dùng lại số
liệu từ Bài 2).

Mã lỗi tư duy dùng tiền tố `xldl.` để không đụng `ppnc.`, `cbqt.`, `nckh.`, hay `knm.` trong cùng
DB.

## Trạng thái trên hệ thống

Chưa nhập vào hệ thống nào (local hoặc prod) — chỉ mới build manifest + dry-run local.
