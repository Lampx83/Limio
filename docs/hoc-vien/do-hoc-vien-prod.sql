-- Đo học viên trên prod: học viên mới mỗi tuần, cửa vào, % có hoạt động học đầu tiên,
-- % quay lại sau 7 ngày, và danh sách 30 ngày để nhắn hỏi trực tiếp. CHỈ ĐỌC.
-- Chạy:  ssh -p 8901 codelab@101.96.66.224 'docker exec -i feedbackme-postgres-1 psql -U feedbackme -d feedbackme -X -P pager=off' < docs/hoc-vien/do-hoc-vien-prod.sql
-- Không có câu lệnh ghi nào; transaction đặt READ ONLY và luôn ROLLBACK.
--
-- Định nghĩa (ghi rõ để đọc số không hiểu nhầm):
--   * Học viên  = có vai learner, KHÔNG kiêm instructor/admin/org_admin/mentor/researcher; bỏ email @feedbackme.dev, @example.com.
--   * Cửa vào   = việc đầu tiên trong: ghi danh qua link mời vào lớp (lớp không mặc định), ghi danh trực tiếp
--                 (lớp mặc định: tự chọn trong danh mục, mua, hoặc GV thêm), thi bằng mã, vào trò chơi trực tiếp.
--                 Thí sinh thi bằng mã không có tài khoản thì KHÔNG nằm trong số này.
--   * Hoạt động học = sự kiện lesson/quiz/assignment/exam/flashcard/forum/speaking/writing/tournament/portfolio,
--                 bấm gợi ý ôn tập (feedback.remediation.clicked), hoặc vào trò chơi. Không tính XP/huy hiệu/ghi danh.
--   * Quay lại sau 7 ngày = lần truy cập cuối hoặc hoạt động cuối rơi từ ngày thứ 7 sau khi tạo tài khoản trở đi.
--                 lastAccessAt chỉ giữ lần CUỐI nên đây là "có quay lại ít nhất một lần", không phải tần suất.
--                 Chỉ chia trên người đã có tài khoản đủ 7 ngày.
--   * Phần F có tên + email học viên: đừng dán kết quả ra kênh chung.
BEGIN READ ONLY;
\pset border 1
\pset null '-'

