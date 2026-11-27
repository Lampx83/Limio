-- Loại tổ chức: mỗi tổ chức đúng một loại (trường thường, trung tâm, nhà xuất bản).
CREATE TYPE "OrganizationKind" AS ENUM ('school', 'center', 'publisher');

ALTER TABLE "Organization" ADD COLUMN "kind" "OrganizationKind" NOT NULL DEFAULT 'school';

-- Trung tâm đang bật công tắc cũ thì thành loại "center"; còn lại là trường thường. Không ai mất quyền.
UPDATE "Organization" SET "kind" = 'center' WHERE "centerEnabled" = true;
