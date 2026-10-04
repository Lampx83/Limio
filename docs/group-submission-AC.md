# Nộp bài theo nhóm — tiêu chí chấp nhận

> Duyệt 2026-10-04. Mỗi khoá một bộ nhóm; nộp lại sau khi chấm đưa cả nhóm về chưa chấm; mục "Để sau" giữ nguyên.

**Bối cảnh.** Học phần Thiết kế UI UX có hai bài tập nhóm (giữa kỳ, cuối kỳ), cùng nhóm suốt học kỳ. Hiện Limio chỉ có bài nộp cá nhân: `AssignmentSubmission` là một dòng cho mỗi (bài tập, sinh viên). Nhóm 5 người phải nộp 5 lần cùng một file, giảng viên chấm 5 lần.

**Phạm vi.** Nhóm thuộc về **khoá học**, do **sinh viên tự lập** theo mẫu đội của Tournament: trưởng nhóm tạo nhóm → nhận mã → gửi cho thành viên → thành viên nhập mã. Bài tập có thêm chế độ **nộp theo nhóm**: một người nộp, cả nhóm có bài; giảng viên chấm một lần, chỉnh riêng được từng người.

**Ngoài phạm vi.** Nhiều bộ nhóm khác nhau trong một khoá (mỗi khoá chỉ một bộ nhóm). Nhóm cho quiz/đề thi. Nhóm trong Tournament (giữ nguyên cơ chế riêng).

---

## Quyết định thiết kế

| # | Quyết định | Lý do |
|---|---|---|
| D1 | Mỗi khoá **một bộ nhóm**; mỗi sinh viên **tối đa một nhóm** trong một khoá | Học phần dùng cùng nhóm cho cả hai bài tập; một bộ là đủ và dễ hiểu |
| D2 | Bài nộp nhóm được **chép thành một dòng cho từng thành viên** (cùng nội dung, cùng tệp), kèm `teamId` và người nộp | Mọi chỗ đang đọc bài nộp (trang bài học, việc cần làm, lịch, e-portfolio, xuất điểm) đọc theo từng người — giữ nguyên được, không phải sửa hàng loạt |
| D3 | Thành viên nhóm được **chốt lúc nộp**: ai trong nhóm lúc bấm nộp thì có bài | Đổi nhóm sau đó không làm bài cũ "đi theo" hay "biến mất" một cách khó hiểu |
| D4 | Mỗi thành viên có ô riêng **"Phần việc của tôi"** (trường mới, không dùng lại `reflection`) | `reflection` đang gắn với XP "suy ngẫm sâu"; trộn hai nghĩa sẽ làm sai cả hai |
| D5 | **Không thêm XP mới.** Quy tắc XP hiện có giữ nguyên, tính theo từng người | Không ai nhận XP nhờ người khác bấm nộp (nguyên tắc chống cày XP) |
| D6 | Sự kiện của đường nộp/chấm nhóm ghi **trong cùng transaction** với thay đổi dữ liệu | Đúng nguyên tắc 1 của CLAUDE.md (đường cá nhân hiện chưa làm đúng — không sửa trong phạm vi này) |

---

## A. Lập nhóm (sinh viên)

**A1 — Tạo nhóm.** *Given* sinh viên đã ghi danh khoá học, chưa thuộc nhóm nào, danh sách nhóm chưa khoá. *When* bấm "Tạo nhóm" và nhập tên. *Then* nhóm được tạo, sinh viên là **trưởng nhóm**, hệ thống sinh **mã 6 ký tự** (không dùng 0/O/1/I), hiện nút "Sao chép mã"; ghi sự kiện `course.team.created`.
- Tên nhóm không trùng trong cùng khoá (báo lỗi rõ ràng).

**A2 — Vào nhóm bằng mã.** *Given* sinh viên đã ghi danh, chưa có nhóm. *When* nhập đúng mã. *Then* vào nhóm; ghi `course.team.joined`.
- Mã sai → "Không tìm thấy nhóm với mã này".
- Mã của nhóm thuộc khoá khác → cũng báo không tìm thấy (không lộ nhóm khoá khác).
- Nhóm đã đủ người → "Nhóm đã đủ N người". Kiểm tra số người **trong transaction** (sửa lỗi tranh chấp đang có ở Tournament).

