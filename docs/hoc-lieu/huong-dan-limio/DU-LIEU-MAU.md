# Dữ liệu mẫu để chụp ảnh — hợp đồng (2026-10-03)

Khoá hướng dẫn dạy giảng viên **đại học**, nên mọi ví dụ và dữ liệu giả đều ở bối cảnh đại học.
Một khoá giả riêng, **"Nhập môn Lập trình"** (ngôn ngữ Python, năm nhất ngành Công nghệ thông tin),
thuộc giảng viên mẫu `giangvien.mau@feedbackme.dev`, là nơi chụp ảnh các màn hình cần có dữ liệu.
Khoá "Hướng dẫn sử dụng Limio" **không** bị lẫn dữ liệu giả vào.

Tất cả là dữ liệu GIẢ, tạo cho dev DB (`localhost:5434`). Không dùng người thật. Tên người giả ghép từ
họ + đệm + tên phổ biến, email `sv.demo.NN@feedbackme.dev`; mật khẩu lấy từ env `DEMO_PASSWORD`
(không ghi vào repo).

## Khoá "Nhập môn Lập trình"

- Slug `nhap-mon-lap-trinh`, trình độ Cơ bản, tiếng Việt, lĩnh vực "Công nghệ thông tin",
  `personalizationEnabled = true`, kiểu "Mở", **đã xuất bản**, không công khai.
- Ba chương, mỗi chương hai bài có tên thật và nội dung văn bản ngắn (3–6 đoạn, có ví dụ mã):
  1. **Biến và kiểu dữ liệu**: "Biến và phép gán", "Các kiểu dữ liệu cơ bản"
  2. **Cấu trúc điều khiển**: "Câu lệnh if", "Vòng lặp for"
  3. **Hàm**: "Định nghĩa và gọi hàm", "Tham số và giá trị trả về"
- Bài "Vòng lặp for" có **bài kiểm tra cuối bài** gồm 3 câu (trắc nghiệm, đúng/sai, sắp xếp thứ tự), trong đó
  câu ví dụ để chụp: *"Đoạn mã `for i in range(3): print(i)` in ra những số nào?"*, đáp án đúng "0, 1, 2";
  "1, 2, 3" gắn quan niệm sai **"Nghĩ chỉ số đếm bắt đầu từ 1"**; "0, 1, 2, 3" gắn **"Nghĩ range gồm cả giá trị cuối"**.
- Các bài khác có bài kiểm tra 2–3 câu để học viên có dữ liệu mức thành thạo.
- Tab Tổng quan: ô "Giá khoá học" để trống, ô "Công khai" **tắt**.

## Lớp học và học viên

- 36 học viên giả, ghi danh vào khoá, chia ba lớp: **K65-CS1** (14), **K65-CS2** (12), **K65-CS3** (10).
  Tên lớp đúng như vậy. Lớp K65-CS1 có đủ mã mời `/enroll/<mã>`.
- Học viên có tiến độ khác nhau (từ 10% tới 100%), một số đã hoàn thành khoá.
- **Một học viên chụp lộ trình:** `sv.demo.01@feedbackme.dev` đã làm bài kiểm tra ở nhiều bài với kết quả khác
  nhau, sao cho trang khoá của họ hiện đủ nhãn **Cần ôn**, **Nên luyện thêm**, **Vững** và vài bước lộ trình
  ("Ôn lại trước khi học tiếp", "Bài tiếp theo", "Luyện thêm cho chắc"). Làm bằng chính hàm nộp bài của hệ
  thống để mức thành thạo (BKT) được tính thật.
- Điểm kinh nghiệm (XP), huy hiệu, chuỗi ngày học: để tab Gamification có số liệu, dùng đường đi thật của hệ
  thống (hàm nộp bài kích hoạt cấp XP). Nếu cấp XP chạy ở tiến trình nền không có mặt, gọi trực tiếp hàm cấp XP
  của `core-gamification` trong script và ghi rõ trong báo cáo.

## Bài tập

- **"Bài tập 1: Tính điểm trung bình"** (gắn bài "Câu lệnh if"), điểm tối đa 10, hạn nộp 5 ngày nữa,
  đã lưu **tiêu chí chấm** dạng văn bản ("4 điểm chạy đúng với dữ liệu mẫu. 3 điểm xử lý trường hợp nhập sai.
  3 điểm đặt tên biến rõ ràng."). Có 20 bài nộp: 12 đã chấm (có điểm và nhận xét), 8 chờ chấm.
- **"Bài tập 2: Kiểm tra số nguyên tố"** (gắn bài "Vòng lặp for"), hạn nộp **đã qua 2 ngày**, 6 bài nộp chờ chấm
  (để thẻ "Assignment quá hạn" khác 0 và trang chủ có việc cần xử lý).

## Kiểm tra đánh giá

- **Ngân hàng câu hỏi "Nhập môn Lập trình – giữa kỳ"** (riêng tư), 8 câu nhiều loại (trắc nghiệm một đáp án,
  trắc nghiệm nhiều đáp án, đúng/sai, điền khuyết, trả lời ngắn, tự luận, sắp xếp, ghép cặp), đủ các nhãn
  Thẩm định (Chưa thẩm định / Đã duyệt / Cần sửa) và vài câu Nháp, vài câu Đã xuất bản.
- **Chưa có đề thi nào** ở thời điểm chụp ảnh "trang Bắt đầu" (để Bước 1 hiện "Đã xong", Bước 2 hiện
  "Làm tiếp bước này"); sau đó mới tạo đề. Vì vậy script dựng đề thi và đợt thi là **bước riêng, chạy sau**
  (cờ `--phase exams`).
- **Đợt thi "Thi giữa kỳ — Nhập môn Lập trình, học kỳ I"** (sau khi có đề): một ca thi, một phòng thi,
  trạng thái đợt Nháp.

## Diễn đàn hỏi đáp

- 4 chủ đề do học viên giả đăng trong khoá: 2 chưa giải đáp, 1 đã xử lý (có câu trả lời được đánh dấu), 1 mới
  đăng hôm nay. Ví dụ tiêu đề: "range(1, 5) có in ra số 5 không?", "Khác nhau giữa == và = là gì?".

## Quy ước chung

- Script: `packages/core-lms/scripts/seed-demo-course.ts` (dùng chính các hàm dịch vụ của `core-lms`, giống
  `import-course.ts`; ghi sự kiện `LearningEvent` bằng đường đi thật, không INSERT tay vào bảng sự kiện).
- **Rerun-safe:** chạy lại không tạo trùng (nhận biết bằng slug/email/tên). Không xoá gì (`LearningEvent` là
  append-only, khoá đã có học viên không xoá được).
- In ra cuối: id khoá, id từng lớp và mã mời, id ngân hàng câu hỏi, id hai bài tập, đường dẫn các trang cần chụp.
