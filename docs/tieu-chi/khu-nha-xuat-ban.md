# Khu quản trị nhà xuất bản (tổ chức loại `publisher`)

Phạm vi: quản trị của một tổ chức loại nhà xuất bản tự làm được báo cáo, mã kích hoạt theo lô và hoàn tiền cho khoá của nhà mình, không phải nhờ giảng viên chủ khoá. Chốt 2026-11-27: nhà xuất bản tự quản mã kích hoạt và hoàn tiền; mỗi tổ chức đúng một loại.

## Tiêu chí chấp nhận

1. **Menu.** Quản trị tổ chức loại nhà xuất bản thấy nhóm "Nhà xuất bản" ở `/org-admin` gồm "Báo cáo nhà xuất bản", "Mã kích hoạt", "Đơn hàng và hoàn tiền". Trường thường và trung tâm không có nhóm này; vào thẳng địa chỉ thì được báo "Tổ chức này không phải nhà xuất bản".
2. **Báo cáo.** `/org-admin/bao-cao` là báo cáo hiện có, chỉ gồm các khoá của nhà xuất bản đang chọn; vẫn ẩn danh, nhóm dưới 10 người không hiện tỉ lệ.
3. **Mã kích hoạt.** `/org-admin/ma-kich-hoat`: chọn khoá rồi tạo lô, xuất CSV, thu hồi, tra cứu mã. Khoá phải có giá và ghi danh mở, nếu không thì trang nói rõ lý do.
4. **Quyền.** Quản trị nhà xuất bản gọi được các route `/api/courses/[id]/access-code*` của khoá thuộc nhà mình; khoá của nhà khác, hoặc quản trị trường thường/trung tâm, bị từ chối. Họ **không** sửa được nội dung khoá (`canEditCourse` không đổi).
5. **Đơn hàng ẩn danh.** `/org-admin/don-hang` liệt kê đơn đã trả tiền hoặc đã hoàn của một khoá: mã đơn, số tiền, cổng thanh toán, ngày. Không có tên, email hay id người mua ở bất kỳ phản hồi nào. Tìm đơn bằng mã đơn, đúng mã người mua thấy trong email xác nhận mua (mã của cổng thanh toán nếu có, không thì 8 ký tự đầu của id).
6. **Hoàn tiền thủ công.** "Hoàn tiền" rồi "Xác nhận đã hoàn": đơn → `refunded` (`refundedCents` = số tiền đơn), quyền học đóng theo cùng luật webhook Stripe (giữ quyền nếu còn đơn paid khác hoặc mã kích hoạt đã dùng cho khoá đó), ghi sự kiện `enrollment.refunded` và `AuditLog` `order.refunded_by_publisher` (người thao tác, đơn, khoá). Idempotent; đơn chưa trả tiền không hoàn được; đơn combo chưa hỗ trợ. Hệ thống không chuyển tiền.
7. **Chống vượt quyền.** Route hoàn tiền đối chiếu đơn với khoá trong đường dẫn; quản trị nhà xuất bản khác hoàn đơn không phải của mình nhận "không tìm thấy đơn" và không đổi gì.

## Chưa làm

- Hoàn một phần tiền và hoàn đơn combo.
- Platform Admin chọn tổ chức trước khi vào (phần 4 của kế hoạch menu quản trị).
