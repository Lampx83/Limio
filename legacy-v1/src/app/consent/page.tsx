import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CONSENT_TEXT, CONSENT_VERSION } from "@/lib/consent";
import ConsentForm from "./consent-form";

export default async function ConsentPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/");

  const existing = db
    .prepare(
      "SELECT consented FROM consent_records WHERE user_id = ? AND consent_text_version = ?",
    )
    .get(user.id, CONSENT_VERSION) as { consented: number } | undefined;
  if (existing?.consented === 1) redirect("/student");

  return (
    <main className="min-h-screen px-3 sm:px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto card p-5 sm:p-7">
        <h1 className="text-xl sm:text-2xl font-bold mb-4">
          Phiếu chấp thuận tham gia nghiên cứu
        </h1>
        <article className="prose-fb text-sm sm:text-base mb-5">
          {CONSENT_TEXT.split("\n").map((line, i) => {
            if (line.startsWith("# "))
              return (
                <h2 key={i} className="font-bold text-lg mt-3 mb-1">
                  {line.slice(2)}
                </h2>
              );
            if (line.startsWith("## "))
              return (
                <h3 key={i} className="font-semibold mt-3 mb-1">
                  {line.slice(3)}
                </h3>
              );
            if (line.startsWith("- "))
              return (
                <li key={i} className="ml-5 list-disc">
                  {renderBold(line.slice(2))}
                </li>
              );
            if (line.trim() === "") return <br key={i} />;
            return (
              <p key={i} className="my-2 leading-relaxed">
                {renderBold(line)}
              </p>
            );
          })}
        </article>
        <ConsentForm version={CONSENT_VERSION} />
      </div>
    </main>
  );
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") ? (
      <strong key={i} className="font-semibold">
        {p.slice(2, -2)}
      </strong>
    ) : (
      <span key={i}>{p}</span>
    ),
  );
}
