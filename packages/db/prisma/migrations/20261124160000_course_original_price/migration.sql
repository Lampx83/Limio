-- Giá gốc của khoá (hiển thị gạch ngang cạnh giá khuyến mãi). Cột thêm mới, nullable: khoá đang có không đổi hành vi.
ALTER TABLE "Course" ADD COLUMN "originalPriceCents" INTEGER;
