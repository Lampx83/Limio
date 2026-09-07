# Khoá Kỹ năng mềm — học liệu

Nguồn của khoá nằm ở `src/*.py`, không phải ở file JSON. `khoa-ky-nang-mem.json`
là **sản phẩm sinh ra**, đừng sửa tay — sửa xong chạy build là mất.

```bash
python3 docs/hoc-lieu/ky-nang-mem/src/build.py              # sinh manifest cho mọi module đã soạn
python3 docs/hoc-lieu/ky-nang-mem/src/build.py --module 2   # chỉ một module, để nhập nối
```

## Cấu trúc khoá

Mười module, mỗi module một kỹ năng. Chín kỹ năng đầu khớp 1-1 với **Kho KNM**
(`docs/Kho KNM (1).xlsx`, 282 câu MCQ, mã `KNM-NNNN`) để ngân hàng câu hỏi và đề
thi dùng chung được tên chủ đề; **Tư duy phản biện** là module thêm, chưa có câu
trong kho.

| # | Module | Trạng thái |
|---|---|---|
| 1 | Giá trị sống | ✅ 3 bài |
| 2 | Tư duy tích cực | chưa soạn |
| 3 | Tư duy phản biện | chưa soạn |
| 4 | Quản lý thời gian | chưa soạn |
| 5 | Giao tiếp hiệu quả | chưa soạn |
| 6 | Kỹ năng lắng nghe | chưa soạn |
| 7 | Thuyết trình hiệu quả | chưa soạn |
| 8 | Nghệ thuật thuyết phục | chưa soạn |
| 9 | Kỹ năng cá nhân trong làm việc nhóm | chưa soạn |
| 10 | Viết CV và phỏng vấn xin việc | chưa soạn |

Thứ tự đi từ trong ra ngoài: nền tảng cá nhân trước (giá trị, tư duy, thời gian),
rồi tới các kỹ năng cần người khác mới luyện được, cuối cùng là nghề nghiệp.

Câu hỏi cuối bài **soạn mới** và gắn mã lỗi tư duy (`knm.*`) để Feedback Engine
nói được học viên sai ở đâu. Kho KNM 282 câu vẫn dùng riêng cho Ngân hàng câu
hỏi và đề thi — hai đường không trộn vào nhau.

## Nhập vào hệ thống

Module đầu tiên tạo khoá mới; các module sau **nối vào khoá đã có** bằng `--into`,
nếu không sẽ đụng slug `ky-nang-mem`.

```bash
# lần đầu (local)
pnpm import:course -- --file docs/hoc-lieu/ky-nang-mem/khoa-ky-nang-mem.json \
  --owner <email-gv> --dry-run
pnpm import:course -- --file docs/hoc-lieu/ky-nang-mem/khoa-ky-nang-mem.json --owner <email-gv>

# module tiếp theo
python3 docs/hoc-lieu/ky-nang-mem/src/build.py --module 2
pnpm import:course -- --file docs/hoc-lieu/ky-nang-mem/khoa-ky-nang-mem.json \
  --owner <email-gv> --into <courseId>
```

Vào production thì đổi lệnh thành `import:course:prod` và mở hầm SSH trước — xem
đầu file `packages/core-lms/scripts/import-course.ts`.

Khoá nhập xong ở trạng thái **nháp**; publish là việc của người duyệt nội dung.

## Quy ước khi soạn tiếp

- Mỗi bài tối đa **5 mục cấp 2** (`##`), nếu không importer cảnh báo mục lục quá dài.
- Mỗi bài kết bằng mục *Luyện tập và tài liệu tham khảo* gồm ba lớp: cá nhân,
  nhóm, bài tập về nhà — rồi mới tới nguồn tham khảo.
- Mọi phương án SAI đáng chú ý phải gắn `misconception`; mã mới khai báo thêm
  vào `MISCONCEPTIONS` trong `src/course.py` kèm một mẫu phản hồi tương ứng.
- Sơ đồ vẽ bằng khối ```html (div + style nội tuyến) thay vì ảnh ngoài: không phụ
  thuộc tệp đặt ở đâu đó, và đọc được trên cả nền sáng lẫn nền tối.
