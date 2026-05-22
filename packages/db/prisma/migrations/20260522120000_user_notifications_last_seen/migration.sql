-- Notifications: derived from existing source tables (forum, assignment,
-- mission, badge, peer-review). This column tracks the last time the user
-- opened the notification panel, so we can compute "unread count" = number
-- of source rows newer than this timestamp.
ALTER TABLE "User" ADD COLUMN "notificationsLastSeenAt" TIMESTAMP(3);
