"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/apiUrl";
import { formatDateTime } from "@/lib/datetime";

interface Status {
  key: string;
  hasValue: boolean;
  source: "db" | "env" | "none";
  updatedAt: string | Date | null;
}

const LABELS: Record<string, { name: string; placeholder: string; help?: string; emoji?: string }> = {
  openai: {
    name: "OpenAI API key",
    placeholder: "sk-proj-...",
    help: "Dùng cho AI tutor, auto-tag skill, generate feedback. Lấy ở console.openai.com.",
    emoji: "",
  },
  "stripe.secret": {
    name: "Stripe secret key",
    placeholder: "sk_live_... / sk_test_...",
    emoji: "",
  },
  "vnpay.secret": { name: "VNPay secret", placeholder: "VNPAY_HASH_SECRET", emoji: "" },
  "momo.secret": { name: "Momo secret", placeholder: "MOMO_SECRET_KEY", emoji: "" },
  "vbee.app_id": { name: "App-Id", placeholder: "App-Id" },
  "vbee.token": { name: "Token", placeholder: "Token" },
};

/**
 * Vài integration cần NHIỀU secret cùng lúc (vd Vbee: App-Id + Token) — gom
 * lại một khung thay vì mỗi secret một card riêng, để rõ đây là MỘT tích hợp
 * chứ không phải hai cái không liên quan.
 */
const GROUPS: Record<
  string,
  { name: string; help?: string; emoji?: string; keys: string[]; testEndpoint?: string }
> = {
  vbee: {
    name: "Vbee — vấn đáp AI bằng giọng nói",
    help: "TTS + STT cho chế độ vấn đáp bằng giọng nói. Lấy cả App-Id và Token ở studio.vbee.vn/apps.",
    emoji: "",
    keys: ["vbee.app_id", "vbee.token"],
    // Không có mode "test trước khi lưu" như OpenAI — App-Id/Token là hai ô
    // độc lập, không có một giá trị "đang gõ" duy nhất để test tạm. Test
    // luôn nhắm vào cặp ĐÃ LƯU, và chỉ bật khi cả hai đã cấu hình.
    testEndpoint: "/api/admin/integrations/vbee/test",
  },
};

export default function IntegrationsManager({
  initialStatuses,
}: {
  initialStatuses: Status[];
}) {
  const [statuses, setStatuses] = useState<Status[]>(initialStatuses);

  async function refresh() {
    const r = await fetch(apiUrl("/api/admin/integrations"));
    const j = await r.json();
    setStatuses(j.statuses ?? []);
  }

  const byKey = new Map(statuses.map((s) => [s.key, s]));
  const groupedKeys = new Set(Object.values(GROUPS).flatMap((g) => g.keys));
  const standalone = statuses.filter((s) => !groupedKeys.has(s.key));

  return (
    <div className="space-y-4">
      {Object.entries(GROUPS).map(([groupId, group]) => {
        const members = group.keys
          .map((k) => byKey.get(k))
          .filter((s): s is Status => s !== undefined);
        if (members.length === 0) return null;
        return (
          <IntegrationGroupCard key={groupId} group={group} members={members} onChange={refresh} />
        );
      })}
      {standalone.map((s) => (
        <IntegrationRow key={s.key} status={s} onChange={refresh} />
      ))}
    </div>
  );
}

