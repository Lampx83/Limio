-- Mã giám thị cho từng phòng thi.
--
-- KHÔNG dùng lại ExamRoom.accessCode: mã đó phát cho THÍ SINH (in phiếu,
-- chiếu lên màn), nên nếu nó cũng mở được màn giám sát thì cả phòng đều vào
-- xem được tiến độ của nhau.
--
-- Nullable: phòng đã tồn tại chưa có mã, sinh khi người tổ chức mở ra xem.
-- Unique toàn hệ thống (không phải theo ca) vì người nhập mã chưa biết mình
-- thuộc ca nào — mã phải tự định vị được phòng.
ALTER TABLE "ExamRoom" ADD COLUMN "proctorCode" VARCHAR(8);

CREATE UNIQUE INDEX "ExamRoom_proctorCode_key" ON "ExamRoom"("proctorCode");
