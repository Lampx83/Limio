-- AC3: thời hạn truy cập và hạn kích hoạt của lô mã. Cả hai NULL = hành vi cũ (vĩnh viễn, không hạn kích hoạt).
ALTER TABLE "CourseAccessCodeBatch" ADD COLUMN "accessDurationMonths" INTEGER;
ALTER TABLE "CourseAccessCodeBatch" ADD COLUMN "activateBefore" TIMESTAMP(3);
