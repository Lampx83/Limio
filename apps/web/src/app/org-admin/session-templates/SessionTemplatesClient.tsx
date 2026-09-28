"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Save, X, AlertTriangle, Loader2 } from "lucide-react";
import EmptyState from "@/components/ui/EmptyState";

interface Template {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

export default function SessionTemplatesClient({
  organizationId,
  initial,
}: {
  organizationId: string;
  initial: Template[];
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const remove = async (id: string, name: string) => {
    if (!window.confirm(`Xoá ca "${name}"? Không ảnh hưởng đợt thi đã tạo.`))
      return;
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/session-templates/${id}`, {
        method: "DELETE",
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {err && (
        <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <AlertTriangle size={14} /> {err}
        </div>
      )}

      {initial.length === 0 && !adding ? (
        <EmptyState
          title="Chưa có ca thi nào"
          description={
            <>
              Bấm <strong>Thêm ca thi</strong> để bắt đầu.
            </>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-token bg-[rgb(var(--surface))]">
          <table className="w-full text-sm">
            <thead className="border-b border-token bg-[rgb(var(--surface-muted))] text-left text-xs uppercase tracking-wide text-faint">
              <tr>
                <th className="px-3 py-2">Mã</th>
                <th className="px-3 py-2">Tên ca</th>
                <th className="px-3 py-2">Giờ bắt đầu</th>
                <th className="px-3 py-2">Giờ kết thúc</th>
                <th className="px-3 py-2 text-right">Thứ tự</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-token">
              {initial.map((t) =>
                editing === t.id ? (
                  <EditRow
                    key={t.id}
                    template={t}
                    onDone={() => {
                      setEditing(null);
                      router.refresh();
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : (
                  <tr key={t.id} className="border-t border-token">
                    <td className="px-3 py-2 font-mono text-xs">{t.code}</td>
                    <td className="px-3 py-2 font-medium">{t.name}</td>
                    <td className="px-3 py-2 font-mono text-sm">{t.startTime}</td>
                    <td className="px-3 py-2 font-mono text-sm">{t.endTime}</td>
                    <td className="px-3 py-2 text-right text-xs text-faint">
                      {t.orderIndex}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setEditing(t.id)}
                          className="btn-ghost btn-sm"
                          title="Sửa"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(t.id, t.name)}
                          disabled={busy}
                          className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                          title="Xoá"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ),
              )}
              {adding && (
                <AddRow
                  organizationId={organizationId}
                  onDone={() => {
                    setAdding(false);
                    router.refresh();
                  }}
                  onCancel={() => setAdding(false)}
                />
              )}
            </tbody>
          </table>
        </div>
      )}

      {!adding && (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="btn-primary btn-sm inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Thêm ca thi
        </button>
      )}
    </div>
  );
}

function AddRow({
  organizationId,
  onDone,
  onCancel,
}: {
  organizationId: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [orderIndex, setOrderIndex] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/orgs/${organizationId}/session-templates`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim().toUpperCase(),
          name: name.trim(),
          startTime,
          endTime,
          orderIndex: orderIndex ? Number(orderIndex) : 0,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-token bg-brand-50 dark:bg-brand-950/20">
      <td className="px-3 py-2">
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="CA-1"
          maxLength={32}
          autoFocus
          className="w-20 rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 font-mono text-xs uppercase"
        />
      </td>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ca 1 — Sáng"
          maxLength={200}
          className="w-full rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-24 rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-24 rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={orderIndex}
          onChange={(e) => setOrderIndex(e.target.value)}
          placeholder="0"
          min={0}
          max={9999}
          className="w-16 rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {err && (
            <span className="inline-flex items-center gap-1 text-xs text-danger-600">
              <AlertTriangle size={12} /> {err}
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-ghost btn-sm"
          >
            <X size={12} />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !code.trim() || !name.trim() || !startTime || !endTime}
            className="btn-primary btn-sm inline-flex items-center gap-1"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Tạo
          </button>
        </div>
      </td>
    </tr>
  );
}

function EditRow({
  template,
  onDone,
  onCancel,
}: {
  template: Template;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(template.name);
  const [startTime, setStartTime] = useState(template.startTime);
  const [endTime, setEndTime] = useState(template.endTime);
  const [orderIndex, setOrderIndex] = useState(template.orderIndex.toString());
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const r = await fetch(`/api/session-templates/${template.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          startTime,
          endTime,
          orderIndex: Number(orderIndex) || 0,
        }),
      });
      if (!r.ok) {
        const j = (await r.json().catch(() => null)) as { error?: string } | null;
        setErr(j?.error ?? `HTTP ${r.status}`);
        return;
      }
      onDone();
    } finally {
      setBusy(false);
    }
  };

  return (
    <tr className="border-t border-token bg-brand-50 dark:bg-brand-950/20">
      <td className="px-3 py-2 font-mono text-xs text-faint">
        {template.code}
      </td>
      <td className="px-3 py-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={200}
          className="w-full rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="time"
          value={startTime}
          onChange={(e) => setStartTime(e.target.value)}
          className="w-24 rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="time"
          value={endTime}
          onChange={(e) => setEndTime(e.target.value)}
          className="w-24 rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2">
        <input
          type="number"
          value={orderIndex}
          onChange={(e) => setOrderIndex(e.target.value)}
          min={0}
          max={9999}
          className="w-16 rounded border border-token bg-[rgb(var(--surface))] px-2 py-1 text-sm"
        />
      </td>
      <td className="px-3 py-2 text-right whitespace-nowrap">
        <div className="flex items-center justify-end gap-2">
          {err && (
            <span className="inline-flex items-center gap-1 text-xs text-danger-600">
              <AlertTriangle size={12} /> {err}
            </span>
          )}
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="btn-ghost btn-sm"
          >
            <X size={12} />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !name.trim() || !startTime || !endTime}
            className="btn-primary btn-sm inline-flex items-center gap-1"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Lưu
          </button>
        </div>
      </td>
    </tr>
  );
}
