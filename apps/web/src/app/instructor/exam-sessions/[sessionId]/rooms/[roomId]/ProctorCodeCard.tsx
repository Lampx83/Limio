"use client";

import { useState } from "react";
import { Check, Copy, Eye } from "lucide-react";
import { copyText } from "@/lib/clipboard";
import { shareUrl } from "@/lib/apiUrl";

/**
 * Mã để giám thị vào coi phòng này mà không cần tài khoản.
 *
 * Cố ý tách hẳn khỏi ô "Mã phòng cho thí sinh" ngay trên nó, và nói rõ đừng
 * chiếu lên màn: hai mã trông giống nhau, phát nhầm thì cả phòng xem được
 * tiến độ của nhau.
 */
export default function ProctorCodeCard({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const [err, setErr] = useState(false);
  const url = shareUrl("/giam-thi");

  const copy = async () => {
    const ok = await copyText(`${url} — mã: ${code}`);
    if (!ok) {
      setErr(true);
      setTimeout(() => setErr(false), 4000);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="mt-2 rounded-md border border-slate-300 bg-slate-50 px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <Eye className="h-4 w-4 shrink-0 text-slate-700" />
        <span className="text-sm text-slate-900">Mã giám thị:</span>
        <code className="rounded bg-white px-2 py-0.5 font-mono text-base font-bold tracking-widest text-slate-900">
          {code}
        </code>
        <button
          type="button"
          onClick={copy}
          className="rounded border border-slate-300 bg-white p-1.5 text-slate-700 hover:bg-slate-100"
          aria-label="Sao chép link và mã giám thị"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-600">
        Giám thị vào <span className="font-medium">{url}</span> rồi nhập mã này
        để điểm danh và theo dõi phòng — không cần tài khoản.
      </p>
      <p className="mt-1 text-xs font-medium text-amber-800">
        Gửi riêng cho giám thị. Đừng chiếu lên màn hay in vào phiếu thí sinh —
        ai có mã này đều xem được tiến độ cả phòng.
      </p>
      {err && (
        <p className="mt-1 text-xs text-red-700">
          Không sao chép được — bôi đen mã rồi copy tay giúp.
        </p>
      )}
    </div>
  );
}
