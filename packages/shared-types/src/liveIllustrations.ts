/**
 * Hình minh hoạ theo chủ đề cho ô hình của bố cục "Chữ và hình" trong Limio-Live (mockup
 * docs/mockup/hinh-minh-hoa-chu-de.html). Hình vẽ nằm ở apps/web/src/lib/limioLiveMotifArt.ts.
 *
 * Đặt ở shared-types vì cả core-feedback (lời dặn và lược đồ JSON khi AI sinh slide) lẫn web (kiểm mã AI trả về,
 * vẽ, lưới chọn) cần cùng một danh sách. Chỉ có hai đường chọn: AI chọn một mã trong danh sách này, hoặc giảng
 * viên chọn trong lưới. Không đoán theo từ khoá.
 */

export const SLIDE_ILLUSTRATIONS = [
  "ketnoi",
  "connguoi",
  "tunhien",
  "ytuong",
  "sachhoc",
  "thoigian",
  "muctieu",
  "toancau",
  "dulieu",
  "antoan",
  "tangtruong",
  "traodoi",
  "khoahoc",
  "congnghe",
  "quytrinh",
  "timkiem",
  "suckhoe",
  "taichinh",
  "canbang",
  "dothi",
  "lotrinh",
  "thanhtich",
  "nangluong",
  "nghethuat",
] as const;
export type SlideIllustrationId = (typeof SLIDE_ILLUSTRATIONS)[number];

export const SLIDE_ILLUSTRATION_LABELS: Record<SlideIllustrationId, string> = {
  ketnoi: "Kết nối",
  connguoi: "Con người",
  tunhien: "Tự nhiên",
  ytuong: "Ý tưởng",
  sachhoc: "Sách và học tập",
  thoigian: "Thời gian",
  muctieu: "Mục tiêu",
  toancau: "Toàn cầu",
  dulieu: "Dữ liệu",
  antoan: "An toàn",
  tangtruong: "Tăng trưởng",
  traodoi: "Trao đổi",
  khoahoc: "Khoa học",
  congnghe: "Công nghệ",
  quytrinh: "Quy trình",
  timkiem: "Tìm hiểu",
  suckhoe: "Sức khoẻ",
  taichinh: "Tài chính",
  canbang: "Cân bằng",
  dothi: "Đô thị",
  lotrinh: "Lộ trình",
  thanhtich: "Thành tích",
  nangluong: "Năng lượng",
  nghethuat: "Nghệ thuật",
};

/** Chủ đề mỗi hình diễn đạt; dùng trong lời dặn AI để mô hình chọn đúng. */
export const SLIDE_ILLUSTRATION_TOPICS: Record<SlideIllustrationId, string> = {
  ketnoi: "kết nối, mạng, internet, liên kết",
  connguoi: "con người, nhóm, cộng tác, cộng đồng",
  tunhien: "tự nhiên, môi trường, sinh thái",
  ytuong: "ý tưởng, sáng tạo, giải pháp",
  sachhoc: "sách, đọc, học tập, kiến thức",
  thoigian: "thời gian, kế hoạch, tiến độ, lịch sử",
  muctieu: "mục tiêu, đích đến, trọng tâm",
  toancau: "toàn cầu, thế giới, hội nhập, văn hoá",
  dulieu: "dữ liệu, cơ sở dữ liệu, lưu trữ, thống kê",
  antoan: "an toàn, bảo mật, quyền riêng tư",
  tangtruong: "tăng trưởng, tiến bộ, phát triển",
  traodoi: "trao đổi, thảo luận, hỏi đáp, phản hồi",
  khoahoc: "khoa học, thí nghiệm, hoá học, nghiên cứu",
  congnghe: "công nghệ, máy tính, phần mềm, lập trình",
  quytrinh: "quy trình, kỹ thuật, vận hành, cơ chế",
  timkiem: "tìm hiểu, phân tích, điều tra, tra cứu",
  suckhoe: "sức khoẻ, y tế, thể chất, tinh thần",
  taichinh: "tài chính, tiền, kinh tế, chi phí",
  canbang: "cân bằng, công bằng, pháp luật, đạo đức",
  dothi: "đô thị, thành phố, xã hội, cộng đồng dân cư",
  lotrinh: "lộ trình, các bước, hành trình, kế hoạch",
  thanhtich: "thành tích, ghi nhận, cuộc thi, kết quả",
  nangluong: "năng lượng, điện, động lực, vật lý",
  nghethuat: "nghệ thuật, thiết kế, mỹ thuật, văn hoá",
};

/**
 * Năm nhóm chủ đề, chỉ để giảng viên tìm nhanh trong lưới chọn. AI vẫn nhận cả danh sách phẳng kèm chủ đề
 * của từng hình. Mỗi hình nằm đúng một nhóm (có test giữ điều này).
 */
export const SLIDE_ILLUSTRATION_GROUPS: ReadonlyArray<{ label: string; ids: readonly SlideIllustrationId[] }> = [
  { label: "Học tập và sáng tạo", ids: ["sachhoc", "ytuong", "nghethuat", "timkiem", "muctieu", "lotrinh"] },
  { label: "Con người và xã hội", ids: ["connguoi", "traodoi", "dothi", "canbang", "suckhoe"] },
  { label: "Khoa học và công nghệ", ids: ["khoahoc", "congnghe", "ketnoi", "dulieu", "quytrinh", "antoan"] },
  { label: "Tự nhiên và Trái Đất", ids: ["tunhien", "toancau", "nangluong"] },
  { label: "Kinh tế và phát triển", ids: ["taichinh", "tangtruong", "thanhtich", "thoigian"] },
];

export const isSlideIllustrationId = (v: unknown): v is SlideIllustrationId =>
  typeof v === "string" && (SLIDE_ILLUSTRATIONS as readonly string[]).includes(v);
