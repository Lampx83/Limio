# Hoàn thành bài tính theo Bài luyện — Acceptance criteria

> 14/11/2026, **bản đề xuất, chờ thầy duyệt, chưa code.** Thầy chốt mức chặt: bài có Bài luyện chỉ "Đã xong" khi học viên đã **bấm Kiểm tra mọi câu** của các khối luyện trong bài.

## Hiện trạng (đã đối chiếu mã)

- "Đã xong" ở thanh bài và con số "n / 22 bài hoàn thành" đọc sự kiện `lesson.completed` (`learning/progress.ts`). Sự kiện do `POST /api/lessons/{id}/complete` phát ra, mỗi (học viên, bài) một lần.
- Điều kiện phát sự kiện nằm ở `LessonCompletionPrompt` và cấu hình dựng trong `learn/[slug]/lessons/[lessonId]/page.tsx`: có khối Video riêng thì xem đủ ngưỡng; có quiz/bài tập nộp thì nộp hết; không có gì khác thì **chỉ cần cuộn tới cuối trang**; bài slide thì nghe đủ ngưỡng.
- **Bài luyện (khối `exam_practice`) không tính vào điều kiện nào.** Bài chỉ có phiếu luyện thành "Đã xong" khi học viên cuộn hết trang, kể cả khi chưa làm câu nào.
- Mỗi lần "Kiểm tra" một câu của Bài luyện, máy chủ ghi `ExamPracticeAnswer.checkedAt` (cả câu tự luận có nhận xét AI: nếu AI lỗi hoặc hết hạn mức thì vẫn ghi `checkedAt`, chỉ không có nội dung nhận xét).

## AC1 — Câu "đã kiểm tra" và bài "xong"

- **Given** một bài có ít nhất một khối Bài luyện hiện cho học viên (khối không ẩn, đề ẩn có ≥ 1 câu), **When** học viên chưa kiểm tra hết các câu của các khối đó, **Then** bài chưa xong, kể cả khi đã cuộn tới cuối trang.
- **Given** học viên đã bấm "Kiểm tra" (hoặc "Nhận xét bằng AI" với câu nói tự do và đóng vai) cho **mọi câu** của **mọi khối luyện hiện** trong bài, và các điều kiện sẵn có khác của bài (quiz, bài tập, video) đã đủ, **Then** bài tự xong (sự kiện `lesson.completed`, lý do `all_activities_completed`, cộng XP như hiện nay).
- Một câu được tính "đã kiểm tra" nếu trong **bất kỳ buổi luyện nào** của học viên cho đề đó có đáp án với `checkedAt` khác rỗng. Làm lại, bỏ buổi hoặc kết thúc buổi không làm câu mất trạng thái đã kiểm tra.
- Số câu tính theo **từng câu** của đề ẩn (kể cả câu trong phiếu đứng riêng như bạn ảo, đóng vai, tự luận).
- **"Kết thúc bài luyện" không thay cho Kiểm tra**: bấm kết thúc mà còn câu chưa kiểm tra thì bài vẫn chưa xong.

## AC2 — Điều kiện cuộn hết trang

- **Given** bài có khối Bài luyện hiện cho học viên, **Then** điều kiện "cuộn tới cuối trang" **không còn áp dụng** cho bài đó (Bài luyện thay cho nó, như quiz và bài tập nộp đang làm). Bài không có Bài luyện giữ nguyên quy tắc cuộn như cũ.
- Khối luyện ẩn, khối chưa có câu nào, và xem như học viên của giảng viên (`?preview=1`) **không** được tính và không ghi nhận gì.

## AC3 — Hiển thị cho học viên

- Dải "Để hoàn thành bài" thêm một mục **"Bài luyện n / m"** (n câu đã kiểm tra trên tổng m câu) khi bài có Bài luyện. Khi đủ thì mục có dấu hoàn thành như các mục khác.
- Thanh phần trăm của bài gộp thêm tỉ lệ n/m theo cách đã gộp video và hoạt động (trung bình các điều kiện áp dụng).
- Bấm "Kiểm tra" thành công thì trang cập nhật lại số n/m **không tải lại cả trang đang làm dở** (chỉ làm mới phần dữ liệu máy chủ); khi câu cuối được kiểm tra, bài tự hoàn thành như hiện nay (hiện "Hoàn thành bài học!" rồi tải lại).
- Chuỗi giao diện thêm vào cả bản vi và en (`learn.completion.practice`).

- **Ngoài phạm vi (thầy quyết 14/11):** thanh bài bên trái **không** hiện phần trăm của bài dở dang; nó vẫn chỉ có dấu xong / chưa và số phút.

## AC4 — Không làm hỏng dữ liệu đang có

- Bài **đã** có sự kiện `lesson.completed` giữ nguyên là xong, không bị rút lại; số "n / 22" không giảm sau khi đổi quy tắc.
- Giảng viên thêm câu vào đề ẩn sau khi học viên đã xong bài: bài đó vẫn xong. Học viên chưa xong thì phải kiểm tra cả câu mới.
- Chỉ tính cho học viên đã ghi danh và đang dùng khung bài học; giảng viên đứng lớp, chiếu lớp và người chưa ghi danh không bị đổi hành vi.

## AC5 — Quyền riêng tư, dữ liệu, sự kiện

- Chỉ đọc dữ liệu luyện của chính học viên; không thêm bảng, không thêm loại sự kiện (dùng lại `lesson.completed`, lý do `all_activities_completed`). `LearningEvent` vẫn append-only.
- Không ghi thêm gì vào nội dung bài hay đề của giảng viên.

## AC6 — Tài liệu

- Nếu hướng dẫn trợ lý Lily hoặc `GIAO-DIEN.md` có nói cách bài hoàn thành thì cập nhật cho đúng (hiện tìm trong `teacherAssistantGuide.ts` và `GIAO-DIEN.md` chưa thấy chỗ nào nói; nếu chưa có thì thêm một dòng cho giảng viên biết Bài luyện giờ tính vào hoàn thành bài).

## Kiểm thử

- Hàm thuần "đếm câu đã kiểm tra theo khối": không có khối, khối ẩn, khối không câu, một phần, đủ, nhiều khối, nhiều buổi luyện, buổi bỏ dở.
- Cấu hình hoàn thành của bài: bài có Bài luyện thì bỏ điều kiện cuộn; có thêm quiz thì cả hai phải đủ; bài không có Bài luyện giữ nguyên (không hồi quy).
- Trang bài: chưa kiểm tra hết thì không gọi `/complete`; đủ thì gọi một lần với lý do `all_activities_completed`.
- Xem trên trình duyệt ở bài 1.1 Reading (3 khối luyện), 400 px và 1280 px.

## Câu cần thầy chốt

1. **Câu nói với bạn ảo / đóng vai cũng phải kiểm tra?** Đề xuất: **có** (đúng nghĩa "mọi câu"). Hệ quả: học viên không có micro hay chỉ muốn gõ vẫn làm được (gõ và nhận xét); cần ít nhất 2 lượt của học viên mới bấm được.
2. **Khoá demo đã có học viên đang học?** Quy tắc mới chỉ áp cho bài chưa xong; bài đã xong không đổi (AC4). Nếu muốn tính lại cho cả bài đã xong thì phải làm riêng và thầy quyết.
