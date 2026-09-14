-- A6.5 (rewrite) — mã tham gia riêng cho vấn đáp AI: SV đã đăng nhập tự nhập
-- mã này để vào thẳng ca, bỏ qua Enrollment. Cột riêng, tách khỏi "openCode"
-- (đó là cho ExamCandidate ẩn danh của thi viết) để hai đường không lẫn nhau.
ALTER TABLE "ExamSchedule" ADD COLUMN "oralJoinCode" TEXT;

CREATE UNIQUE INDEX "ExamSchedule_oralJoinCode_key" ON "ExamSchedule"("oralJoinCode");
