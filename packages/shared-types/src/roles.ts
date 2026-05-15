export const RoleName = {
  Learner: "learner",
  Instructor: "instructor",
  Admin: "admin", // Platform admin — super, vượt qua tenant boundary
  OrgAdmin: "org_admin", // Quản trị viên 1 trường, scope theo Organization
  Mentor: "mentor",
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];
