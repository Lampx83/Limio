# Tiêu chí: trang Tạo bài giảng một ô (mô tả + một tài liệu), ít nhất 5 tương tác, thêm 90 phút

Bản mẫu: `docs/mockup/tao-bai-giang-mot-o.html`. Người dùng duyệt ngày 2026-10-19, kèm ba đề xuất:
- "Giữ ý": AI viết 5 slide tương tác.
- Bài 15 phút giữ 9–12 slide.
- Bài 90 phút có 42–50 slide, ít nhất 10 slide tương tác.

Trang này thay ba thẻ trong `tao-bai-giang-ba-the.md`. Giữ lại từ đó: chuyển tệp PowerPoint sang trang nhập, nhãn "Soạn thủ công".

## Một ô

- **M1.** Trang "Tạo bài giảng" gồm:
  - Câu dẫn (người dùng chốt 2026-10-19): "Limio có thể hỗ trợ thầy/cô soạn bài giảng tương tác chỉ từ một ý tưởng. Nếu có tài liệu tham khảo, thầy/cô đính kèm tệp. Nếu đã có bài giảng PowerPoint, Limio hỗ trợ soạn lại kèm các nội dung tương tác." Không còn dòng ghi chú dài ở cuối trang.
  - Một ô mô tả (tối đa 2.000 ký tự).
  - Nút "Đính kèm tài liệu" kèm chữ nhạt "(không bắt buộc)", cạnh nút có dòng giới hạn "Một tệp: Word, PDF, .txt, .md tối đa 10 MB; PowerPoint (.pptx) tối đa 50 MB".
  - Hàng thời lượng, công tắc internet, nút "Soạn dàn ý".
  - Ví dụ mẫu.
- **M2.** Mô tả luôn là ý muốn của giảng viên: chủ đề, người học, mục tiêu, điều cần nhấn mạnh. AI đọc mô tả trong mọi trường hợp.
- **M3.** Mỗi bài chỉ một tài liệu:
  - Word .docx, PDF, .txt, .md tối đa 10 MB, hoặc PowerPoint .pptx tối đa 50 MB.
  - Đã có tệp thì nút thành "Đổi tài liệu". Đính kèm tệp khác thì tệp mới thay tệp cũ, kèm dòng báo tên tệp bị thay.
  - Kéo thả tệp vào ô cũng được. Tệp .ppt đời cũ, tệp khác loại hay quá cỡ thì báo lỗi rõ.
- **M4.** Dán vào ô một đoạn trên 2.000 ký tự khi chưa có tệp: đoạn đó thành tài liệu "Văn bản dán", ô mô tả giữ phần đã có trước khi dán.
  - Có nút "Đưa lại vào ô mô tả" (cắt ở 2.000 ký tự, kèm dòng báo).
  - Đã có tệp thì ô mô tả giữ giới hạn 2.000 ký tự như thường.
- **M5.** Dòng nhắc dưới ô nói AI sẽ làm gì:
  - Không tài liệu: "AI sẽ soạn từ kiến thức chung theo mô tả này."
  - Có tài liệu: "AI sẽ bám sát tài liệu đính kèm và soạn theo mô tả của thầy/cô", kèm "(mô tả không bắt buộc)" khi ô trống.
  - Tài liệu là PowerPoint: "AI sẽ nhập bài giảng PowerPoint…".
- **M6.** Nút "Soạn dàn ý" bật khi: có tài liệu, hoặc mô tả có từ 15 ký tự. Công tắc "Tìm thêm nguồn trên internet" và ví dụ mẫu chỉ hiện khi không có tài liệu.
- **M7.** Tài liệu là PowerPoint thì nút thành "Nhập PowerPoint" và hàng thời lượng ẩn. Bấm thì mở trang nhập PowerPoint với tệp đã đọc sẵn, mô tả mang theo. Mô tả được dùng khi AI soạn lại mạch và khi AI viết các slide tương tác.

## Máy chủ: mô tả đi cùng tài liệu

- **M8.** API soạn dàn ý nhận `topic` (mô tả) cùng `file` hoặc `text` trong một lần gửi. Có tài liệu thì nguồn là "document", mô tả là yêu cầu của giảng viên (`intent`). Không có tài liệu thì giữ như cũ: mô tả là nguồn "topic", 15 đến 2.000 ký tự.
- **M9.** Yêu cầu của giảng viên lưu ở `LiveDeck.sourceIntent` (migration). Mục "# Yêu cầu của giảng viên" được đưa vào câu lệnh soạn dàn ý, tạo slide và nhập PowerPoint, kèm quy tắc:
  - Làm theo yêu cầu về người học, trọng tâm, cách dạy.
  - Kiến thức và số liệu vẫn chỉ lấy từ tài liệu.
  - Yêu cầu không được vượt các quy tắc khác.
- **M10.** Trang nhập PowerPoint (API `import-pptx`, `import-mode`) nhận `intent`, lưu cùng bài.

## Thời lượng 90 phút