\echo '=== A. TỔNG QUAN ==='
WITH hv AS (
  -- Học viên thuần: có vai learner, không kiêm giảng viên/quản trị; bỏ tài khoản demo/thử.
  SELECT u.id, u."displayName", u.email, u."createdAt", u."lastAccessAt", u."emailVerifiedAt"
  FROM "User" u
  WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                WHERE ur."userId" = u.id AND r.name = 'learner')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.name IN ('instructor', 'admin', 'org_admin', 'mentor', 'researcher'))
    AND u.email NOT LIKE '%@feedbackme.dev' AND u.email NOT LIKE '%@example.com'
),
cua AS (
  -- Cửa vào = việc đầu tiên học viên làm: ghi danh, thi, hay chơi trò chơi.
  SELECT hv.id, coalesce(x.kind, '5. chưa vào đâu') AS cua_vao, x.at AS luc_vao
  FROM hv
  LEFT JOIN LATERAL (
    SELECT kind, at FROM (
      SELECT CASE WHEN s."isDefault" THEN '2. ghi danh trực tiếp (danh mục / GV thêm)'
                  ELSE '1. link mời vào lớp' END AS kind, e."enrolledAt" AS at
      FROM "Enrollment" e JOIN "Cohort" s ON s.id = e."sectionId" WHERE e."userId" = hv.id
      UNION ALL SELECT '3. thi bằng mã', a."startedAt" FROM "ExamAttempt" a WHERE a."userId" = hv.id
      UNION ALL SELECT '4. trò chơi trực tiếp', g."joinedAt" FROM "GameParticipant" g WHERE g."userId" = hv.id
    ) t ORDER BY at LIMIT 1
  ) x ON true
),
hd AS (
  -- Hoạt động học thật (không tính XP/huy hiệu/ghi danh tự sinh): bài học, quiz, bài tập,
  -- thi, flashcard, thảo luận, nói/viết, đấu trường, hồ sơ, bấm gợi ý ôn tập, vào trò chơi.
  SELECT "userId", min(at) AS dau, max(at) AS cuoi, count(*) AS so
  FROM (
    SELECT e."userId", e."occurredAt" AS at FROM "LearningEvent" e
    WHERE e."userId" IN (SELECT id FROM hv)
      AND (split_part(e."eventType", '.', 1) IN
             ('lesson', 'quiz', 'assignment', 'exam', 'flashcard', 'forum', 'speaking', 'writing', 'tournament', 'portfolio')
           OR e."eventType" = 'feedback.remediation.clicked')
    UNION ALL
    SELECT g."userId", g."joinedAt" FROM "GameParticipant" g WHERE g."userId" IN (SELECT id FROM hv)
  ) t
  GROUP BY "userId"
),
m AS (
  SELECT hv.*, cua.cua_vao, cua.luc_vao, hd.dau, hd.cuoi, coalesce(hd.so, 0) AS so_hoat_dong,
         -- Quay lại = còn thấy mặt (truy cập hoặc học) từ ngày thứ 7 sau khi tạo tài khoản.
         (greatest(hv."lastAccessAt", hd.cuoi) >= hv."createdAt" + interval '7 days') AS quay_lai,
         (hv."createdAt" <= now() - interval '7 days') AS du_7_ngay
  FROM hv JOIN cua ON cua.id = hv.id LEFT JOIN hd ON hd."userId" = hv.id
)
SELECT 'học viên (thuần, không tính tài khoản demo)' AS chỉ_số, count(*)::text AS giá_trị FROM m
UNION ALL SELECT 'đã xác minh email', count(*) FILTER (WHERE "emailVerifiedAt" IS NOT NULL)::text FROM m
UNION ALL SELECT 'mới 7 ngày', count(*) FILTER (WHERE "createdAt" > now() - interval '7 days')::text FROM m
UNION ALL SELECT 'mới 30 ngày', count(*) FILTER (WHERE "createdAt" > now() - interval '30 days')::text FROM m
UNION ALL SELECT 'truy cập trong 7 ngày', count(*) FILTER (WHERE "lastAccessAt" > now() - interval '7 days')::text FROM m
UNION ALL SELECT 'truy cập trong 30 ngày', count(*) FILTER (WHERE "lastAccessAt" > now() - interval '30 days')::text FROM m
UNION ALL SELECT 'có hoạt động học (từ trước tới nay)', count(*) FILTER (WHERE so_hoat_dong > 0)::text FROM m;

