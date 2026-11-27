# Giáo viên theo loại tổ chức

Chốt 2026-11-27: loại tổ chức (`Organization.kind`: trường thường, trung tâm, nhà xuất bản) quyết định giáo viên của tổ chức đó thấy tính năng nào. Trước đó tính năng trung tâm bật theo cờ riêng của từng tài khoản, vai `center_teacher` và bản ghi lớp có lịch, nên giáo viên cùng loại tổ chức thấy khác nhau.

## Quy tắc

| Loại tổ chức | Giáo viên thấy |
|---|---|
| Trường thường | Phần giảng viên chuẩn: soạn khoá, chấm bài, thi cử, lớp. Không có lịch dạy, điểm danh, giáo trình dựng sẵn |
| Trung tâm | Chuẩn, thêm: Lịch dạy, Giáo trình, bảng điều phối của mình, bắt đầu/kết thúc buổi, điểm danh, nhận xét sau buổi |
| Nhà xuất bản | Chuẩn, thêm khối "Mã kích hoạt" ở khoá có giá. Việc bán hàng, hoàn tiền, báo cáo gộp do quản trị nhà xuất bản làm |

## Tiêu chí chấp nhận

1. **Theo người** (menu, trang Lịch dạy/Giáo trình/Đối chiếu): giáo viên thấy tính năng trung tâm khi thuộc tổ chức loại trung tâm, hoặc đang dạy một khoá của trung tâm, hoặc là quản trị của một trung tâm. Thuộc trường thường hay nhà xuất bản thì không.
2. **Theo khoá** (tab Lịch dạy và Chuyên cần ở trang lớp, tóm tắt lịch trên thẻ lớp): chỉ khi khoá thuộc tổ chức loại trung tâm. Một giáo viên dạy ở hai loại tổ chức thấy tab đúng theo từng khoá.
3. **Giữ lối vào dữ liệu đã có:** khoá đã có lớp đặt lịch luôn hiện phần lịch, dù tổ chức sở hữu là loại gì; giáo viên của khoá đó luôn thấy mục menu trung tâm.
4. **Đã bỏ:** cờ riêng `center.access` cho từng tài khoản; vai `center_teacher` đứng một mình không còn bật tính năng.
5. **Vai "Giảng viên trung tâm (chỉ dạy)"** chỉ cấp được cho thành viên của tổ chức loại trung tâm (cấp ở loại khác trả `validation_failed`); công tắc chỉ hiện ở trang thành viên của trung tâm. Thu hồi vai đã có thì vẫn làm được ở mọi loại.
6. Đổi loại tổ chức không xoá dữ liệu nào: chỉ giao diện ẩn hoặc hiện.

## Ghi chú

- Trang `/instructor/dieu-phoi` vẫn theo tổ chức của khoá đầu tiên mà giáo viên quản lý (chưa chọn tổ chức khi có nhiều nơi).
- Gói tài khoản (`goi-tai-khoan.md`, AC2b) từng dự kiến chặn tính năng trung tâm theo `center.access` của gói; mã chưa có đường này nên việc bỏ cờ không đổi hành vi hiện tại. Nếu làm AC2b, gắn điều kiện gói vào `isCenterEnabledForUser` và `isCenterCourse`.
- Chưa làm: kiểm giáo viên Platform Admin đổi tổ chức khi đã gắn khoá (phần 4 của kế hoạch quản trị).

## Giảng viên trung tâm (chỉ dạy), chốt thêm 2026-11-27

6. Menu của vai `center_teacher` chỉ còn **Lịch dạy, Điều phối lịch, Giáo trình** (cộng "Giám sát phòng thi" nếu được xếp coi thi). Điểm danh và nhận xét sau buổi làm từ Lịch dạy và trang buổi, không có mục riêng. Bỏ "Assignment" và "Forum Q&A" khỏi menu này.
7. "Điều phối lịch" của người chỉ dạy (`getOrgBoard`, `getOrgClassTimeline`) chỉ trả buổi có họ là giáo viên dự kiến (hoặc buổi chưa gán và họ phụ trách lớp) và lớp họ phụ trách hoặc dạy ít nhất một buổi; `canManage` luôn sai nên không dẫn tới trang sửa. Tổ chức khác vẫn bị từ chối.
8. Giảng viên thường của một trung tâm giữ nguyên menu đầy đủ (chuẩn + các mục trung tâm); chỉ vai `center_teacher` bị rút gọn.
