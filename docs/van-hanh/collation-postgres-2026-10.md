# Lệch collation Postgres trên server 224 (2026-10-23)

> Trạng thái (2026-10-24): **đã REINDEX xong trên server 224** (bước 4–6, xem "Kết quả thực hiện" cuối mục 3). Bước 3 (ghim `0.8.7-pg15-bookworm` + tắt watchtower) đã sửa trong compose prod/dev và CI, **chưa push**; có hiệu lực ở lần deploy kế tiếp (Postgres khởi động lại 10–30 giây trên cả 224 và AWS). **Còn lại:** push vào giờ vắng, kiểm server AWS, sửa các DB dev bị lệch.
> File kiểm tra chỉ đọc: [`kiem-tra-collation-prod.sql`](kiem-tra-collation-prod.sql).

## 1. Triệu chứng

Ngày 2026-10-23, mỗi lần mở `psql` vào DB `feedbackme` trên server 224 đều in:

```
WARNING: database "feedbackme" has a collation version mismatch
DETAIL: The database was created using collation version 2.41, but the operating system provides version 2.36.
```

Postgres dùng thư viện glibc của hệ điều hành để so sánh chuỗi (locale `en_US.utf8`). Index B-tree trên cột chữ lưu khoá theo thứ tự glibc tính ra **lúc ghi**. Khi glibc đổi phiên bản, thứ tự có thể đổi theo, và index cũ có thể không còn khớp với cách Postgres tìm kiếm hiện tại.

## 2. Nguyên nhân: đổi image, không phải watchtower

| Thời điểm | Image Postgres | Hệ điều hành | glibc |
|---|---|---|---|
| 2026-05-03 → lần deploy đầu có commit `3239ff56` | `postgres:15` | Debian 13 trixie | **2.41** (DB được tạo ở đây) |
| từ lần deploy đó tới nay | `pgvector/pgvector:pg15` | Debian 12 bookworm | **2.36** |

- Commit `3239ff56` (2026-09-13, module Vấn đáp AI A6.2) đổi `image: postgres:15` thành `pgvector/pgvector:pg15` trong `docker-compose.prod.yml` để có extension `vector`. Comment ghi "tương thích ngược 100%", đúng về định dạng dữ liệu nhưng không đúng về hệ điều hành bên dưới.
- Image gốc `postgres:15` đã chuyển sang trixie từ tháng 8/2025. Còn `pgvector/pgvector` vẫn build mặc định trên bookworm: trên Docker Hub, tag `pg15` có **cùng digest** với `pg15-bookworm` (bản 2026-10-01); trixie phải ghi rõ `pg15-trixie`.
- Đã kiểm trên máy dev: `postgres:15` cho `GLIBC 2.41-12+deb13u2`, `pgvector/pgvector:pg15` cho `GLIBC 2.36-9+deb12u14`.
- `deploy.yml` chạy `docker compose up -d postgres …` mỗi lần deploy, nên lần deploy đầu có commit đó trên server 224 đã kéo image mới và khởi động lại Postgres trên bookworm. Commit lên `main` ngày 2026-09-13, nhưng ghi chép ngày 2026-09-28 cho thấy thư mục deploy trên 224 lúc đó vẫn còn `postgres:15`, nên ngày đổi thật có thể muộn hơn. Lệnh `docker inspect` ở bước 1 cho biết lần gần nhất container được tạo lại (`tạo=`), và log deploy trên GitHub Actions cho biết ngày đổi. Dù sao DB đã chạy với glibc lệch tối đa khoảng 6 tuần.
- Watchtower chỉ kéo bản mới hơn của **cùng một tag**, không tự đổi `postgres:15` sang `pgvector/pgvector:pg15`, nên nó không phải nguyên nhân.
- Tuy vậy, watchtower là rủi ro thứ hai: tag `pg15` là tag trôi, mỗi lần pgvector đẩy bản mới (gần nhất 2026-10-01) watchtower có thể tự khởi động lại Postgres prod giữa giờ học. Nếu một ngày pgvector đổi mặc định sang trixie, OS sẽ lại đổi âm thầm như lần này.

### Vì sao không quay về trixie

