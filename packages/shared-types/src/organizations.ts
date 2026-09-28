/**
 * User không gắn `organizationId` (tự đăng ký, chưa trường nào nhận) không
 * phải lỗi — đó là trạng thái mặc định, coi như đang ở "nhóm chung" của
 * platform. Hai hằng số này là sentinel dùng ở filter/dropdown UI, KHÔNG
 * phải id thật trong bảng `Organization`.
 */
export const COMMON_POOL_FILTER_VALUE = "__common__";
export const COMMON_POOL_LABEL = "Nhóm chung";
