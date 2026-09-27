"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";

type App = {
  id: string;
  status: "pending" | "approved" | "rejected";
  institution: string;
  subject: string;
  motivation: string | null;
  verificationUrl: string | null;
  rejectionReason: string | null;
  createdAt: string;
  reviewedAt: string | null;
  reviewerName: string | null;
  user: { displayName: string; email: string; emailVerified: boolean };
};

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", dateStyle: "short", timeStyle: "short" });

export default function ApplicationsClient({ pending, reviewed }: { pending: App[]; reviewed: App[] }) {
  return (
    <div className="space-y-10">
      <section>
        <h2 className="text-h3 mb-3 font-semibold">Chờ duyệt ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="card text-sm text-muted">Không có đơn nào đang chờ.</p>
        ) : (
          <ul className="space-y-4">
            {pending.map((a) => (
              <PendingCard key={a.id} app={a} />
            ))}
          </ul>
        )}
      </section>

      {reviewed.length > 0 && (
        <section>
          <h2 className="text-h3 mb-3 font-semibold">Đã xử lý gần đây</h2>
          <ul className="space-y-2">
            {reviewed.map((a) => (
              <li key={a.id} className="card flex flex-wrap items-center justify-between gap-2 text-sm">
                <span>
                  <b>{a.user.displayName}</b> · {a.institution}
                </span>
                <span className="flex items-center gap-2">
                  <span className={a.status === "approved" ? "chip-success" : "chip-danger"}>
                    {a.status === "approved" ? "Đã duyệt" : "Từ chối"}
                  </span>
                  <span className="text-meta text-muted">
                    {a.reviewerName ?? "—"} · {a.reviewedAt ? fmt(a.reviewedAt) : ""}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PendingCard({ app }: { app: App }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function act(action: "approve" | "reject") {
    setBusy(true);
    setError(null);
    const res = await fetch(apiUrl(`/api/admin/instructor-applications/${app.id}`), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setError(
        data.error === "already_reviewed"
          ? "Đơn này đã được xử lý bởi người khác."
          : data.error === "reason_required"
            ? "Cần nhập lý do từ chối."
            : "Có lỗi, thử lại sau.",
      );
      if (data.error === "already_reviewed") router.refresh();
      return;
    }
    router.refresh();
  }

  return (
    <li className="card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-semibold">{app.user.displayName}</p>
          <p className="text-sm text-muted">
            {app.user.email}{" "}
            {app.user.emailVerified ? (
              <span className="chip-success ml-1">Đã xác thực email</span>
            ) : (
              <span className="chip-warning ml-1">Chưa xác thực email</span>
            )}
          </p>
        </div>
        <span className="text-meta text-muted">Nộp {fmt(app.createdAt)}</span>
      </div>

      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-meta text-muted">Trường / đơn vị</dt>
          <dd className="font-medium">{app.institution}</dd>
        </div>
        <div>
          <dt className="text-meta text-muted">Môn / lĩnh vực</dt>
          <dd className="font-medium">{app.subject}</dd>
        </div>
        {app.verificationUrl && (
          <div className="sm:col-span-2">
            <dt className="text-meta text-muted">Link xác minh</dt>
            <dd>
              <a
                href={app.verificationUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="break-all text-brand-700 underline"
              >
                {app.verificationUrl}
              </a>
            </dd>
          </div>
        )}
        {app.motivation && (
          <div className="sm:col-span-2">
            <dt className="text-meta text-muted">Giới thiệu</dt>
            <dd className="whitespace-pre-line">{app.motivation}</dd>
          </div>
        )}
      </dl>

      {rejecting && (
        <div className="mt-4">
          <label className="label" htmlFor={`reason-${app.id}`}>
            Lý do từ chối (sẽ gửi cho người nộp)
          </label>
          <textarea
            id={`reason-${app.id}`}
            className="input mt-1.5 w-full"
            rows={3}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            placeholder="Ví dụ: Chưa xác minh được đơn vị công tác. Bạn có thể nộp lại kèm link trang giảng viên của trường."
          />
        </div>
      )}

      {error && <p className="banner-danger mt-3 text-sm">{error}</p>}

      <div className="mt-4 flex flex-wrap gap-2">
        {rejecting ? (
          <>
            <button
              className="btn-danger"
              disabled={busy || !reason.trim()}
              onClick={() => act("reject")}
            >
              {busy ? "Đang gửi..." : "Xác nhận từ chối"}
            </button>
            <button className="btn-secondary" disabled={busy} onClick={() => setRejecting(false)}>
              Huỷ
            </button>
          </>
        ) : (
          <>
            <button className="btn-primary" disabled={busy} onClick={() => act("approve")}>
              {busy ? "Đang duyệt..." : "Duyệt và gửi email chúc mừng"}
            </button>
            <button className="btn-secondary" disabled={busy} onClick={() => setRejecting(true)}>
              Từ chối
            </button>
          </>
        )}
      </div>
    </li>
  );
}
