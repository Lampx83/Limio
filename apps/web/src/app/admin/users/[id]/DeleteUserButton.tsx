"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

const OWNERSHIP_LABEL = {
  course_owner: "khoá học",
  exam_round_admin: "đợt thi",
} as const;

export default function DeleteUserButton({
  userId,
  userName,
  userEmail,
}: {
  userId: string;
  userName: string;
  userEmail: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const typed = prompt(
      `Xoá "${userName}" khỏi hệ thống?\n\nTài khoản, thông tin cá nhân và quyền đăng nhập sẽ bị gỡ vĩnh viễn; điểm số và lịch sử học được giữ lại dưới dạng ẩn danh. Không thể hoàn tác.\n\nGõ email của user để xác nhận:`,
    );
    if (typed === null) return;
    if (typed.trim().toLowerCase() !== userEmail.toLowerCase()) {
      alert("Email không khớp — đã huỷ.");
      return;
    }
    setBusy(true);
    const res = await fetch(apiUrl(`/api/admin/users/${userId}`), { method: "DELETE" });
    if (res.ok) {
      router.push("/admin/users");
      router.refresh();
      return;
    }
    const body = await res.json().catch(() => ({}));
    if (body.error === "has_ownership") {
      const list = (body.blockers as { kind: keyof typeof OWNERSHIP_LABEL; title: string }[])
        .map((b) => `• ${OWNERSHIP_LABEL[b.kind]}: ${b.title}`)
        .join("\n");
      alert(`User đang phụ trách:\n${list}\n\nHãy chuyển quyền trước rồi xoá lại.`);
    } else if (body.error === "cannot_delete_self") {
      alert("Bạn không thể xoá chính tài khoản đang đăng nhập.");
    } else {
      alert(`Lỗi: ${body.error ?? res.status}`);
    }
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={remove}
      disabled={busy}
      className="btn-secondary btn-sm text-danger-700"
    >
      {busy ? "…" : "Xoá user"}
    </button>
  );
}