\echo '=== B. HỌC VIÊN MỚI MỖI TUẦN (12 tuần, tuần bắt đầu thứ Hai, giờ VN) ==='
WITH hv AS (
  -- Học viên thuần: có vai learner, không kiêm giảng viên/quản trị; bỏ tài khoản demo/thử.
  SELECT u.id, u."displayName", u.email, u."createdAt", u."lastAccessAt", u."emailVerifiedAt"
  FROM "User" u
  WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                WHERE ur."userId" = u.id AND r.name = 'learner')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.name IN ('instructor', 'admin', 'org_admin', 'mentor', 'researcher'))
    AND u.email NOT LIKE '%@feedbackme.dev' AND u.email NOT LIKE '%@example.com'
),
cua AS (
  -- Cửa vào = việc đầu tiên học viên làm: ghi danh, thi, hay chơi trò chơi.
  SELECT hv.id, coalesce(x.kind, '5. chưa vào đâu') AS cua_vao, x.at AS luc_vao
  FROM hv
  LEFT JOIN LATERAL (
    SELECT kind, at FROM (
      SELECT CASE WHEN s."isDefault" THEN '2. ghi danh trực tiếp (danh mục / GV thêm)'
                  ELSE '1. link mời vào lớp' END AS kind, e."enrolledAt" AS at
      FROM "Enrollment" e JOIN "Cohort" s ON s.id = e."sectionId" WHERE e."userId" = hv.id
      UNION ALL SELECT '3. thi bằng mã', a."startedAt" FROM "ExamAttempt" a WHERE a."userId" = hv.id
      UNION ALL SELECT '4. trò chơi trực tiếp', g."joinedAt" FROM "GameParticipant" g WHERE g."userId" = hv.id
    ) t ORDER BY at LIMIT 1
  ) x ON true
),
hd AS (
  -- Hoạt động học thật (không tính XP/huy hiệu/ghi danh tự sinh): bài học, quiz, bài tập,
  -- thi, flashcard, thảo luận, nói/viết, đấu trường, hồ sơ, bấm gợi ý ôn tập, vào trò chơi.
  SELECT "userId", min(at) AS dau, max(at) AS cuoi, count(*) AS so
  FROM (
    SELECT e."userId", e."occurredAt" AS at FROM "LearningEvent" e
    WHERE e."userId" IN (SELECT id FROM hv)
      AND (split_part(e."eventType", '.', 1) IN
             ('lesson', 'quiz', 'assignment', 'exam', 'flashcard', 'forum', 'speaking', 'writing', 'tournament', 'portfolio')
           OR e."eventType" = 'feedback.remediation.clicked')
    UNION ALL
    SELECT g."userId", g."joinedAt" FROM "GameParticipant" g WHERE g."userId" IN (SELECT id FROM hv)
  ) t
  GROUP BY "userId"
),
m AS (
  SELECT hv.*, cua.cua_vao, cua.luc_vao, hd.dau, hd.cuoi, coalesce(hd.so, 0) AS so_hoat_dong,
         -- Quay lại = còn thấy mặt (truy cập hoặc học) từ ngày thứ 7 sau khi tạo tài khoản.
         (greatest(hv."lastAccessAt", hd.cuoi) >= hv."createdAt" + interval '7 days') AS quay_lai,
         (hv."createdAt" <= now() - interval '7 days') AS du_7_ngay
  FROM hv JOIN cua ON cua.id = hv.id LEFT JOIN hd ON hd."userId" = hv.id
)
SELECT to_char(date_trunc('week', ("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh'), 'YYYY-MM-DD') AS tuần,
       count(*) AS mới,
       count(*) FILTER (WHERE cua_vao LIKE '1.%') AS link_mời,
       count(*) FILTER (WHERE cua_vao LIKE '2.%') AS ghi_danh_trực_tiếp,
       count(*) FILTER (WHERE cua_vao LIKE '3.%') AS thi,
       count(*) FILTER (WHERE cua_vao LIKE '4.%') AS trò_chơi,
       count(*) FILTER (WHERE cua_vao LIKE '5.%') AS chưa_vào_đâu,
       round(100.0 * count(*) FILTER (WHERE so_hoat_dong > 0) / count(*)) AS "%_có_hoạt_động",
       CASE WHEN bool_and(du_7_ngay)
            THEN round(100.0 * count(*) FILTER (WHERE quay_lai) / count(*))::text ELSE 'chưa đủ 7 ngày' END AS "%_quay_lại_sau_7_ngày"
FROM m
WHERE "createdAt" > now() - interval '12 weeks'
GROUP BY 1 ORDER BY 1;

\echo '=== C. THEO CỬA VÀO (học viên tạo trong 90 ngày) ==='
WITH hv AS (
  -- Học viên thuần: có vai learner, không kiêm giảng viên/quản trị; bỏ tài khoản demo/thử.
  SELECT u.id, u."displayName", u.email, u."createdAt", u."lastAccessAt", u."emailVerifiedAt"
  FROM "User" u
  WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                WHERE ur."userId" = u.id AND r.name = 'learner')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.name IN ('instructor', 'admin', 'org_admin', 'mentor', 'researcher'))
    AND u.email NOT LIKE '%@feedbackme.dev' AND u.email NOT LIKE '%@example.com'
),
cua AS (
  -- Cửa vào = việc đầu tiên học viên làm: ghi danh, thi, hay chơi trò chơi.
  SELECT hv.id, coalesce(x.kind, '5. chưa vào đâu') AS cua_vao, x.at AS luc_vao
  FROM hv
  LEFT JOIN LATERAL (
    SELECT kind, at FROM (
      SELECT CASE WHEN s."isDefault" THEN '2. ghi danh trực tiếp (danh mục / GV thêm)'
                  ELSE '1. link mời vào lớp' END AS kind, e."enrolledAt" AS at
      FROM "Enrollment" e JOIN "Cohort" s ON s.id = e."sectionId" WHERE e."userId" = hv.id
      UNION ALL SELECT '3. thi bằng mã', a."startedAt" FROM "ExamAttempt" a WHERE a."userId" = hv.id
      UNION ALL SELECT '4. trò chơi trực tiếp', g."joinedAt" FROM "GameParticipant" g WHERE g."userId" = hv.id
    ) t ORDER BY at LIMIT 1
  ) x ON true
),
hd AS (
  -- Hoạt động học thật (không tính XP/huy hiệu/ghi danh tự sinh): bài học, quiz, bài tập,
  -- thi, flashcard, thảo luận, nói/viết, đấu trường, hồ sơ, bấm gợi ý ôn tập, vào trò chơi.
  SELECT "userId", min(at) AS dau, max(at) AS cuoi, count(*) AS so
  FROM (
    SELECT e."userId", e."occurredAt" AS at FROM "LearningEvent" e
    WHERE e."userId" IN (SELECT id FROM hv)
      AND (split_part(e."eventType", '.', 1) IN
             ('lesson', 'quiz', 'assignment', 'exam', 'flashcard', 'forum', 'speaking', 'writing', 'tournament', 'portfolio')
           OR e."eventType" = 'feedback.remediation.clicked')
    UNION ALL
    SELECT g."userId", g."joinedAt" FROM "GameParticipant" g WHERE g."userId" IN (SELECT id FROM hv)
  ) t
  GROUP BY "userId"
),
m AS (
  SELECT hv.*, cua.cua_vao, cua.luc_vao, hd.dau, hd.cuoi, coalesce(hd.so, 0) AS so_hoat_dong,
         -- Quay lại = còn thấy mặt (truy cập hoặc học) từ ngày thứ 7 sau khi tạo tài khoản.
         (greatest(hv."lastAccessAt", hd.cuoi) >= hv."createdAt" + interval '7 days') AS quay_lai,
         (hv."createdAt" <= now() - interval '7 days') AS du_7_ngay
  FROM hv JOIN cua ON cua.id = hv.id LEFT JOIN hd ON hd."userId" = hv.id
)
SELECT cua_vao AS cửa_vào,
       count(*) AS số_học_viên,
       round(100.0 * count(*) / sum(count(*)) OVER ()) AS "%_tổng",
       round(100.0 * count(*) FILTER (WHERE so_hoat_dong > 0) / count(*)) AS "%_có_hoạt_động",
       round(100.0 * count(*) FILTER (WHERE quay_lai AND du_7_ngay) / nullif(count(*) FILTER (WHERE du_7_ngay), 0)) AS "%_quay_lại_sau_7_ngày",
       count(*) FILTER (WHERE du_7_ngay) AS "mẫu_số_quay_lại"
FROM m
WHERE "createdAt" > now() - interval '90 days'
GROUP BY 1 ORDER BY 1;

\echo '=== D. CÁCH TẠO TÀI KHOẢN (học viên tạo trong 90 ngày) ==='
WITH hv AS (
  -- Học viên thuần: có vai learner, không kiêm giảng viên/quản trị; bỏ tài khoản demo/thử.
  SELECT u.id, u."displayName", u.email, u."createdAt", u."lastAccessAt", u."emailVerifiedAt"
  FROM "User" u
  WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                WHERE ur."userId" = u.id AND r.name = 'learner')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.name IN ('instructor', 'admin', 'org_admin', 'mentor', 'researcher'))
    AND u.email NOT LIKE '%@feedbackme.dev' AND u.email NOT LIKE '%@example.com'
),
cua AS (
  -- Cửa vào = việc đầu tiên học viên làm: ghi danh, thi, hay chơi trò chơi.
  SELECT hv.id, coalesce(x.kind, '5. chưa vào đâu') AS cua_vao, x.at AS luc_vao
  FROM hv
  LEFT JOIN LATERAL (
    SELECT kind, at FROM (
      SELECT CASE WHEN s."isDefault" THEN '2. ghi danh trực tiếp (danh mục / GV thêm)'
                  ELSE '1. link mời vào lớp' END AS kind, e."enrolledAt" AS at
      FROM "Enrollment" e JOIN "Cohort" s ON s.id = e."sectionId" WHERE e."userId" = hv.id
      UNION ALL SELECT '3. thi bằng mã', a."startedAt" FROM "ExamAttempt" a WHERE a."userId" = hv.id
      UNION ALL SELECT '4. trò chơi trực tiếp', g."joinedAt" FROM "GameParticipant" g WHERE g."userId" = hv.id
    ) t ORDER BY at LIMIT 1
  ) x ON true
),
hd AS (
  -- Hoạt động học thật (không tính XP/huy hiệu/ghi danh tự sinh): bài học, quiz, bài tập,
  -- thi, flashcard, thảo luận, nói/viết, đấu trường, hồ sơ, bấm gợi ý ôn tập, vào trò chơi.
  SELECT "userId", min(at) AS dau, max(at) AS cuoi, count(*) AS so
  FROM (
    SELECT e."userId", e."occurredAt" AS at FROM "LearningEvent" e
    WHERE e."userId" IN (SELECT id FROM hv)
      AND (split_part(e."eventType", '.', 1) IN
             ('lesson', 'quiz', 'assignment', 'exam', 'flashcard', 'forum', 'speaking', 'writing', 'tournament', 'portfolio')
           OR e."eventType" = 'feedback.remediation.clicked')
    UNION ALL
    SELECT g."userId", g."joinedAt" FROM "GameParticipant" g WHERE g."userId" IN (SELECT id FROM hv)
  ) t
  GROUP BY "userId"
),
m AS (
  SELECT hv.*, cua.cua_vao, cua.luc_vao, hd.dau, hd.cuoi, coalesce(hd.so, 0) AS so_hoat_dong,
         -- Quay lại = còn thấy mặt (truy cập hoặc học) từ ngày thứ 7 sau khi tạo tài khoản.
         (greatest(hv."lastAccessAt", hd.cuoi) >= hv."createdAt" + interval '7 days') AS quay_lai,
         (hv."createdAt" <= now() - interval '7 days') AS du_7_ngay
  FROM hv JOIN cua ON cua.id = hv.id LEFT JOIN hd ON hd."userId" = hv.id
)
, ap AS (
  SELECT m.id, coalesce(string_agg(DISTINCT p.provider, '+' ORDER BY p.provider), 'không có (GV/quản trị tạo)') AS cach
  FROM m LEFT JOIN "AuthProvider" p ON p."userId" = m.id
  WHERE m."createdAt" > now() - interval '90 days'
  GROUP BY m.id
)
SELECT cach AS đăng_nhập_bằng, count(*) AS số_học_viên FROM ap GROUP BY 1 ORDER BY 2 DESC;

