import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell, { DataTable } from "@/components/AdminShell";
import { systemAdminNav } from "@/lib/instructor-nav";

interface Row {
  id: number;
  action: string;
  target_type: string | null;
  target_id: number | null;
  payload: string | null;
  created_at: string;
  actor_username: string | null;
  actor_role: string | null;
}

export default async function AuditPage() {
  const user = (await getCurrentUser())!;
  const rows = db
    .prepare(
      `SELECT al.id, al.action, al.target_type, al.target_id, al.payload, al.created_at,
              u.username AS actor_username, u.role AS actor_role
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.actor_id
       ORDER BY al.created_at DESC LIMIT 200`,
    )
    .all() as Row[];

  return (
    <AdminShell
      title="Nhật ký kiểm toán"
      fullName={user.full_name}
      role="system_admin"
      nav={systemAdminNav("audit")}
    >
      <p className="text-sm text-slate-500 mb-3">
        Ghi nhận các hành động nhạy cảm như impersonate. Hiển thị 200 sự kiện mới nhất.
      </p>
      <DataTable
        rows={rows}
        empty="Chưa có sự kiện nào."
        columns={[
          {
            key: "time",
            header: "Thời gian",
            render: (r) => <span className="text-xs text-slate-500">{r.created_at}</span>,
          },
          {
            key: "actor",
            header: "Người thực hiện",
            render: (r) => (
              <span className="font-mono text-xs">
                {r.actor_username ? `@${r.actor_username}` : "—"}
                {r.actor_role && (
                  <span className="text-slate-400"> ({r.actor_role})</span>
                )}
              </span>
            ),
          },
          {
            key: "action",
            header: "Hành động",
            render: (r) => actionBadge(r.action),
          },
          {
            key: "target",
            header: "Đối tượng",
            render: (r) => (
              <span className="text-xs">
                {r.target_type ?? "—"}
                {r.target_id !== null && ` #${r.target_id}`}
              </span>
            ),
          },
          {
            key: "payload",
            header: "Chi tiết",
            render: (r) => (
              <pre className="text-[10px] font-mono text-slate-500 max-w-xs overflow-x-auto">
                {r.payload}
              </pre>
            ),
          },
        ]}
      />
    </AdminShell>
  );
}

function actionBadge(action: string) {
  if (action.startsWith("impersonate_"))
    return <span className="badge-amber text-xs">{action}</span>;
  return <span className="badge-slate text-xs">{action}</span>;
}
