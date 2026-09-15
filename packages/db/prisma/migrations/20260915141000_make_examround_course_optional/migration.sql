-- ensureDefaultRound() tự sinh 1 ExamRound cho MỌI Exam khi publish (kể cả
-- đề độc lập không gắn khoá học — xem migration make_exam_course_optional).
-- ExamRound.courseId trước đây NOT NULL sẽ chặn publish đề độc lập.
ALTER TABLE "ExamRound" ALTER COLUMN "courseId" DROP NOT NULL;