\echo '=== E. PHỄU LẦN ĐẦU (học viên tạo trong 90 ngày) ==='
WITH hv AS (
  -- Học viên thuần: có vai learner, không kiêm giảng viên/quản trị; bỏ tài khoản demo/thử.
  SELECT u.id, u."displayName", u.email, u."createdAt", u."lastAccessAt", u."emailVerifiedAt"
  FROM "User" u
  WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                WHERE ur."userId" = u.id AND r.name = 'learner')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.name IN ('instructor', 'admin', 'org_admin', 'mentor', 'researcher'))
    AND u.email NOT LIKE '%@feedbackme.dev' AND u.email NOT LIKE '%@example.com'
),
cua AS (
  -- Cửa vào = việc đầu tiên học viên làm: ghi danh, thi, hay chơi trò chơi.
  SELECT hv.id, coalesce(x.kind, '5. chưa vào đâu') AS cua_vao, x.at AS luc_vao
  FROM hv
  LEFT JOIN LATERAL (
    SELECT kind, at FROM (
      SELECT CASE WHEN s."isDefault" THEN '2. ghi danh trực tiếp (danh mục / GV thêm)'
                  ELSE '1. link mời vào lớp' END AS kind, e."enrolledAt" AS at
      FROM "Enrollment" e JOIN "Cohort" s ON s.id = e."sectionId" WHERE e."userId" = hv.id
      UNION ALL SELECT '3. thi bằng mã', a."startedAt" FROM "ExamAttempt" a WHERE a."userId" = hv.id
      UNION ALL SELECT '4. trò chơi trực tiếp', g."joinedAt" FROM "GameParticipant" g WHERE g."userId" = hv.id
    ) t ORDER BY at LIMIT 1
  ) x ON true
),
hd AS (
  -- Hoạt động học thật (không tính XP/huy hiệu/ghi danh tự sinh): bài học, quiz, bài tập,
  -- thi, flashcard, thảo luận, nói/viết, đấu trường, hồ sơ, bấm gợi ý ôn tập, vào trò chơi.
  SELECT "userId", min(at) AS dau, max(at) AS cuoi, count(*) AS so
  FROM (
    SELECT e."userId", e."occurredAt" AS at FROM "LearningEvent" e
    WHERE e."userId" IN (SELECT id FROM hv)
      AND (split_part(e."eventType", '.', 1) IN
             ('lesson', 'quiz', 'assignment', 'exam', 'flashcard', 'forum', 'speaking', 'writing', 'tournament', 'portfolio')
           OR e."eventType" = 'feedback.remediation.clicked')
    UNION ALL
    SELECT g."userId", g."joinedAt" FROM "GameParticipant" g WHERE g."userId" IN (SELECT id FROM hv)
  ) t
  GROUP BY "userId"
),
m AS (
  SELECT hv.*, cua.cua_vao, cua.luc_vao, hd.dau, hd.cuoi, coalesce(hd.so, 0) AS so_hoat_dong,
         -- Quay lại = còn thấy mặt (truy cập hoặc học) từ ngày thứ 7 sau khi tạo tài khoản.
         (greatest(hv."lastAccessAt", hd.cuoi) >= hv."createdAt" + interval '7 days') AS quay_lai,
         (hv."createdAt" <= now() - interval '7 days') AS du_7_ngay
  FROM hv JOIN cua ON cua.id = hv.id LEFT JOIN hd ON hd."userId" = hv.id
)
SELECT '1. tạo tài khoản' AS bước, count(*) AS số, 100 AS "%" FROM m WHERE "createdAt" > now() - interval '90 days'
UNION ALL SELECT '2. … vào được lớp / thi / trò chơi', count(*) FILTER (WHERE cua_vao NOT LIKE '5.%'),
       round(100.0 * count(*) FILTER (WHERE cua_vao NOT LIKE '5.%') / nullif(count(*), 0))
  FROM m WHERE "createdAt" > now() - interval '90 days'
