# Tiêu chí: slide viết theo ngôn ngữ của bài giảng

Lỗi người dùng báo (2026-10-19): bài giảng có slide tiếng Anh, nhưng slide mới thêm vào lại ra tiếng Việt.

## Nguyên nhân (đã đối chiếu mã trên main 94e19d8b)

- `LiveDeck` không lưu ngôn ngữ nào; không có chỗ nào nhận biết ngôn ngữ của bài.
- Câu lệnh gửi AI ép tiếng Việt, không có điều kiện:
  - `lectureOutline.ts:292` (soạn dàn ý: mô tả, tài liệu, PowerPoint "Soạn lại mạch")
  - `lectureSlides.ts:219` (tạo slide và "Cập nhật slide theo dàn ý")
  - `lectureSlideChat.ts:84` (Nhờ AI: hỏi đáp, cả bản nháp slide đề xuất)
- `lectureSlideEdit.ts` (Nhờ AI sửa slide) không ép tiếng Việt, nhưng toàn bộ câu lệnh viết bằng tiếng Việt, nên với slide trống AI cũng viết tiếng Việt.
- Trường hợp hay gặp nhất: nhập PowerPoint tiếng Anh bằng cách "Giữ ý, làm đẹp lại" (không qua AI, nên giữ tiếng Anh). Sau đó thêm slide ở dàn ý và bấm "Cập nhật slide theo dàn ý": các dòng mới đi qua AI và quay về bằng tiếng Việt.
- Chữ do hệ thống tự viết lên slide cũng cố định tiếng Việt:
  - " (tiếp)" khi tách slide (`limioLiveSlides.ts`, `limioLivePptx.ts:267`, `limioLiveChartFromImage.ts:169`)
  - "Nội dung chính" và "Phần N" (`limioLiveOutline.ts:346`), "Phần mới" (`limioLiveOutlineUi.ts:264`)
  - "Nguồn tham khảo" (`limioLiveOutline.ts:95`)
  - "Nguồn: [1]", "Nguồn ảnh: …", "Đơn vị: …", "Chuỗi n" (biểu đồ)
  - nguồn mặc định của trích dẫn ("Thông điệp chính của bài học", `lectureSlides.ts:189`)

## Ngôn ngữ của bài

- **L1.** `LiveDeck` có thêm cột `language` (mã ngôn ngữ: `vi`, `en`, `zh`, `ja`, `ko`, `fr`, `de`; để trống nghĩa là chưa xác định, khi đó AI viết theo ngôn ngữ của tài liệu hoặc nội dung hiện có). Thêm bằng migration, bài cũ để trống.
- **L2.** Hàm thuần `detectLanguage(text)` nhận biết ngôn ngữ từ chữ: đủ chữ (từ 40 chữ cái Latin, hoặc 10 chữ Hán/Nhật/Hàn) thì trả mã ngôn ngữ, chưa đủ hay không chắc thì trả `null`. Tiếng Việt nhận qua chữ riêng của tiếng Việt (ă ơ ư đ, dấu nặng, dấu hỏi…); tiếng Anh qua chữ không dấu và các từ thường gặp (the, and, of…); chữ Hán, Nhật, Hàn nhận theo bảng mã Unicode.
- **L2b.** Mô tả chủ đề ghi rõ ngôn ngữ thì theo đúng ngôn ngữ đó, dù mô tả viết bằng tiếng khác (người dùng chốt 2026-10-19). Ví dụ "Bài giảng bằng tiếng Anh về…", "dạy bằng tiếng Anh", "slide tiếng Anh", "in English" → `en`. Hàm thuần `explicitLanguage(text)`.
- **L3.** Ngôn ngữ được ghi lúc tạo bài:
  - bài từ ý tưởng: theo ngôn ngữ ghi rõ trong mô tả (L2b), không có thì theo chữ mô tả
  - bài từ tài liệu: theo chữ của tài liệu (không theo tên tệp)
  - bài từ PowerPoint: theo chữ của các slide gốc (tiêu đề và ý, không tính ghi chú giảng)
- **L4.** Bài cũ (cột trống) được nhận ngôn ngữ từ chữ của các slide hiện có ngay lần đầu cần dùng (thêm slide, cập nhật theo dàn ý, Nhờ AI), rồi ghi lại vào cột. Không chạy script sửa hàng loạt.
- **L5.** Giảng viên đổi được ngôn ngữ của bài trong menu "Giao diện" của trình sửa, mục "Ngôn ngữ của slide" (người dùng chốt 2026-10-19). Có lựa chọn "Tự nhận theo nội dung" (để trống cột) và danh sách ngôn ngữ ở L1. Đổi ngôn ngữ chỉ áp cho nội dung viết từ lúc đó; không tự dịch các slide đã có. Dòng nhắc dưới mục nói rõ điều này.

