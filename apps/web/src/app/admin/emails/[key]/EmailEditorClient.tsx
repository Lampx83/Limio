"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { copyText } from "@/lib/clipboard";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import { apiUrl } from "@/lib/apiUrl";
import HistoryDrawer from "./HistoryDrawer";

interface Variable {
  name: string;
  label: string;
  example: string;
  required?: boolean;
}

export default function EmailEditorClient({
  key_,
  scopeId,
  initial,
}: {
  key_: string;
  scopeId: string;
  initial: {
    subject: string;
    bodyHtml: string;
    bodyText: string;
    enabled: boolean;
    overriddenForScope: boolean;
    variables: Variable[];
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);

  const [subject, setSubject] = useState(initial.subject);
  const [bodyHtml, setBodyHtml] = useState(initial.bodyHtml);
  const [bodyText, setBodyText] = useState(initial.bodyText);
  const [enabled, setEnabled] = useState(initial.enabled);

  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    const changed =
      subject !== initial.subject ||
      bodyHtml !== initial.bodyHtml ||
      bodyText !== initial.bodyText ||
      enabled !== initial.enabled;
    setDirty(changed);
  }, [subject, bodyHtml, bodyText, enabled, initial]);

  // Build example variable map for preview (lookup keys from initial.variables).
  const exampleVars = useMemo(() => {
    const m: Record<string, string> = {};
    for (const v of initial.variables) m[v.name] = v.example ?? "";
    return m;
  }, [initial.variables]);

  // Live preview — render Handlebars-style {{var}} in-browser using a simple
  // string replace. Good enough for preview; real send uses server Handlebars.
  const previewHtml = useMemo(
    () => renderInBrowser(bodyHtml, exampleVars),
    [bodyHtml, exampleVars],
  );
  const previewSubject = useMemo(
    () => renderInBrowser(subject, exampleVars),
    [subject, exampleVars],
  );

  const apiBase = `${apiUrl("/api/admin/emails")}/${encodeURIComponent(key_)}`;

  function onSave() {
    startTransition(async () => {
      const res = await fetch(`${apiBase}?scope=${scopeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          bodyHtml,
          bodyText: bodyText || null,
          enabled,
        }),
      });
      if (!res.ok) {
        const e = await res.json().catch(() => ({}));
        toast.error(e.error ?? "Lưu thất bại");
        return;
      }
      toast.success("Đã lưu thay đổi");
      router.refresh();
    });
  }

  async function onTestSend() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      toast.error("Email không hợp lệ");
      return;
    }
    setTestSending(true);
    try {
      const res = await fetch(`${apiBase}/test-send?scope=${scopeId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: testEmail,
          // Send current (possibly unsaved) draft.
          subject,
          bodyHtml,
          bodyText: bodyText || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Gửi test thất bại");
      } else if (data.delivered) {
        toast.success(`Đã gửi tới ${testEmail}`);
      } else if (data.loggedOnly) {
        toast.info("Resend chưa cấu hình — email chỉ log ra console server");
      } else {
        toast.error(data.error ?? "Provider trả về lỗi");
      }
    } finally {
      setTestSending(false);
    }
  }

  function onRemoveOverride() {
    if (
      !confirm(
        "Xoá override sẽ khiến template quay về dùng mẫu chung. Tiếp tục?",
      )
    )
      return;
    startTransition(async () => {
      const res = await fetch(`${apiBase}?scope=${scopeId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        toast.error("Xoá thất bại");
        return;
      }
      toast.success("Đã xoá override, quay về mẫu chung");
      router.refresh();
    });
  }

  return (
    <>
      {/* Variable cheatsheet */}
      <div className="card mb-4 p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
          Biến có thể dùng (cú pháp <code>{`{{tên}}`}</code>)
        </p>
        <div className="flex flex-wrap gap-2">
          {initial.variables.map((v) => (
            <button
              key={v.name}
              type="button"
              onClick={async () => {
                const ok = await copyText(`{{${v.name}}}`);
                if (ok) toast.info(`Đã copy {{${v.name}}}`);
                else toast.error("Không sao chép được — copy tay giúp.");
              }}
              className="rounded-full border border-base-300 bg-base-50 px-2.5 py-1 text-xs font-mono hover:border-brand-400 hover:bg-brand-50"
              title={`${v.label} — VD: ${v.example}`}
            >
              {`{{${v.name}}}`}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* LEFT: editor */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
              Subject
            </label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="mt-1 w-full rounded-lg border border-base-300 bg-base-50 px-3 py-2 text-sm font-mono focus:border-brand-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
              Body HTML
            </label>
            <textarea
              value={bodyHtml}
              onChange={(e) => setBodyHtml(e.target.value)}
              rows={18}
              className="mt-1 w-full rounded-lg border border-base-300 bg-base-50 px-3 py-2 text-xs font-mono focus:border-brand-500 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-muted">
              Body Text <span className="font-normal text-faint">(fallback cho email client không HTML — để trống để auto-strip từ HTML)</span>
            </label>
            <textarea
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              rows={6}
              className="mt-1 w-full rounded-lg border border-base-300 bg-base-50 px-3 py-2 text-xs font-mono focus:border-brand-500 focus:outline-none"
              spellCheck={false}
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>Bật template này</span>
            {!enabled && (
              <span className="text-xs text-danger-600">
                (Tắt sẽ fallback xuống tầng dưới — org → global → cứng trong code)
              </span>
            )}
          </label>
        </div>

        {/* RIGHT: preview */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
            Preview (với data mẫu)
          </p>
          <div className="rounded-lg border border-base-300 bg-white shadow-sm">
            <div className="border-b border-base-200 px-4 py-2 text-xs">
              <span className="text-muted">Subject: </span>
              <span className="font-medium">{previewSubject}</span>
            </div>
            <iframe
              title="email preview"
              srcDoc={previewHtml}
              sandbox=""
              className="h-[640px] w-full rounded-b-lg"
            />
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div className="sticky bottom-4 mt-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-base-300 bg-white p-3 shadow-lg">
        <div className="flex items-center gap-2">
          <input
            type="email"
            placeholder="Gửi test đến..."
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="rounded-lg border border-base-300 bg-base-50 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
          />
          <button
            onClick={onTestSend}
            disabled={testSending || !testEmail}
            className="btn btn-secondary text-sm"
          >
            {testSending ? "Đang gửi..." : "Gửi test"}
          </button>
          <button
            type="button"
            onClick={() => setHistoryOpen(true)}
            className="btn btn-ghost text-sm"
          >
            Lịch sử sửa
          </button>
          {scopeId !== "global" && initial.overriddenForScope && (
            <button
              type="button"
              onClick={onRemoveOverride}
              disabled={pending}
              className="btn btn-ghost text-sm text-danger-700"
            >
              Xoá override
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <span className="text-xs text-warning-700">
              ● Có thay đổi chưa lưu
            </span>
          )}
          <button
            onClick={onSave}
            disabled={pending || !dirty}
            className="btn btn-primary text-sm"
          >
            {pending ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>

      <HistoryDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        templateKey={key_}
        scopeId={scopeId}
        onReverted={() => router.refresh()}
      />
    </>
  );
}

/**
 * Browser-side Handlebars-lite: replaces {{var}} placeholders with values.
 * Doesn't support helpers/blocks — server uses full Handlebars on real send.
 * Good enough for live preview while editing.
 */
function renderInBrowser(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_match, name: string) =>
    name in vars ? vars[name] ?? "" : "",
  );
}
