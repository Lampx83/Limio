-- Dựng lại mọi index theo glibc đang chạy, rồi ghi nhận phiên bản collation mới. CÓ GHI (chỉ index + catalog).
-- Chạy SAU khi backup thủ công đã qua bước "dump ok" (docs/van-hanh/collation-postgres-2026-10.md, bước 4–5):
--   ssh -p 8901 codelab@101.96.66.224 'docker exec -i feedbackme-postgres-1 psql -U feedbackme -d feedbackme -X -P pager=off' < docs/van-hanh/reindex-collation-prod.sql
-- Không sửa dòng dữ liệu nào; chạy lại nhiều lần vẫn an toàn. Lỗi ở bất kỳ lệnh nào ⇒ dừng, KHÔNG chạy REFRESH.
\set ON_ERROR_STOP on
\timing on
\pset border 1

\echo '=== TRƯỚC ==='
SELECT datcollversion AS lúc_tạo, pg_database_collation_actual_version(oid) AS hệ_điều_hành
FROM pg_database WHERE datname = current_database();

-- Không xếp hàng chờ khoá quá 10 giây; báo lock timeout thì chạy lại cả file.
SET lock_timeout = '10s';

\echo '=== REINDEX DATABASE (từng bảng một, mỗi bảng một transaction) ==='
REINDEX DATABASE feedbackme;

\echo '=== GHI NHẬN PHIÊN BẢN COLLATION MỚI ==='
ALTER DATABASE feedbackme REFRESH COLLATION VERSION;

\echo '=== SAU ==='
SELECT datcollversion AS lúc_tạo, pg_database_collation_actual_version(oid) AS hệ_điều_hành
FROM pg_database WHERE datname = current_database();
