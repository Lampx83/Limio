"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { accessSummary } from "@/lib/accessSummary";
import { toast } from "@/lib/toast";
import type { JoinMatch, JoinResolution } from "@/lib/joinCode";

const NOT_FOUND =
  "Không tìm thấy mã này. Hãy kiểm tra lại với thầy cô — mã gồm chữ in hoa và số, không có chữ O, I, L.";

/**
 * Ô "Nhập mã" chung trên trang Bắt đầu (AC2): mã lớp, mã thi, vấn đáp, trò chơi, bài giảng trực tiếp,
 * bảng ý tưởng, bảng trắng, mã kích hoạt khoá. Máy chủ nhận ra loại mã; trùng nhiều loại thì cho chọn.
 * Báo lỗi ngay dưới ô và giữ nguyên chữ học viên vừa gõ.
 */
export default function JoinCodeBox() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [choices, setChoices] = useState<JoinMatch[] | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim() || busy) return;
    setBusy(true);
    setMessage(null);
    setChoices(null);
    try {
      const r = await fetch(apiUrl("/api/me/join-code"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      if (r.status === 429) {
        setMessage("Bạn đã thử nhiều mã quá. Vui lòng đợi vài phút rồi thử lại.");
        return;
      }
      if (!r.ok) {
        setMessage(NOT_FOUND);
        return;
      }
      const res = (await r.json()) as JoinResolution;
      switch (res.result) {
        case "redirect":
          router.push(res.href);
          return;
        case "access_code":
          await redeem();
          return;
        case "ended":
          setMessage(`${res.match.label} đã kết thúc hoặc đã đóng. Bạn hỏi thầy cô mã mới nhé.`);
          return;
        case "choose":
          setChoices(res.matches);
          return;
        case "not_found":
          setMessage(NOT_FOUND);
          return;
      }
    } catch {
      setMessage("Chưa kết nối được tới Limio. Hãy kiểm tra mạng rồi thử lại.");
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    const r = await fetch(apiUrl("/api/redeem-code"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code }),
    });
    const d = (await r.json().catch(() => ({}))) as {
      courseSlug?: string;
      error?: string;
      accessExpiresAt?: string | null;
    };
    if (r.ok && d.courseSlug) {
      toast.success("Kích hoạt thành công", { description: `${accessSummary(d.accessExpiresAt)} Đang chuyển vào khóa…` });
      router.push(`/learn/${d.courseSlug}`);
      return;
    }
    setMessage(
      r.status === 429
        ? "Bạn đã thử nhiều mã quá. Vui lòng đợi vài phút rồi thử lại."
        : d.error === "code_not_found"
          ? NOT_FOUND
          : d.error === "code_expired"
            ? "Mã kích hoạt này đã hết hạn kích hoạt. Bạn hỏi lại người đã gửi mã nhé."
            : "Mã kích hoạt này đã được dùng hoặc không còn hiệu lực. Bạn hỏi lại người đã gửi mã nhé.",
    );
  }

  return (
    <div>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="join-code" className="sr-only">
          Mã từ thầy cô
        </label>
        <input
          id="join-code"
          value={code}
          onChange={(e) => {
            setCode(e.target.value);
            if (message) setMessage(null);
          }}
          className="input flex-1 font-mono text-lg uppercase tracking-widest"
          placeholder="VD: K7M2QX"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          maxLength={20}
          aria-describedby="join-code-help"
          aria-invalid={message ? true : undefined}
        />
        <button type="submit" disabled={busy || !code.trim()} className="btn-primary sm:w-28">
          {busy ? "Đang tìm…" : "Vào"}
        </button>
      </form>
      <p id="join-code-help" className="mt-2 text-sm text-muted">
        Mã lớp, mã thi, mã trò chơi hay mã bài giảng trực tiếp đều nhập ở đây.
      </p>
      {message && (
        <p role="alert" className="mt-2 text-sm text-danger-700">
          {message}
        </p>
      )}
      {choices && (
        <div className="mt-3">
          <p className="text-sm font-medium">Mã này khớp với nhiều chỗ — bạn muốn vào đâu?</p>
          <ul className="mt-2 space-y-2">
            {choices.map((m) => (
              <li key={m.kind}>
                <Link
                  href={m.href}
                  className="flex items-center justify-between gap-3 rounded-lg border border-token px-3 py-2 text-sm hover:border-brand-400"
                >
                  <span>{m.label}</span>
                  <span className="shrink-0 text-xs text-faint">{m.ended ? "đã kết thúc" : "Vào →"}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