UNION ALL SELECT '3. … và có hoạt động học', count(*) FILTER (WHERE cua_vao NOT LIKE '5.%' AND so_hoat_dong > 0),
       round(100.0 * count(*) FILTER (WHERE cua_vao NOT LIKE '5.%' AND so_hoat_dong > 0) / nullif(count(*), 0))
  FROM m WHERE "createdAt" > now() - interval '90 days'
UNION ALL SELECT '4. … và quay lại sau 7 ngày (chỉ tính người đã đủ 7 ngày)',
       count(*) FILTER (WHERE cua_vao NOT LIKE '5.%' AND so_hoat_dong > 0 AND quay_lai),
       round(100.0 * count(*) FILTER (WHERE cua_vao NOT LIKE '5.%' AND so_hoat_dong > 0 AND quay_lai) / nullif(count(*), 0))
  FROM m WHERE "createdAt" > now() - interval '90 days' AND du_7_ngay
UNION ALL SELECT '(ngoài phễu) có hoạt động học dù chưa vào lớp/thi/trò chơi — vd đọc khoá công khai',
       count(*) FILTER (WHERE cua_vao LIKE '5.%' AND so_hoat_dong > 0),
       round(100.0 * count(*) FILTER (WHERE cua_vao LIKE '5.%' AND so_hoat_dong > 0) / nullif(count(*), 0))
  FROM m WHERE "createdAt" > now() - interval '90 days'