function IntegrationGroupCard({
  group,
  members,
  onChange,
}: {
  group: { name: string; help?: string; emoji?: string; testEndpoint?: string };
  members: Status[];
  onChange: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const allConfigured = members.every((m) => m.hasValue);

  async function testSaved() {
    if (!group.testEndpoint) return;
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch(apiUrl(group.testEndpoint), { method: "POST" });
    const j = await res.json();
    setBusy(false);
    setTestResult(j.ok ? "✓ Key đã lưu hợp lệ" : `✗ ${j.error}`);
  }

  return (
    <section className="card">
      <header className="flex items-start gap-3 border-b border-token pb-3">
        <span className="text-2xl">{group.emoji ?? ""}</span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{group.name}</h2>
          {group.help && <p className="mt-1.5 text-xs text-muted">{group.help}</p>}
        </div>
      </header>
      <div className="mt-4 space-y-5">
        {members.map((status, i) => (
          <div key={status.key} className={i > 0 ? "border-t border-token pt-4" : ""}>
            <IntegrationField status={status} onChange={onChange} />
          </div>
        ))}
      </div>

      {group.testEndpoint && allConfigured && (
        <div className="mt-4 border-t border-token pt-4">
          <button
            onClick={testSaved}
            disabled={busy}
            className="btn-secondary btn-sm"
          >
            Test key đã lưu
          </button>
          {testResult && (
            <p
              className={`mt-3 rounded-lg px-3 py-2 text-xs ${
                testResult.startsWith("✓")
                  ? "border border-success-100 bg-success-50 text-success-700"
                  : testResult.startsWith("✗")
                    ? "border border-danger-100 bg-danger-50 text-danger-700"
                    : "border border-token bg-[rgb(var(--surface-muted))] text-muted"
              }`}
            >
              {testResult}
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function IntegrationRow({
  status,
  onChange,
}: {
  status: Status;
  onChange: () => void;
}) {
  const meta = LABELS[status.key] ?? { name: status.key, placeholder: "", emoji: "" };
  return (
    <section className="card">
      <header className="flex items-start justify-between gap-3 border-b border-token pb-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <span className="text-2xl">{meta.emoji ?? ""}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold">{meta.name}</h2>
            <p className="mt-0.5 text-xs text-faint">
              <code className="font-mono">{status.key}</code>
            </p>
            {meta.help && <p className="mt-1.5 text-xs text-muted">{meta.help}</p>}
          </div>
        </div>
        <StatusChip status={status} />
      </header>
      <div className="mt-4">
        <IntegrationField status={status} onChange={onChange} hideLabel />
      </div>
    </section>
  );
}

function StatusChip({ status }: { status: Status }) {
  const statusChip = status.hasValue
    ? status.source === "env"
      ? "chip-brand"
      : "chip-success"
    : "chip";
  const statusLabel = status.hasValue
    ? status.source === "env"
      ? "✓ env"
      : "✓ saved"
    : "Chưa cấu hình";
  return <span className={statusChip}>{statusLabel}</span>;
}

/**
 * Phần thân dùng chung cho cả card đơn (IntegrationRow) lẫn card gộp nhóm
 * (IntegrationGroupCard): nhãn nhỏ + trạng thái (trừ khi `hideLabel` — card
 * đơn đã hiện tên/trạng thái ở header rồi), ô nhập, nút lưu/đổi/xoá, kết quả
 * test, thời điểm cập nhật. Mỗi field tự quản state của riêng nó — lưu App-Id
 * không đụng gì tới Token.
 */
function IntegrationField({
  status,
  onChange,
  hideLabel,
}: {
  status: Status;
  onChange: () => void;
  hideLabel?: boolean;
}) {
  const meta = LABELS[status.key] ?? { name: status.key, placeholder: "" };
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [showInput, setShowInput] = useState(!status.hasValue);

  async function save() {
    if (!value.trim()) return;
    setBusy(true);
    setTestResult(null);
    const res = await fetch(
      apiUrl(`/api/admin/integrations/${encodeURIComponent(status.key)}`),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: value.trim() }),
      },
    );
    setBusy(false);
    if (res.ok) {
      setValue("");
      setShowInput(false);
      setTestResult("✓ Đã lưu (encrypted)");
      onChange();
    } else {
      const d = await res.json().catch(() => ({}));
      setTestResult(`Lỗi: ${d.error ?? "unknown"}`);
    }
  }

  async function testInline() {
    if (!value.trim()) return;
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch(apiUrl("/api/admin/integrations/openai/test"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value: value.trim() }),
    });
    const j = await res.json();
    setBusy(false);
    setTestResult(
      j.ok ? `✓ Hợp lệ (${j.modelCount} models)` : `✗ ${j.error}`,
    );
  }

  async function testSaved() {
    setBusy(true);
    setTestResult("Testing...");
    const res = await fetch(apiUrl("/api/admin/integrations/openai/test"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const j = await res.json();
    setBusy(false);
    setTestResult(
      j.ok ? `✓ Key đã lưu hợp lệ (${j.modelCount} models)` : `✗ ${j.error}`,
    );
  }

  async function clearKey() {
    if (!confirm(`Xóa key "${status.key}"?`)) return;
    setBusy(true);
    const res = await fetch(
      apiUrl(`/api/admin/integrations/${encodeURIComponent(status.key)}`),
      { method: "DELETE" },
    );
    setBusy(false);
    if (res.ok) {
      setValue("");
      setShowInput(true);
      setTestResult(null);
      onChange();
    }
  }

  return (
    <div>
      {!hideLabel && (
        <div className="mb-2 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <span className="text-sm font-medium">{meta.name}</span>{" "}
            <code className="font-mono text-xs text-faint">{status.key}</code>
          </div>
          <StatusChip status={status} />
        </div>
      )}

      {showInput ? (
        <div className="space-y-3">
          <input
            type="password"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={meta.placeholder}
            className="input font-mono"
            autoComplete="off"
          />
          <div className="flex flex-wrap gap-2">
            {status.key === "openai" && (
              <button
                onClick={testInline}
                disabled={busy || !value}
                className="btn-secondary btn-sm"
              >
                Test trước khi lưu
              </button>
            )}
            <button
              onClick={save}
              disabled={busy || !value}
              className="btn-primary btn-sm"
            >
              {busy ? "..." : "Lưu (encrypted)"}
            </button>
            {status.hasValue && (
              <button
                onClick={() => {
                  setShowInput(false);
                  setValue("");
                  setTestResult(null);
                }}
                className="btn-ghost btn-sm"
              >
                Hủy
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setShowInput(true)}
            className="btn-secondary btn-sm"
          >
            Thay đổi
          </button>
          {status.key === "openai" && (
            <button
              onClick={testSaved}
              disabled={busy}
              className="btn-secondary btn-sm"
            >
              Test key đã lưu
            </button>
          )}
          {status.source === "db" && (
            <button
              onClick={clearKey}
              disabled={busy}
              className="btn-sm inline-flex items-center justify-center gap-2 rounded-lg border border-danger-100 bg-[rgb(var(--surface))] px-3 py-1.5 font-medium text-danger-600 transition-colors hover:bg-danger-50 disabled:opacity-50"
            >
              Xóa
            </button>
          )}
        </div>
      )}

      {testResult && (
        <p
          className={`mt-3 rounded-lg px-3 py-2 text-xs ${
            testResult.startsWith("✓")
              ? "border border-success-100 bg-success-50 text-success-700"
              : testResult.startsWith("✗") || testResult.startsWith("Lỗi")
                ? "border border-danger-100 bg-danger-50 text-danger-700"
                : "border border-token bg-[rgb(var(--surface-muted))] text-muted"
          }`}
        >
          {testResult}
        </p>
      )}

      {status.updatedAt && (
        <p className="mt-3 text-xs text-faint">
          Cập nhật: {formatDateTime(status.updatedAt)}
        </p>
      )}
    </div>
  );
}
