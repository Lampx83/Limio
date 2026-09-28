export const RoleName = {
  Learner: "learner",
  Instructor: "instructor",
  Admin: "admin", // Platform admin — super, vượt qua tenant boundary
  OrgAdmin: "org_admin", // Quản trị viên 1 trường, scope theo Organization
  Mentor: "mentor",
  // Cộng thêm trên nền Instructor, không thay thế: mở các công cụ nghiên cứu
  // (xuất dữ liệu thô, điều kiện thực nghiệm). Giảng viên thường không thấy.
  Researcher: "researcher",
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];