ORDER BY 1;

\echo '=== E2. TỪ LÚC TẠO TÀI KHOẢN TỚI HOẠT ĐỘNG HỌC ĐẦU TIÊN (90 ngày, ai có hoạt động) ==='
WITH hv AS (
  -- Học viên thuần: có vai learner, không kiêm giảng viên/quản trị; bỏ tài khoản demo/thử.
  SELECT u.id, u."displayName", u.email, u."createdAt", u."lastAccessAt", u."emailVerifiedAt"
  FROM "User" u
  WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                WHERE ur."userId" = u.id AND r.name = 'learner')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.name IN ('instructor', 'admin', 'org_admin', 'mentor', 'researcher'))
    AND u.email NOT LIKE '%@feedbackme.dev' AND u.email NOT LIKE '%@example.com'
),
cua AS (
  -- Cửa vào = việc đầu tiên học viên làm: ghi danh, thi, hay chơi trò chơi.
  SELECT hv.id, coalesce(x.kind, '5. chưa vào đâu') AS cua_vao, x.at AS luc_vao
  FROM hv
  LEFT JOIN LATERAL (
    SELECT kind, at FROM (
      SELECT CASE WHEN s."isDefault" THEN '2. ghi danh trực tiếp (danh mục / GV thêm)'
                  ELSE '1. link mời vào lớp' END AS kind, e."enrolledAt" AS at
      FROM "Enrollment" e JOIN "Cohort" s ON s.id = e."sectionId" WHERE e."userId" = hv.id
      UNION ALL SELECT '3. thi bằng mã', a."startedAt" FROM "ExamAttempt" a WHERE a."userId" = hv.id
      UNION ALL SELECT '4. trò chơi trực tiếp', g."joinedAt" FROM "GameParticipant" g WHERE g."userId" = hv.id
    ) t ORDER BY at LIMIT 1
  ) x ON true
),
hd AS (
  -- Hoạt động học thật (không tính XP/huy hiệu/ghi danh tự sinh): bài học, quiz, bài tập,
  -- thi, flashcard, thảo luận, nói/viết, đấu trường, hồ sơ, bấm gợi ý ôn tập, vào trò chơi.
  SELECT "userId", min(at) AS dau, max(at) AS cuoi, count(*) AS so
  FROM (
    SELECT e."userId", e."occurredAt" AS at FROM "LearningEvent" e
    WHERE e."userId" IN (SELECT id FROM hv)
      AND (split_part(e."eventType", '.', 1) IN
             ('lesson', 'quiz', 'assignment', 'exam', 'flashcard', 'forum', 'speaking', 'writing', 'tournament', 'portfolio')
           OR e."eventType" = 'feedback.remediation.clicked')
    UNION ALL
    SELECT g."userId", g."joinedAt" FROM "GameParticipant" g WHERE g."userId" IN (SELECT id FROM hv)
  ) t
  GROUP BY "userId"
),
m AS (
  SELECT hv.*, cua.cua_vao, cua.luc_vao, hd.dau, hd.cuoi, coalesce(hd.so, 0) AS so_hoat_dong,
         -- Quay lại = còn thấy mặt (truy cập hoặc học) từ ngày thứ 7 sau khi tạo tài khoản.
         (greatest(hv."lastAccessAt", hd.cuoi) >= hv."createdAt" + interval '7 days') AS quay_lai,
         (hv."createdAt" <= now() - interval '7 days') AS du_7_ngay
  FROM hv JOIN cua ON cua.id = hv.id LEFT JOIN hd ON hd."userId" = hv.id
)
SELECT count(*) AS số_học_viên,
       count(*) FILTER (WHERE dau - "createdAt" <= interval '1 hour') AS trong_1_giờ,
       count(*) FILTER (WHERE dau - "createdAt" <= interval '1 day') AS trong_1_ngày,
       round((percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM dau - "createdAt")) / 3600)::numeric, 1) AS trung_vị_giờ
