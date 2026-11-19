// Bảng màu chip Word Cloud.
//
// WORD_GRADIENTS: vàng → xanh → tím → hồng (chip gradient, chữ trắng) — bảng màu Word Cloud
// dùng chung cho phiên độc lập (instructor/classroom/WordCloud) và bài giảng trình chiếu (Limio-Live).
export const WORD_GRADIENTS = [
  "bg-gradient-to-r from-accent-400 to-accent-500",
  "bg-gradient-to-r from-blue-400 to-blue-500",
  "bg-gradient-to-r from-purple-400 to-purple-500",
  "bg-gradient-to-r from-pink-400 to-pink-500",
];

// Cùng thứ tự màu nhưng đậm hơn (600), cho kiểu chữ thuần trên nền sáng — 400/500 quá nhạt để đọc từ xa.
export const WORD_TEXT_COLORS = ["text-accent-600", "text-blue-600", "text-purple-600", "text-pink-600"];

// Cùng thứ tự màu, nền đặc cho thanh xếp hạng.
export const WORD_SOLID_BG = ["bg-accent-500", "bg-blue-500", "bg-purple-500", "bg-pink-500"];
