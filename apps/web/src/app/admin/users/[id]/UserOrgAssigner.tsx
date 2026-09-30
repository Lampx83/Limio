"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiUrl } from "@/lib/apiUrl";
import { toast } from "@/lib/toast";
import { COMMON_POOL_FILTER_VALUE, COMMON_POOL_LABEL } from "@feedbackme/shared-types";

export interface OrgOption {
  id: string;
  name: string;
  code: string;
}

const ERROR_MESSAGES: Record<string, string> = {
  org_not_found: "Không tìm thấy tổ chức",
  user_not_found: "Không tìm thấy user",
  forbidden: "Bạn không có quyền thực hiện thao tác này",
};

export default function UserOrgAssigner({
  userId,
  currentOrgId,
  orgs,
}: {
  userId: string;
  currentOrgId: string | null;
  orgs: OrgOption[];
}) {
  const router = useRouter();
  const [saved, setSaved] = useState(currentOrgId ?? COMMON_POOL_FILTER_VALUE);
  const [value, setValue] = useState(saved);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    const res = await fetch(apiUrl(`/api/admin/users/${userId}/organization`), {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        organizationId: value === COMMON_POOL_FILTER_VALUE ? null : value,
      }),
    });
    setBusy(false);
    if (res.ok) {
      setSaved(value);
      toast.success("Đã cập nhật tổ chức của user");
      router.refresh();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error("Cập nhật thất bại", {
        description: ERROR_MESSAGES[data?.error] ?? data?.error,
      });
    }
  }

  return (
    <div className="flex flex-wrap items-end gap-2">
      <div className="min-w-[220px] flex-1">
        <label htmlFor="user-org" className="label">
          Tổ chức
        </label>
        <select
          id="user-org"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="input mt-1"
        >
          <option value={COMMON_POOL_FILTER_VALUE}>{COMMON_POOL_LABEL} (không thuộc tổ chức nào)</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name} ({o.code})
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={save}
        disabled={busy || value === saved}
        className="btn-secondary btn-sm"
      >
        {busy ? "Đang lưu…" : "Lưu"}
      </button>
    </div>
  );
}
