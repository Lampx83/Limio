-- Kiểm tra index trên prod sau khi glibc của image Postgres đổi từ 2.41 (trixie) sang 2.36 (bookworm). CHỈ ĐỌC.
-- Chạy:  ssh -p 8901 codelab@101.96.66.224 'docker exec -i feedbackme-postgres-1 psql -U feedbackme -d feedbackme -X -P pager=off' < docs/van-hanh/kiem-tra-collation-prod.sql
-- Không có câu lệnh ghi nào; transaction đặt READ ONLY và luôn ROLLBACK. Phương án sửa: docs/van-hanh/collation-postgres-2026-10.md
--
-- Đọc kết quả:
--   * Mục 3 liệt kê index phụ thuộc thứ tự chữ của hệ điều hành (gần như mọi khoá chính vì id là chuỗi).
--   * Mục 4 tìm giá trị trùng trong index UNIQUE bằng cách quét thẳng bảng, không đi qua index đang nghi hỏng.
--     Có dòng "TRÙNG" ⇒ phải dọn dữ liệu trùng trước, nếu không REINDEX index đó sẽ báo lỗi.
--   * Mục 5 dùng amcheck soát cấu trúc từng index. amcheck chưa cài thì mục này tự bỏ qua (cài là một lệnh ghi,
--     xem bước 2 trong file phương án). Không có dòng "HỎNG" vẫn chưa chứng minh index lành tuyệt đối,
--     nên REINDEX vẫn phải làm; kết quả chỉ cho biết có cần dọn dữ liệu và gấp tới mức nào.
--   * Mục 6 cho số liệu để ước lượng thời gian khoá bảng khi REINDEX.
BEGIN READ ONLY;
\pset border 1
\pset null '-'

\echo '=== 1. PHIÊN BẢN COLLATION: LÚC TẠO DATABASE vs HỆ ĐIỀU HÀNH ĐANG CHẠY ==='
SELECT datname, datcollate, datctype,
       datcollversion AS lúc_tạo,
       pg_database_collation_actual_version(oid) AS hệ_điều_hành_hiện_tại,
       pg_size_pretty(pg_database_size(oid)) AS dung_lượng_db
FROM pg_database WHERE datname = current_database();
SELECT version();

\echo '=== 2. EXTENSION ĐANG CÀI (amcheck có chưa?) ==='
SELECT extname, extversion FROM pg_extension ORDER BY 1;

\echo '=== 3. INDEX DÙNG COLLATION CỦA HỆ ĐIỀU HÀNH (bị ảnh hưởng) — 40 index lớn nhất ==='
WITH idx AS (
  SELECT DISTINCT i.indexrelid, i.indrelid
  FROM pg_index i
  CROSS JOIN LATERAL unnest(i.indcollation::oid[]) AS k(coll)
  JOIN pg_collation co ON co.oid = k.coll
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = ic.relnamespace
  WHERE co.collprovider IN ('d', 'c') AND co.collname NOT IN ('C', 'POSIX')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
)
SELECT idx.indrelid::regclass AS bảng, idx.indexrelid::regclass AS index, am.amname AS loại,
       i.indisunique AS unique, pg_size_pretty(pg_relation_size(idx.indexrelid)) AS cỡ
FROM idx
JOIN pg_index i ON i.indexrelid = idx.indexrelid
JOIN pg_class ic ON ic.oid = idx.indexrelid
JOIN pg_am am ON am.oid = ic.relam
ORDER BY pg_relation_size(idx.indexrelid) DESC
LIMIT 40;

WITH idx AS (
  SELECT DISTINCT i.indexrelid, i.indrelid, i.indisunique
  FROM pg_index i
  CROSS JOIN LATERAL unnest(i.indcollation::oid[]) AS k(coll)
  JOIN pg_collation co ON co.oid = k.coll
  JOIN pg_class ic ON ic.oid = i.indexrelid
  JOIN pg_namespace n ON n.oid = ic.relnamespace
  WHERE co.collprovider IN ('d', 'c') AND co.collname NOT IN ('C', 'POSIX')
    AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
)
SELECT count(*) AS số_index_bị_ảnh_hưởng,
       count(*) FILTER (WHERE indisunique) AS trong_đó_unique,
       count(DISTINCT indrelid) AS số_bảng,
       pg_size_pretty(sum(pg_relation_size(indexrelid))) AS tổng_cỡ_index
FROM idx;

\echo '=== 4. GIÁ TRỊ TRÙNG TRONG INDEX UNIQUE (quét thẳng bảng, không dùng index) ==='
SET LOCAL enable_indexscan = off;
SET LOCAL enable_indexonlyscan = off;
SET LOCAL enable_bitmapscan = off;
DO $$
DECLARE
  r record;
  keys text;
  cond text;
  n bigint;
  checked int := 0;
  bad int := 0;