## AI viết đúng ngôn ngữ

- **L6.** *Given* bài có ngôn ngữ là tiếng Anh, *when* thêm slide ở dàn ý rồi "Cập nhật slide theo dàn ý", *then* các slide mới viết bằng tiếng Anh, còn các slide cũ giữ nguyên.
- **L7.** Bốn câu lệnh (dàn ý, tạo slide, Nhờ AI hỏi đáp, Nhờ AI sửa slide) nhận tham số ngôn ngữ. Thay câu "Viết bằng tiếng Việt" bằng "Viết nội dung slide bằng <ngôn ngữ của bài>". Với tiếng Việt, giữ nguyên quy tắc hiện nay về thuật ngữ tiếng Anh.
- **L8.** Nhờ AI hỏi đáp: lời AI trả lời giảng viên vẫn bằng tiếng Việt và xưng "thầy/cô", nhưng bản nháp slide AI đề xuất viết bằng ngôn ngữ của bài.
- **L9.** Nhờ AI sửa slide ("Viết lại", "Ngắn hơn", "Thêm ví dụ", "Yêu cầu riêng"…): viết bằng ngôn ngữ của bài, kể cả khi slide đang trống.
- **L10.** Bài từ ý tưởng hay tài liệu tiếng Anh: dàn ý và slide viết bằng tiếng Anh. Thầy/cô vẫn muốn dạy bằng tiếng Việt thì đổi theo L5.

## Chữ hệ thống trên slide

- **L11.** Chữ do hệ thống viết lên slide đi theo ngôn ngữ của bài. Có bảng chữ cho tiếng Việt và tiếng Anh; ngôn ngữ khác dùng tạm bảng tiếng Anh (người dùng chốt 2026-10-19); chưa xác định thì dùng bảng tiếng Việt. Áp cho: " (tiếp)" / " (cont.)", "Nội dung chính" / "Main content", "Phần N" / "Part N", "Phần mới" / "New section", "Nguồn tham khảo" / "References", "Nguồn:" / "Source:", "Nguồn ảnh:" / "Image source:", "Đơn vị:" / "Unit:", "Chuỗi n" / "Series n", và nguồn mặc định của trích dẫn.
- **L12.** Chữ của giao diện giảng viên (nút, ô nhập, lời nhắc trong trình sửa) giữ tiếng Việt; chỉ chữ nằm trên slide mới đổi.

## Sự kiện, thử nghiệm

- **L13.** Sự kiện tạo dàn ý và tạo slide (`live.deck.outline_generated`, `live.deck.slides_generated`) ghi thêm `language`.
- **L14.** Test thuần:
  - `detectLanguage` với chữ Việt, Anh, lẫn lộn và quá ngắn
  - mỗi câu lệnh có đúng câu về ngôn ngữ (Việt, Anh)
  - bảng chữ hệ thống theo ngôn ngữ
  - bài cũ được nhận ngôn ngữ từ slide
- **L15.** Thử trên localhost bằng LLM giả: nhập PowerPoint tiếng Anh, thêm slide ở dàn ý, cập nhật, rồi kiểm tra câu lệnh gửi đi có yêu cầu tiếng Anh và chữ hệ thống là tiếng Anh.

## Ngoài phạm vi

- Không dịch tự động bài đã có sang ngôn ngữ khác.
- Không đổi ngôn ngữ của màn hình học viên (Vote, Word Cloud…) hay của giao diện giảng viên.

## Kết quả (2026-10-19, chưa commit)

- Đã làm L1–L15. Thử trên localhost bằng LLM giả: mô tả "Bài giảng bằng tiếng Anh về…" tạo bài `language = en`; câu lệnh dàn ý và tạo slide đều yêu cầu viết bằng tiếng Anh; sự kiện ghi `language: en`; xoá cột rồi mở lại thì tự nhận lại `en`; menu Giao diện đổi được và "Tự nhận lại theo nội dung" chạy đúng.
- Còn chữ tiếng Việt cố định chưa đổi theo ngôn ngữ: tên chuỗi mặc định khi đổi Biểu đồ sang Bảng ("Chuỗi n", "Số liệu" trong `toTable`) và mô tả biểu đồ cho trình đọc màn hình (`chartAltText`). Màn hình học viên ngoài trang chia sẻ chưa nhận ngôn ngữ (dùng bảng tiếng Việt).

## Đã chốt (2026-10-19)

1. Tự nhận ngôn ngữ và cho đổi bằng tay ở menu Giao diện (L5).
2. Ngoài tiếng Việt và tiếng Anh, chữ hệ thống dùng tạm tiếng Anh (L11).
3. Mô tả ghi rõ ngôn ngữ thì theo ngôn ngữ đó (L2b).
