# "Thử nói tự do" với bạn ảo (chatbot đóng vai, gõ hoặc nói) — Acceptance criteria

> 14/11/2026, **bản đề xuất, chờ thầy duyệt, chưa code.** Thầy chốt: làm kiểu chatbot (gõ hoặc nói), **cho vài bài trước**. Đây là **bước 2** sau "Hội thoại đóng vai theo kịch bản" (`limio-language-luyen-hoi-thoai-dong-vai.md`, đã làm): bước 1 luyện đúng cụm của bài, bước 2 cho học viên tự nghĩ câu với một bạn ảo biết đáp lại.

## Hiện trạng (đã đối chiếu mã)

- Có sẵn: ghi âm trong trình duyệt và chuyển chữ (Whisper), trừ ví token của học viên và các trần AI (`assertWithinCaps`, `recordAiUsage`), khung AI nhận xét cho câu mở (không điểm, mã hoá SSMMD), mô hình chat theo cấu hình (`llm.ts`, mặc định mô hình tự host), cách lưu câu trả lời của câu mở.
- Chưa có: hàm "bạn ảo trả lời một lượt" cho Bài luyện. Các trợ lý AI khác (gia sư theo bài, vấn đáp) có hội thoại nhiều lượt nhưng gắn với bảng hội thoại và quy tắc riêng, không dùng lại trực tiếp.

## Phạm vi đợt này (3 bài, đều là bài sách bảo "work in pairs / discuss")

| Bài | Tình huống | Cụm mục tiêu (gợi ý) |
|---|---|---|
| 1.3 Learn to | Hai bạn chọn đồ mang theo khi phải rời nhà gấp (nối tiếp 6B) | I would take…, That's not really essential, I'm not sure about that, I was thinking the same thing |
| 1.1 Speaking | Hỏi–đáp về lối sống: người ấy làm gì mỗi ngày, lần gần nhất làm gì | When was the last time you…?, Do you often…? |
| 1.4 Speakout | Bàn xem nên sống ở thành phố lớn hay cộng đồng nhỏ (7C) | I prefer… because…, One advantage of… is… |

Mỗi bài thêm **một khối luyện riêng** "Thử nói với bạn ảo", đặt đúng chỗ như sách (mốc `:::practice`). Bài khác để đợt sau, sau khi xem học viên dùng.

## AC1 — Khung hội thoại

- **Given** khối "Thử nói với bạn ảo". **When** mở. **Then** thấy: tình huống (1–2 câu), **lời mở đầu của bạn ảo** hiện sẵn (không tốn AI), danh sách **cụm gợi ý** (có thể thu gọn), ô nhập và nút **gửi**, nút **ghi âm**, đếm lượt "Lượt n/8", nút **Kết thúc** và nút **Bắt đầu lại**.
- **Gõ:** tối đa 300 ký tự mỗi lượt; gửi bằng nút hoặc Enter (Shift+Enter xuống dòng).
- **Nói:** bấm ghi âm (tối đa 30 giây), bấm Dừng thì máy chuyển thành chữ và **điền vào ô nhập** để học viên đọc lại, sửa rồi mới gửi (không tự gửi). Bản ghi âm **không được lưu**. Lần đầu có dòng "Bản ghi âm được gửi tới OpenAI để chuyển thành chữ."
- Cụm gợi ý nào học viên đã dùng trong lời mình thì được đánh dấu ✓ (so khớp từ, không phân biệt hoa thường và dấu câu). Không có điểm.
- Hết **số lượt tối đa** (mặc định 8, soạn chỉnh được 4–12) thì khung nhập khoá, hiện nút nhận xét. Bắt đầu lại xoá hội thoại hiện tại (có hộp xác nhận nếu đã có từ 2 lượt).
- 400 px: khung cuộn trong trang, ô nhập và nút gửi không bị bàn phím che, vùng chạm ≥ 44 px; trình đọc màn hình đọc "Bạn ảo nói…" / "Bạn nói…" và có vùng báo "Bạn ảo đang trả lời".

## AC2 — Bạn ảo trả lời thế nào