Quay về `pg15-trixie` thì glibc khớp lại 2.41 với lúc tạo DB, nghe có vẻ gọn hơn. Nhưng `deploy.yml` triển khai **cùng file compose** lên cả server AWS (limio.hust.edu.vn, matrix target `aws`). Server AWS đã chạy `pgvector/pgvector:pg15` từ trước 2026-09-28, nên DB bên đó nhiều khả năng được tạo trên bookworm (2.36). Đổi file compose sang trixie sẽ tạo đúng sự cố này ở AWS. Vì vậy phương án dưới đây **ghim bookworm** (OS mà cả hai server đang chạy) và sửa server 224 cho khớp. Debian 12 hiện ở giai đoạn hỗ trợ dài hạn (LTS, đến khoảng giữa 2028); chuyển sang trixie sau này sẽ là một lần bảo trì có chủ đích, làm cùng lúc với nâng Postgres lên bản lớn mới (dump/restore dựng lại mọi index).

## 3. Rủi ro

- Trên prod có **531 index** dùng collation của hệ điều hành (298 index unique, 180 bảng, tổng 72 MB), vì gần như mọi khoá chính và khoá ngoại là chuỗi (id dạng cuid), cộng với `User.email`, `slug`, mã thi, `LearningEvent.eventKey`…
- Khi index lệch thứ tự, hậu quả **âm thầm**: tìm theo khoá có thể trượt (ví dụ không tìm thấy user theo email ⇒ có thể tạo tài khoản trùng), ràng buộc unique có thể để lọt bản ghi trùng, kết quả sắp xếp sai vị trí.
- Mức thật có thể thấp: thay đổi lớn về collation của glibc là ở bản 2.28; dữ liệu khoá của Limio phần lớn là chữ thường ASCII, chữ số và vài dấu câu. Nhưng chưa có bằng chứng giữa 2.36 và 2.41 không đổi gì, nên phải đo (mục 4 và 5 của file SQL) và sửa bằng REINDEX bất kể kết quả.
- Bản backup `pg_dump` hằng đêm là bản **logic** (dữ liệu dạng SQL), không chứa index, nên **không bị ảnh hưởng** và là đường lui an toàn.

### Kết quả kiểm prod (2026-10-24, bước 1)

| Mục | Kết quả |
|---|---|
| 1. Phiên bản | Lúc tạo **2.41**, hệ điều hành **2.36**; PostgreSQL 15.19 trên Debian 12 (`pgdg12`); DB 173 MB |
| 2. Extension | `pgcrypto`, `plpgsql`, `vector 0.8.6`; **chưa có amcheck** |
| 3. Index bị ảnh hưởng | 531 index (298 unique) trên 180 bảng, tổng 72 MB. `LearningEvent` chiếm 47 MB (116 nghìn dòng) |
| 4. Trùng trong index unique | **0/298**: chưa có bản ghi trùng lọt qua ràng buộc unique |
| 5. amcheck | Bỏ qua (chưa cài) |
| 7. Giờ thấp điểm | 01:00–05:59 khoảng 40–57 sự kiện/giờ; thấp nhất 03:00–05:59 (khoảng 40/giờ). Đông nhất 12:00 (367/giờ) và 00:00 (210/giờ) |

Không có dữ liệu trùng nên REINDEX sẽ không vấp lỗi unique, và chưa cần dọn dữ liệu trước. Cấu trúc index chưa được soát (chưa cài amcheck), nên vẫn chưa biết index đã lệch thật hay chưa; REINDEX vẫn cần làm.

### Kết quả thực hiện (2026-10-24, khoảng 19:38 giờ Việt Nam, lúc không có người dùng)

Thầy/cô yêu cầu làm ngay; Claude chạy qua kết nối SSH thầy/cô đã đăng nhập.

1. **Sao lưu:** `feedbackme_manual_20261024_123802_truoc-reindex-collation` (`/home/codelab/feedbackme-backup-data/manual/`): dump 12 MB đã qua `pg_restore --list`, 180 bảng, `User=854 Course=46 Lesson=587 LearningEvent=125865`, đã chép ra NAS (`offsite=ok`).
2. **REINDEX + REFRESH:** chạy file [`reindex-collation-prod.sql`](reindex-collation-prod.sql). `REINDEX DATABASE feedbackme` mất **4,1 giây** cho cả DB; `REFRESH COLLATION VERSION` báo `changing version from 2.41 to 2.36`.
3. **Kiểm lại:** kết nối không còn cảnh báo; lúc tạo = hệ điều hành = 2.36; 0/298 index unique có giá trị trùng; `/api/health` trả 200, cả 3 replica web vẫn healthy. Tổng cỡ index giảm từ 72 MB xuống 49 MB và DB từ 173 MB xuống 149 MB, vì REINDEX cũng dọn phần index phình.

