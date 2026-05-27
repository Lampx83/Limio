-- BankQuestion metadata: bổ sung 6 field instructor cần để quản lý ngân hàng
--   code           : mã human-readable (vd KNM-0001), auto-sinh theo bank.codePrefix
--   learningOutcome: CĐR (chuẩn đầu ra) free-text
--   authorName     : tác giả (free-text, default = tên creator khi tạo mới)
--   reviewStatus   : pending | approved | needs_revision
--   reviewedByUserId / reviewedAt : audit thẩm định
--   editNote       : ghi chú sửa (free-text changelog ngắn)
--
-- QuestionBank: thêm codePrefix + codeNextSeq để auto-sinh code.
-- Existing rows giữ code = NULL (backward compat); instructor tự cập nhật code
-- khi cần qua UI hoặc bulk re-import.

ALTER TABLE "QuestionBank"
    ADD COLUMN "codePrefix"  TEXT,
    ADD COLUMN "codeNextSeq" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "BankQuestion"
    ADD COLUMN "code"             TEXT,
    ADD COLUMN "learningOutcome"  TEXT,
    ADD COLUMN "authorName"       TEXT,
    ADD COLUMN "reviewStatus"     TEXT         NOT NULL DEFAULT 'pending',
    ADD COLUMN "reviewedByUserId" TEXT,
    ADD COLUMN "reviewedAt"       TIMESTAMP(3),
    ADD COLUMN "editNote"         TEXT;

-- code unique per bank. Postgres UNIQUE coi NULL khác NULL nên nhiều row
-- có code = NULL vẫn hợp lệ (Prisma @@unique cũng compile ra đúng cái này).
CREATE UNIQUE INDEX "BankQuestion_bankId_code_key"
    ON "BankQuestion" ("bankId", "code");

-- Filter UI sẽ lọc theo reviewStatus nên cần index composite (bank, status).
CREATE INDEX "BankQuestion_bankId_reviewStatus_idx"
    ON "BankQuestion" ("bankId", "reviewStatus");

ALTER TABLE "BankQuestion"
    ADD CONSTRAINT "BankQuestion_reviewedByUserId_fkey"
    FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
