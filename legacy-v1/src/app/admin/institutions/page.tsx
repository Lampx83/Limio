import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { systemAdminNav } from "@/lib/instructor-nav";
import NewInstitutionForm from "./new-institution-form";

interface Row {
  id: number;
  code: string;
  name: string;
  address: string | null;
  contact_email: string | null;
  n_users: number;
  n_courses: number;
  created_at: string;
}

export default async function InstitutionsPage() {
  const user = (await getCurrentUser())!;
  const rows = db
    .prepare(
      `SELECT i.id, i.code, i.name, i.address, i.contact_email, i.created_at,
              (SELECT COUNT(*) FROM users WHERE institution_id = i.id) AS n_users,
              (SELECT COUNT(*) FROM courses WHERE institution_id = i.id) AS n_courses
       FROM institutions i ORDER BY i.created_at DESC`,
    )
    .all() as Row[];

  return (
    <AdminShell
      title="Cơ sở giáo dục"
      fullName={user.full_name}
      role="system_admin"
      nav={systemAdminNav("institutions")}
    >
      <NewInstitutionForm />

      <h2 className="text-lg font-semibold mt-5 mb-3">
        Tất cả cơ sở ({rows.length})
      </h2>
      <DataTable
        rows={rows}
        empty="Chưa có cơ sở giáo dục nào."
        columns={[
          {
            key: "code",
            header: "Mã",
            render: (r) => <span className="font-mono text-xs">{r.code}</span>,
          },
          {
            key: "name",
            header: "Tên",
            render: (r) => (
              <div>
                <p className="font-medium">{r.name}</p>
                {r.address && (
                  <p className="text-xs text-slate-500">{r.address}</p>
                )}
              </div>
            ),
          },
          {
            key: "contact",
            header: "Liên hệ",
            render: (r) => <span className="text-xs">{r.contact_email ?? "—"}</span>,
          },
          {
            key: "stats",
            header: "Thống kê",
            render: (r) => (
              <span className="text-xs text-slate-500">
                {r.n_users} người dùng · {r.n_courses} khoá
              </span>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}
