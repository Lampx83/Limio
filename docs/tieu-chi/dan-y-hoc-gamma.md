# Trang dàn ý học theo Gamma (O1–O6)

Bản mẫu đã duyệt: `docs/mockup/dan-y-hoc-gamma.html`. Điều chỉnh theo ý thầy/cô: **sửa slide vẫn bằng cửa sổ Sửa** (không sửa trực tiếp trên thẻ,
Gamma làm vậy khó dùng); màn Đối chiếu hai cột của bài nhập từ PowerPoint (PowerPoint trước / dàn ý đề xuất) giữ nguyên.

- **O1.** Given trang dàn ý của một bài. When mở trang. Then mỗi slide là một thẻ có số thứ tự, tiêu đề và **các ý hiện sẵn** (tối đa 4 ý, mỗi ý
  tối đa 2 dòng; nhiều hơn thì dòng "và n ý nữa"), chân thẻ ghi bố cục và nguồn ("từ slide 12, phần 1/2"). Bấm vào thẻ mở cửa sổ Sửa như trước;
  kéo ⋮⋮ để đổi thứ tự, nút xoá và Hoàn tác như trước. Slide tương tác hiện câu hỏi hoặc lời mời ở dòng ý, nền khác.
- **O2.** Given màn hình rộng từ `lg`. When mở trang. Then dàn ý chiếm cột trái, cột phải (rộng 340 px, dính trên đầu khi cuộn) gồm: số slide và số nội
  dung/tương tác, buổi giảng (15/30/45 phút) và gợi ý số slide, trạng thái lưu; **giao diện**; **mạch bài**; các cảnh báo. Dưới `lg` cột phải xếp trên
  danh sách (không cuộn ngang).
- **O3.** Giao diện: hai bản xem thu nhỏ vẽ bằng chính bộ vẽ slide (một bìa, một slide nội dung của chính bài) theo giao diện của bài; nút "Gợi ý
  giao diện khác" đổi sang giao diện sáng kế tiếp chưa xem (vòng lại khi hết) và lưu ngay vào bài; tên giao diện hiện bên dưới. Đổi lại được trong trình
  soạn. Không mở thư viện đầy đủ ở trang này.
- **O4.** Mạch bài là hai câu ghép từ dàn ý, không gọi AI: bài nhập từ PowerPoint nói "Giữ đúng thứ tự n slide gốc", mọi bài nói "Bài gồm k phần: …"
  (tên các phần nội dung theo thứ tự) và số slide tương tác nếu có.
- **O5.** Nút tạo luôn trong tầm mắt: thanh dính đáy trang. Một nút duy nhất "Tạo n slide" (gộp Xác nhận dàn ý và Tạo slide): bấm là xác nhận
  dàn ý rồi tạo; bỏ ô tích "Tôi đã xem lại". Bên cạnh là một câu nói rõ điều sẽ xảy ra (dựng thẳng từ slide gốc không tốn token, hay AI viết n slide và
  dự kiến bao nhiêu token). Lỗi chặn hiện ngay trên thanh và khoá nút. Bài đã có slide: nút "Cập nhật slide theo dàn ý" (hỏi lại như trước) và "Mở
  bài giảng".
- **O6.** Đang tạo: danh sách thẻ được thay bằng lưới slide theo đúng thứ tự dàn ý, **sáng dần từ slide 1 đến hết, không nhảy cóc**. Máy chủ viết theo lô
  chạy song song nên slide xong không theo thứ tự; lưới chỉ dùng SỐ slide đã xong (sự kiện `slide` của máy chủ đếm cả slide dựng sẵn không qua AI) và sáng
  từng ô một (khoảng 160 ms mỗi ô) tới con số đó. Ô đã xong hiện tiêu đề và ký hiệu bố cục; tối đa 2 ô kế tiếp là "đang viết" (viền nhấn, vạch chạy); các ô sau
  mờ hơn. Cập nhật một phần: slide không nằm trong danh sách sẽ viết (sự kiện `start` kèm `ids`) luôn hiện như đã xong và không tính vào số đếm. Thanh
  trạng thái ghi "Đang tạo slide k trên n" theo đúng ô đang sáng. Slide chỉ được lưu một lần khi cả bài xong (không để bài dở dang) nên chưa mở được từng slide
  trong lúc tạo.
- **O7.** Tạo xong thì tự mở bài giảng để thầy/cô thấy ngay slide, không phải quay về dàn ý rồi bấm "Mở bài giảng": các ô còn lại sáng nhanh (90 ms mỗi ô),
  dừng khoảng 0,9 giây trên lưới đã đủ rồi chuyển sang trang bài giảng. Ngoại lệ: có slide AI chưa viết được (`fallbackCount` > 0) thì ở lại dàn ý, hiện cảnh
  báo "dựng thẳng từ dàn ý, hãy xem lại" kèm nút Mở bài giảng.
