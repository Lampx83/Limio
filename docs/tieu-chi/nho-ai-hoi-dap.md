# Tiêu chí: trình sửa slide gọn hơn và hỏi đáp với AI trong tab Nhờ AI

Bản mẫu: `docs/mockup/nho-ai-hoi-dap.html` (chờ duyệt). Hai yêu cầu của người dùng làm chung một đợt:
"Có thể để người dùng hỏi đáp và AI trả lời trước khi tiến hành một sửa chữa gì đó?" và "Tối ưu lại không gian sửa slide này nhé".

## Bố cục trình sửa slide

- **K1.** *Given* màn rộng (từ `lg`), *when* mở trình sửa một slide, *then* bản xem trước là phần chính bên trái: lớn, chiếm phần còn lại của chiều ngang, co vừa chiều cao màn hình và đứng yên khi cuộn bảng sửa. Bảng sửa bên phải rộng cố định khoảng 460 px, chứa hai tab Nội dung và Nhờ AI.
- **K2.** *Given* màn hẹp (dưới `lg`), *then* bản xem trước ở trên, rộng hết khung; bảng sửa ở dưới; nút Xong luôn thấy được.
- **K3.** Tab Nội dung vẫn dùng tốt trong bảng 460 px: ô nhập một cột, bộ chọn bố cục, bộ chọn biểu tượng, ô dòng nguồn; không có ô nào bị cắt chữ.
- **K4.** Tab Nhờ AI không có khung viền lồng và không có tiêu đề trùng tên tab.

## Hỏi đáp với AI (tab Nhờ AI)

- **K5.** Tab Nhờ AI là một cuộc trò chuyện về đúng slide đang mở. Ô nhập 2–3 dòng nằm ở đáy bảng, nút gửi nằm trong ô; Enter gửi, Shift + Enter xuống dòng.
- **K6.** Mỗi lượt, AI tự chọn một trong ba kiểu trả lời:
  - **trả lời** bằng lời, không đổi slide (ví dụ "Ý thứ hai có chính xác không?");
  - **hỏi lại** khi yêu cầu chưa rõ, kèm 2–3 hướng gợi ý; bấm một hướng là gửi hướng đó như một lượt mới;
  - **đề xuất sửa**: kèm bản nháp slide.
- **K7.** *Given* AI trả lời bằng lời mà trong đó có gợi ý sửa, *then* dưới câu trả lời có nút "Làm theo gợi ý này"; bấm vào thì gọi AI lần hai để ra bản nháp (cách tách hai bước, phòng khi mô hình trả JSON kém ổn định lúc vừa trò chuyện vừa viết bản nháp).
- **K8.** *Given* AI đề xuất sửa, *then* bản xem trước lớn hiện bản đề xuất, kèm nút chuyển "Trước / Sau" và hai nút "Áp dụng", "Bỏ". Trong cuộc trò chuyện chỉ có một dòng tóm tắt đề xuất và các nút đó. *When* chưa bấm Áp dụng, *then* không có gì ghi vào slide.
- **K9.** Bản nháp đi qua đúng bộ kiểm tra hiện có (`proposalFromDraft`): lấp phần AI để trống bằng nội dung hiện tại, kiểm bố cục, kiểm con số ở bài từ mô tả chủ đề, gom số nguồn ở bài có nguồn internet. Bản nháp hỏng thì AI nói rõ trong cuộc trò chuyện, không hiện đề xuất rỗng.
- **K10.** Các lựa chọn nhanh (Viết ngắn hơn, Thêm ví dụ, Dễ hiểu hơn, Đổi thành câu hỏi quiz, Viết lại từ dàn ý) là một hàng nút một dòng trên ô nhập, mô tả nằm ở tooltip. Bấm một nút là gửi sẵn câu tương ứng vào cuộc trò chuyện.
- **K11.** Lỗi và trạng thái ("AI đang trả lời...", hết hạn mức, mất kết nối) hiện ngay dưới ô nhập, không ở đáy bảng.

## Ngữ cảnh và nguồn kiến thức

- **K12.** Mỗi lượt gửi kèm: nội dung slide hiện tại, dòng dàn ý của slide, đoạn tài liệu liên quan (bài từ tài liệu) hoặc các trang đã đọc (bài có nguồn internet), và tối đa 6 lượt gần nhất.
- **K13.** Bài từ tài liệu: AI chỉ trả lời theo tài liệu và nói rõ khi tài liệu không đề cập. Bài từ mô tả chủ đề: mỗi câu trả lời bằng lời có dòng nhỏ "Câu trả lời dựa trên kiến thức chung, thầy/cô cần kiểm tra." Bài có nguồn internet: câu trả lời ghi số nguồn [n] khi dùng thông tin từ nguồn.
- **K14.** Mọi quy tắc văn phong giữ nguyên: câu hoàn chỉnh, tiếng Việt, không emoji; không bịa số liệu, tên người, trích dẫn.

## Lưu trữ, sự kiện, hạn mức

- **K15.** Bản đầu không lưu cuộc trò chuyện: đóng trình sửa hoặc chuyển slide thì cuộc trò chuyện của slide đó mất. Bảng ghi rõ điều này bằng một dòng nhỏ.
- **K16.** Mỗi lượt ghi `live.slide.ai_chat_turn` (deckId, slideId, kiểu trả lời, có hỏi lại hay không); áp dụng đề xuất vẫn ghi `live.slide.ai_edit_accepted`. Không ghi nội dung câu hỏi hay câu trả lời.
- **K17.** Mỗi lượt trừ ví token như các nút AI khác, chặn trước khi gọi mô hình khi hết hạn mức. Bảng hiện ước lượng số lượt còn lại trong tháng.

## Thử nghiệm

- **K18.** Test thuần: câu lệnh trò chuyện theo ba nguồn; chuẩn hoá câu trả lời (kiểu lạ ⇒ trả lời bằng lời; đề xuất hỏng ⇒ câu báo lỗi, không đề xuất); cắt lịch sử còn 6 lượt; hỏi lại có 2–3 hướng.
- **K19.** Thử trên localhost bằng LLM giả cả ba kiểu trả lời và đường "Làm theo gợi ý này"; thử với Qwen thật nếu có.
