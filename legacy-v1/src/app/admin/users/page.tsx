import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { systemAdminNav } from "@/lib/instructor-nav";
import ImpersonateButton from "@/components/ImpersonateButton";

interface Row {
  id: number;
  username: string;
  full_name: string;
  role: string;
  institution_name: string | null;
  institution_code: string | null;
  experiment_condition: string | null;
  created_at: string;
}

export default async function AllUsersPage() {
  const user = (await getCurrentUser())!;
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.full_name, u.role, u.experiment_condition, u.created_at,
              i.name AS institution_name, i.code AS institution_code
       FROM users u
       LEFT JOIN institutions i ON i.id = u.institution_id
       ORDER BY u.created_at DESC`,
    )
    .all() as Row[];

  return (
    <AdminShell
      title="Toàn bộ người dùng"
      fullName={user.full_name}
      role="system_admin"
      nav={systemAdminNav("users")}
    >
      <p className="text-sm text-slate-500 mb-3">
        Tổng số: <strong>{rows.length}</strong> tài khoản trên toàn hệ thống.
      </p>
      <DataTable
        rows={rows}
        empty="Hệ thống chưa có người dùng."
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
            key: "inst",
            header: "Cơ sở",
            render: (r) =>
              r.institution_name ? (
                <span className="text-xs">
                  <span className="font-mono text-slate-500">{r.institution_code}</span>{" "}
                  {r.institution_name}
                </span>
              ) : (
                <span className="text-xs text-slate-400">— hệ thống —</span>
              ),
          },
          {
            key: "cond",
            header: "Nhóm TN",
            render: (r) =>
              r.experiment_condition === "personalized" ? (
                <span className="badge-green">CN hoá</span>
              ) : r.experiment_condition === "control" ? (
                <span className="badge-slate">Đối chứng</span>
              ) : (
                "—"
              ),
          },
          {
            key: "created",
            header: "Tạo",
            render: (r) => <span className="text-xs text-slate-500">{r.created_at}</span>,
          },
          {
            key: "actions",
            header: "Hành động",
            render: (r) =>
              r.role !== "system_admin" && r.id !== user.id ? (
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
