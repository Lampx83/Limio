import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { institutionAdminNav } from "@/lib/instructor-nav";
import NewUserForm from "./new-user-form";
import ImpersonateButton from "@/components/ImpersonateButton";

interface UserRow {
  id: number;
  username: string;
  full_name: string;
  role: string;
  experiment_condition: string | null;
  created_at: string;
}

export default async function InstitutionUsersPage() {
  const user = (await getCurrentUser())!;
  const rows = db
    .prepare(
      `SELECT id, username, full_name, role, experiment_condition, created_at
       FROM users WHERE institution_id = ? ORDER BY role DESC, created_at DESC`,
    )
    .all(user.institution_id) as UserRow[];

  return (
    <AdminShell
      title="Người dùng cơ sở"
      fullName={user.full_name}
      role="institution_admin"
      nav={institutionAdminNav("users")}
    >
      <NewUserForm />

      <h2 className="text-lg font-semibold mt-5 mb-3">
        Tất cả người dùng ({rows.length})
      </h2>
      <DataTable
        rows={rows}
        empty="Cơ sở chưa có người dùng."
        columns={[
          {
            key: "name",
            header: "Họ tên",
            render: (r) => (
              <div>
                <p className="font-medium">{r.full_name}</p>
                <p className="text-xs text-slate-400 font-mono">@{r.username}</p>
              </div>
            ),
          },
          {
            key: "role",
            header: "Vai trò",
            render: (r) => roleBadge(r.role),
          },
          {
            key: "cond",
            header: "Nhóm thí nghiệm",
            render: (r) =>
              r.role === "student" ? (
                r.experiment_condition === "personalized" ? (
                  <span className="badge-green">Cá nhân hoá</span>
                ) : r.experiment_condition === "control" ? (
                  <span className="badge-slate">Đối chứng</span>
                ) : (
                  "—"
                )
              ) : (
                "—"
              ),
          },
          {
            key: "created",
            header: "Ngày tạo",
            render: (r) => <span className="text-xs text-slate-500">{r.created_at}</span>,
          },
          {
            key: "actions",
            header: "Hành động",
            render: (r) =>
              r.role === "student" || r.role === "instructor" ? (
                <ImpersonateButton userId={r.id} />
              ) : (
                <span className="text-xs text-slate-300">—</span>
              ),
          },
        ]}
      />
    </AdminShell>
  );
}

function roleBadge(role: string) {
  const m: Record<string, { label: string; cls: string }> = {
    student: { label: "Sinh viên", cls: "badge-blue" },
    instructor: { label: "Giảng viên", cls: "badge-amber" },
    institution_admin: { label: "QT Cơ sở", cls: "badge-green" },
    system_admin: { label: "QT Hệ thống", cls: "badge-slate" },
  };
  const r = m[role] ?? { label: role, cls: "badge-slate" };
  return <span className={r.cls}>{r.label}</span>;
}
