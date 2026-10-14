# Khoá Nhập môn Nghiên cứu khoa học — học liệu

Đối tượng: **sinh viên đại học** làm NCKH sinh viên / khoá luận / bài tập lớn có tính nghiên cứu
lần đầu. Đây là khoá cơ bản trong bộ 4 khoá về kỹ năng nghiên cứu (SV → học viên cao học → nghiên
cứu sinh → khoá chuyên đề xử lý dữ liệu, chưa soạn).

Nguồn của khoá nằm ở `src/*.py`, không phải ở file JSON. `khoa-nhap-mon-nckh.json`
là **sản phẩm sinh ra**, đừng sửa tay — sửa xong chạy build là mất.

```bash
python3 docs/hoc-lieu/nhap-mon-nckh/src/build.py
```

## Cấu trúc khoá

**Một module duy nhất** ("Nhập môn NCKH"), 5 bài theo đúng trình tự làm một đề tài thật: đặt câu
hỏi → đọc tài liệu → trích dẫn đúng → chọn cách trả lời → viết và trình bày. Một đề tài do người
học tự chọn được dùng xuyên suốt cả 5 bài — sản phẩm luyện tập ở bài sau dùng lại sản phẩm của bài
trước, không phải bài tập rời rạc.

| # | Bài | Trạng thái |
|---|---|---|
| 1.1 | Nghiên cứu khoa học là gì và đặt câu hỏi nghiên cứu thế nào | ✅ |
| 2.1 | Đọc tài liệu có hệ thống và tìm khoảng trống nghiên cứu | ✅ |
| 3.1 | Trích dẫn đúng và giữ liêm chính học thuật | ✅ |
| 4.1 | Chọn cách trả lời câu hỏi nghiên cứu — thiết kế cơ bản | ✅ |
| 5.1 | Viết báo cáo và trình bày trước hội đồng | ✅ |

**Khoá đã soạn xong toàn bộ 5 bài.** Câu hỏi cuối bài **soạn mới**, gắn mã lỗi tư duy (`nckh.*`) để
Feedback Engine nói được học viên sai ở đâu.

## Nhập vào hệ thống

Khoá chỉ có một module nên nhập một lần, không cần `--into`.

```bash
pnpm import:course -- --file docs/hoc-lieu/nhap-mon-nckh/khoa-nhap-mon-nckh.json \
  --owner <email-gv> --dry-run
pnpm import:course -- --file docs/hoc-lieu/nhap-mon-nckh/khoa-nhap-mon-nckh.json --owner <email-gv>
```

Vào production thì đổi lệnh thành `import:course:prod` và mở hầm SSH trước — xem đầu file
`packages/core-lms/scripts/import-course.ts`.

Khoá nhập xong ở trạng thái **nháp**; publish là việc của người duyệt nội dung.

## Quy ước khi soạn tiếp

- Mỗi bài tối đa **5 mục cấp 2** (`##`), nếu không importer cảnh báo mục lục quá dài.
- Mỗi bài kết bằng mục *Luyện tập và tài liệu tham khảo* gồm ba lớp: cá nhân, nhóm, bài tập về
  nhà — rồi mới tới nguồn tham khảo. Ưu tiên dùng lại đề tài của chính người học qua các bài, thay
  vì bài tập rời rạc.
- Mọi phương án SAI đáng chú ý phải gắn `misconception`; mã mới khai báo thêm vào `MISCONCEPTIONS`
  trong `src/course.py` kèm một mẫu phản hồi tương ứng.
- Sơ đồ vẽ bằng khối ```html (div + style nội tuyến) thay vì ảnh ngoài: không phụ thuộc tệp đặt ở
  đâu đó, đọc được trên cả nền sáng lẫn nền tối, và **không cần xin phép ảnh**. Nếu sau này cần
  ảnh thật (ảnh học giả, sơ đồ gốc từ một công trình), phải kiểm giấy phép qua API Wikimedia và mở
  xem tận mắt trước khi đưa vào, giống quy ước ở khoá Kỹ năng mềm — bài 1.1 hiện chưa dùng ảnh nào.
- Nguồn tham khảo dùng sách/bài báo kinh điển, dễ kiểm chứng (Hulley, Booth & Colomb, Creswell…),
  không bịa DOI hay link — nếu cần link (video, bài báo có DOI cụ thể) phải xác minh trước khi ghi
  vào bài, không viết theo trí nhớ.

## Video nhúng trong bài

`videos.tsv` — mỗi bài 2 video (mở bài + minh họa), toàn bộ từ kênh **Scribbr** (chuyên nội dung
phương pháp nghiên cứu) trừ 2 video (Academic Bites ở bài 1.1, Academic English Now ở bài 2.1, Carl
Kwan ở bài 5.1). Tiêu đề, kênh và thời lượng đã xác minh qua oEmbed của YouTube trước khi gắn — không
ghi theo trí nhớ, theo đúng quy ước ở khoá Kỹ năng mềm.

Đã gắn vào production bằng `layout:lesson:prod` (video 1 ở vị trí `0` — ngay sau mục tiêu bài học;
video 2 ở vị trí `3` — sau mục thứ 3 của thân bài). Lệnh mẫu (xem `videos.tsv` để lấy id/tiêu đề đầy
đủ cho từng bài):

```bash
pnpm layout:lesson:prod -- \
  --file docs/hoc-lieu/nhap-mon-nckh/khoa-nhap-mon-nckh.json \
  --lesson "Bài 1.1" --owner joynguyen7@gmail.com \
  --video "0|https://www.youtube.com/watch?v=<id1>|<tiêu đề> (<thời lượng>)|<mô tả>" \
  --video "3|https://www.youtube.com/watch?v=<id2>|<tiêu đề> (<thời lượng>)|<mô tả>" \
  --dry-run
```

`layout:lesson` dựng lại toàn bộ khối nội dung (richtext + video) của đúng bài được chọn — không
đụng tới quiz. Chạy `--dry-run` trước luôn, đối chiếu số khối cũ/mới trước khi bỏ cờ để ghi thật.

Ảnh minh họa (Wikimedia Commons) **chưa làm** — khoá nội dung khá trừu tượng (khung FINER, APA,
thang đo…) nên ưu tiên video trước; có thể bổ sung sau nếu tìm được ảnh thật sự phù hợp và đúng
giấy phép, theo quy ước ở mục trên.

## Trạng thái trên hệ thống

| Nơi | Khoá | Ghi chú |
|---|---|---|
| Prod (server 224) | `nhap-mon-nckh` — `c73e350c-0928-46fe-89f7-01f87c9ddcdb` | Nhập qua hầm SSH, chủ sở hữu `joynguyen7@gmail.com`. Đã gắn video cả 5 bài. Đang ở trạng thái **nháp**, chưa publish. |
| Local | — | Chưa nhập (chỉ mới build manifest + dry-run) |