Bước 3 (ghim image) đã có trong mã nhưng chỉ có hiệu lực sau khi push và deploy. Tới lúc đó watchtower vẫn có thể kéo bản `pg15` mới; việc này không gây lệch lại chừng nào tag `pg15` còn là bookworm.

## 4. Các bước

Thứ tự có chủ ý: kiểm tra (chỉ đọc) → ghim image (chặn sự cố tái diễn) → backup → REINDEX → đánh dấu phiên bản → kiểm lại.

### Bước 1 — Kiểm tra, chỉ đọc (làm bất cứ lúc nào)

Từ thư mục repo trên máy của thầy/cô:

```bash
ssh -p 8901 codelab@101.96.66.224 'docker exec -i feedbackme-postgres-1 psql -U feedbackme -d feedbackme -X -P pager=off' < docs/van-hanh/kiem-tra-collation-prod.sql
```

Đọc kết quả:
- **Mục 1** phải ra `lúc_tạo = 2.41`, `hệ_điều_hành_hiện_tại = 2.36`.
- **Mục 4** có dòng `TRÙNG` ⇒ **dừng lại**, gửi kết quả cho Claude: dữ liệu trùng phải dọn trước, nếu không REINDEX index đó sẽ lỗi. Nếu bảng trùng là `LearningEvent` thì không được xoá dòng (append-only, CLAUDE.md §4.5), cần bàn riêng.
- **Mục 6** cho cỡ index để ước lượng thời gian khoá (xem mục 5 của tài liệu này).
- **Mục 7** cho giờ ít người học nhất để chọn giờ chạy bước 4.

Thêm vài lệnh chỉ đọc để xác nhận nguyên nhân và cấu hình watchtower:

```bash
ssh -p 8901 codelab@101.96.66.224 'docker inspect feedbackme-postgres-1 --format "{{.Config.Image}} tạo={{.Created}} chạy_từ={{.State.StartedAt}}"; docker exec feedbackme-postgres-1 sh -c "ldd --version | head -1; . /etc/os-release; echo \$VERSION_CODENAME"; docker ps --format "{{.Names}} {{.Image}}" | grep -i watchtower'
```

```bash
ssh -p 8901 codelab@101.96.66.224 'W=$(docker ps --format "{{.Names}}" | grep -i watchtower | head -1); docker inspect "$W" --format "{{json .Config.Cmd}}"; docker inspect "$W" --format "{{range .Config.Env}}{{println .}}{{end}}" | grep "^WATCHTOWER_" | grep -v -i -E "token|pass|url"'
```

Nếu watchtower có `--label-enable` (hoặc `WATCHTOWER_LABEL_ENABLE=true`) thì nó chỉ đụng container có nhãn bật; nếu không, nó theo dõi **mọi** container, kể cả `feedbackme-postgres-1`.

### Bước 2 — (Tuỳ chọn, nên làm) Cài amcheck rồi chạy lại bước 1

`amcheck` có sẵn trong image, chỉ cần bật. Đây là **lệnh ghi nhỏ** (thêm vài hàm vào catalog, không đụng dữ liệu, không khoá bảng):

```bash
ssh -p 8901 codelab@101.96.66.224 'docker exec feedbackme-postgres-1 psql -U feedbackme -d feedbackme -X -c "CREATE EXTENSION IF NOT EXISTS amcheck;"'
```

Chạy lại file SQL ở bước 1. Mục 5 sẽ soát từng index B-tree (chỉ giữ khoá đọc; trên dev 538 index soát xong dưới 1 giây). Có dòng `HỎNG` nghĩa là index đã lệch thật, nên làm bước 3–5 sớm. Giữ extension lại sau đó cũng được, để kiểm định kỳ.

### Bước 3 — Ghim image Postgres (một commit, cần duyệt)

Sửa `docker-compose.prod.yml`:

