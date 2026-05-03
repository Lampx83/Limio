import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import AdminShell from "@/components/AdminShell";
import { instructorNav } from "@/lib/instructor-nav";
import PromptForm from "./prompt-form";

interface PromptRow {
  id: number;
  title: string;
  description: string | null;
  template: string;
  is_public: number;
  created_at: string;
}

export default async function PromptsPage() {
  const user = (await getCurrentUser())!;

  const mine = db
    .prepare(
      "SELECT id, title, description, template, is_public, created_at FROM prompt_templates WHERE owner_id = ? ORDER BY created_at DESC",
    )
    .all(user.id) as PromptRow[];

  const shared = db
    .prepare(
      `SELECT id, title, description, template, is_public, created_at
       FROM prompt_templates
       WHERE (institution_id = ? AND is_public = 1) OR (owner_id IS NULL AND is_public = 1)
       ORDER BY created_at DESC`,
    )
    .all(user.institution_id) as PromptRow[];

  return (
    <AdminShell
      title="Mẫu prompt AI"
      fullName={user.full_name}
      role="instructor"
      nav={instructorNav("prompts")}
    >
      <p className="text-sm text-slate-500 mb-4">
        Lưu prompt chất lượng cao để tái sử dụng khi gọi AI feedback. Có thể
        chia sẻ với giảng viên cùng cơ sở.
      </p>

      <PromptForm />

      <h2 className="text-lg font-semibold mt-6 mb-3">Mẫu của tôi</h2>
      <ul className="space-y-2">
        {mine.length === 0 && (
          <li className="card p-6 text-center text-slate-500 text-sm">
            Bạn chưa lưu mẫu nào.
          </li>
        )}
        {mine.map((p) => (
          <PromptCard key={p.id} p={p} />
        ))}
      </ul>

      {shared.length > 0 && (
        <>
          <h2 className="text-lg font-semibold mt-6 mb-3">
            Mẫu được chia sẻ
          </h2>
          <ul className="space-y-2">
            {shared.map((p) => (
              <PromptCard key={p.id} p={p} />
            ))}
          </ul>
        </>
      )}
    </AdminShell>
  );
}

function PromptCard({ p }: { p: PromptRow }) {
  return (
    <li className="card p-3 sm:p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="font-medium">{p.title}</p>
        {p.is_public ? (
          <span className="badge-green text-xs">Công khai</span>
        ) : (
          <span className="badge-slate text-xs">Riêng</span>
        )}
      </div>
      {p.description && (
        <p className="text-xs text-slate-500 mt-1">{p.description}</p>
      )}
      <details className="mt-2">
        <summary className="text-xs text-slate-500 cursor-pointer">Xem prompt</summary>
        <pre className="mt-2 p-2 rounded bg-slate-100 dark:bg-slate-800 text-xs whitespace-pre-wrap font-mono">
          {p.template}
        </pre>
      </details>
    </li>
  );
}
