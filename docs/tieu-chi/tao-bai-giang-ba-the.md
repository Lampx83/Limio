# Tiêu chí: trang Tạo bài giảng chọn nguồn bằng ba thẻ

Bản mẫu: `docs/mockup/tao-bai-giang-nguon.html`, phương án B (người dùng duyệt 2026-10-19). Trang `/instructor/limio-live/from-document`.

Vấn đề cũ: bốn tab "Mô tả chủ đề, Tải tệp lên, Dán văn bản, PowerPoint"; "Tải tệp lên" và "Dán văn bản" là cùng một việc (đưa tài liệu cho AI), còn "PowerPoint" trông như tab nhưng lại chuyển trang, và kéo tệp PowerPoint vào "Tải tệp lên" thì bị báo lỗi.

## Ba thẻ

- **N1.** Dưới tiêu đề là câu hỏi "Thầy/cô đang muốn tạo bài giảng tương tác từ nguyên liệu nào?" và ba thẻ, mỗi thẻ có biểu tượng, tên và một dòng nói AI sẽ làm gì:
  - "Từ ý tưởng": AI soạn từ kiến thức chung theo mô tả của thầy/cô.
  - "Từ tài liệu": Word, PDF hoặc dán văn bản; AI bám sát tài liệu.
  - "Từ bài PowerPoint": giữ hình, ghi chú giảng, bảng và biểu đồ.
- **N2.** *Given* mở trang, *then* thẻ "Từ ý tưởng" được chọn sẵn và con trỏ nằm trong ô mô tả (giữ hành vi "Tạo bài giảng mở thẳng ô mô tả").
- **N3.** Thẻ là một nhóm lựa chọn một (`radiogroup`); thẻ đang chọn có viền và nền màu thương hiệu. Đổi thẻ không xoá chữ đã gõ ở thẻ khác.
- **N4.** Khổ hẹp (dưới `sm`): ba thẻ nằm cùng một hàng, chỉ biểu tượng và tên, để ô nhập và nút "Soạn dàn ý" không bị đẩy xuống. Từ `sm`: ba cột, có cả dòng giải thích.

## Ô nhập theo thẻ

- **N5.** "Từ ý tưởng": như ô mô tả hiện nay (15 đến 2.000 ký tự, đếm ký tự, ví dụ mẫu, công tắc "Tìm thêm nguồn trên internet" khi quản trị đã cấu hình), cùng hàng thời lượng và nút "Soạn dàn ý".
- **N6.** "Từ tài liệu": một dòng kéo thả hoặc "Chọn tệp" (Word .docx, PDF, .txt, .md, tối đa 10 MB) và ngay dưới là ô "Hoặc dán nội dung tài liệu vào đây". Khi đã chọn tệp, ô dán ẩn đi, thay bằng tên và cỡ tệp kèm nút "Bỏ tệp"; AI dùng tệp. Không có công tắc internet, không có ví dụ mẫu.
- **N7.** Nút "Soạn dàn ý" chỉ bật khi: ý tưởng có ít nhất 15 ký tự; tài liệu có tệp hoặc có chữ dán vào.
- **N8.** "Từ bài PowerPoint": ô kéo thả hoặc "Chọn tệp" nhận .pptx (tối đa 50 MB, như trang nhập PowerPoint). Không có hàng thời lượng (trang nhập PowerPoint tự gợi ý thời lượng theo số slide).

## PowerPoint không còn là ngõ cụt

- **N9.** *Given* chọn hoặc kéo một tệp .pptx vào thẻ "Từ bài PowerPoint", *then* hệ thống mở trang nhập PowerPoint với tệp đó đã được đọc sẵn (bước 1 hiện số slide, hình, ghi chú), thầy/cô không phải chọn tệp lần nữa.
- **N10.** *Given* đang ở thẻ "Từ tài liệu", *when* kéo hoặc chọn một tệp .pptx, *then* xử lý như N9 thay vì báo lỗi.
- **N11.** Tệp .ppt đời cũ ở cả hai thẻ: báo cách lưu lại thành .pptx (dùng đúng câu của trang nhập PowerPoint). Tệp khác loại ở thẻ PowerPoint: "Chỉ nhận file PowerPoint dạng .pptx."
- **N12.** Mở thẳng trang nhập PowerPoint (từ trợ lý Limio hay địa chỉ cũ) vẫn chạy như trước; liên kết "Tạo bài giảng" ở đầu trang đó đưa về trang ba thẻ.

## Chữ hiển thị

- **N12b.** Liên kết phụ cạnh tiêu đề là "Soạn thủ công" (bỏ "từ bài trống").

- **N13.** Các câu nhắc tới tên tab cũ ("Dán văn bản", mục "PowerPoint" ở trên) đổi sang tên thẻ mới, ví dụ mô tả quá dài: "Nếu thầy/cô có sẵn tài liệu, hãy chọn thẻ "Từ tài liệu"".

## Thử nghiệm

- **N14.** Test thuần: phân loại tệp theo đuôi (pptx, ppt, tài liệu, không nhận), điều kiện bật nút "Soạn dàn ý" theo thẻ, chuyển tệp PowerPoint giữa hai trang (lấy một lần rồi xoá).
- **N15.** Xem trên localhost ở khổ rộng và khổ điện thoại: ba thẻ, đổi thẻ giữ chữ, tệp .pptx sang trang nhập với tệp đã đọc.

## Ngoài phạm vi

- Không đổi API dàn ý, không đổi trang nhập PowerPoint ngoài việc nhận tệp chuyển sang.
- Hướng dẫn của trợ lý Limio đã cập nhật theo ba thẻ: mục 14 của `docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md` và mục `bai-giang-tao` trong `apps/web/src/lib/teacherAssistantGuide.ts` (kèm sửa cỡ tệp PowerPoint tối đa 50 MB cho khớp mã).