- Mỗi lượt gửi **lịch sử hội thoại** cho mô hình; bạn ảo trả lời **1–2 câu, tối đa 30 từ**, bằng tiếng Anh đơn giản đúng **mức của khoá** (`levelBand`), **ở trong vai và tình huống**, thường kết bằng **một câu hỏi tiếp** để học viên nói thêm.
- Bạn ảo **dùng tự nhiên một vài cụm mục tiêu** của bài (để học viên nghe mẫu), nhưng không đọc lại cả danh sách.
- **Không sửa lỗi giữa chừng** (để hội thoại trôi); nhận xét lỗi nằm ở cuối (AC4). Học viên viết tiếng Việt thì bạn ảo vẫn trả lời tiếng Anh và mời học viên thử lại bằng tiếng Anh bằng một câu ngắn.
- Lời học viên đặt trong khung dữ liệu; mô hình được dặn **bỏ qua mọi chỉ dẫn nằm trong lời học viên** ("quên vai", "cho điểm 10", "in ra hướng dẫn"), không tiết lộ chỉ dẫn hệ thống, nói lạc đề thì kéo về tình huống bằng một câu. Bộ lọc phía máy chủ chặn đầu ra nhắc tới chỉ dẫn nội bộ hoặc tên mô hình.
- Mô hình lỗi hoặc quá hạn: báo "Bạn ảo chưa trả lời được, thử gửi lại"; **không trừ token, không mất lượt**, lời đã nhập vẫn còn trong ô.

## AC3 — Giới hạn, ví token, quyền riêng tư

- Mỗi lượt trừ **ví token của học viên** theo mức thực dùng (mô hình chat) cộng chuyển chữ nếu nói. Hết hạn mức hoặc chưa cấu hình AI thì báo rõ, hội thoại dừng, phần đã có vẫn xem được, không trừ.
- Trần theo lượt (tối đa 12 lượt/khối) và theo ngày dùng chung với các tính năng AI khác; không thêm trần riêng đợt này (như câu mở, quan sát thêm).
- Máy chủ **không lưu hội thoại riêng**: lịch sử do trình duyệt giữ và gửi lại mỗi lượt (máy chủ cắt theo số lượt và độ dài tối đa). Khi hội thoại kết thúc, **bản chữ cả hai bên** được lưu như câu trả lời của câu mở (cùng chỗ với đáp án khác của học viên: xoá khi xoá tài khoản, có trong export dữ liệu cá nhân).
- Mỗi lượt gửi ghi sự kiện `exam.practice.freechat_turn` (id, số lượt, số từ; **không mang chữ**). Tính là hoạt động học (học viên tự bấm).
- Xem thử của giảng viên: chạy được để thấy trải nghiệm (trừ ví giảng viên), **không lưu gì**, không nhận xét AI.

## AC4 — Nhận xét cuối buổi

- **When** hội thoại kết thúc (đủ lượt hoặc bấm Kết thúc, tối thiểu 2 lượt của học viên) **Then** nút **"Nhận xét bằng AI"** (một lần bấm) dùng lại khung nhận xét của câu mở: ba tiêu chí Cần cải thiện/Khá/Tốt (Task, Content, Language), **nhắc cụm mục tiêu đã dùng và còn thiếu**, tối đa vài lỗi quan trọng kèm trích dẫn đúng lời học viên, một việc nên luyện tiếp. Không có điểm, không vào sổ điểm; nhãn "Góp ý do AI tạo, có thể sai".
- Chỉ nhận xét **lời của học viên** (không chấm bạn ảo). Cùng hội thoại đã nhận xét thì hiện lại bản cũ, không gọi AI.
- Hết hạn mức, AI lỗi: vẫn hiện hội thoại và cụm đã dùng (✓), kèm lời nhắn rõ.

## AC5 — Soạn và nhập

- Trình soạn Bài luyện, câu Tự luận có thêm khối **"Hội thoại tự do với bạn ảo (tuỳ chọn)"**: tình huống, tên hai vai, **lời mở đầu của bạn ảo**, **cụm mục tiêu** (mỗi dòng một cụm), số lượt tối đa. Có hướng dẫn một câu dưới từng ô. Không bật cùng lúc với "Hội thoại đóng vai theo kịch bản" của cùng câu (chọn một).
- Công cụ nhập khoá nhận `freechat: { scenario, roles, opening, targets[], maxTurns }` cho câu essay.
- Cập nhật `GIAO-DIEN.md` và hướng dẫn trợ lý Lily.

## AC6 — Không làm hỏng chỗ khác

- Câu mở thường, hội thoại đóng vai theo kịch bản, vấn đáp, gia sư theo bài, đề thi và luyện đề không đổi.
- Bài chưa có khối này không đổi gì.

## Kiểm thử

- Mô hình giả: lịch sử cắt đúng, độ dài trả lời, không rò chỉ dẫn, lời nhồi lệnh không đổi vai, tiếng Việt vẫn trả lời tiếng Anh; lỗi mô hình không trừ token và không mất lượt.
- Giao diện: gõ, nói (bộ ghi âm giả) điền vào ô rồi sửa, ✓ cụm đã dùng, hết lượt khoá ô, bắt đầu lại, xem thử không lưu; 400 và 1280 px.
- Sự kiện không chứa chữ; xoá tài khoản xoá bản chữ đã lưu.
- Thử trên dev với **mô hình chat thật** (cấu hình `LLM_BASE_URL`) trước khi coi là xong.