FROM m
WHERE "createdAt" > now() - interval '90 days' AND dau IS NOT NULL;

\echo '=== F. DANH SÁCH HỌC VIÊN 30 NGÀY GẦN NHẤT (mới nhất trước) — để nhắn hỏi trực tiếp ==='
WITH hv AS (
  -- Học viên thuần: có vai learner, không kiêm giảng viên/quản trị; bỏ tài khoản demo/thử.
  SELECT u.id, u."displayName", u.email, u."createdAt", u."lastAccessAt", u."emailVerifiedAt"
  FROM "User" u
  WHERE EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                WHERE ur."userId" = u.id AND r.name = 'learner')
    AND NOT EXISTS (SELECT 1 FROM "UserRole" ur JOIN "Role" r ON r.id = ur."roleId"
                    WHERE ur."userId" = u.id AND r.name IN ('instructor', 'admin', 'org_admin', 'mentor', 'researcher'))
    AND u.email NOT LIKE '%@feedbackme.dev' AND u.email NOT LIKE '%@example.com'
),
cua AS (
  -- Cửa vào = việc đầu tiên học viên làm: ghi danh, thi, hay chơi trò chơi.
  SELECT hv.id, coalesce(x.kind, '5. chưa vào đâu') AS cua_vao, x.at AS luc_vao
  FROM hv
  LEFT JOIN LATERAL (
    SELECT kind, at FROM (
      SELECT CASE WHEN s."isDefault" THEN '2. ghi danh trực tiếp (danh mục / GV thêm)'
                  ELSE '1. link mời vào lớp' END AS kind, e."enrolledAt" AS at
      FROM "Enrollment" e JOIN "Cohort" s ON s.id = e."sectionId" WHERE e."userId" = hv.id
      UNION ALL SELECT '3. thi bằng mã', a."startedAt" FROM "ExamAttempt" a WHERE a."userId" = hv.id
      UNION ALL SELECT '4. trò chơi trực tiếp', g."joinedAt" FROM "GameParticipant" g WHERE g."userId" = hv.id
    ) t ORDER BY at LIMIT 1
  ) x ON true
),
hd AS (
  -- Hoạt động học thật (không tính XP/huy hiệu/ghi danh tự sinh): bài học, quiz, bài tập,
  -- thi, flashcard, thảo luận, nói/viết, đấu trường, hồ sơ, bấm gợi ý ôn tập, vào trò chơi.
  SELECT "userId", min(at) AS dau, max(at) AS cuoi, count(*) AS so
  FROM (
    SELECT e."userId", e."occurredAt" AS at FROM "LearningEvent" e
    WHERE e."userId" IN (SELECT id FROM hv)
      AND (split_part(e."eventType", '.', 1) IN
             ('lesson', 'quiz', 'assignment', 'exam', 'flashcard', 'forum', 'speaking', 'writing', 'tournament', 'portfolio')
           OR e."eventType" = 'feedback.remediation.clicked')
    UNION ALL
    SELECT g."userId", g."joinedAt" FROM "GameParticipant" g WHERE g."userId" IN (SELECT id FROM hv)
  ) t
  GROUP BY "userId"
),
m AS (
  SELECT hv.*, cua.cua_vao, cua.luc_vao, hd.dau, hd.cuoi, coalesce(hd.so, 0) AS so_hoat_dong,
         -- Quay lại = còn thấy mặt (truy cập hoặc học) từ ngày thứ 7 sau khi tạo tài khoản.
         (greatest(hv."lastAccessAt", hd.cuoi) >= hv."createdAt" + interval '7 days') AS quay_lai,
         (hv."createdAt" <= now() - interval '7 days') AS du_7_ngay
  FROM hv JOIN cua ON cua.id = hv.id LEFT JOIN hd ON hd."userId" = hv.id
)
SELECT m."displayName" AS tên, m.email,
       to_char((m."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI') AS tạo_lúc,
       CASE WHEN m."emailVerifiedAt" IS NULL THEN 'chưa' ELSE 'rồi' END AS xác_minh,
       m.cua_vao AS cửa_vào,
       (SELECT count(*) FROM "Enrollment" e WHERE e."userId" = m.id) AS số_khoá,
       (SELECT string_agg(c.title, '; ' ORDER BY e."enrolledAt") FROM "Enrollment" e JOIN "Course" c ON c.id = e."courseId"
         WHERE e."userId" = m.id) AS khoá,
       m.so_hoat_dong AS số_hoạt_động,
       to_char((m.dau AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI') AS học_đầu_tiên,
       to_char((m."lastAccessAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Ho_Chi_Minh', 'DD/MM HH24:MI') AS truy_cập_cuối,
       CASE WHEN NOT m.du_7_ngay THEN 'chưa đủ 7 ngày' WHEN m.quay_lai THEN 'có' ELSE 'không' END AS quay_lại
FROM m
WHERE m."createdAt" > now() - interval '30 days'
ORDER BY m."createdAt" DESC;

ROLLBACK;
