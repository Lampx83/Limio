# Banner trang khoá học có thông tin sách và ảnh bìa — Acceptance criteria

> 10/11/2026, **thầy đã duyệt và đã code (xem "Đã làm" ở cuối), chưa commit.** Theo mẫu banner "Active Skills for Reading 3" thầy gửi 10/11/2026. Chỉ đối chiếu rồi chốt qua hỏi đáp: giữ nguyên phần đầu, XP, chuỗi ngày học và chip mức độ; **không** chip kỹ năng; không thêm trường sách nào ngoài nhà xuất bản, tác giả, lần xuất bản; áp cho **mọi khoá**.

## Hiện trạng

- Banner ở `apps/web/src/app/learn/[slug]/page.tsx` (hiển thị cho học viên đã ghi danh): chip mức độ/ngôn ngữ, tên khoá, chip chuỗi ngày học, hai ô "Tiến độ học" + "Điểm tương tác", nút "Tiếp tục: …".
- Bảng `Course` **đã có** `publisher`, `authors`, `edition`, `coverUrl` (dùng cho Thư viện giáo trình, SEO, trang danh mục), nhưng **không có chỗ nào trên giao diện** để nhập chúng: ô nhập từng nằm trong khung "Thư viện giáo trình" của giảng viên, đã gỡ ở đợt gộp menu; `coverUrl` chỉ nhận URL gõ tay (không có nút tải ảnh lên).

## AC1 — Dòng thông tin sách trong banner

- **Given** khoá có ít nhất một trong ba trường nhà xuất bản, tác giả, lần xuất bản. **When** học viên mở trang khoá. **Then** ngay dưới tên khoá có một dòng chữ trắng nhỏ "Nhà xuất bản · Tác giả · Lần xuất bản", trường trống thì bỏ (không có dấu "·" thừa).
- **Given** cả ba trường trống. **Then** không có dòng này và không chừa khoảng trống.

## AC2 — Ảnh bên phải banner

- **Given** khoá có ảnh. **When** màn từ `lg` (1024 px) trở lên. **Then** ảnh nằm ở cột phải, căn giữa theo chiều cao banner, tỉ lệ bìa sách (cao hơn rộng), bo góc nhẹ, có bóng; **phần bên trái giữ nguyên** như hiện tại (chip mức độ, tên khoá, chuỗi ngày học, hai ô tiến độ và XP, nút "Tiếp tục").
- Dưới `lg`: ảnh **ẩn** — lúc đầu duyệt là `sm` (640 px) nhưng ở 640–1023 px cột ảnh ép hai ô tiến độ/XP quá hẹp (chữ xuống từng từ), nên đổi sang `lg` ngày 10/11/2026.
- **Given** khoá không có ảnh. **Then** banner hiện như cũ (không để trống cột phải).
- Ảnh có `alt` rỗng (trang trí, tên khoá đã ở tiêu đề).
- Không thêm chip kỹ năng.

## AC3 — Chỗ nhập thông tin sách và tải ảnh lên (cài đặt khoá)

- Trong form cài đặt khoá của giảng viên (`CourseMetaForm`) có mục **"Thông tin sách (nếu có)"**: ba ô văn bản **Nhà xuất bản**, **Tác giả**, **Lần xuất bản** (cùng giới hạn độ dài và cách cắt khoảng trắng với `core-lms/language/library.ts`; để trống = xoá).
- Cùng mục có ô **"Ảnh bìa / banner"**: nút **Tải ảnh lên** (JPG, PNG, WebP; tối đa 5 MB), xem trước ảnh đã chọn, nút **Đổi ảnh** và **Xoá ảnh**. Sai định dạng hoặc quá cỡ thì báo lỗi bằng tiếng Việt, không lưu gì.
- Ảnh lưu ở tầng `public` của lớp lưu trữ (giống ảnh đại diện), `coverUrl` lưu đường dẫn nội bộ của ảnh đó. Kiểm tra `coverUrl` ở `core-lms` phải chấp nhận đường dẫn này (hiện chỉ chấp nhận URL tuyệt đối).
- Chỉ người có quyền sửa khoá mới tải được (cùng quy tắc với route sửa khoá); học viên và khách bị từ chối.
- Thông tin sách và ảnh dùng chung một nguồn dữ liệu với Thư viện giáo trình, trang danh mục và SEO, nên đổi một chỗ thì các chỗ kia đổi theo.
- Thao tác lưu đi qua cùng đường lưu của form khoá, ghi vào nhật ký hoạt động như các lần sửa khoá hiện có.

