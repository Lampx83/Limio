# Video giảng viên nói (Ditto) — dựng và nạp

Tiêu chí: `docs/tieu-chi/trinh-chieu-giang-vien.md`, AC7. Trình chiếu «Học với giảng viên ảo» hiện thầy Tiến Đạt ở góc dưới phải, miệng nói khớp giọng.

## Vì sao dựng offline

Dịch vụ Ditto là container `vidgen-avatar` của Vidgen trên server 232, chỉ nằm trong mạng docker `dc_network`, cổng 8791 không mở ra ngoài. Production Limio (server 224, HUST Singapore) **không gọi tới được** (đã kiểm 01/11/2026: từ 224 tới 101.96.66.232 cả cổng 8791 lẫn ssh 8901 đều báo `No route to host`; HUST Singapore chưa kiểm vì không có khoá ssh). Vì vậy:

1. `export` chép giọng và mốc đoạn của bài ra thư mục việc (chạy nơi có DB + kho tệp: container worker của production, hoặc máy dev trỏ DB đó).
2. `build-lecturer-video.ts` dựng video trên máy có ssh tới 232 (ví dụ máy dev của người vận hành), không cần DB.
3. `attach` nạp video vào kho tệp và bài (cũng chạy nơi có DB + kho tệp).

Video là **tắt tiếng** và dài đúng bằng tệp giọng; trình phát chạy nó theo `audio.currentTime`, nên không đổi trình phát hay tệp âm thanh.

## Số liệu (đo 01/11/2026, GPU L40 dùng chung)

| | |
|---|---|
| Thời gian dựng một clip | ~3,3 giây GPU cho mỗi giây lời (clip 15 giây: 47 giây; lần đầu có thêm 11,5 giây nạp mô hình). Không phụ thuộc cỡ video |
| Khoá `toan-10-slide-tuong-tac` | 5 bài, 210 đoạn, 1.519 giây lời (30,4 phút giọng) → khoảng 80–90 phút GPU |
| Dung lượng | bản 512 px ≈ 35 KB/giây giọng, bản 256 px ≈ 11 KB/giây. Bài 9 phút: ~19 MB + ~6 MB |
| Lưu trữ | kho tệp lớp `private` (S3/MinIO hoặc volume uploads), cạnh tệp giọng |

GPU dùng chung với vLLM và các việc khác: dịch vụ chỉ nạp mô hình khi có việc, giữ khoá `GPU.lock`, thiếu bộ nhớ thì việc chờ. Dựng vào giờ thấp điểm.

## Quy trình

```bash
# 1. Chép giọng ra thư mục việc (nơi có DB + kho tệp). Chỉ đọc.
pnpm --filter @feedbackme/web exec tsx scripts/lecturer-video.ts export --course toan-10-slide-tuong-tac --out ./lv-work

# 2. Dựng (máy có ssh tới 232). Xem kế hoạch trước bằng --dry-run. Cần ffmpeg, ffprobe.
LECTURER_AVATAR_SSH=tizia-prod pnpm --filter @feedbackme/web exec tsx scripts/build-lecturer-video.ts --dir ./lv-work --dry-run
LECTURER_AVATAR_SSH=tizia-prod pnpm --filter @feedbackme/web exec tsx scripts/build-lecturer-video.ts --dir ./lv-work

# 3. Nạp. Mặc định chỉ in kế hoạch; thêm --apply để ghi kho tệp và DB.
pnpm --filter @feedbackme/web exec tsx scripts/lecturer-video.ts attach --dir ./lv-work --lecturer tien-dat
pnpm --filter @feedbackme/web exec tsx scripts/lecturer-video.ts attach --dir ./lv-work --lecturer tien-dat --apply
```

- Dịch vụ Ditto: `LECTURER_AVATAR_SSH=<máy ssh>` (ssh + `docker exec vidgen-avatar python -m vidgen.avatar call …`, khoá API ở lại trong container, không in ra) hoặc `LECTURER_AVATAR_URL=http://máy:8791` + `LECTURER_AVATAR_KEY`.
- Ảnh: mặc định `public/lecturers/tien-dat.jpg`; đổi bằng `--photo`. Mã `--lecturer` phải là một giảng viên ảo trong danh mục (`VIRTUAL_LECTURERS`) và là người trong ảnh: video chỉ phát khi học viên đang học với đúng giảng viên đó.
- Trong container production: migration `20261101120000_lecturer_video` phải đã chạy (`migrate` của deploy lo việc này). Container `worker` có sẵn tsx và mã nguồn; chép thư mục việc vào bằng `docker cp` rồi chạy lệnh `attach` ở đó.

## Idempotent và an toàn

- `build`: đoạn đã có trong `clips/` (khoá theo ảnh + âm thanh đoạn + cỡ) không gọi lại Ditto; bài có `video.json` khớp ảnh + giọng + mốc đoạn thì bỏ qua. Lỗi một đoạn thì thử lại 3 lần; chạy lại script tiếp tục từ chỗ dở.
- `attach`: bài đã nạp đúng bản thì bỏ qua; **từ chối bài mà giọng đã tạo lại** sau lúc `export` (video sẽ lệch tiếng); tệp lên kho lỗi giữa chừng thì xoá phần đã lên; bản video cũ bị thay thì xoá khỏi kho.
- Tạo lại giọng của bài (admin bấm tạo giọng) thì video cũ tự ngừng dùng và bị xoá khỏi kho; học viên thấy ảnh tĩnh cho tới khi dựng và nạp lại.

## Bật / tắt và gỡ

- Tắt cho mọi bài: `NARRATION_LECTURER_VIDEO=0` trong `/etc/feedbackme/.env.prod` rồi `$COMPOSE up -d web` (mặc định trống = bật). Học viên về ảnh tĩnh, không cần sửa dữ liệu.
- Gỡ video của một bài: đặt các cột `video*` của dòng `LessonNarration` về NULL (rồi xoá tệp `lesson-narration/<lessonId>/lecturer-*.mp4` trong kho nếu cần dung lượng).

## Giới hạn đã biết

- Đầu mỗi đoạn giảng, tư thế đầu của Ditto quay về gần trạng thái ban đầu của ảnh (mỗi đoạn là một clip riêng, nối bằng giữ hình cuối khi nghỉ 0,5 giây): có thể thấy nhích nhẹ giữa hai đoạn.
- Chỉ có video cho giảng viên đã dựng (hiện chỉ Tiến Đạt); giảng viên khác vẫn dùng ảnh tĩnh.
- Chưa kiểm trên điện thoại thật; chưa đo mức dùng mạng thật qua 4G.
