# Khoá Các công nghệ giáo dục tiên tiến — học liệu

Học phần chuyên đề cho sinh viên **năm cuối ngành Công nghệ giáo dục**. Trọng tâm
là **năng lực thẩm định**, không phải dạy công cụ: công cụ đổi nhanh hơn tốc độ
cập nhật của bất kỳ chương trình đào tạo nào, còn cách đọc bằng chứng và đặt câu
hỏi đúng thì dùng lại được cho mọi công nghệ kế tiếp.

Nguồn của khoá nằm ở `src/*.py`, không phải ở file JSON. `khoa-cngd-tien-tien.json`
là **sản phẩm sinh ra**, đừng sửa tay — sửa xong chạy build là mất.

```bash
python3 docs/hoc-lieu/cong-nghe-giao-duc-tien-tien/src/build.py              # cả khoá
python3 docs/hoc-lieu/cong-nghe-giao-duc-tien-tien/src/build.py --module 3   # một module, để nhập nối
```

## Cấu trúc khoá

| # | Module | Nội dung | Bài |
|---|---|---|---|
| 1 | Nền tảng thẩm định | Bốn làn sóng công nghệ giáo dục; lý thuyết học tập; TPACK – SAMR – RAT – PICRAT; đọc effect size; bối cảnh pháp lý Việt Nam; toàn cảnh thị trường EdTech thế giới và Việt Nam; hướng dẫn đồ án | 7 |
| 2 | AI tạo sinh | Cơ chế mô hình ngôn ngữ; thiết kế và kiểm thử lời nhắc; trợ giảng và hệ dạy học thông minh; sinh học liệu và chấm bài; liêm chính – thiên lệch – chính sách | 6 |
| 3 | Học thích ứng | Thành phần tri thức và ma trận Q; BKT; DKT và giới hạn; lặp lại ngắt quãng; chính sách chọn bài kế tiếp | 6 |
| 4 | Phân tích học tập | Vòng khép kín; nhật ký sự kiện và chuẩn xAPI; chỉ số không bị lách; bảng điều khiển và cảnh báo sớm; công bằng và quản trị dữ liệu | 6 |
| 5 | Công nghệ nhập vai và triển khai | Phổ thực tại ảo cùng bằng chứng; thiết kế học liệu nhập vai; xưởng kỹ thuật AR; thử nghiệm với người học thật; triển khai; bảo vệ đồ án | 6 |

**31 bài · 420 câu hỏi · 39 lỗi tư duy (`cngdtt.*`) + 39 mẫu phản hồi · 45 sơ đồ
tự vẽ + 8 ảnh có giấy phép.**

## Đồ án xuyên suốt: sách AR

Sản phẩm cuối khoá là một cuốn **sách AR** do sinh viên tự dựng cho một nội dung
dạy học cụ thể. Sáu mốc trải đều năm module, mỗi mốc nộp một mảnh và được góp ý
ngay — không có bản nộp một lần cuối kỳ.

| Mốc | Gắn với | Nộp gì |
|---|---|---|
| 1 | Module 1 | Chọn nội dung, hồ sơ thẩm định, thử nghiệm kỹ thuật nhỏ nhất chạy được |
| 2 | Module 2 | Bản thảo 4 trang có AI hỗ trợ, nhật ký AI, biên bản kiểm chứng |
| 3 | Module 3 | Bộ luyện tập phân hoá ba mức, bảng quyết định thích ứng, cơ chế ôn tập |
| 4 | Module 4 | Kế hoạch đo lường viết trước khi thu dữ liệu, kèm hồ sơ dữ liệu |
| 5 | Module 5 | Bản dựng AR hoàn chỉnh, thử nghiệm với người học thật, danh sách sửa |
| 6 | Buổi cuối | Bảo vệ 10 phút, demo trực tiếp có ba lớp dự phòng |

Tuyến kỹ thuật khuyến nghị là **web AR**: mã QR trên trang in → trang tĩnh dùng
`<model-viewer>` → chế độ AR. Không cần cài ứng dụng, không khoá vào nhà cung cấp.

## Quy ước soạn bài

- Mỗi bài: mục tiêu → mục lục (tối đa 5 mục cấp 2) → nội dung → tổng kết →
  luyện tập cá nhân / nhóm / **bài tập về nhà dạng sản phẩm số** → nguồn tham khảo.
- Bài tập về nhà luôn kèm **Cách làm (gợi ý từng bước)** và dòng **Chấm theo** có
  thang điểm — sinh viên phải làm ra sản phẩm, không viết bài luận suông.
- Câu hỏi sai quan trọng gắn mã lỗi tư duy `cngdtt.*` để Feedback Engine chỉ đúng
  chỗ hiểu nhầm.
- Sơ đồ vẽ bằng khối ```html trong `body` (div + style nội tuyến), chạy được trên
  cả nền sáng lẫn nền tối; ảnh chụp phải có giấy phép và ghi nguồn tại chỗ.

## Nhập vào hệ thống

Module đầu tạo khoá mới; các module sau **nối vào khoá đã có** bằng `--into`.

```bash
pnpm import:course:prod -- --file docs/hoc-lieu/cong-nghe-giao-duc-tien-tien/khoa-cngd-tien-tien.json \
  --owner <email> --dry-run
pnpm import:course:prod -- --file .../module-3.json --owner <email> --into <courseId>
```

Sửa một bài đã nhập thì dùng `pnpm update:lesson:prod -- --file <manifest> --lesson "<tiêu đề>"`.
Mọi câu hỏi đều có `key`, nên sửa đề bài không sinh ra câu trùng.
