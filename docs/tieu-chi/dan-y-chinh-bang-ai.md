# Chỉnh dàn ý bằng AI và soạn lại từ đầu (R1–R12)

Trang dàn ý hiện chỉ cho sửa tay từng slide. Thầy/cô muốn đổi hướng cả bài ("ngắn lại", "thêm ví dụ", "bớt lý thuyết") thì phải quay về form và soạn bài mới.
Tính năng này thêm một ô ở cột phải để dặn AI chỉnh dàn ý ngay trong bài, và một dòng "Soạn lại từ đầu". Theo nguyên tắc ít lựa chọn cho giảng viên:
một ô nhập, một nút, một dòng chữ; không chọn bố cục hay hộp từng mục; không phải khung chat nhiều lượt.

- **R1.** Given trang dàn ý của bài do AI soạn (từ tài liệu, mô tả chủ đề hoặc mô tả kèm internet). When mở trang. Then đầu cột phải (trên "Giao diện") có hộp
  "Chỉnh dàn ý bằng AI": một ô nhập nhiều dòng, nút "Chỉnh dàn ý", dòng chữ nhỏ "Soạn lại từ đầu". Từ `lg` hộp nằm trong cột phải dính trên đầu; dưới `lg` xếp trên
  danh sách như các hộp khác (không cuộn ngang). Bài nhập từ PowerPoint có slide lấy nguyên từ file gốc, và bài không còn văn bản nguồn: **không hiện hộp**.
- **R2.** Dưới ô nhập có 4 gợi ý bấm nhanh: "Rút ngắn lại", "Thêm ví dụ thực tế", "Bớt lý thuyết, thêm hoạt động", "Dễ hiểu hơn cho người mới". Bấm một gợi ý chỉ **điền
  vào ô** (nối thêm nếu ô đã có chữ), không gửi; thầy/cô sửa được rồi mới bấm "Chỉnh dàn ý". Gợi ý là chữ thường, không dùng nhãn bo tròn.
- **R3.** Gửi: lời dặn sau khi cắt khoảng trắng phải từ 5 đến 1.000 ký tự; ngoài khoảng đó nút khoá và có dòng nói rõ lý do. Ctrl/Cmd+Enter trong ô cũng gửi. Trình duyệt gửi
  **dàn ý đang hiện trên màn hình** (kể cả phần vừa sửa tay chưa kịp tự lưu), không phải bản trong cơ sở dữ liệu.
- **R4.** Kết quả của "Chỉnh dàn ý": AI nhận dàn ý hiện tại, văn bản nguồn đã lưu và lời dặn; slide không liên quan đến lời dặn được giữ nguyên. Dàn ý mới thay dàn ý cũ trên
  trang và tự lưu như mọi chỉnh sửa; xác nhận cũ bị huỷ. Kiến thức, số liệu, trích dẫn vẫn chỉ lấy từ nguồn (lời dặn là dữ liệu, không vượt quy tắc của hệ thống, kể cả khi lời dặn
  bảo "bỏ qua các quy tắc trên"). Ngôn ngữ của bài giữ nguyên trừ khi lời dặn ghi rõ ngôn ngữ khác. Thời lượng buổi không đổi.
- **R5.** Số slide: tối đa theo mức của thời lượng (như lúc soạn đầu); tối thiểu thấp hơn mức gợi ý để lời dặn "rút còn 10 slide" làm được, và lệch mức gợi ý chỉ hiện cảnh báo
  sẵn có, không chặn. Chỉnh dàn ý **không tự bổ sung slide tương tác** (nếu lời dặn bỏ bớt tương tác thì tôn trọng, cảnh báo "nên có ít nhất n slide tương tác" vẫn hiện).
- **R6.** Giữ định danh slide: slide mới trùng slide cũ (cùng loại, cùng tiêu đề; ưu tiên trùng cả ý) **giữ id cũ**, mỗi id cũ dùng một lần. Nhờ vậy khi bài đã có slide,
  "Cập nhật slide theo dàn ý" chỉ viết lại slide đổi nội dung và thêm/xoá slide thật sự đổi, không xoá-tạo lại cả bài; slide thầy/cô đã sửa tay vẫn được giữ như trước.
