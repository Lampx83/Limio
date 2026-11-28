-- Tính năng trung tâm theo loại tổ chức, không theo gói (docs/tieu-chi/goi-tai-khoan.md §2, chốt 28/11/2026).
-- Bỏ khoá `center.access` khỏi mọi gói; cờ này thôi bán được (seed-feature-flags đặt sellable = false),
-- nên để lại thì admin không lưu được gói nào (validateEntitlements từ chối khoá không bán được).
UPDATE "Plan" SET "entitlements" = "entitlements" - 'center.access', "updatedAt" = NOW()
WHERE "entitlements" ? 'center.access';
