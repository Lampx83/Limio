## Mô tả

<!-- Thay đổi gì, vì sao. Tag feature ID nếu có (vd B1.3). -->

## Checklist

- [ ] Đã chạy `pnpm typecheck` và `pnpm test`.
- [ ] **Nếu PR đổi giao diện giảng viên** (thêm/đổi tên/xoá nút, trang, mục menu, luồng làm việc): đã cập nhật
      `docs/hoc-lieu/huong-dan-limio/GIAO-DIEN.md` **và** kho hướng dẫn của trợ lý Limio
      (`apps/web/src/lib/teacherAssistantGuide.ts`, danh mục điểm đến ở `lib/teacherAssistant.ts`).
      Test `teacherAssistantFreshness` sẽ đỏ nếu quên (nhãn không còn trong mã, trang không tồn tại, mục menu mới
      chưa dạy trợ lý). Xem CLAUDE.md §4.9.
- [ ] Nếu PR thêm cách sinh phản hồi/loại nội dung mới: đã code toạ độ SSMMD (CLAUDE.md §4.8) và hook auto-tag (§5.3).