**A3 — Rời nhóm.** *Given* danh sách chưa khoá. *When* thành viên bấm "Rời nhóm" và xác nhận. *Then* rời nhóm; ghi `course.team.left`.
- Trưởng nhóm rời → quyền trưởng nhóm chuyển cho **người vào sớm nhất** còn lại.
- Người cuối cùng rời → nhóm bị xoá **nếu nhóm chưa có bài nộp nào**; nếu đã có bài nộp thì giữ nhóm (rỗng) để lịch sử chấm còn nguyên.

**A4 — Đổi mã.** *When* trưởng nhóm bấm "Đổi mã". *Then* mã cũ hết hiệu lực, mã mới hiện ra. Thành viên đã vào không bị ảnh hưởng.

**A5 — Mời ra khỏi nhóm.** *When* trưởng nhóm gỡ một thành viên (khi chưa khoá). *Then* người đó rời nhóm; ghi `course.team.left` với `removedBy`.

**A6 — Gộp nhóm.** Không có nút riêng: một trưởng nhóm rời nhóm của mình (A3) rồi vào nhóm kia bằng mã (A2). Tài liệu hướng dẫn ghi rõ cách này.

**A7 — Chỗ hiển thị.** Trang khoá học có khối **"Nhóm của tôi"**: tên nhóm, mã (chỉ thành viên thấy), danh sách thành viên, biểu tượng trưởng nhóm, các nút ở A1–A5. Trên thẻ bài tập nhóm, sinh viên chưa có nhóm thấy lời nhắc dẫn tới khối này.

## B. Quản lý nhóm (giảng viên)

**B1 — Cài đặt.** Giảng viên đặt **số người tối đa** mỗi nhóm (để trống = không giới hạn) và bấm **"Khoá danh sách nhóm"** / "Mở khoá". Ghi `course.team.locked` / `course.team.unlocked`.

**B2 — Khi đã khoá.** Sinh viên **không** tạo, vào, rời nhóm hay đổi mã được (nút ẩn, API trả lỗi `teams_locked`). Khối "Nhóm của tôi" ghi "Danh sách nhóm đã khoá — liên hệ giảng viên nếu cần đổi".

**B3 — Tổng quan.** Trang "Nhóm" của khoá: danh sách nhóm (tên, trưởng nhóm, số thành viên / tối đa), và danh sách **sinh viên chưa có nhóm**. Lọc theo lớp (section).

**B4 — Chuyển, gỡ, thêm.** Giảng viên chuyển một sinh viên sang nhóm khác, gỡ khỏi nhóm, thêm sinh viên chưa có nhóm vào một nhóm, đổi trưởng nhóm — **kể cả khi đã khoá**. Ghi sự kiện tương ứng (`course.team.member_moved`, …) và lưu ai thực hiện.

**B5 — Quyền.** Chỉ người sửa được khoá học mới dùng được B1–B4. Sinh viên chỉ thấy nhóm của mình (tên + thành viên), không thấy mã của nhóm khác.

## C. Bài tập nộp theo nhóm

**C1 — Bật chế độ.** Form tạo/sửa bài tập có lựa chọn **"Nộp cá nhân / Nộp theo nhóm"** (mặc định cá nhân).
- Đổi chế độ khi bài tập **đã có bài nộp** → bị chặn, báo lý do.
- Bài tập gắn Tournament không có lựa chọn này.
- Nhân bản khoá / nhân bản bài học giữ nguyên chế độ (sửa cả `duplicateCourse` lẫn `duplicateLesson`).

**C2 — Nộp.** *Given* bài tập nhóm, sinh viên thuộc nhóm X. *When* sinh viên nộp. *Then* trong **một transaction**: mỗi thành viên hiện tại của X có một dòng bài nộp cùng nội dung, cùng tệp, cùng `teamId`, ghi `submittedById`; ghi `assignment.submitted` **cho từng thành viên** (payload có `teamId`, `submittedById`, `teamSubmission: true`).

**C3 — Chưa có nhóm.** Sinh viên chưa có nhóm mở bài tập nhóm → không có form nộp; thấy lời nhắc "Bạn cần vào một nhóm trước khi nộp" (chưa khoá) hoặc "… liên hệ giảng viên" (đã khoá).

**C4 — Trên trang bài học.** Mọi thành viên thấy cùng một bài nộp, kèm dòng **"Nộp lần cuối bởi [tên] lúc [giờ]"**. Ai trong nhóm cũng nộp lại được.

**C5 — Nộp lại.** Nộp lại thay nội dung của **cả nhóm**. Nếu bài đã chấm, form hỏi xác nhận: *"Nộp lại sẽ đưa bài của cả nhóm về trạng thái chưa chấm."* (giữ hành vi hiện có của bài cá nhân, nhưng nói rõ hậu quả cho cả nhóm).

