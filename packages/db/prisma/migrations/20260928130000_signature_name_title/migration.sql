ALTER TABLE "Organization" ADD COLUMN     "signatureName" TEXT,
ADD COLUMN     "signatureTitle" TEXT;

ALTER TABLE "Certificate" ADD COLUMN     "platformSignatureName" TEXT,
ADD COLUMN     "platformSignatureTitle" TEXT,
ADD COLUMN     "issuerSignatureName" TEXT,
ADD COLUMN     "issuerSignatureTitle" TEXT;
