"use client";

import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";

type Info = { rules: string[]; detectedIp: string | null; detectedIpInternal: boolean | null };

/**
 * Dải mạng được phép VÀO THI của trường. Chỉ áp ở bước vào thi các đề thuộc
 * trường này; các tính năng khác của hệ thống không bị ảnh hưởng.
 */
export default function ExamNetworkSettings({
  organizationId,
  initialRules,
}: {
  organizationId: string;
  initialRules: string[];
}) {
  const [text, setText] = useState(initialRules.join("\n"));
  const [saved, setSaved] = useState(initialRules);
  const [info, setInfo] = useState<Info | null>(null);
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState<string[]>([]);

  useEffect(() => {
    let alive = true;
    fetch(apiUrl(`/api/orgs/${organizationId}/exam-network`))
      .then((r) => (r.ok ? (r.json() as Promise<Info>) : null))
      .then((j) => {
        if (alive && j) setInfo(j);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [organizationId]);

  const dirty = text.split("\n").map((l) => l.trim()).filter(Boolean).join("\n") !== saved.join("\n");

  const save = async () => {
    setBusy(true);
    setInvalid([]);
    try {
      const res = await fetch(apiUrl(`/api/orgs/${organizationId}/exam-network`), {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ rules: text.split("\n") }),
      });
      const j = (await res.json().catch(() => null)) as
        | { rules?: string[]; error?: string; invalid?: string[] }
        | null;
      if (!res.ok) {
        if (j?.error === "invalid_ip_rules") {
          setInvalid(j.invalid ?? []);
          toast.error("Có dòng không phải IP hoặc CIDR hợp lệ.");
        } else {
          toast.error("Không lưu được. Thử lại.");
        }
        return;
      }
      setSaved(j?.rules ?? []);
      setText((j?.rules ?? []).join("\n"));
      toast.success(
        (j?.rules ?? []).length === 0
          ? "Đã tắt giới hạn mạng khi vào thi."
          : `Đã lưu ${(j?.rules ?? []).length} dải mạng.`,
      );
    } finally {
      setBusy(false);
    }
  };

  const enabled = saved.length > 0;

  return (
    <section className="card">
      <h2 className="text-base font-semibold">Mạng được phép vào thi</h2>
      <p className="mt-1 text-xs text-muted">
        Học viên chỉ <b>vào thi</b> các đề của trường này khi đang ở trong dải mạng bên dưới (mã
        chung, mã cá nhân, phòng chờ, bắt đầu bài). Học liệu, diễn đàn và các tính năng khác vẫn
        dùng bình thường ở bất kỳ đâu. Để trống = không giới hạn. Đề luyện thi không bị giới hạn.
      </p>

      <label className="mt-3 block text-sm font-medium" htmlFor={`ipr-${organizationId}`}>
        Mỗi dòng một IP hoặc dải CIDR
      </label>
      <textarea
        id={`ipr-${organizationId}`}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        spellCheck={false}
        placeholder={"203.0.113.0/24   # phòng máy A\n198.51.100.7"}
        className="mt-1 w-full rounded border border-token p-2 font-mono text-xs"
      />

      {invalid.length > 0 && (
        <p role="alert" className="mt-2 text-xs text-red-700">
          Không hợp lệ: <span className="font-mono">{invalid.join(", ")}</span>
        </p>
      )}

      {info && (
        <div
          className={`mt-3 rounded border px-3 py-2 text-xs ${
            info.detectedIp === null || info.detectedIpInternal
              ? "border-amber-300 bg-amber-50 text-amber-900"
              : "border-token bg-slate-50 text-slate-700"
          }`}
        >
          <p>
            IP hệ thống thấy khi bạn mở trang này:{" "}
            <b className="font-mono">{info.detectedIp ?? "không xác định"}</b>
          </p>
          {(info.detectedIp === null || info.detectedIpInternal) && (
            <p className="mt-1">
              Đây không phải IP công khai thật của bạn. Có thể proxy chưa truyền IP người dùng tới
              máy chủ. <b>Đừng bật giới hạn</b> cho tới khi mục này hiện đúng IP mạng trường: nếu
              không, mọi học viên sẽ bị chặn.
            </p>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={busy || !dirty}
          className="rounded bg-brand-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "Đang lưu…" : "Lưu"}
        </button>
        <span className="text-xs text-muted">
          {enabled ? `Đang bật: ${saved.length} dải` : "Đang tắt (không giới hạn)"}
        </span>
      </div>
    </section>
  );
}
