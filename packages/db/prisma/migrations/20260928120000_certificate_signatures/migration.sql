ALTER TABLE "Organization" ADD COLUMN     "signatureImageUrl" TEXT;

ALTER TABLE "Certificate" ADD COLUMN     "platformSignatureUrl" TEXT,
ADD COLUMN     "issuerSignatureUrl" TEXT;
