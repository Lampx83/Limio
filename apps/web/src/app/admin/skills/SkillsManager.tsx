"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  X,
  AlertTriangle,
  Network,
  Loader2,
} from "lucide-react";

export type SkillRow = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  createdAt: Date | string;
  _count: {
    contentMappings: number;
    questionTags: number;
    prerequisites: number;
    dependents: number;
  };
};

type Prereq = { id: string; code: string; name: string };

export default function SkillsManager({
  initialSkills,
}: {
  initialSkills: SkillRow[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = filter.toLowerCase().trim();
    if (!q) return initialSkills;
    return initialSkills.filter(
      (s) =>
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q),
    );
  }, [filter, initialSkills]);

  const refresh = () => router.refresh();

  return (
    <div className="space-y-4">
      {/* Search + create */}
      <div className="flex items-center gap-2">
        <input
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Tìm theo code hoặc tên..."
          className="input flex-1"
        />
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="btn-primary btn-sm inline-flex items-center gap-1.5"
        >
          <Plus size={14} /> Skill mới
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-danger-200 bg-danger-50 px-3 py-2 text-sm text-danger-700">
          <AlertTriangle size={14} /> {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-xs underline"
          >
            Đóng
          </button>
        </div>
      )}

      {creating && (
        <CreateForm
          onCancel={() => setCreating(false)}
          onError={setError}
          onCreated={() => {
            setCreating(false);
            refresh();
          }}
        />
      )}

      {/* List */}
      <div className="overflow-hidden rounded-2xl border border-token bg-[rgb(var(--surface))] shadow-card">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--surface-muted))]">
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Tên</th>
              <th className="px-4 py-3 text-right">Lesson</th>
              <th className="px-4 py-3 text-right">Question</th>
              <th className="px-4 py-3 text-right">Prereq</th>
              <th className="px-4 py-3 text-right">Dependents</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-token">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-faint">
                  Không có skill nào khớp.
                </td>
              </tr>
            )}
            {filtered.map((s) => (
              <SkillRowView
                key={s.id}
                skill={s}
                allSkills={initialSkills}
                editing={editing === s.id}
                onEdit={() => setEditing(s.id)}
                onCancelEdit={() => setEditing(null)}
                expanded={expandedId === s.id}
                onToggleExpand={() =>
                  setExpandedId(expandedId === s.id ? null : s.id)
                }
                onError={setError}
                onRefresh={refresh}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CreateForm({
  onCancel,
  onCreated,
  onError,
}: {
  onCancel: () => void;
  onCreated: () => void;
  onError: (m: string) => void;
}) {
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: code.trim(),
          name: name.trim(),
          description: description.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        onError(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onCreated();
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-2xl border border-brand-200 bg-brand-50/40 p-4 dark:border-brand-900/40 dark:bg-brand-950/10"
    >
      <header className="flex items-baseline justify-between border-b border-brand-200 pb-2 dark:border-brand-900/40">
        <h3 className="font-semibold">Tạo skill mới</h3>
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
          <X size={14} />
        </button>
      </header>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Code <span className="text-danger-600">*</span>
          </span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="vd: linear_regression.basics"
            pattern="[a-z][a-z0-9._-]*"
            required
            minLength={2}
            maxLength={80}
            className="input mt-1 font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-faint">
            Lowercase, chỉ chứa <code>a-z0-9._-</code>. Không sửa được sau khi
            tạo.
          </span>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Tên <span className="text-danger-600">*</span>
          </span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="vd: Linear Regression cơ bản"
            required
            maxLength={200}
            className="input mt-1"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-faint">
            Mô tả (tuỳ chọn)
          </span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={5000}
            rows={2}
            className="input mt-1 font-normal"
          />
        </label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="btn-ghost btn-sm">
          Huỷ
        </button>
        <button
          type="submit"
          disabled={busy}
          className="btn-primary btn-sm inline-flex items-center gap-1.5 disabled:opacity-50"
        >
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Tạo
        </button>
      </div>
    </form>
  );
}

function SkillRowView({
  skill,
  allSkills,
  editing,
  onEdit,
  onCancelEdit,
  expanded,
  onToggleExpand,
  onError,
  onRefresh,
}: {
  skill: SkillRow;
  allSkills: SkillRow[];
  editing: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  expanded: boolean;
  onToggleExpand: () => void;
  onError: (m: string) => void;
  onRefresh: () => void;
}) {
  const [name, setName] = useState(skill.name);
  const [description, setDescription] = useState(skill.description ?? "");
  const [busy, setBusy] = useState(false);

  const totalUsage =
    skill._count.contentMappings + skill._count.questionTags;

  const saveEdit = async () => {
    setBusy(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        onError(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onCancelEdit();
      onRefresh();
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
    }
  };

  const deleteSkill = async () => {
    const usageMsg =
      totalUsage > 0
        ? `Skill này đang được dùng (${skill._count.contentMappings} lesson + ${skill._count.questionTags} question). Vẫn xoá?`
        : "Xoá skill này?";
    if (!confirm(usageMsg)) return;
    const force = totalUsage > 0;
    setBusy(true);
    try {
      const res = await fetch(
        `/api/skills/${skill.id}${force ? "?force=1" : ""}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) {
        onError(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      onRefresh();
    } catch (e) {
      onError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <>
      <tr className="transition-colors hover:bg-[rgb(var(--surface-muted))]">
        <td className="px-4 py-3 align-top">
          <code className="text-xs font-mono text-faint">{skill.code}</code>
        </td>
        <td className="px-4 py-3 align-top">
          {editing ? (
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input text-sm"
            />
          ) : (
            <p className="font-medium">{skill.name}</p>
          )}
          {!editing && skill.description && (
            <p className="mt-0.5 text-xs text-faint">{skill.description}</p>
          )}
          {editing && (
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Mô tả"
              className="input mt-2 text-xs"
            />
          )}
        </td>
        <td className="px-4 py-3 align-top text-right tabular-nums text-faint">
          {skill._count.contentMappings}
        </td>
        <td className="px-4 py-3 align-top text-right tabular-nums text-faint">
          {skill._count.questionTags}
        </td>
        <td className="px-4 py-3 align-top text-right tabular-nums text-faint">
          {skill._count.prerequisites}
        </td>
        <td className="px-4 py-3 align-top text-right tabular-nums text-faint">
          {skill._count.dependents}
        </td>
        <td className="px-4 py-3 align-top text-right">
          <div className="flex justify-end gap-1">
            {editing ? (
              <>
                <button
                  type="button"
                  onClick={saveEdit}
                  disabled={busy}
                  className="btn-primary btn-sm inline-flex items-center gap-1"
                >
                  {busy ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Save size={12} />
                  )}
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={onCancelEdit}
                  className="btn-ghost btn-sm"
                >
                  <X size={12} />
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onToggleExpand}
                  className={
                    "btn-ghost btn-sm inline-flex items-center gap-1 " +
                    (expanded ? "bg-[rgb(var(--surface-muted))]" : "")
                  }
                  title="Prerequisites"
                >
                  <Network size={12} />
                </button>
                <button
                  type="button"
                  onClick={onEdit}
                  className="btn-ghost btn-sm"
                  title="Sửa"
                >
                  <Pencil size={12} />
                </button>
                <button
                  type="button"
                  onClick={deleteSkill}
                  disabled={busy}
                  className="btn-ghost btn-sm text-danger-600 hover:bg-danger-50"
                  title="Xoá"
                >
                  <Trash2 size={12} />
                </button>
              </>
            )}
          </div>
        </td>
      </tr>
      {expanded && !editing && (
        <tr className="bg-[rgb(var(--surface-muted))]/40">
          <td colSpan={7} className="px-4 py-3">
            <PrerequisitesEditor
              skill={skill}
              allSkills={allSkills}
              onError={onError}
              onRefresh={onRefresh}
            />
          </td>
        </tr>
      )}
    </>
  );
}

function PrerequisitesEditor({
  skill,
  allSkills,
  onError,
  onRefresh,
}: {
  skill: SkillRow;
  allSkills: SkillRow[];
  onError: (m: string) => void;
  onRefresh: () => void;
}) {
  const [prereqs, setPrereqs] = useState<Prereq[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pickerId, setPickerId] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}/prerequisites`);
      const body = await res.json();
      if (!res.ok) {
        onError(body.error ?? `HTTP ${res.status}`);
      } else {
        setPrereqs(body.prerequisites as Prereq[]);
      }
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  // Lazy load on first mount.
  if (prereqs === null && !loading) {
    void load();
  }

  const addPrereq = async () => {
    if (!pickerId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/skills/${skill.id}/prerequisites`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prerequisiteSkillId: pickerId }),
      });
      const body = await res.json();
      if (!res.ok) {
        onError(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      setPickerId("");
      await load();
      onRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const removePrereq = async (prereqId: string) => {
    setBusy(true);
    try {
      const res = await fetch(
        `/api/skills/${skill.id}/prerequisites/${prereqId}`,
        { method: "DELETE" },
      );
      const body = await res.json();
      if (!res.ok) {
        onError(body.error ?? `HTTP ${res.status}`);
        setBusy(false);
        return;
      }
      await load();
      onRefresh();
    } catch (e) {
      onError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const candidates = useMemo(() => {
    const existing = new Set((prereqs ?? []).map((p) => p.id));
    return allSkills.filter(
      (s) => s.id !== skill.id && !existing.has(s.id),
    );
  }, [allSkills, prereqs, skill.id]);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-faint">
          Prerequisite của {skill.name}
        </p>
        {loading && <p className="mt-2 text-xs text-faint">Đang tải...</p>}
        {prereqs && prereqs.length === 0 && (
          <p className="mt-2 text-xs text-faint">
            Chưa có prerequisite — skill này được coi là root.
          </p>
        )}
        {prereqs && prereqs.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {prereqs.map((p) => (
              <li
                key={p.id}
                className="inline-flex items-center gap-1 rounded-full border border-token bg-[rgb(var(--surface))] py-1 pl-3 pr-1 text-xs"
              >
                <code className="text-faint">{p.code}</code>
                <span>·</span>
                <span>{p.name}</span>
                <button
                  type="button"
                  onClick={() => removePrereq(p.id)}
                  disabled={busy}
                  className="ml-1 rounded-full p-0.5 text-faint hover:bg-danger-50 hover:text-danger-600"
                >
                  <X size={12} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={pickerId}
          onChange={(e) => setPickerId(e.target.value)}
          className="input flex-1 text-sm"
        >
          <option value="">— Thêm prerequisite —</option>
          {candidates.map((s) => (
            <option key={s.id} value={s.id}>
              {s.code} — {s.name}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={addPrereq}
          disabled={!pickerId || busy}
          className="btn-secondary btn-sm inline-flex items-center gap-1 disabled:opacity-50"
        >
          {busy ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Thêm
        </button>
      </div>
    </div>
  );
}
