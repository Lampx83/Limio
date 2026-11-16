-- Báo cáo cho nhà xuất bản (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC1): quyền "Xem báo cáo" theo tổ chức.
-- Chỉ thêm bảng mới; không đụng bảng nào khác.
CREATE TABLE "OrganizationReportViewer" (
  "organizationId"  TEXT NOT NULL,
  "userId"          TEXT NOT NULL,
  "grantedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "grantedByUserId" TEXT,

  CONSTRAINT "OrganizationReportViewer_pkey" PRIMARY KEY ("organizationId", "userId"),
  CONSTRAINT "OrganizationReportViewer_organizationId_fkey" FOREIGN KEY ("organizationId")
    REFERENCES "Organization"(id) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OrganizationReportViewer_userId_fkey" FOREIGN KEY ("userId")
    REFERENCES "User"(id) ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "OrganizationReportViewer_userId_idx" ON "OrganizationReportViewer"("userId");
