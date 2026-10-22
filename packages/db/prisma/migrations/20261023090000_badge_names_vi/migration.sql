-- Việt hoá tên huy hiệu học viên thấy ngay lần đầu vào khoá ("First Step",
-- "Course Complete"...). Huy hiệu mốc được seed một lần, không có code nào
-- upsert lại lúc chạy ⇒ phải đổi bằng dữ liệu. Chỉ đụng dòng còn mang đúng tên
-- tiếng Anh mặc định, tên đã được sửa tay thì giữ nguyên. Chỉ sửa bảng Badge,
-- không đụng LearningEvent.

UPDATE "Badge" SET "name" = 'Bước chân đầu tiên', "description" = 'Hoàn thành bài học đầu tiên.'
WHERE "code" = 'first_step' AND "name" = 'First Step';

UPDATE "Badge" SET "name" = 'Khởi động'
WHERE "code" = 'quiz_starter' AND "name" = 'Quiz Starter';

UPDATE "Badge" SET "name" = 'Lần đầu vượt qua'
WHERE "code" = 'first_win' AND "name" = 'First Win';

UPDATE "Badge" SET "name" = 'Điểm tuyệt đối'
WHERE "code" = 'perfect_score' AND "name" = 'Perfect Score';

UPDATE "Badge" SET "name" = 'Về đích', "description" = 'Hoàn thành toàn bộ một khoá học.'
WHERE "code" = 'course_complete' AND "name" = 'Course Complete';

UPDATE "Badge" SET "name" = 'Tự sửa sai',
  "description" = 'Khắc phục 5 lỗi hiểu sai bằng cách trả lời đúng sau khi đã sai.'
WHERE "code" = 'cleared_5' AND "name" = 'Self-Corrector';

UPDATE "Badge" SET "name" = 'Học từ sai lầm',
  "description" = 'Khắc phục 25 lỗi hiểu sai — bằng chứng bạn thực sự học từ sai lầm.'
WHERE "code" = 'cleared_25' AND "name" = 'Misconception Slayer';

-- Huy hiệu thành thạo sinh tự động theo chủ đề: "Skill Master: <tên chủ đề>".
UPDATE "Badge"
SET "name" = 'Thành thạo: ' || substring("name" FROM 15),
    "description" = 'Đạt mức thành thạo từ 90% trở lên ở chủ đề "' || substring("name" FROM 15) || '".'
WHERE "code" LIKE 'skill\_master:%' AND "name" LIKE 'Skill Master: %';
