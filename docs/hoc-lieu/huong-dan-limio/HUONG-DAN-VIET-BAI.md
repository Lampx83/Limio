# Hướng dẫn viết bài cho khoá "Hướng dẫn sử dụng Limio"

Đọc theo thứ tự: `GIAO-DIEN.md` (sự thật về giao diện) → `src/mockup.py` (hàm `shot`, `legend`, `flow`, `try_now`…) →
`src/m1_l1.py` (bài mẫu về phong cách) → `src/course.py` (mã lỗi tư duy có sẵn).

## Quy tắc ngôn ngữ (user chốt, không thương lượng)

1. Câu **đủ chủ ngữ và vị ngữ**. Viết "Thầy/cô bấm nút Tạo khoá", không viết "Bấm Tạo khoá"
   làm câu độc lập (trong danh sách bước thì được phép bắt đầu bằng động từ nếu đã có
   chủ ngữ ở câu dẫn).
2. Gọi người đọc là **"thầy/cô"**. Tuyệt đối không dùng "bạn", "anh/chị", "quý thầy cô".
3. **Không trộn tiếng Anh với tiếng Việt.** Dùng: bài kiểm tra, bài tập, tiêu chí chấm,
   phản hồi, bảng theo dõi, xuất bản, chương, bài học, học viên, đường dẫn, điểm kinh
   nghiệm, chủ đề, lớp học, diễn đàn hỏi đáp. Được giữ: tên riêng (Limio, Word, Excel,
   YouTube), viết tắt đã quen (AI, QR, PDF, CSV, XP). Không viết: quiz, rubric,
   feedback, dashboard, publish, assignment, module, lesson, forum, upload, link, click.
4. Từ ngữ **dễ hiểu**: câu ngắn (dưới ~25 chữ), một ý một câu, giải thích thuật ngữ ngay
   lần đầu. Không dùng ví dụ trừu tượng; ví dụ lấy từ việc dạy học (môn Toán, Ngữ văn, Tin
   học, một lớp 40 học viên…).
5. Tên nút, tên mục khi trích lại: viết **tên Việt** theo bảng đổi tên ở `GIAO-DIEN.md`
   và đặt trong dấu ngoặc kép hoặc in đậm, ví dụ nút "Xuất bản".

## Khuôn mỗi bài

Mỗi bài là một tệp `src/mN_lK.py` có biến `LESSON` (xem `m1_l1.py`):

- `title`: "Bài N.K · Tên bài" (tên theo việc thầy/cô muốn làm, không theo tên tính năng).
- `durationMin`: 3–6. `description`: một câu. `objectives`: 2–3 mục, mỗi mục bắt đầu bằng
  động từ quan sát được ("Tạo được…", "Phân biệt được…"), sẽ hiện sau câu "Học xong bài
  này, thầy/cô có thể:". `summary`: 3 ý. Không khai báo `objectivesLead` (build tự thêm).
- `body`: tối thiểu **3 mục `##`**. Mỗi bài có **ít nhất một hình**: ảnh chụp giao diện thật (`shot(...)` + `legend([...])`) hoặc sơ đồ quy trình (`flow([...])`) hoặc bảng so sánh. Không nhúng ảnh ngoài.
- Cuối `body`: **`try_now(...)`** — một việc làm được ở khoá của chính thầy/cô, 1–3 phút,
  3–4 bước, bước nào cũng chỉ đúng nơi bấm.
- 1–3 hộp chú giải: `> [!ghi-nho] **Tiêu đề kết thúc bằng dấu chấm.**` rồi dòng sau là nội
  dung (bắt buộc có dấu chấm cuối tiêu đề, nếu không tiêu đề dính vào câu sau); loại có:
  `ghi-nho`, `vi-du`, `canh-bao`, `meo`.
- `quiz`: 3–4 câu, trộn dạng (mcq, true_false, ordering, matching), mỗi câu có `explanation`.
  Phương án sai nên gắn `misconception` bằng mã trong `course.py` khi đúng chỗ hiểu nhầm
  ấy. **Chỉ dùng mã đã có**; cần mã mới thì báo lại ở báo cáo cuối, không tự sửa `course.py`.
  Quiz của bài mẫu cũng là ví dụ quiz cho giảng viên, nên câu hỏi phải tốt: một đáp án
  đúng rõ ràng, phương án sai hợp lý, không đánh đố.

## Hình: ảnh chụp thật (user chốt 2026-10-03, thay cho mockup)

Không vẽ mockup giao diện. Mỗi hình giao diện là một **chỗ đặt ảnh** bằng `shot()`:

```python
from mockup import *
body = (... + shot("1-2-bieu-mau-tao-khoa", "Hình minh hoạ: biểu mẫu tạo khoá học.",
        need="/instructor/courses/new, đã điền tiêu đề 'Toán 10', bật 'Bật cá nhân hoá học tập'",
        marks=["Ô tiêu đề", "Ô cá nhân hoá", "Nút Tạo và tiếp tục"]) + "\n\n"
        + legend(["**Ô tiêu đề.** ...", "**Ô cá nhân hoá.** ...", "**Nút Tạo và tiếp tục.** ..."]) + ...)
```

- `shot()` trả về một dòng Markdown ảnh: nối vào `body` và để **đứng một dòng riêng** (cách đoạn
  trước và sau bằng `\n\n`).
- `need` đủ cụ thể để người chụp không phải hỏi lại: đường dẫn, tab đang mở, đã điền gì, cần dữ liệu
  mẫu gì. `marks` là chữ cho các vòng số vẽ lên ảnh; số trong `legend([...])` đặt ngay dưới ảnh phải
  khớp thứ tự `marks`.
- Mỗi bài 1–2 ảnh, chọn màn hình quan trọng nhất. Văn bản phải tự đứng được khi chưa có ảnh.
- Ảnh được chụp riêng (xem `capture/`); `build.py` ghi danh sách ảnh cần có vào `shots.json`.
- Vẫn dùng được cho phần KHÔNG phải giao diện: `hero`, `flow`, `card`/`row_cards`, `legend`, `try_now`.
  Các hàm `window`, `menu`, `field`, `tabs`, `check`, `radio`, `btn`, `chip`, `two_col`, `mark` (vẽ
  giao diện) không dùng nữa.

Quy tắc kỹ thuật: khối HTML không có dòng trống (`fence` đã xoá); chuỗi `body` ghép bằng `+` chứ
không dùng f-string chứa CSS; `**đậm**` trong hàm của `mockup.py` đã được xử lý.

## Điều không được viết

Xem cuối `GIAO-DIEN.md`. Nếu bài cần một chi tiết mà `GIAO-DIEN.md` không có, **đừng đoán** —
bỏ chi tiết đó hoặc ghi vào báo cáo cuối để kiểm lại trong mã nguồn.

## Kiểm tra trước khi báo xong

```bash
cd /Users/joynguyen/Code/FeedBackMe
python3 docs/hoc-lieu/huong-dan-limio/src/build.py --allow-missing --out <thư-mục-riêng>/<tên>.json
pnpm --filter @feedbackme/core-lms exec tsx ../../docs/hoc-lieu/huong-dan-limio/src/preview.ts <đường-dẫn-json> <thư-mục-xem-trước> light
```

Lệnh thứ hai chạy đúng bộ kiểm tra (zod) của importer và dựng HTML; lỗi schema hiện ở đây.
Dùng thư mục riêng của mình (không ghi đè `khoa-huong-dan-limio.json`, vì nhiều người viết song
song). Sau đó đọc lại HTML sinh ra để tìm: chữ "bạn", từ tiếng Anh, `**` còn sót, dòng
dính nhau.
