"use client";

import { useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import { enrollErrorMessage } from "@/lib/enrollErrors";
import { useT, useUiLang } from "@/lib/i18n/client";

export default function JoinSectionButton({
  code,
  isLoggedIn,
  /** Đã ghi danh khoá này rồi — bấm nút là chuyển lớp, không phải ghi danh. */
  mode = "join",
}: {
  code: string;
  isLoggedIn: boolean;
  mode?: "join" | "move";
}) {
  const t = useT();
  const lang = useUiLang();
  const [submitting, setSubmitting] = useState(false);

  async function onClick() {
    if (!isLoggedIn) {
      window.location.href = `/signin?callbackUrl=/enroll/${code}`;
      return;
    }

    setSubmitting(true);
    const res = await fetch(apiUrl(`/api/enroll-code/${code}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ move: mode === "move" }),
    });
    if (res.status === 401) {
      window.location.href = `/signin?callbackUrl=/enroll/${code}`;
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (data.error === "payment_required") {
        toast.error(t("catalog.join.paymentTitle"), {
          description: t("catalog.join.paymentBody"),
        });
      } else if (data.error === "invalid_invite_code") {
        toast.error(t("catalog.join.invalidTitle"), {
          description: t("catalog.join.invalidBody"),
        });
      } else {
        toast.error(t("catalog.join.failed"), {
          description: enrollErrorMessage(data.error, res.status, lang),
        });
      }
      setSubmitting(false);
      return;
    }
    toast.success(mode === "move" ? t("catalog.join.moved") : t("catalog.join.joined"), {
      description: t("catalog.enroll.redirecting"),
    });
    window.location.href = `/learn/${data.courseSlug}`;
  }

  return (
    <button
      onClick={onClick}
      disabled={submitting}
      className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg disabled:opacity-50 disabled:hover:scale-100"
    >
      {submitting
        ? mode === "move"
          ? t("catalog.join.moving")
          : t("catalog.join.joining")
        : mode === "move"
          ? t("catalog.join.move")
          : t("catalog.join.join")}
    </button>
  );
}
