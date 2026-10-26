-- AlterTable: mã số sinh viên do người dùng tự khai (nullable, không unique)
ALTER TABLE "User" ADD COLUMN "studentCode" TEXT;
