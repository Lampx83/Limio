import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin, listLtiTools } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import RegisterLtiToolForm from "./RegisterLtiToolForm";
import LtiToolRow from "./LtiToolRow";

export const revalidate = 30;

export default async function LtiToolsAdminPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin?callbackUrl=/admin/lti-tools");
  if (!(await isAdmin(session.user.id))) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <div className="rounded-2xl border border-danger-100 bg-danger-50 p-5 text-sm text-danger-700">
          Chỉ admin mới đăng ký được LTI tools.
        </div>
      </main>
    );
  }

  const tools = await listLtiTools();
  const issuer = process.env.LTI_PLATFORM_ISSUER ?? "http://localhost:3000";

  return (
    <main>
      <Link href="/" className="link inline-flex items-center gap-1 text-sm">
        ← Trang chủ
      </Link>

      <div className="mt-4">
        <span className="chip-brand">Admin · LTI 1.3</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          LTI 1.3 Tools
        </h1>
        <p className="mt-2 max-w-2xl text-muted">
          Đăng ký external LTI 1.3 tools (Khan Academy, Quizlet, ...) để
          instructors có thể nhúng vào lesson.
        </p>
      </div>

      {/* Platform info */}
      <section className="mt-8 card">
        <header className="border-b border-token pb-3">
          <h2 className="text-base font-semibold">Platform info</h2>
          <p className="mt-0.5 text-xs text-faint">
            Gửi cho tool provider để cấu hình OIDC handshake.
          </p>
        </header>
        <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-[max-content_1fr]">
          <dt className="text-xs font-semibold uppercase tracking-wide text-faint">
            Issuer
          </dt>
          <dd>
            <code className="rounded-md bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-mono text-xs">
              {issuer}
            </code>
          </dd>
          <dt className="text-xs font-semibold uppercase tracking-wide text-faint">
            JWKS URL
          </dt>
          <dd>
            <code className="rounded-md bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-mono text-xs break-all">
              {issuer}/.well-known/jwks.json
            </code>
          </dd>
          <dt className="text-xs font-semibold uppercase tracking-wide text-faint">
            OIDC Auth URL
          </dt>
          <dd>
            <code className="rounded-md bg-[rgb(var(--surface-muted))] px-2 py-0.5 font-mono text-xs break-all">
              {issuer}/api/lti/auth
            </code>
          </dd>
        </dl>
      </section>

      {/* Register form */}
      <section className="mt-8">
        <h2 className="text-lg font-semibold">Đăng ký tool mới</h2>
        <div className="mt-3">
          <RegisterLtiToolForm />
        </div>
      </section>

      {/* Tools list */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          Tools đã đăng ký{" "}
          <span className="text-sm font-normal text-faint">({tools.length})</span>
        </h2>
        {tools.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-dashed border-token p-10 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft text-2xl">
                          </div>
            <p className="mt-4 text-sm text-muted">Chưa có tool nào.</p>
          </div>
        ) : (
          <ul className="mt-4 space-y-3">
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