**C6 — "Phần việc của tôi".** Mỗi thành viên tự ghi phần của mình (không bắt buộc, tối đa 1.000 ký tự). Chỉ chính người đó sửa được; sửa ô này **không** đưa bài về chưa chấm. Giảng viên thấy ô của từng người khi chấm.

**C7 — Đổi nhóm sau khi đã nộp** (theo D3).
- Người rời nhóm X giữ dòng bài nộp cũ của mình (lịch sử, điểm nếu đã chấm).
- Người mới vào nhóm X **không** tự có bài nộp cũ của X; lần nộp lại tiếp theo của X sẽ gồm cả người đó.
- Màn hình chấm hiện thành viên **lúc nộp**, đánh dấu ai đã rời / ai mới vào.
- Mỗi học viên chỉ có **một** dòng cho mỗi bài tập. Người đã chuyển sang nhóm Y: khi nhóm Y nộp, dòng của họ được thay bằng bài của Y (bài cũ của X không còn trên dòng đó).
- Chấm nhóm chỉ áp cho các dòng cùng **lần nộp mới nhất** (`teamSubmittedAt`), nên dòng cũ của người đã rời không bị chấm đè.

## D. Chấm bài nhóm

**D1 — Danh sách chấm theo nhóm.** Trang bài nộp của bài tập nhóm liệt kê **mỗi nhóm một dòng** (tên nhóm, thành viên, trạng thái, người nộp, lúc nộp), cộng mục "Sinh viên chưa có nhóm". Bộ đếm "đã nộp / chờ chấm / đã chấm" đếm **theo nhóm**.

**D2 — Chấm một lần.** Giảng viên nhập điểm + nhận xét cho nhóm → áp cho **mọi dòng** của lần nộp đó; ghi `assignment.graded` cho từng thành viên (payload có `teamId`). "Gợi ý điểm bằng AI" chạy **một lần** cho bài nhóm.

**D3 — Chỉnh riêng từng người.** Trong cùng màn hình, giảng viên chỉnh điểm riêng một thành viên (kèm lý do, không bắt buộc). Chấm lại điểm nhóm sau đó **không ghi đè** điểm đã chỉnh riêng; màn hình hiện rõ ai đang có điểm riêng.

**D4 — "Chấm & bài tiếp".** Đi lần lượt theo **nhóm**, bỏ qua nhóm chưa nộp (giống hành vi hiện tại theo người).

## E. Dữ liệu, quyền riêng tư, an toàn

**E1 — Xoá tài khoản.** Xoá tài khoản một thành viên **không xoá tệp** của bài nộp nhóm khi các thành viên khác vẫn còn dùng tệp đó.

**E2 — Xuất dữ liệu cá nhân.** Bản xuất của sinh viên có nhóm đã tham gia (tên nhóm, thời gian vào/rời).

**E3 — Quyền xem.** Sinh viên chỉ xem được bài nộp của nhóm mình. API nộp kiểm tra người nộp đang thuộc nhóm và đã ghi danh khoá.

**E4 — Sự kiện.** Mọi thao tác ở A, B, C, D ghi `LearningEvent` trong cùng transaction với thay đổi dữ liệu, tên theo khuôn `<domain>.<entity>.<verb_past>`.

## F. Kiểm thử bắt buộc

- Tạo nhóm, vào bằng mã, mã sai, nhóm đầy (kể cả hai người vào cùng lúc), rời nhóm, chuyển trưởng nhóm, xoá nhóm rỗng chưa có bài / giữ nhóm rỗng đã có bài.
- Khoá danh sách chặn mọi thao tác của sinh viên; giảng viên vẫn chuyển được.
- Nộp nhóm tạo đúng N dòng + N sự kiện trong một transaction; nộp lại thay cả nhóm; người mới vào không nhận bài cũ.
- Chấm nhóm áp cho mọi dòng; điểm chỉnh riêng không bị ghi đè khi chấm lại.
- Bài tập cá nhân **không đổi hành vi** (toàn bộ test hiện có vẫn qua).
- Xoá tài khoản một thành viên không làm mất tệp của thành viên khác.

## Để sau (P1)

Đếm "chờ chấm" theo nhóm ở các chỗ ngoài trang bài nộp (bảng điều khiển giảng viên, thông báo, lịch, KPI trang Bài tập) — trong P0 các chỗ này vẫn đếm theo người. Cột "Nhóm" trong các bản xuất điểm.
