export const RoleName = {
  Learner: "learner",
  Instructor: "instructor",
  Admin: "admin",
  Mentor: "mentor",
} as const;

export type RoleName = (typeof RoleName)[keyof typeof RoleName];
