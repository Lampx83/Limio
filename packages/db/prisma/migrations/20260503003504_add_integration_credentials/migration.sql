-- CreateTable
CREATE TABLE "IntegrationCredential" (
    "key" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "meta" JSONB,
    "updatedById" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationCredential_pkey" PRIMARY KEY ("key")
);