```yaml
  postgres:
    # Ghim cả bản pgvector lẫn hệ điều hành. Tag trôi `pg15` từng đổi OS
    # (trixie → bookworm) khi chuyển từ postgres:15 sang pgvector, làm lệch
    # collation glibc 2.41 → 2.36 (docs/van-hanh/collation-postgres-2026-10.md).
    # Đổi tag ở đây = bảo trì có chủ đích: đổi codename (bookworm/trixie) bắt buộc REINDEX.
    image: pgvector/pgvector:0.8.7-pg15-bookworm
    labels:
      # Watchtower không được tự khởi động lại DB prod.
      com.centurylinklabs.watchtower.enable: "false"
```

Đổi cùng tag trong `docker-compose.yml` (dev) và `.github/workflows/ci.yml` cho đồng bộ. Tag này không đổi OS của dev (vẫn bookworm).

Postgres dev trên máy (cổng 5434) bị cùng một chuyện, cùng một nguyên nhân: cụm dev được khởi tạo trên `postgres:15` (trixie), rồi `docker-compose.yml` cũng chuyển sang `pgvector/pgvector:pg15` trong commit `7e28af60` (cùng ngày 2026-09-13). Kết quả kiểm ngày 2026-10-23:

| DB dev | lúc tạo | hiện tại |
|---|---|---|
| `feedbackme` | 2.36 | 2.36 (tạo lại sau khi đổi image, không lệch) |
| `feedbackme_test`, `feedbackme_stale_backup`, `postgres` | 2.41 | 2.36 (lệch) |

Dev không cần cửa sổ bảo trì: `feedbackme_test` là DB test dựng lại được, các DB còn lại chỉ cần `REINDEX DATABASE <tên>;` rồi `ALTER DATABASE <tên> REFRESH COLLATION VERSION;`, chạy từ checkout gốc (CLAUDE.md §6.1).

Lưu ý khi đẩy commit này lên `main`:
- Tag mới và nhãn mới làm `docker compose up -d postgres` trong `deploy.yml` **tạo lại container Postgres** trên **cả 224 lẫn AWS**: mất kết nối DB khoảng 10–30 giây, web tự kết nối lại. Hệ điều hành không đổi (vẫn bookworm, glibc 2.36), nên không tạo thêm lệch.
- Vì vậy nên đẩy commit vào giờ thấp điểm, không trùng ca thi.
- Nhãn watchtower có hiệu lực ngay khi container được tạo lại.

### Bước 4 — Backup ngay trước khi REINDEX (giờ thấp điểm)

Chọn giờ theo mục 7 của file SQL, tránh 02:30 (backup hằng đêm) và các ca thi đã lên lịch. Theo số đo ngày 2026-10-24, khung **03:00–05:59** vắng nhất. Vì REINDEX chỉ mất vài giây đến dưới 1 phút, khung 18:00–19:59 (khoảng 65–80 sự kiện/giờ, tức hơn 1 sự kiện/phút) cũng chấp nhận được nếu không tiện thức khuya.

```bash
ssh -p 8901 codelab@101.96.66.224 '/home/codelab/services/backup/feedbackme-backup.sh manual truoc-reindex-collation; tail -20 /home/codelab/feedbackme-backup-data/backup.log'
```

Chỉ đi tiếp khi log có `dump ok — … bảng` (dump đã qua `pg_restore --list`). Lỗi ở bước uploads hoặc offsite không chặn việc này, vì REINDEX chỉ đụng DB.

### Bước 5 — REINDEX và đánh dấu phiên bản collation

Mở một phiên psql trên server (gõ trong cùng một phiên để `\timing` và `lock_timeout` có hiệu lực):

```bash
ssh -t -p 8901 codelab@101.96.66.224 'docker exec -it feedbackme-postgres-1 psql -U feedbackme -d feedbackme -X'
```

Trong psql:

```sql
\timing on
-- Không xếp hàng chờ khoá quá 10 giây; nếu báo lock timeout thì chạy lại lệnh đó.
SET lock_timeout = '10s';

-- 5a. Đo thật trên bảng có index lớn nhất trước:
REINDEX TABLE "LearningEvent";

-- 5b. Toàn bộ DB (Postgres 15: gồm cả catalog hệ thống). Không chạy trong BEGIN … COMMIT.
REINDEX DATABASE feedbackme;

-- 5c. Chỉ chạy SAU KHI 5b xong không lỗi: ghi nhận DB nay theo glibc 2.36.
ALTER DATABASE feedbackme REFRESH COLLATION VERSION;
```

