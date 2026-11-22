# Trang «Tiến độ học liệu» (admin)

Địa chỉ: `/admin/tien-do-hoc-lieu` (chỉ Platform Admin; mục «Tiến độ học liệu» trong menu admin, nhóm Catalog).

Trang theo dõi việc **sinh học liệu cho nhiều môn/khoá**. Mỗi môn là một «dự án» tự đẩy bảng tiến độ của mình lên Redis; trang chỉ hiển thị, không biết gì riêng về môn nào.

## Mô hình dữ liệu

- Khoá Redis: `ops:content-progress:<mã dự án>`; giá trị là JSON kiểu `Project` (xem đầu `apps/web/src/app/admin/tien-do-hoc-lieu/page.tsx`): `id`, `title`, `subtitle`, `updatedAt`, `link`, `stats[]` (ô số liệu), `pipelines[]` (việc đang chạy), `forecast`, `groups[]` (bảng ma trận: cột = công đoạn, hàng = đối tượng như cấp/Chủ đề/bài; mỗi ô `done|partial|todo|na` + chi tiết), `notes[]`.
- Thêm môn mới: chỉ cần ghi một khoá `ops:content-progress:<mã mới>` đúng khuôn trên, không sửa trang.
- Redis chỉ là chỗ chứa bản chụp: số liệu gốc nằm ở thư mục làm việc của từng dự án và script vận hành tính lại được. Mất Redis thì chạy lại script đẩy.

## Dự án HSK bản gốc

Script (ngoài repo): `~/Documents/Limio/hsk-progress/hsk_progress.py` (`--push prod` hoặc `--push local`), đọc thư mục `~/Documents/Limio/hsk*-goc/` và tệp `ops-state.json` (các việc ghi tay: Chủ đề đã nhập thử/có âm thanh/lên Limio, việc đang chạy, dự báo).

Đẩy lên production cần ssh tới server 224 (`ssh limio224`): script chạy `docker exec feedbackme-redis-1 redis-cli -x SET …`.
