-- Role-scoped "last seen" so switching roles doesn't auto-mark the other
-- role's notifications as read. Shape: { learner: "iso", instructor: "iso", ... }.
-- The pre-existing `notificationsLastSeenAt` column is left in place for now
-- as a fallback for the learner role; new code reads/writes only the JSON map.
ALTER TABLE "User" ADD COLUMN "notificationsLastSeenByRole" JSONB;
