-- AlterTable
-- Default backfills the 1 pre-existing demo row from manual QA; Prisma Client
-- always sets issuerName explicitly on new inserts (see issueCertificate).
ALTER TABLE "Certificate" ADD COLUMN     "issuerName" TEXT NOT NULL DEFAULT 'Limio';