- Nếu 5b dừng giữa chừng vì index unique báo trùng: phần đã dựng vẫn giữ, **không chạy 5c**, gửi thông báo lỗi cho Claude.
- 5c chỉ đổi một con số trong catalog; nó không sửa index. Chạy 5c mà bỏ 5b là che cảnh báo đi trong khi index vẫn có thể lệch.

### Bước 6 — Kiểm lại

Thoát psql, chạy lại file SQL ở bước 1:
- Không còn cảnh báo `collation version mismatch` khi kết nối.
- Mục 1: `lúc_tạo = 2.36 = hệ_điều_hành_hiện_tại`.
- Mục 4: `0 index có giá trị trùng`; mục 5 (nếu đã cài amcheck): `0 index báo hỏng`.

Rồi chạy chính file đó trên server AWS (bằng khoá `.pem`, user `ubuntu`) để xác nhận bên đó **không** lệch. Nếu AWS cũng lệch thì lặp lại bước 4–6 ở đó.

### Đường lui

- REINDEX không sửa dòng dữ liệu nào, chỉ dựng lại index; chạy lại nhiều lần vẫn an toàn.
- Nếu có sự cố lạ sau REINDEX: khôi phục DB từ bản backup bước 4 bằng `feedbackme-restore.sh <thư-mục-backup> --db-only --yes` (CLAUDE.md §7.6). Lưu ý: mọi thứ ghi sau lúc backup sẽ mất, nên chỉ dùng khi thật cần.

## 5. Thời gian khoá dự kiến

`REINDEX` (bản thường, không CONCURRENTLY) xử lý **từng bảng một**. Trong lúc dựng index của một bảng: ghi vào bảng đó (INSERT/UPDATE/DELETE) phải chờ, và truy vấn cần dùng đúng index đang dựng cũng chờ. Các bảng khác vẫn chạy bình thường. Với catalog hệ thống, mọi truy vấn mới có thể khựng trong tích tắc.

Số đo prod (2026-10-24): DB 173 MB, 531 index bị ảnh hưởng, tổng cỡ index 72 MB. Bảng lớn nhất là `LearningEvent`: 116 nghìn dòng, bảng 45 MB, index 47 MB. Mọi bảng khác có index dưới 4 MB, nên dựng lại mất cỡ mili-giây mỗi bảng.

| Việc | Ước lượng | Ai bị ảnh hưởng |
|---|---|---|
| Bước 3: tạo lại container Postgres | 10–30 giây | Mọi request cần DB, trên cả 224 và AWS |
| Bước 5a: `REINDEX TABLE "LearningEvent"` | vài giây (47 MB index) | Ghi sự kiện học phải chờ |
| Bước 5b: `REINDEX DATABASE` | **dưới 1 phút** tổng cộng; `LearningEvent` vài giây, mỗi bảng còn lại dưới 1 giây | Ghi vào bảng đang được dựng |
| Bước 5c: `REFRESH COLLATION VERSION` | tức thì | Không ai |

Số này là **ước lượng** (chưa đo REINDEX trên bản sao prod). Bước 5a chính là phép đo thật: nếu `LearningEvent` mất hơn 10 giây thì dừng, đối chiếu mục 6 của file SQL, và cân nhắc `REINDEX … CONCURRENTLY` (không chặn ghi, nhưng chậm hơn và phải chạy theo từng bảng). Cả cửa sổ bảo trì bước 4–6, kể cả backup và kiểm lại, nên dành **15 phút**.

## 6. Bài học

- Đổi image cơ sở dữ liệu phải coi là thay đổi hạ tầng, không phải chi tiết của một tính năng: kiểm cả hệ điều hành bên dưới (`ldd --version`), không chỉ phiên bản Postgres.
- Không dùng tag trôi cho DB prod; tag phải ghi cả bản phần mềm lẫn codename OS.
- Cảnh báo `collation version mismatch` đã có trong log Postgres từ ngày đổi image nhưng không ai đọc. Có thể thêm bước kiểm `datcollversion` vào job cảnh báo (`docker/cron/alert.sh`) như một việc riêng sau này.
