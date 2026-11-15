# Giảng viên ảo theo từng khoá — tiêu chí nghiệm thu

Ngày soạn: 15/11/2026. Lý do: giảng viên ảo trước đây chỉ chọn được cho cả hệ thống (`virtual_lecturer.default_lecturer`), nên khoá có lời giảng xưng "cô Bảo Trang" vẫn hiện chân dung "Tiến Đạt". Thầy đã chốt (15/11/2026): thêm cột riêng cho từng khoá, không đổi mặc định hệ thống vì sẽ kéo theo giọng của các bài Toán 10.

## Phạm vi

- Thêm `Course.virtualLecturerCode` (chuỗi, cho phép null). `null` = theo mặc định hệ thống. Giá trị là mã trong danh mục cố định `VIRTUAL_LECTURERS`, không phải khoá ngoại.
- Chỉ admin nền tảng đặt được, ở cùng chỗ đã đặt «Giảng viên ảo» (mức hiệu lực) của khoá trong `/admin/courses`.
- Không đổi mức hiệu lực (Bắt buộc/Hiện/Em tự bật/Không hiện) và không đổi cách chọn mặc định hệ thống.

## Tiêu chí (Given – When – Then)

**AC1 — Chọn người cho khoá**
- Given admin mở `/admin/courses`, When bấm ô «Người giảng» của một khoá, Then thấy mục «Theo mặc định hệ thống» và đủ 8 giảng viên ảo (tên + nam/nữ), đang chọn đúng giá trị của khoá.
- Given admin chọn một người, When lưu, Then `Course.virtualLecturerCode` đổi, các khoá khác không đổi, và có một dòng AuditLog `course.virtual_lecturer_code.changed` mang `courseId`, giá trị cũ và mới (không mang gì khác).
- Given chọn lại giá trị đang có, Then không ghi gì và không có AuditLog.
- Given người không phải admin gọi API, Then 403 và dữ liệu không đổi.
- Given gửi mã không có trong danh mục, Then 400 `validation_failed` và dữ liệu không đổi.

**AC2 — Hiệu lực khi học viên xem**
- Given khoá có `virtualLecturerCode`, When học viên mở bài có Nghe giảng, Then chân dung và tên là người của khoá, bất kể mặc định hệ thống.
- Given khoá để `null`, Then dùng mặc định hệ thống như trước.
- Given mã trong cột không còn có trong danh mục (sau này bỏ một người), Then rơi về mặc định hệ thống, không báo lỗi và không làm hỏng trang bài.
- Given hệ thống tắt giảng viên ảo hoặc mức hiệu lực là «Không hiện», Then vẫn không hiện gì (cột mới không làm hiện ra thứ đang bị chặn).
- Trang học và API cùng đọc qua `getEffectiveVirtualLecturer`, không tự đọc cột.

**AC3 — Không phá dữ liệu cũ**
- Migration chỉ thêm một cột cho phép null, không điền sẵn giá trị; mọi khoá hiện có giữ hành vi cũ.

## Ngoài phạm vi (ghi lại để không hứa nhầm)

- Giọng đọc (voice) của vai «Giảng viên (Nghe giảng)» vẫn chọn ở «Giọng đọc» của khoá như cũ; cột này chỉ quyết định chân dung và tên hiển thị. Muốn nghe đúng giọng Bảo Trang thì chọn đúng giọng ở đó.
- Không cho giảng viên (không phải admin) tự đổi người giảng của khoá mình.
- Không thêm người mới vào danh mục.
