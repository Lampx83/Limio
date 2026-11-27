# Chọn tổ chức khi vào quản trị đơn vị

Chốt 2026-11-27 (phần 4 của kế hoạch loại tổ chức). Trước đó các trang `/org-admin/*` tự lấy "tổ chức đầu tiên" của người xem (hoặc `?truong=`), menu gộp mọi loại của mọi tổ chức, và Platform Admin không được gán dòng quản trị nào nên nhiều trang báo "Chưa được gán trường nào".

## Quy tắc

1. Khu quản trị đơn vị làm việc với **một tổ chức đang chọn** (`getActiveOrg`, `apps/web/src/lib/activeOrg.ts`). Menu theo loại của riêng tổ chức đó, không gộp.
2. **Platform Admin phải chọn** tổ chức trước khi vào (màn "Chọn tổ chức để quản trị" hiện thay cho nội dung, ở `org-admin/layout.tsx`). **OrgAdmin** thường tự vào tổ chức được gán đầu tiên theo tên; nút "Đổi tổ chức" hiện khi họ quản trị nhiều hơn một tổ chức hoặc là Platform Admin.
3. **Ghi nhật ký mỗi lần vào.** Platform Admin chọn một tổ chức mà mình KHÔNG được gán làm OrgAdmin thì `AuditLog` ghi `org.admin_entered` (người làm, `organizationId`, `kind`); chọn lại cùng tổ chức sau khi đổi là một lần vào mới, nên ghi lại. Vào tổ chức mình được gán, hay chuyển trang khi đã chọn, không ghi. Đổi/bỏ lựa chọn (`DELETE`) không ghi vì chưa vào đâu.
4. Lựa chọn nhớ bằng cookie `fbm_org` (httpOnly, 12 giờ). Cookie chỉ là trí nhớ: quyền kiểm lại mỗi lượt (`canEnterOrg`, cache ≤ 60 giây), cookie giả hay cũ không mở thêm quyền. Gỡ quyền hoặc đổi loại tổ chức áp trong ≤ 60 giây (hoặc ngay khi `revalidateTag`).
5. `?truong=` không còn quyết định tổ chức: các hàm `listManagedOrgs`, `listManagedCenterOrgs`, `loadPublisherArea`, `getManagedKinds` chỉ trả tổ chức đang chọn, nên các nút chọn trường trên từng trang tự biến mất. Trang mới trong `/org-admin` lấy tổ chức bằng `getActiveOrg` hoặc `activeAdminships`, **đừng** tự đọc dòng quản trị đầu tiên.
6. Lõi: `enterOrgAdminWorkspace`, `canEnterOrg`, `listEnterableOrgs` (`core-lms/src/org/adminEntry.ts`, có test). Route: `POST/DELETE /api/org-admin/active-org`.

## Tiêu chí chấp nhận

- Given Platform Admin chưa chọn, When mở `/org-admin/*`, Then thấy màn chọn tổ chức, không thấy dữ liệu tổ chức nào.
- Given Platform Admin chọn tổ chức không được gán, Then menu theo loại tổ chức đó và có đúng một bản ghi `org.admin_entered`; chọn lại thì thêm một bản ghi.
- Given OrgAdmin quản trị hai tổ chức khác loại, Then menu chỉ có nhóm của tổ chức đang chọn; "Đổi tổ chức" chuyển sang tổ chức kia.
- Given người không quản trị tổ chức X, When gọi `POST /api/org-admin/active-org` với X, Then 403 và không ghi nhật ký.

## Chưa làm

- `/instructor/dieu-phoi` vẫn lấy tổ chức của khoá đầu tiên của giảng viên (không phải khu quản trị).
- Chưa có trang xem nhật ký `org.admin_entered`; hiện đọc qua bảng `AuditLog`.
