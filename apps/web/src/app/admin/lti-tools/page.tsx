import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, listLtiTools } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import RegisterLtiToolForm from "./RegisterLtiToolForm";
import LtiToolRow from "./LtiToolRow";

export const dynamic = "force-dynamic";

export default async function LtiToolsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/lti-tools");
  if (!(await isAdmin(session.user.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p className="rounded border border-red-300 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200">
          Chỉ admin mới đăng ký được LTI tools.
        </p>
      </main>
    );
  }

  const tools = await listLtiTools();
  // Build platform OIDC issuer + auth URL hint to show the instructor for tool config.
  const issuer = process.env.LTI_PLATFORM_ISSUER ?? "http://localhost:3000";

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/" className="text-sm underline">
        ← Trang chủ
      </Link>
      <h1 className="mt-3 text-2xl font-bold">LTI 1.3 Tools (Admin)</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Đăng ký external LTI 1.3 tools (e.g. Khan Academy, Quizlet) để
        instructors có thể nhúng vào lesson.
      </p>

      <section className="mt-6 rounded border border-slate-200 bg-slate-50 p-4 text-xs dark:border-slate-800 dark:bg-slate-900/40">
        <p className="font-medium uppercase text-slate-500">
          Platform info — gửi cho tool provider
        </p>
        <ul className="mt-2 space-y-1 font-mono">
          <li>Issuer: <code>{issuer}</code></li>
          <li>JWKS URL: <code>{issuer}/.well-known/jwks.json</code></li>
          <li>OIDC Auth URL: <code>{issuer}/api/lti/auth</code></li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Đăng ký tool mới</h2>
        <RegisterLtiToolForm />
      </section>

      <section className="mt-10">
        <h2 className="text-lg font-semibold">Tools đã đăng ký ({tools.length})</h2>
        {tools.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Chưa có tool nào.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {tools.map((t) => (
              <li key={t.id}>
                <LtiToolRow tool={t} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
