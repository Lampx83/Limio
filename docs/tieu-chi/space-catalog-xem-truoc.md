# Không gian học liệu ở /catalog: xem trước khoá và admin chọn space — Acceptance criteria

> Bản nháp 26/11/2026. Mở rộng dải "Không gian học liệu" (combo-khoa-hoc.md AC10): mỗi space có vài khoá xem trước, và admin chọn space nào hiện.

## AC1 — Thẻ space có xem trước khoá

- Mỗi space hiện ở `/catalog` là một thẻ: **đầu thẻ** (logo — space kiểu Limio dùng lát chanh —, tên, "N khoá đang mở", nút **Xem tất cả →** sang trang chủ space) và **hàng khoá tiêu biểu** (tối đa 5): bìa sách (`BookCover`), tên khoá (tối đa 2 dòng), giá (gốc gạch ngang + giá bán + `-%`, hoặc "Miễn phí"). Bấm khoá → `/catalog/<slug>`.
- Trên điện thoại hàng khoá cuộn ngang (mỗi thẻ ~8rem); từ `md` chia 5 cột.
- Space không có khoá nào đủ điều kiện (xem AC2) thì chỉ còn đầu thẻ.

## AC2 — Chọn khoá xem trước (tự động)

- Đi theo thứ tự khoá của space; chỉ lấy khoá **đã xuất bản và có ảnh bìa**; tối đa 5.
- Space kiểu Limio: cấp có quyển (`hsk-N-quyen-k` đã xuất bản) được thay bằng các quyển của nó (đang bán, có bìa sách); quyển không bìa bị bỏ.
- Giá = gói đang bán rẻ nhất, hoặc giá phẳng, hoặc 0 (miễn phí).
- Lỗi DB → danh mục không vỡ: mục space biến mất, phần còn lại của `/catalog` chạy bình thường.

## AC3 — Cấu hình space nào hiện (Admin)

- SiteSetting `catalog.spaces`: **vắng / rỗng / hỏng → TỰ ĐỘNG** (mọi space đang bật, xếp theo tên); **JSON mảng slug → CHỌN TAY**: đúng các space đó theo đúng thứ tự đó; **mảng rỗng → ẩn cả mục**. Slug không còn là space đang bật bị bỏ khi hiển thị; trùng/sai dạng bị làm sạch; tối đa 24.
- **Admin → Section catalog** (`/admin/catalog-sections`) có khối **"Không gian học liệu ở /catalog"**: chọn Tự động / Chọn tay; chế độ chọn tay có danh sách (lên, xuống, bỏ) và ô "Thêm space…" liệt kê các space đang bật chưa nằm trong danh sách; nút **Lưu**, áp dụng ngay.

## AC4 — API và quyền

- `GET /api/admin/catalog-spaces` → `{ mode, slugs, choices }`; `PUT` body `{ mode: "auto"|"manual", slugs }`. **Chỉ admin nền tảng** (người khác 403, chưa đăng nhập 403).
- `PUT` chế độ chọn tay từ chối slug không phải space đang bật (`400 unknown_space` kèm danh sách) thay vì lưu ngầm; body sai dạng → `400 validation_failed`.
- Ghi `AuditLog` `catalog.spaces.updated` (payload chỉ mang chế độ và slug), và làm mới cache danh sách space.

## Cách kiểm

- Test: `lib/space/__tests__/catalogSpaceConfig.test.ts` (đọc/ghi/làm sạch/áp lựa chọn), `catalogSpaces.test.ts` (xem trước, chọn tay đúng thứ tự, mảng rỗng, dữ liệu hỏng).
- Xem bằng mắt: thẻ space ở `/catalog` (điện thoại và máy tính), khối admin.
