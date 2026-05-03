import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { CONSENT_VERSION } from "@/lib/consent";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role !== "student") redirect("/");

  const consent = db
    .prepare(
      "SELECT consented FROM consent_records WHERE user_id = ? AND consent_text_version = ?",
    )
    .get(user.id, CONSENT_VERSION) as { consented: number } | undefined;
  if (!consent || consent.consented !== 1) redirect("/consent");

  return <>{children}</>;
}
