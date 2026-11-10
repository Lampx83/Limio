# Bài luyện: nút "Kiểm tra tất cả" — Acceptance criteria

> 10/11/2026, **bản đề xuất, chờ thầy duyệt, chưa code.** Thầy yêu cầu: ngoài nút "Kiểm tra câu n" ở từng câu, có thêm nút **"Kiểm tra tất cả"** ở cuối cùng.

## Hiện trạng

- Trong Bài luyện (`LessonPractice`), mỗi câu có nút "Kiểm tra câu n" (chỉ bật khi đã trả lời); bấm thì chấm câu đó, hiện đúng/sai, giải thích và đáp án. Sửa đáp án thì kết quả câu đó mất, phải kiểm tra lại.
- Bài chia thành các bước (mỗi đoạn văn kèm các câu của nó là một bước; câu ngoài đoạn gộp thành bước riêng). Nút "Kết thúc bài luyện" ở cuối, nằm ngoài các câu.
- Kiểm tra một câu ghi sự kiện học (`exam.practice.answered`) và, ở khoá bật cá nhân hoá, tính vào nhãn kỹ năng; đây là lần kiểm tra đầu của câu.

## AC1 — Nút "Kiểm tra tất cả"

- **Given** Bài luyện có bật "Kiểm tra từng câu" (`checkEnabled`). **Then** ở cuối khu câu hỏi hiện nút **"Kiểm tra tất cả"** (cạnh/ngay trên "Kết thúc bài luyện" khi ở bước cuối; xem câu hỏi 1 bên dưới). Đề không bật kiểm tra từng câu thì không có nút (như nút từng câu).
- **When** bấm. **Then** hệ thống kiểm tra **mọi câu đã trả lời mà chưa kiểm tra (hoặc đã sửa đáp án sau lần kiểm tra)**, lần lượt như bấm từng nút; câu đã kiểm tra và chưa đổi đáp án thì bỏ qua (không ghi thêm sự kiện, không tính lần nữa). Kết quả từng câu hiện đúng như khi bấm riêng (đúng/sai, giải thích, đáp án).
- Câu **chưa trả lời** không bị kiểm tra và không bị coi là sai ở bước này; sau khi chạy hiện dòng "Còn n câu chưa trả lời" kèm nút nhảy tới câu đầu tiên còn trống.
- Câu tự luận (không chấm tự động) giữ nguyên cách hiện cũ ("không kiểm tra tự động được").
- Nút hiện "Đang kiểm tra… (k/n)" khi đang chạy, khoá nút từng câu trong lúc đó; lỗi một câu không dừng cả loạt: các câu còn lại vẫn được kiểm tra, cuối cùng báo "Không kiểm tra được n câu, bấm lại để thử".
- Nút tắt khi chưa có câu nào cần kiểm tra (tất cả đã kiểm tra hoặc chưa trả lời câu nào), kèm dòng giải thích ngắn.

## AC2 — Không đổi cách tính

- Mỗi câu vẫn chỉ ghi nhận lần kiểm tra đầu cho nhãn kỹ năng; "Kiểm tra tất cả" không tạo thêm sự kiện nào ngoài những gì bấm từng câu sẽ tạo (cùng `eventKey`, nên bấm hai lần không nhân đôi).
- Xem thử của giảng viên: "Kiểm tra tất cả" cũng chạy ở chế độ xem thử (không lưu, không ghi sự kiện).
- Kết quả cuối buổi ("Kết thúc bài luyện") không đổi.

## AC3 — Giao diện

- Dùng nút `btn-primary` cỡ như "Kết thúc bài luyện"; trên điện thoại nút rộng cả hàng, không tràn ngang ở 400 px.
- Nếu có nhiều bước (nhiều đoạn văn), bấm ở bước nào chỉ kiểm tra các câu **của bước đó** hay **của cả bài**? Xem câu hỏi 1.

## Kiểm thử

- Hàm chọn các câu cần kiểm tra (đã trả lời, chưa kiểm tra hoặc đã đổi đáp án; bỏ câu trống và câu đã kiểm tra).
- Bấm một lần kiểm tra đúng các câu cần; bấm lần hai không gọi lại; một câu lỗi không dừng loạt; trạng thái "k/n"; xem thử không gọi route lưu.
- Xem trên trình duyệt ở 400 và 1280 px.

## Câu cần thầy chốt

1. **Phạm vi của nút:** (a) đặt ở **cuối bước đang xem** và chỉ kiểm tra các câu của bước đó (đề xuất, vì học viên chỉ thấy câu của bước đang xem); hay (b) đặt ở **cuối bước cuối cùng** và kiểm tra **cả bài**?
2. Sau khi kiểm tra tất cả, có **tự mở phần "Xem đáp án"** của các câu sai (như hiện nay, câu sai mở sẵn) — đề xuất giữ nguyên, không đổi.
