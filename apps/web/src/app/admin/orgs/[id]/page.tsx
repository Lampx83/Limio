import OrgKindSelect from "@/components/OrgKindSelect";
import SpaceSettingsSection from "@/components/space/SpaceSettingsSection";
import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@feedbackme/db";
import { listAcademicTerms, listOrgAdmins } from "@feedbackme/core-lms";
import OrgAdminManager from "./OrgAdminManager";
import OrgTabs from "./OrgTabs";
import { orgKindMeta } from "../orgKindMeta";
import SubscriptionManager from "../../_components/SubscriptionManager";
import OrgMembersClient from "@/app/org-admin/members/OrgMembersClient";
import OrgSettingsClient from "@/app/org-admin/settings/OrgSettingsClient";
import AcademicTermsManager from "@/app/org-admin/settings/AcademicTermsManager";
import ExamNetworkSettings from "@/app/org-admin/settings/ExamNetworkSettings";
import { toDayKey } from "@/lib/datetime";

export const dynamic = "force-dynamic";

export default async function AdminOrgDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const org = await prisma.organization.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      code: true,
      name: true,
      brandingLogoUrl: true,
      signatureImageUrl: true,
      signatureName: true,
      signatureTitle: true,
      inviteEmailOnImport: true,
      inviteEmailOnInstructorAdd: true,
      inviteEmailOnProctorAdd: true,
      examAllowedIps: true,
      kind: true,
      _count: { select: { users: true } },
    },
  });
  if (!org) notFound();

  const [admins, terms] = await Promise.all([listOrgAdmins(org.id), listAcademicTerms(org.id)]);

  const kind = orgKindMeta(org.kind);
  const noAdmin = admins.length === 0;

  return (
    <main>
      <nav aria-label="Đường dẫn" className="mb-3 text-sm text-muted">
        <Link href="/admin/orgs" className="link">Tổ chức</Link>
        <span aria-hidden className="mx-1.5 text-faint">/</span>
        <span className="text-[rgb(var(--text))]">{org.name}</span>
      </nav>

      <header className="card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="h-display text-2xl font-bold sm:text-3xl">{org.name}</h1>
              <span className={kind.chip}>{kind.label}</span>
            </div>
            <p className="mt-1 text-xs text-faint">
              Mã: <code className="font-mono">{org.code}</code> · ID:{" "}
              <code className="font-mono break-all">{org.id}</code>
            </p>
          </div>
          <dl className="flex gap-6 text-sm">
            <div>
              <dt className="text-xs text-muted">OrgAdmin</dt>
              <dd className="h-display text-xl font-bold tabular-nums">{admins.length}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">Người dùng</dt>
              <dd className="h-display text-xl font-bold tabular-nums">{org._count.users.toLocaleString("vi-VN")}</dd>
            </div>
          </dl>
        </div>
        {noAdmin && (
          <div className="banner-warning mt-4 flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm">Tổ chức này chưa có OrgAdmin, chưa ai quản trị được ở phía tổ chức.</span>
            <a href="#nguoi-dung" className="btn-secondary btn-sm">Cấp OrgAdmin</a>
          </div>
        )}
      </header>

      <OrgTabs
        tabs={[
          {
            id: "thong-tin",
            label: "Thông tin & thương hiệu",
            content: (
              <section aria-label="Thông tin và thương hiệu">
                <p className="mb-3 text-sm text-muted">
                  Tên trường, logo và chữ ký người đại diện hiện trên chứng nhận hoàn thành khoá học do trường cấp. Mã trường là
                  định danh nên không đổi được.
                </p>
                <OrgSettingsClient
                  organizationId={org.id}
                  initialName={org.name}
                  initialLogoUrl={org.brandingLogoUrl}
                  initialSignatureUrl={org.signatureImageUrl}
                  initialSignatureName={org.signatureName}
                  initialSignatureTitle={org.signatureTitle}
                  initialEmailSettings={{
                    inviteEmailOnImport: org.inviteEmailOnImport,
                    inviteEmailOnInstructorAdd: org.inviteEmailOnInstructorAdd,
                    inviteEmailOnProctorAdd: org.inviteEmailOnProctorAdd,
                  }}
                />
              </section>
            ),
          },
          {
            id: "cau-hinh",
            label: "Cấu hình",
            content: (
              <>
                <OrgKindSelect organizationId={org.id} initialKind={org.kind} />
                <SpaceSettingsSection organizationId={org.id} />
                <ExamNetworkSettings organizationId={org.id} initialRules={org.examAllowedIps} />
                <AcademicTermsManager organizationId={org.id} initialTerms={terms} todayKey={toDayKey(new Date())} />
              </>
            ),
          },
          {
            id: "goi",
            label: "Gói tài khoản",
            content: (
              <section className="card">
                <h2 className="mb-1 text-base font-semibold">Gói tài khoản</h2>
                <p className="mb-3 text-xs text-muted">
                  Gói của tổ chức: gán theo hợp đồng, gia hạn hoặc huỷ. Ngày tính theo giờ Việt Nam.
                </p>
                <SubscriptionManager organizationId={org.id} />
              </section>
            ),
          },
          {
            id: "nguoi-dung",
            label: "Quản trị & thành viên",
            badge: admins.length,
            warn: noAdmin,
            content: (
              <>
                <section className="card">
                  <h2 className="mb-1 text-base font-semibold">OrgAdmin</h2>
                  <p className="mb-3 text-xs text-muted">
                    Người có quyền quản trị riêng tổ chức này (branding, ca thi, session template…). Chỉ Platform Admin mới
                    cấp/thu hồi được ở đây.
                  </p>
                  <OrgAdminManager
                    organizationId={org.id}
                    initialAdmins={admins.map((a) => ({
                      userId: a.userId,
                      email: a.email,
                      displayName: a.displayName,
                      grantedAt: a.grantedAt.toISOString(),
                      grantedByName: a.grantedByName,
                    }))}
                  />
                </section>
                <section className="card">
                  <h2 className="mb-1 text-base font-semibold">Thành viên</h2>
                  <p className="mb-3 text-xs text-muted">
                    User thuộc tổ chức này. Thêm theo email (tự tạo tài khoản và gửi mail mời nếu chưa có). User đang ở tổ chức
                    khác thì chuyển ở trang quản lý của user đó.
                  </p>
                  <OrgMembersClient organizationId={org.id} />
                </section>
              </>
            ),
          },
        ]}
      />
    </main>
  );
}
