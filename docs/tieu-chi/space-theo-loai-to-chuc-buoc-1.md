# Space theo loại tổ chức, bước 1: mẫu mặc định và lọc danh sách mẫu

Chốt 2026-11-28 (theo đề xuất: mẫu dự án vẫn hiện cho mọi tổ chức; mẫu trung tâm xưng "bạn"). Đã code. Bước 2 (khối bật tắt, kiểu hiển thị khoá) làm sau, không nằm ở đây.

## Hiện trạng

- Space là trang `/s/<mã>` của một tổ chức: tên, màu, logo, chữ giới thiệu, danh sách khoá. Cấu hình ở `Organization.space` (JSON), quản trị tổ chức sửa ở "Thương hiệu & kỳ học" (`SpaceSettingsManager`).
- Ô **"Nạp mẫu"** liệt kê `SPACE_TEMPLATES` cho MỌI tổ chức: chỉ có hai mẫu của dự án (MICRO4ASIA, HSK 3.0). Tổ chức mới bật space phải tự viết mọi dòng chữ từ trang trắng.
- Mẫu chỉ được nạp vào form rồi Lưu; không lưu "đang dùng mẫu nào". Bước 1 giữ nguyên cách này, **không đổi schema**.
- Mọi space dùng chung một bố cục (`SpaceHome`).

## Việc của bước 1

Thêm ba **mẫu theo loại** (trường thường, trung tâm, nhà xuất bản): chỉ là chữ khởi đầu hợp với từng loại, nạp vào form như hai mẫu hiện có. Ô "Nạp mẫu" hiện mẫu theo loại của tổ chức đang sửa, rồi đến các mẫu dự án như cũ. Space của tổ chức chưa từng cấu hình thì form mở sẵn với mẫu của loại đó.

Bước 1 **không** đổi bố cục và **không** thêm tính năng nào vào trang space. Chữ trong mẫu không được hứa điều trang chưa có.

## Quy tắc

1. **Mẫu theo loại** có mã `school`, `center`, `publisher`; dựng từ loại và tên tổ chức (`templateForKind(kind, orgName)`), là hàm thuần để kiểm bằng test. Nội dung chỉ gồm các khoá chữ đã sửa được (`SPACE_EDITABLE_COPY`) cho các ngôn ngữ của space, cộng bảng màu thương hiệu Limio. Tên tổ chức được điền sẵn vào tiêu đề và chân trang.
2. **Danh sách "Nạp mẫu"**: mẫu của loại tổ chức đang sửa đứng đầu, nhóm "Mẫu theo loại"; sau đó nhóm "Mẫu dự án" (MICRO4ASIA, HSK 3.0) như hiện nay, mọi tổ chức vẫn thấy (không hồi quy). Mẫu theo loại của loại khác không hiện.
3. **Mặc định khi chưa cấu hình**: space trống (chưa có tên, chưa có chữ nào, chưa có khoá) mở form với mẫu của loại. Space đã có bất kỳ cấu hình nào thì giữ nguyên, **không bao giờ tự ghi đè**. Mẫu chỉ vào DB khi quản trị bấm Lưu.
4. **Đổi loại tổ chức** (Platform Admin) không đụng vào `space` đã lưu. Danh sách mẫu đổi theo loại mới ở lần mở form kế tiếp.
5. **Nạp mẫu khi đã có chữ**: hỏi xác nhận trước khi thay (hiện nạp là thay luôn); quản trị huỷ được và form giữ nguyên.
6. **Quyền**: không đổi. Quản trị tổ chức hoặc Platform Admin sửa; mã (slug) dựng sẵn chỉ Platform Admin dùng; chỉ khoá của chính tổ chức đưa vào được.
7. `getOrganizationSpaceAdminData` trả thêm `kind` của tổ chức (đã kiểm quyền trước, như cũ).

## Tiêu chí chấp nhận