BEGIN
  FOR r IN
    SELECT DISTINCT i.indexrelid, i.indrelid, i.indnkeyatts, i.indpred
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indcollation::oid[]) AS k(coll)
    JOIN pg_collation co ON co.oid = k.coll
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    WHERE i.indisunique AND i.indisvalid
      AND co.collprovider IN ('d', 'c') AND co.collname NOT IN ('C', 'POSIX')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
  LOOP
    -- Cột khoá (hoặc biểu thức như lower(email)); hai NULL không tính là trùng.
    SELECT string_agg(format('(%s)', pg_get_indexdef(r.indexrelid, a, true)), ', ' ORDER BY a),
           string_agg(format('(%s) IS NOT NULL', pg_get_indexdef(r.indexrelid, a, true)), ' AND ' ORDER BY a)
      INTO keys, cond
      FROM generate_series(1, r.indnkeyatts) AS a;
    IF r.indpred IS NOT NULL THEN
      cond := cond || format(' AND (%s)', pg_get_expr(r.indpred, r.indrelid, true));
    END IF;
    EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM %s WHERE %s GROUP BY %s HAVING count(*) > 1) d',
                   r.indrelid::regclass, cond, keys)
      INTO n;
    checked := checked + 1;
    IF n > 0 THEN
      bad := bad + 1;
      RAISE WARNING 'TRÙNG: index % (bảng %) có % giá trị bị lặp', r.indexrelid::regclass, r.indrelid::regclass, n;
    END IF;
  END LOOP;
  RAISE NOTICE 'Mục 4 xong: đã soát % index unique, % index có giá trị trùng.', checked, bad;
END $$;

\echo '=== 5. AMCHECK: SOÁT CẤU TRÚC TỪNG INDEX B-TREE (bỏ qua nếu chưa cài amcheck) ==='
DO $$
DECLARE
  r record;
  checked int := 0;
  bad int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'amcheck') THEN
    RAISE NOTICE 'amcheck chưa cài — bỏ qua mục 5. Cài theo bước 2 trong docs/van-hanh/collation-postgres-2026-10.md rồi chạy lại file này.';
    RETURN;
  END IF;
  FOR r IN
    SELECT DISTINCT i.indexrelid, pg_relation_size(i.indexrelid) AS sz
    FROM pg_index i
    CROSS JOIN LATERAL unnest(i.indcollation::oid[]) AS k(coll)
    JOIN pg_collation co ON co.oid = k.coll
    JOIN pg_class ic ON ic.oid = i.indexrelid
    JOIN pg_am am ON am.oid = ic.relam AND am.amname = 'btree'
    JOIN pg_namespace n ON n.oid = ic.relnamespace
    WHERE i.indisvalid AND i.indisready
      AND co.collprovider IN ('d', 'c') AND co.collname NOT IN ('C', 'POSIX')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_toast%'
    ORDER BY sz
  LOOP
    BEGIN
      -- heapallindexed = true: mọi dòng trong bảng phải tìm thấy trong index. Chỉ giữ khoá đọc (AccessShareLock).
      PERFORM bt_index_check(r.indexrelid::regclass, true);
    EXCEPTION WHEN OTHERS THEN
      bad := bad + 1;
      RAISE WARNING 'HỎNG: index % — %', r.indexrelid::regclass, SQLERRM;
    END;
    checked := checked + 1;
  END LOOP;
  RAISE NOTICE 'Mục 5 xong: đã soát % index b-tree, % index báo hỏng.', checked, bad;
END $$;

\echo '=== 6. ƯỚC LƯỢNG THỜI GIAN KHOÁ KHI REINDEX: 15 BẢNG CÓ INDEX LỚN NHẤT ==='
SELECT c.oid::regclass AS bảng,
       c.reltuples::bigint AS số_dòng_ước_tính,
       pg_size_pretty(pg_relation_size(c.oid)) AS cỡ_bảng,
       pg_size_pretty(pg_indexes_size(c.oid)) AS cỡ_mọi_index
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE c.relkind = 'r' AND n.nspname = 'public'
ORDER BY pg_indexes_size(c.oid) DESC
LIMIT 15;

\echo '=== 7. CHỌN GIỜ THẤP ĐIỂM: SỰ KIỆN HỌC TRUNG BÌNH MỖI NGÀY THEO GIỜ VIỆT NAM (28 ngày) ==='
SELECT extract(hour FROM e."occurredAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Ho_Chi_Minh')::int AS giờ_vn,
       round(count(*) / 28.0, 1) AS sự_kiện_trung_bình_mỗi_ngày,
       count(DISTINCT e."userId") AS số_người_khác_nhau_trong_28_ngày
FROM "LearningEvent" e
WHERE e."occurredAt" > (now() AT TIME ZONE 'UTC') - interval '28 days'
GROUP BY 1 ORDER BY 1;

ROLLBACK;