- **M11.** Thêm 90 phút: 42 đến 50 slide, đủ mạch Mục tiêu, Mục lục, bìa từng phần, Tổng kết, có 4 đến 6 phần nội dung. Các thời lượng cũ giữ nguyên số slide, kể cả 15 phút giữ 9–12 slide.
- **M12.** 90 phút chỉ là một lựa chọn để giảng viên tự bấm, không phải mặc định và không được tự gợi ý: khi nhập PowerPoint, gợi ý thời lượng giữ như cũ (đến 12 slide → 15 phút, đến 19 → 30, còn lại → 45) (người dùng chốt 2026-10-19).
- **M13.** Câu lệnh soạn dàn ý cho phép tới 50 slide và tăng giới hạn chữ trả về theo số slide.

## Ít nhất 5 tương tác ở mọi cách tạo

- **M14.** Mức tối thiểu theo thời lượng:
  - 15, 30, 45 phút: ít nhất 5 slide tương tác, ít nhất 3 loại khác nhau.
  - 90 phút: ít nhất 10 slide tương tác, ít nhất 4 loại.
  - Loại tính gồm trắc nghiệm, bình chọn, đám mây từ, bảng cộng tác, vẽ hình, bảng trắng.
- **M15.** Bảng trắng (whiteboard) tối đa 1 cho cả bài, chỉ khi có bài toán hoặc tình huống cần cả lớp cùng giải. Dàn ý AI trả về có nhiều hơn thì các bảng trắng thừa đổi thành bảng cộng tác.
- **M16.** Câu lệnh soạn dàn ý (mô tả, tài liệu, PowerPoint soạn lại mạch) nêu đúng mức tối thiểu ở M14 và giới hạn ở M15. Giữ các luật cũ:
  - Không hai slide tương tác liền nhau.
  - Không ở slide đầu, slide cuối.
  - Không ngay sau slide mở phần.
- **M17.** Sau khi chuẩn hoá dàn ý, dàn ý còn thiếu số slide tương tác hoặc thiếu loại thì máy chủ gọi AI thêm một lần nhỏ để bổ sung.
  - AI trả về danh sách slide tương tác cần thêm, mỗi slide gồm vị trí "sau slide số k", loại, câu hỏi hoặc lời mời.
  - Hệ thống chèn đúng luật ở M16; vị trí sai thì dời tới chỗ hợp lệ gần nhất, không có chỗ thì bỏ.
  - Lỗi AI khi bổ sung không làm hỏng việc tạo bài: giữ dàn ý như cũ, kèm cảnh báo.
- **M18.** PowerPoint "Giữ ý, làm đẹp lại":
  - Slide gốc giữ nguyên, không AI. Hệ thống gọi AI một lần để viết 5 slide tương tác (10 với 90 phút) và chèn xen giữa các phần.
  - Nội dung câu hỏi được AI viết ở bước "Tạo slide", như mọi dòng dàn ý không lấy từ slide gốc.
  - AI chưa cấu hình hoặc hết hạn mức: vẫn nhập được, không có tương tác bổ sung, kèm cảnh báo.
  - Chữ giới thiệu cách này đổi thành "Giữ nguyên slide gốc; AI chỉ viết thêm các slide tương tác (tốn ít lượt)".
- **M19.** Cảnh báo dưới dàn ý nhắc khi bài còn ít hơn mức tối thiểu, ví dụ sau khi giảng viên tự xoá bớt: "Bài nên có ít nhất 5 slide tương tác (hiện có 3)".

## Bố cục phong phú (người dùng yêu cầu 2026-10-19)

- **M23.** Câu lệnh soạn dàn ý thêm luật đa dạng bố cục:
  - Không quá 2 slide nội dung liền nhau cùng bố cục.
  - "Chữ và hình" chiếm không quá 40% số slide nội dung (không tính bìa, mở phần, tóm tắt).
  - Ý song song dùng Ba thẻ, quy trình dùng Các bước, đối chiếu dùng So sánh.
  - Các slide Chữ và hình còn lại tự xen kẽ sáu kiểu trình bày (nhánh `feat/limio-live-chu-va-hinh`).
- **M24.** Cảnh báo dưới dàn ý khi quá nửa số slide nội dung là Chữ và hình (từ 4 slide trở lên): "Nhiều slide Chữ và hình (n trên m slide nội dung); nên đổi vài slide sang Ba thẻ, Các bước hoặc So sánh."

## Sự kiện, thử nghiệm, hướng dẫn

- **M20.** `live.deck.outline_generated` ghi thêm:
  - `hasIntent`: có yêu cầu của giảng viên đi cùng tài liệu.
  - `interactionsAdded`: số slide tương tác hệ thống bổ sung.
- **M21.** Test thuần:
  - mục tiêu tương tác theo thời lượng, phép tính phần thiếu
  - chèn slide tương tác đúng luật, giới hạn bảng trắng
  - câu lệnh có yêu cầu của giảng viên, có mức tối thiểu
  - câu lệnh bổ sung tương tác
  - gợi ý thời lượng, khoảng slide 90 phút
  - các hàm của ô nhập (dán dài thành tài liệu, điều kiện bật nút)
- **M22.** Cập nhật `GIAO-DIEN.md` và hướng dẫn của trợ lý Lily. Xem trên localhost bằng LLM giả ở khổ rộng và khổ hẹp:
  - mô tả có kèm tài liệu
  - chỉ có mô tả
  - 90 phút
  - PowerPoint "Giữ ý" có 5 tương tác
