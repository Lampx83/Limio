-- Bỏ ràng buộc "đề thi phải gắn 1 khoá học" — cho phép Exam.courseId NULL
-- (đề độc lập, vào bằng mã/link mời, chỉ người tạo — createdById — sửa/chấm).
ALTER TABLE "Exam" ALTER COLUMN "courseId" DROP NOT NULL;

-- An toàn dữ liệu: một Exam phải có ÍT NHẤT courseId hoặc createdById, nếu
-- không sẽ không ai sửa/chấm được nó (không có chủ sở hữu).
ALTER TABLE "Exam" ADD CONSTRAINT "exam_courseid_or_createdby_check"
  CHECK ("courseId" IS NOT NULL OR "createdById" IS NOT NULL);