- **AC1.** Given tổ chức loại trung tâm, When quản trị mở "Nạp mẫu", Then thấy "Mẫu theo loại: Trung tâm" rồi "Mẫu dự án: MICRO4ASIA, HSK 3.0"; không thấy mẫu trường thường hay nhà xuất bản. Tương tự cho hai loại còn lại.
- **AC2.** Given tổ chức loại nhà xuất bản chưa cấu hình space, When mở form, Then tiêu đề, giới thiệu, chân trang là chữ của mẫu nhà xuất bản và có tên tổ chức; chưa gì được lưu vào DB cho tới khi bấm Lưu.
- **AC3.** Given space đã có cấu hình (dù chỉ có tên), When mở form, Then giữ nguyên cấu hình, không nạp mẫu.
- **AC4.** Given form đã có chữ, When chọn một mẫu, Then hiện hỏi xác nhận; "Huỷ" giữ nguyên, "Nạp mẫu" mới thay.
- **AC5.** Given Platform Admin đổi tổ chức từ trường thường sang trung tâm, Then `Organization.space` không đổi; lần mở form sau, danh sách mẫu theo loại là của trung tâm.
- **AC6.** Mỗi mẫu theo loại: màu là mã hex hợp lệ và qua `normalizeStored` không mất trường nào; mọi khoá chữ nằm trong `SPACE_EDITABLE_COPY`; có đủ chữ cho từng ngôn ngữ của space; không chứa dấu `{`/`}` còn sót (tên tổ chức đã được điền).
- **AC7.** Chữ của ba mẫu không nhắc tính năng trang space chưa có: không "lịch khai giảng", không ô nhập mã, không nút mua, không tên học viên hay người mua.
- **AC8.** Không có migration; hai mẫu dự án sinh ra đúng nội dung như trước.

## Việc kiểm (viết trước khi code)

- Test hàm thuần: `templatesForKind`, `templateForKind` (AC1, AC6, AC7), đặt ở `apps/web/src/lib/space/__tests__/`.
- Test "space trống" (AC2, AC3): hàm `isBlankSpace(stored)` có test.
- Test lõi: `getOrganizationSpaceAdminData` trả `kind`, người ngoài vẫn `forbidden`.
- Xem trên trình duyệt: ba tổ chức demo (HUST, Trung tâm demo, NXB Demo) mở form, nạp mẫu, Lưu, mở `/s/<mã>`.
- Cập nhật `docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md` (mục Space) cùng lúc.

## Chữ đề xuất của ba mẫu (tiếng Việt, để duyệt)

`{T}` là tên tổ chức, điền lúc dựng mẫu.

| Khoá | Trường thường | Trung tâm | Nhà xuất bản |
|---|---|---|---|
| Tiêu đề (đầu) | Học trực tuyến cùng | Học cùng | Học liệu số của |
| Tiêu đề (nhấn) | {T} | {T} | {T} |
| Giới thiệu | Các khoá học do giảng viên của {T} xây dựng. Đăng ký tài khoản để vào học, làm bài và xem nhận xét của giảng viên. | Các khoá học và lớp của {T}. Chọn khoá phù hợp với trình độ của bạn, đăng ký tài khoản để vào học và theo dõi buổi học của lớp. | Bộ học liệu của {T} trên Limio, gồm bài học, bài tập và nhận xét. Đăng ký tài khoản để bắt đầu học. |
| Dưới "Các khoá học" | Chọn khoá học phù hợp và bắt đầu. | Chọn khoá theo trình độ và mục tiêu của bạn. | Chọn bộ học liệu bạn cần. |
| Chân trang | {T}, xây dựng trên Limio. | {T}, xây dựng trên Limio. | {T}, xuất bản trên Limio. |
| Mô tả khi chia sẻ | Các khoá học trực tuyến của {T} trên Limio. | Khoá học và lớp của {T} trên Limio. | Học liệu số của {T} trên Limio. |

Bản tiếng Anh viết khi làm, theo cùng nội dung.

## Quyết định đã chốt

1. Mẫu dự án (MICRO4ASIA, HSK 3.0) vẫn hiện cho mọi tổ chức, như cũ.
2. Xưng hô với người học trong mẫu trung tâm: "bạn".
3. Mẫu theo loại chỉ thay chữ (khoá, logo, ảnh đang có được giữ; tên và màu chỉ điền khi form chưa có tên); mẫu dự án nạp trọn bộ như trước.

## Ngoài phạm vi (bước 2)

Khối bật tắt và sắp xếp, kiểu hiển thị khoá (lưới, danh sách, bìa sách), khối riêng theo loại (lớp đang mở, ô nhập mã), lưu "đang dùng mẫu", bản nháp và bản đăng.