## AC4 — Không làm hỏng chỗ khác

- Khoá không có thông tin sách và không có ảnh: trang khoá, danh mục, thư viện giáo trình, SEO đều như trước.
- Xoá ảnh thì `coverUrl` về `null` và file được dọn (không để file mồ côi).
- Banner vẫn đạt quy ước giao diện (§4.6 CLAUDE.md): hai ô tiến độ/XP giữ nguyên cách xếp cũ ở mọi cỡ màn, cột ảnh chỉ thêm từ `lg`; màu và cỡ chữ dùng token có sẵn.

## Kiểm thử

- Hàm dựng dòng thông tin sách: đủ ba trường, thiếu một, thiếu hai, trống cả ba (trả rỗng).
- Banner: có ảnh/không ảnh, có dòng sách/không, ẩn ảnh dưới `lg`.
- Tải ảnh: sai định dạng, quá cỡ, không quyền, thành công; xoá ảnh dọn file.
- Form: lưu ba trường, để trống thì xoá.

## Ngoài phạm vi

ISBN, năm xuất bản, bộ sách; chip kỹ năng; đổi hoặc dời ô XP và chuỗi ngày học; nền gradient và lớp chấm của banner; dùng ảnh làm nền cả banner.

## Đã làm (10/11/2026)

- **Dữ liệu và quyền:** `updateCourse` nhận thêm `publisher`, `authors`, `edition` (cắt khoảng trắng, rỗng = xoá, tối đa 120 ký tự) và `coverUrl` nhận đường dẫn nội bộ `/api/course-covers/<tệp>` hoặc URL http(s) (`isAllowedCoverUrl`, từ chối `javascript:`, `data:`, thoát thư mục). Cùng quyền sửa khoá (đồng giảng viên cũng sửa được, khác với khung Thư viện giáo trình chỉ dành cho chủ khoá). Hằng `COURSE_COVER_PATH_PREFIX` ở `shared-types`.
- **Tải ảnh:** `POST/DELETE /api/instructor/courses/[courseId]/cover` (JPG/PNG/WebP, ≤ 5 MB, lỗi tiếng Việt; thay ảnh hoặc quyền sai thì dọn tệp), phục vụ công khai ở `/api/course-covers/[file]`; tệp ở tầng `public` của lớp lưu trữ, thư mục theo khoá (`lib/courseCover.ts`, `storage-keys.ts`).
- **Form khoá:** mục "Thông tin sách (nếu có)" trong `CourseMetaForm` với ba ô và `CourseCoverUpload` (tải lên/đổi/xoá có hiệu lực ngay, không đợi nút Lưu).
- **Banner:** `components/course/CourseHeroBook.tsx` (`CourseBookLine`, `CourseHeroCover`) gắn vào `learn/[slug]/page.tsx`; ảnh ẩn dưới 1024 px; khoá không có gì thì như cũ.
- **Kiểm thử:** `courseBookInfo.test.ts` (core-lms, 7), `courseCover.test.ts` (5), `CourseHeroBook.test.tsx` (5); toàn bộ web 2525 test và core-lms courses+language 613 test qua; đã xem trên trình duyệt ở 1536 px và 400 px (tải ảnh qua API thật, lưu form, banner có dòng sách + ảnh; điện thoại ẩn ảnh, không tràn ngang).
- **Chưa làm / lưu ý:** banner chế độ xem thử của giảng viên (`?preview=1`) giữ bản đơn giản cũ; bài kiểm tay luồng chọn tệp bằng hộp thoại hệ điều hành (chỉ kiểm bằng gọi API và nút trong form).
- **Chỉnh 10/11/2026 (sau khi xem màn thật):** ảnh chỉ hiện từ `lg`; ở màn dưới `sm` ô "Điểm tương tác" chỉ giữ "Cấp n · Tên cấp", câu "Cần thêm … XP để lên cấp …" ẩn (hiện từ `sm`) cho ô khỏi bị kéo cao.
