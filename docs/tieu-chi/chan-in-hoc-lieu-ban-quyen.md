# Chặn in học liệu của khoá bản quyền — Acceptance criteria

> Bản nháp 22/11/2026, thầy chốt phạm vi: **chặn hết** (bài học, slide của bài, link chia sẻ bài giảng; cả giảng viên chủ khoá cũng không in được). Mở rộng AC1 của `hoc-lieu-nha-xuat-ban-P0.md`: dùng chính cờ **"Học liệu có bản quyền"** (`Course.protectedMedia`), giảng viên không phải bật thêm gì.

## Vì sao làm

Cờ bản quyền hiện chỉ giữ file (PDF, ảnh, video, âm thanh) khỏi người chưa có quyền. Chữ của bài thì vẫn in thành PDF được qua `/learn/[slug]/lessons/[id]/print` (đường in có chủ đích), và người dùng bấm Ctrl+P trên trang bài cũng in được.

## Giới hạn phải nói thẳng

Trình duyệt **không cho web chặn in tuyệt đối**. Thứ chặn chắc chắn là phía máy chủ (không dựng bản in). Phần còn lại chỉ làm khó người dùng thường: ai chụp màn hình, quay màn hình, chép tay hay tắt CSS vẫn lấy được chữ. Chống rò rỉ thật cần thêm watermark tên người xem (chưa làm, ghi ở "Để sau"). Giao diện bật cờ phải nói đúng điều này, không hứa quá.

## AC1 — Trang bản in `/print` của bài

- **Given** khoá bật cờ, **When** bất kỳ ai (học viên, người xem thử, giảng viên chủ khoá, trợ giảng, admin) mở `/learn/[slug]/lessons/[id]/print` (kể cả `?gv=1`), **Then** thấy trang thông báo "Học liệu của khoá này có bản quyền, không cho phép in hoặc lưu PDF" kèm nút quay lại bài; **không** có nội dung bài, tiêu đề bài, ghi chú giảng viên, và **không** tự gọi hộp thoại in.
- **Given** khoá không bật cờ, **Then** `/print` chạy đúng như trước.
- **Given** khoá bật cờ, **When** tắt cờ, **Then** `/print` chạy lại ngay (không cache).
- Bài đặt "xem thử" **cũng bị chặn in**: xem thử là cho đọc, không phải cho mang đi.

## AC2 — Trang bài học thường

- **Given** khoá bật cờ, **Then** các nút "In / Lưu PDF" (đầu bài ngoài khung 3 cột, thanh công cụ nội dung) **không hiện**.
- **Given** khoá bật cờ, **When** người xem bấm Ctrl+P / Cmd+P hoặc menu In của trình duyệt trên trang bài, **Then** bản xem trước chỉ có một dòng "Học liệu có bản quyền — không cho phép in", không có nội dung bài.
- **Given** khoá không bật cờ, **Then** không thêm CSS in nào, trang không đổi.

## AC3 — Slide của bài (`/learn/[slug]/lessons/[id]/slides`)

- **Given** khoá bật cờ, **When** in từ trang slide, **Then** như AC2 (trang trắng kèm dòng thông báo). Trang này vốn không có nút PDF (`allowPdf={false}`), giữ nguyên.

## AC4 — Link chia sẻ bài giảng (`/bai-giang/<mã>`)

- **Given** bài giảng đang gắn vào một bài học của khoá bật cờ, **When** mở link chia sẻ của bài giảng đó, **Then** nút "Tải PDF" không hiện và in bằng trình duyệt ra trang trắng kèm dòng thông báo.
- **Given** bài giảng không gắn vào bài học nào, hoặc gắn vào khoá **không** bật cờ, **Then** link chia sẻ chạy như trước, nút "Tải PDF" vẫn có.
- Bài giảng gỡ khỏi bài học (hoặc khoá tắt cờ) thì mở lại in được ngay.
- **Không đổi:** link chia sẻ vẫn mở cho ai có mã (cổng xem không thuộc phạm vi này). Muốn siết thì làm AC riêng.

## AC5 — Giao diện bật cờ

- Mô tả ở bảng "Học liệu có bản quyền" (tab Tổng quan của khoá) nói thêm: bật thì **không in, không lưu PDF** bài học, slide và link chia sẻ bài giảng gắn với khoá, kể cả với giảng viên.
- Lưu ý dưới công tắc nói đúng giới hạn: chặn in chỉ làm khó người dùng thông thường, không chống chụp màn hình.
- **Phải làm rõ với giảng viên:** bật cờ thì chính họ cũng không in được bản có ghi chú (`?gv=1`) để cầm lên lớp. Muốn in thì tắt cờ tạm thời.

## Không hồi quy

- Khoá không bật cờ: không đổi gì, không thêm truy vấn đáng kể (một cột `protectedMedia` đã có sẵn trong truy vấn khoá).
- Không ghi `LearningEvent` khi bị chặn (không phải hành vi học, và sẽ phình bảng khi bị dò).
- Không đụng bản in phòng thi, mã phòng thi, giấy chứng nhận (không phải học liệu của bài).
- Nội dung vẫn **hiện trên màn hình** bình thường; chỉ đường in bị chặn.

## Quyết định kỹ thuật

- Lõi quyết định ở `core-lms/courses/protectedMedia.ts`: `isLessonPrintBlocked(lessonId)`, `isLiveDeckPrintBlocked(deckId)` (bài giảng nằm trong bài học của khoá bật cờ).
- CSS chặn in là một thành phần dùng chung `PrintBlock` (thẻ `<style>` trong `@media print` + dòng chữ qua `::before`), chỉ nhúng khi khoá bật cờ, nên không đụng `globals.css`.
- Thêm trang mới hiện nội dung bài học ⇒ phải tra cờ và nhúng `PrintBlock`, như quy tắc `guardedLessonMedia` cho file.

## Để sau

- Watermark tên/email người xem lên trang bài (chống chụp màn hình có truy vết).
- Siết cổng xem của link chia sẻ bài giảng theo khoá bản quyền.
