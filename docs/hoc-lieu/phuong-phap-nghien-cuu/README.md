# Khoá Phương pháp nghiên cứu & Viết luận văn — học liệu

Đối tượng: **học viên cao học** đang làm luận văn — khác với khoá Nhập môn NCKH (SV đại học, NCKH
lần đầu). Đây là khoá thứ hai trong bộ 4 khoá về kỹ năng nghiên cứu (SV → **học viên cao học** →
nghiên cứu sinh → khoá chuyên đề xử lý dữ liệu, chưa soạn).

Nguồn của khoá nằm ở `src/*.py`, không phải ở file JSON. `khoa-phuong-phap-nghien-cuu.json`
là **sản phẩm sinh ra**, đừng sửa tay — sửa xong chạy build là mất.

```bash
python3 docs/hoc-lieu/phuong-phap-nghien-cuu/src/build.py
```

## Cấu trúc khoá

**Một module duy nhất**, 6 bài theo đúng trình tự làm một luận văn từ đề tài đã có tới bản hoàn
chỉnh sẵn sàng bảo vệ. Một đề tài luận văn thật của người học được dùng xuyên suốt cả 6 bài —
sản phẩm mỗi bài (khung lý thuyết, ma trận tổng quan, thiết kế, kết quả kiểm định, chương luận
văn) là bản dùng lại được ngay, không phải bài tập minh hoạ.

| # | Bài | Trạng thái |
|---|---|---|
| 1 | Từ câu hỏi nghiên cứu đến khung lý thuyết | ✅ |
| 2 | Tổng quan tài liệu hệ thống | ✅ |
| 3 | Thiết kế nghiên cứu | ✅ |
| 4 | Thu thập và xử lý dữ liệu | ✅ |
| 5 | Viết luận văn và chuẩn bị bảo vệ | ✅ |
| 6 | Đạo đức nghiên cứu với dữ liệu người tham gia | ✅ |

**Khoá đã soạn xong toàn bộ 6 bài.** Câu hỏi cuối bài **soạn mới**, gắn mã lỗi tư duy (`ppnc.*`) để
Feedback Engine nói được học viên sai ở đâu.

## Nhập vào hệ thống

Khoá chỉ có một module nên nhập một lần, không cần `--into`.

```bash
pnpm import:course -- --file docs/hoc-lieu/phuong-phap-nghien-cuu/khoa-phuong-phap-nghien-cuu.json \
  --owner <email-gv> --dry-run
pnpm import:course -- --file docs/hoc-lieu/phuong-phap-nghien-cuu/khoa-phuong-phap-nghien-cuu.json \
  --owner <email-gv>
```

Vào production thì đổi lệnh thành `import:course:prod` và mở hầm SSH trước — xem đầu file
`packages/core-lms/scripts/import-course.ts`.

Khoá nhập xong ở trạng thái **nháp**; publish là việc của người duyệt nội dung.

## Quy ước khi soạn tiếp

Giống hoàn toàn quy ước ở khoá Nhập môn NCKH (`docs/hoc-lieu/nhap-mon-nckh/README.md`): tối đa 5
mục cấp 2 mỗi bài, kết bằng *Luyện tập và tài liệu tham khảo* ba lớp (cá nhân/nhóm/bài tập về nhà),
mọi phương án sai đáng chú ý gắn `misconception`, sơ đồ vẽ bằng khối ```html thay vì ảnh ngoài, và
nguồn tham khảo dùng sách/bài báo kinh điển dễ kiểm chứng — không bịa DOI hay link.

Khác biệt so với Nhập môn NCKH: nội dung ở mức cao học nên sâu hơn về kỹ thuật (PLS-SEM, EFA, PRISMA,
độ tin cậy giữa người mã hoá…) — mã lỗi tư duy dùng tiền tố `ppnc.` để không đụng `nckh.` (Nhập môn
NCKH) hay `knm.` (Kỹ năng mềm) trong cùng DB.

## Trạng thái trên hệ thống

Chưa nhập vào hệ thống nào (local hoặc prod) — chỉ mới build manifest + dry-run local.