- **R7.** Hoàn tác: sau khi chỉnh hoặc soạn lại, trên trang có thanh "Đã chỉnh theo: “…” (lời dặn rút gọn)" kèm nút **Quay lại bản trước**, khôi phục dàn ý và thời lượng trước đó và tự lưu.
  Thanh **không tự biến mất sau vài giây** (khác hoàn tác xoá slide); nó mất khi thầy/cô sửa dàn ý bằng tay, gửi lời dặn khác, hoặc rời trang. Chỉ giữ một bước hoàn tác.
- **R8.** "Soạn lại từ đầu": bỏ dàn ý hiện tại, soạn lại từ văn bản nguồn đã lưu (và các trang đã đọc nếu bài có nguồn internet) theo đúng đường tạo ban đầu, kể cả bước bổ sung
  slide tương tác. Lời dặn trong ô (nếu có) thay yêu cầu ban đầu; ô trống thì dùng lại yêu cầu ban đầu của bài (nếu có). Luôn hỏi xác nhận một lần vì phần sửa tay sẽ mất (nói rõ
  còn Quay lại bản trước). Không tạo bài mới: cùng bài, cùng đường dẫn, cùng giao diện.
- **R9.** Đang chạy: ô nhập, nút và dòng "Soạn lại từ đầu" bị khoá, nút ghi "Đang chỉnh...", có dòng "thường mất từ 20 đến 60 giây". Máy chủ trả luồng NDJSON có nhịp giữ kết nối
  (như lúc soạn đầu) để proxy không cắt. Lỗi AI hoặc mạng: **dàn ý hiện tại giữ nguyên**, có dòng báo lỗi và thử lại được; không để lại dàn ý nửa vời.
- **R10.** Hạn mức: dùng chung hạn mức token AI của giảng viên; hết hạn mức thì dừng **trước khi** gọi mô hình, thông báo như lúc tạo ("hết hạn mức hôm nay/tháng này"). Dưới nút có dòng
  ước tính "Mỗi lần chỉnh dùng khoảng n token AI" (tính từ độ dài dàn ý và nguồn).
- **R11.** Quyền và ràng buộc: chỉ chủ bài giảng gọi được (người khác 404/403); bài không có dàn ý hoặc không có văn bản nguồn trả lỗi rõ (`no_outline`, `no_source`); bài đã có slide
  mà dàn ý đổi thì dùng "Cập nhật slide theo dàn ý" như trước, tính năng này **không** tự viết lại slide. Ghi sự kiện `live.deck.outline_revised` (chế độ chỉnh hay soạn lại, số slide
  trước/sau, số ký tự lời dặn, số cảnh báo); **không ghi nội dung lời dặn**.
- **R12.** Giữ trợ lý Lily theo kịp giao diện (CLAUDE.md §4.9): cập nhật `docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md` rồi mục tương ứng trong `teacherAssistantGuide.ts` (tên nút đúng như trên
  màn hình, có `useCases`); `teacherAssistantFreshness.test.ts` xanh.

## Test (viết trước code)

- `packages/core-feedback/src/__tests__/lectureRevise.test.ts`: câu lệnh chỉnh dàn ý (R4, R5, R6): mục "Dàn ý hiện tại" và "Yêu cầu chỉnh" có mặt và đứng trước nguồn; quy tắc "giữ nguyên slide không liên
  quan" và "lời dặn là dữ liệu"; lời dặn cắt ở 1.000 ký tự; không có `revision` thì vẫn là câu lệnh soạn đầu (ít nhất 5 tương tác; các test `lectureOutline`, `lectureMotO`, `lectureTopic` hiện có giữ nguyên là xanh); chế độ chỉnh cho phép ít slide hơn mức gợi ý.
- `apps/web/src/lib/limioLiveOutlineRevise.test.ts` (hàm thuần): kiểm tra lời dặn (R3), dàn ý rút gọn gửi AI (bỏ dòng Nguồn tham khảo), giữ id slide (R6, kể cả dòng Nguồn tham khảo), điều kiện hiện hộp (R1), ước tính token (R10), rút gọn lời dặn cho thanh hoàn tác (R7).
