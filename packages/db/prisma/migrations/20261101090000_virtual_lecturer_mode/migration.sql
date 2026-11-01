-- Giảng viên ảo: mức riêng của khoá (null = theo mặc định hệ thống).
CREATE TYPE "VirtualLecturerMode" AS ENUM ('BAT_BUOC', 'HIEN', 'TU_BAT', 'AN');
ALTER TABLE "Course" ADD COLUMN "virtualLecturerMode" "VirtualLecturerMode";
