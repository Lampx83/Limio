-- AlterTable
ALTER TABLE "Certificate" ADD COLUMN     "issuerLogoUrl" TEXT,
ALTER COLUMN "issuerName" DROP DEFAULT;