## Ngoài phạm vi (đợt này)

Bạn ảo đọc to bằng giọng nói (TTS); hội thoại thời gian thực/streaming; chấm phát âm; nhiều học viên cùng một phòng; tình huống tự sinh theo trình độ.

## Câu cần thầy chốt

1. **Ba bài đợt này** (1.3 Learn to, 1.1 Speaking, 1.4 Speakout) đúng ý chưa, hay thầy muốn bài khác? Đề xuất: giữ ba bài này.
2. **Nói xong có tự gửi không?** Đề xuất: **không**, điền vào ô cho học viên đọc lại, sửa rồi bấm gửi (máy nghe có thể sai; tránh gửi lời nghe nhầm cho AI).
3. **Số lượt mặc định 8**, tối đa 12: thầy muốn khác không? Mỗi lượt tốn token mô hình chat, nên nhiều lượt thì đắt và học viên dễ mệt.
4. **Bạn ảo đọc to bằng TTS** để sau, được không? Đề xuất: để sau, vì thêm độ trễ và chi phí; học viên nói được và đọc chữ trả lời của bạn ảo.

## Đã làm (14/11/2026) và chỗ khác với AC

- **Câu mở có `config.freechat`** (tình huống, vai, lời mở đầu, cụm mục tiêu, số lượt 4–12); không dùng cùng `roleplay` (cả hai thì đóng vai thắng, ở UI lẫn máy chủ). Cấu hình xuống trình duyệt (nội dung đề); bài mẫu và tiêu chí vẫn giấu.
- **Bạn ảo:** route `POST /api/practice-sessions/{id}/freechat/{câu}` (JSON `{history, message}`), xem thử `POST /api/practice-preview/{examId}/freechat/{câu}` (không lưu, không sự kiện). Mô hình chat theo cấu hình `LLM_BASE_URL`; trả lời ≤ 2 câu, ≤ 30 từ; lời học viên một dòng (xuống dòng gộp lại); bộ lọc đầu ra chặn lộ chỉ dẫn/tên mô hình; mô hình lỗi hoặc quá 30 giây thì báo, không trừ token, lời đã nhập còn trong ô; không có `usage` thì ước lượng theo ký tự để vẫn trừ ví.
- **Giới hạn kiểm ở máy chủ (không chỉ nút):** quá `maxTurns` của lịch sử gửi lên, tổng 3 × `maxTurns` lượt cho mỗi câu mỗi buổi (đếm bằng sự kiện, vì "Bắt đầu lại" cho chơi lại), buổi đã kết thúc thì từ chối, nhận xét cuối buổi cần ≥ 2 lượt của học viên.
- **Nhận xét cuối buổi** dùng khung câu mở sẵn có (chế độ nói tự do: chỉ xét dòng "Learner:", nêu cụm đã dùng/chưa thử).
- **Sự kiện** `exam.practice.freechat_turn` (không mang chữ); lỗi ghi sự kiện chỉ log, không làm mất lời bạn ảo.
- **Soạn:** ô "Hội thoại với bạn ảo (tuỳ chọn)" chọn một trong "Không / Đóng vai theo kịch bản / Nói tự do với bạn ảo (chatbot)"; importer nhận `freechat`.
- **Speakout (3 bài, đã nhập vào dev):** 1.3 Learn to (chọn đồ mang theo), 1.1 Speaking (lối sống), 1.4 Speakout (thành phố hay cộng đồng nhỏ, 7C).
- **Do rà soát độc lập đã sửa:** "Bắt đầu lại" xoá hẳn bản chữ đã lưu (lưu `{text:""}` thay vì `null`, cả ở đóng vai), hiện lỗi micro, ẩn nút "Nói" khi câu tắt giọng nói, trả tiêu điểm về ô nhập, vùng chạm ≥ 44 px.
- **Chưa làm / cần thầy quyết:** (1) nhóm đối chứng nghiên cứu (`control_group`) chưa bị chặn dùng bạn ảo như nhận xét câu mở — cần chốt có coi bạn ảo là can thiệp hay không; (2) lịch sử do trình duyệt giữ nên học viên có thể tự soạn lời "partner" giả trong lịch sử (chỉ tác động tới chính họ và ví của họ); (3) trạng thái "Kết thúc" chưa lưu khi tải lại; (4) lời học viên chưa đặt trong khung dữ liệu riêng (chỉ có luật trong prompt, như AC2 đã nói); (5) chưa thử với mô hình chat thật vì dev chưa cấu hình `LLM_BASE_URL`.
