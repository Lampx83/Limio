-- AlterTable
ALTER TABLE "Organization" ADD COLUMN "inviteEmailOnInstructorAdd" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "inviteEmailOnProctorAdd" BOOLEAN NOT NULL DEFAULT true;
