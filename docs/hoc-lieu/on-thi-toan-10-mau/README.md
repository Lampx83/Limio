# Khoá mẫu "Ôn thi vào lớp 10 — Toán" (cho nhà xuất bản xem)

> Trạng thái (31/10/2026): **đã nhập máy dev (nháp, chủ khoá `giangvien.mau@feedbackme.dev`)**: 5 bài, 37 câu hỏi, 11 lỗi tư duy;
> công thức KaTeX, lời giải hiện từng bước, Nghe giảng từng bước, PDF bản đọc thử có bản quyền và lô 5 mã (12 tháng).
> Chưa lên prod, chưa commit. Mục đích: để nhà xuất bản (đối tác sách "Ôn thi vào lớp 10") **xem sách của họ hiển thị thế nào
> trên Limio** và thử luồng "sách giấy → nhập mã → học". Nội dung **do Limio tự soạn**, không trích sách của NXB nào.

## Thiết kế dạy học (đặc thù môn Toán)

| Nguyên tắc | Thể hiện trong khoá |
|---|---|
| Học bằng làm; ví dụ mẫu từng bước rồi mờ dần | Ví dụ mẫu chia bước, mỗi bước một dòng kèm "vì sao" → **Tự làm bước cuối** (đáp án gập) → quiz tự giải |
| Kiến thức xếp tầng | Bài 1 là **chẩn đoán điều kiện tiên quyết** (căn, bình phương, hằng đẳng thức, bậc nhất) |
| Lỗi là dữ liệu | **Tìm lỗi trong lời giải** ở mỗi bài + mã lỗi `on10.*` gắn phương án sai, phản hồi chỉ đúng chỗ nhầm |
| Luyện xen kẽ, phân mức, tính giờ | Bài 5: **đề mini 8 câu, 20 phút**, trộn ba chủ đề, ghi mức Nhận biết / Thông hiểu / Vận dụng |
| Công thức chuẩn | KaTeX (`$…$`, `$$…$$`) thay Unicode |
| Nghe vừa xem | **Nghe giảng từng bước**: giọng giảng tới bước nào thì bước đó hiện ra |

| Bài | Nội dung | Bảng màu | Lời giảng |
|---|---|---|---|
| 1 | Khởi động: kiểm tra kiến thức nền (6 câu chẩn đoán) | `paper` | — |
| 2 | Phương trình bậc hai và biệt thức Δ | `limio` | có |
| 3 | Hệ thức Viète và các dạng bài tham số | `forest` | có |
| 4 | Giải bài toán bằng cách lập phương trình | `sunset` | có |
| 5 | Luyện tổng hợp: đề mini tính giờ | `vibrant` | — |

## Tính năng đã thêm vào Limio cho khoá này

- **Công thức toán (KaTeX).** HTML bài chỉ lưu nguồn LaTeX (`<span class="math-inline" data-latex>` / `<div class="math-block" data-latex>`);
  `SafeHtml` dựng ở trình duyệt sau khi lọc (`apps/web/src/lib/mathRender.ts`, `trust:false`). Dùng được trong bài (importer, trình soạn:
  hai node `lessonMathInline` / `lessonMathBlock`) và trong **đề, phương án, giải thích của câu hỏi** (`plainToRichHtml`).
  Luật "$" như pandoc nên "giá $5 và $10" vẫn là tiền.
- **Lời giải hiện từng bước.** Mục "Các bước" có `reveal: true` → `data-reveal`; trang học viên ẩn các bước sau, nút **Bước tiếp / Xem hết /
  Xem lại từ đầu**, bước mới "viết ra" từ trái sang phải. HTML lưu vẫn đủ mọi bước nên in, xuất, người không chạy script vẫn thấy đủ
  (`apps/web/src/lib/lessonReveal.ts`).
- **Nghe giảng từng bước.** Anchor của lời giảng nhận hậu tố `#n` (`"Tên mục #2"` = bước 2 của mục); player tô sáng và hiện đúng bước
  khi đoạn giảng đó phát (`resolveAnchors`, `NarrationPlayer`, importer kiểm anchor `#n` trỏ tới bước có thật).
- `pnpm --filter @feedbackme/core-lms attach:pdf` gắn PDF + bật bản quyền + sinh lô mã (chỉ máy dev, kho tệp trên đĩa).

## Acceptance criteria — đã kiểm

- [x] Mọi phép tính và đáp án quiz thay lại vào phương trình (9 ví dụ, 37 câu).
- [x] Công thức dựng đúng ở bài (82 phần tử KaTeX ở bài 2), hiện được trên điện thoại (< 640px, công thức dài cuộn ngang).
- [x] Hình đồ thị là tệp SVG nhúng bằng ảnh (bộ lọc HTML cắt `<svg>` nội tuyến), hiện đúng, nhãn nghiệm dưới trục.
- [x] "Bước tiếp" / "Xem hết" chạy; Nghe giảng với giọng giả: bước tô sáng và bộ đếm "Bước n/6" đi theo thời gian audio, thanh phát ghi "… · bước 6".
- [x] Test: `mathRender`, `lessonReveal`, `richTextMath`, `learner` (anchor `#n`), `importCourseLayouts` (math, reveal, anchor) xanh; `tsc` sạch.
- [x] PDF bản quyền: người ẩn danh và học viên chưa ghi danh mở link PDF nhận 403.
- [ ] **Chưa làm / chưa kiểm:** học viên đã nhập mã mở được PDF (200); giọng thật (hiện chỉ có tiếng bíp từ bộ đọc giả của dev — cần admin "Tạo lại"
  bằng giọng NEU); xem quiz có công thức trên giao diện học viên; chạy trên prod (kho tệp prod là S3, `attach:pdf` không dùng được ở đó).

## Giới hạn đã biết

- Trình soạn bài chỉ hiện **chữ nguồn LaTeX** trong ô mã (chưa xem trước công thức ngay trong trình soạn); sửa được bằng cách gõ lại nguồn.
- Đề / phương án có `<` ngay sau chữ cái (vd `$a<b$`) bị `looksLikeHtml` coi là HTML nên công thức không dựng; dùng `\lt`.
- Thẻ ghi nhớ, mục tiêu, tổng kết còn dùng Unicode (chưa qua bộ dựng công thức).
- Tiêu đề mục **không** chứa công thức vì tiêu đề là neo của Nghe giảng.

## Cách nhập

```bash
python3 -I docs/hoc-lieu/on-thi-toan-10-mau/src/build.py          # sinh JSON từ nội dung
pnpm import:course -- --file ../../docs/hoc-lieu/on-thi-toan-10-mau/khoa-on-thi-toan-10-mau.json --owner <email> --dry-run
pnpm import:course -- --file ../../docs/hoc-lieu/on-thi-toan-10-mau/khoa-on-thi-toan-10-mau.json --owner <email> [--replace]
pnpm --filter @feedbackme/core-lms attach:pdf --course on-thi-vao-10-toan-mau --lesson "biệt thức" --owner <email> \
  --file <pdf> --title "Bản đọc thử (PDF)" --protect --batch "Lô mẫu cho NXB" --count 5 --months 12
```

`--replace` xoá khoá nháp cùng slug rồi nhập lại (chỉ khi chưa có học viên), nên PDF, cờ bản quyền và lô mã phải gắn lại bằng `attach:pdf`.
Hình đồ thị: `python3 -I docs/hoc-lieu/on-thi-toan-10-mau/src/make_figures.py <userId>` rồi dán URL vào `FIG_PARABOLA` trong `build.py`.
