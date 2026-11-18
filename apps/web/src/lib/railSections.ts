/**
 * Danh sách mục dưới bài hiện tại ở thanh bài bên trái (components/language/LessonSectionsNav.tsx) thu gọn/mở được. Hằng số nằm ở lib thuần vì cả
 * trang bài (server component) lẫn hai component client đều dùng, mà server component không đọc được giá trị xuất từ module "use client".
 */
/** Nhớ trạng thái thu gọn theo trình duyệt (cho mọi bài, mọi khoá): đã thu gọn thì các bài khác cũng thu gọn. */
export const SECTIONS_COLLAPSED_KEY = "limio:rail:sections-collapsed";
/** Bấm vào dòng bài hiện tại thì phát sự kiện này lên window; danh sách mục nghe và đổi thu gọn/mở. */
export const RAIL_SECTIONS_TOGGLE_EVENT = "limio:rail-sections-toggle";
