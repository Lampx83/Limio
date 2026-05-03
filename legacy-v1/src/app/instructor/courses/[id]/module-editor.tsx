"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Module {
  id: number;
  title: string;
  description: string | null;
  order_idx: number;
}
interface Material {
  id: number;
  type: "video" | "pdf" | "quiz";
  title: string;
  description: string | null;
  video_url: string | null;
  pdf_url: string | null;
  reading_text: string | null;
  quiz_data: string | null;
  duration_min: number | null;
}
interface Assignment {
  id: number;
  title: string;
  prompt: string;
  learning_objectives: string;
  rubric: string;
  min_words: number;
}

export default function ModuleEditor({
  module,
  materials,
  assignments,
}: {
  module: Module;
  materials: Material[];
  assignments: Assignment[];
}) {
  const router = useRouter();
  const [editingModule, setEditingModule] = useState(false);
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [showAddAssignment, setShowAddAssignment] = useState(false);
  const [title, setTitle] = useState(module.title);
  const [description, setDescription] = useState(module.description ?? "");

  async function saveModule() {
    const res = await fetch(`/api/instructor/modules/${module.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    });
    if (res.ok) {
      setEditingModule(false);
      router.refresh();
    } else {
      alert("Lưu thất bại");
    }
  }

  async function deleteModule() {
    if (!confirm(`Xoá module "${module.title}" và toàn bộ học liệu/bài tập?`))
      return;
    const res = await fetch(`/api/instructor/modules/${module.id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  async function deleteMaterial(id: number, name: string) {
    if (!confirm(`Xoá học liệu "${name}"?`)) return;
    const res = await fetch(`/api/instructor/materials/${id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  async function deleteAssignment(id: number, name: string) {
    if (!confirm(`Xoá bài tập "${name}"?`)) return;
    const res = await fetch(`/api/instructor/assignments/${id}`, {
      method: "DELETE",
    });
    if (res.ok) router.refresh();
  }

  return (
    <li className="card p-3 sm:p-4">
      {editingModule ? (
        <div className="space-y-2 mb-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="input"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="input min-h-[60px]"
          />
          <div className="flex gap-2 justify-end">
            <button onClick={() => setEditingModule(false)} className="btn-secondary text-xs py-1 px-2">Huỷ</button>
            <button onClick={saveModule} className="btn-primary text-xs py-1 px-2">Lưu</button>
          </div>
        </div>
      ) : (
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="min-w-0">
            <p className="font-semibold">{module.title}</p>
            {module.description && (
              <p className="text-xs text-slate-500 mt-0.5">{module.description}</p>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button onClick={() => setEditingModule(true)} className="text-xs px-2 py-0.5 rounded border border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">Sửa</button>
            <button onClick={deleteModule} className="text-xs px-2 py-0.5 rounded border border-rose-300 text-rose-600 hover:bg-rose-50">Xoá</button>
          </div>
        </div>
      )}

      {/* Materials */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Học liệu ({materials.length})
          </p>
          <button
            onClick={() => setShowAddMaterial(!showAddMaterial)}
            className="text-xs px-2 py-0.5 rounded border border-brand-300 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
          >
            {showAddMaterial ? "Đóng" : "+ Thêm học liệu"}
          </button>
        </div>
        {showAddMaterial && (
          <NewMaterialForm
            moduleId={module.id}
            onDone={() => {
              setShowAddMaterial(false);
              router.refresh();
            }}
          />
        )}
        <ul className="space-y-1">
          {materials.map((mat) => (
            <li
              key={mat.id}
              className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/50"
            >
              <div className="min-w-0 flex items-center gap-2">
                <TypeBadge type={mat.type} />
                <span className="text-sm truncate">{mat.title}</span>
              </div>
              <button
                onClick={() => deleteMaterial(mat.id, mat.title)}
                className="text-xs text-rose-500 shrink-0"
                title="Xoá"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Assignments */}
      <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Bài tập ({assignments.length})
          </p>
          <button
            onClick={() => setShowAddAssignment(!showAddAssignment)}
            className="text-xs px-2 py-0.5 rounded border border-brand-300 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
          >
            {showAddAssignment ? "Đóng" : "+ Thêm bài tập"}
          </button>
        </div>
        {showAddAssignment && (
          <NewAssignmentForm
            moduleId={module.id}
            onDone={() => {
              setShowAddAssignment(false);
              router.refresh();
            }}
          />
        )}
        <ul className="space-y-1">
          {assignments.map((a) => (
            <li
              key={a.id}
              className="flex items-center justify-between gap-2 p-2 rounded bg-slate-50 dark:bg-slate-800/50"
            >
              <span className="text-sm truncate">{a.title}</span>
              <button
                onClick={() => deleteAssignment(a.id, a.title)}
                className="text-xs text-rose-500 shrink-0"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      </div>
    </li>
  );
}

function TypeBadge({ type }: { type: string }) {
  const m: Record<string, { label: string; cls: string }> = {
    video: { label: "Video", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-200" },
    pdf: { label: "Đọc", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-200" },
    quiz: { label: "Quiz", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-200" },
    slides: { label: "Slides", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-200" },
    file: { label: "Tệp", cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200" },
    link: { label: "Link", cls: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-200" },
    poll: { label: "Khảo sát", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-200" },
    discussion: { label: "Thảo luận", cls: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-200" },
  };
  const meta = m[type] ?? { label: type, cls: "badge-slate" };
  return <span className={`badge ${meta.cls}`}>{meta.label}</span>;
}

function NewMaterialForm({
  moduleId,
  onDone,
}: {
  moduleId: number;
  onDone: () => void;
}) {
  const [type, setType] = useState<"video" | "pdf" | "quiz">("video");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [readingText, setReadingText] = useState("");
  const [quizJson, setQuizJson] = useState(
    `[\n  {"q":"Câu hỏi 1?","options":["A","B","C","D"],"correct_idx":0,"explanation":"..."}\n]`,
  );
  const [duration, setDuration] = useState(5);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        type,
        title,
        description,
        duration_min: duration,
      };
      if (type === "video") body.video_url = videoUrl;
      if (type === "pdf") body.reading_text = readingText;
      if (type === "quiz") {
        try {
          body.quiz_data = JSON.parse(quizJson);
        } catch {
          setError("Quiz JSON không hợp lệ");
          return;
        }
      }
      const res = await fetch(`/api/instructor/modules/${moduleId}/materials`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lưu thất bại");
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-slate-300 dark:border-slate-700 rounded p-3 mb-2 space-y-2">
      <div className="flex gap-2">
        {(["video", "pdf", "quiz"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={`flex-1 px-2 py-1 text-xs rounded border ${
              type === t
                ? "border-brand-600 bg-brand-50 text-brand-900 dark:bg-brand-900/30 dark:text-brand-100"
                : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {t === "video" ? "Video" : t === "pdf" ? "Tài liệu đọc" : "Quiz"}
          </button>
        ))}
      </div>
      <input
        className="input text-sm"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề"
        required
        minLength={3}
      />
      <input
        className="input text-sm"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Mô tả ngắn"
      />
      <input
        type="number"
        className="input text-sm"
        value={duration}
        onChange={(e) => setDuration(Number(e.target.value))}
        placeholder="Thời lượng (phút)"
        min={1}
      />
      {type === "video" && (
        <input
          className="input text-sm font-mono"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="https://www.youtube.com/embed/..."
          required
        />
      )}
      {type === "pdf" && (
        <textarea
          className="input text-sm font-mono min-h-[120px]"
          value={readingText}
          onChange={(e) => setReadingText(e.target.value)}
          placeholder="Nội dung markdown: # tiêu đề, **đậm**, - bullet..."
          required
          minLength={20}
        />
      )}
      {type === "quiz" && (
        <textarea
          className="input text-sm font-mono min-h-[160px]"
          value={quizJson}
          onChange={(e) => setQuizJson(e.target.value)}
          required
        />
      )}
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onDone}
          className="btn-secondary text-xs py-1 px-2"
        >
          Huỷ
        </button>
        <button disabled={submitting} className="btn-primary text-xs py-1 px-2">
          {submitting ? "..." : "Tạo"}
        </button>
      </div>
    </form>
  );
}

function NewAssignmentForm({
  moduleId,
  onDone,
}: {
  moduleId: number;
  onDone: () => void;
}) {
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [lo, setLo] = useState("");
  const [rubric, setRubric] = useState("");
  const [minWords, setMinWords] = useState(150);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/instructor/modules/${moduleId}/assignments`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title,
            prompt,
            learning_objectives: lo,
            rubric,
            min_words: minWords,
          }),
        },
      );
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Lưu thất bại");
        return;
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="border border-slate-300 dark:border-slate-700 rounded p-3 mb-2 space-y-2">
      <input
        className="input text-sm"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Tiêu đề bài tập"
        required
        minLength={3}
      />
      <textarea
        className="input text-sm min-h-[80px]"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Đề bài (≥ 20 ký tự)"
        required
      />
      <textarea
        className="input text-sm"
        value={lo}
        onChange={(e) => setLo(e.target.value)}
        placeholder="Mục tiêu học tập"
        required
      />
      <textarea
        className="input text-sm"
        value={rubric}
        onChange={(e) => setRubric(e.target.value)}
        placeholder="Rubric chấm điểm"
        required
      />
      <input
        type="number"
        className="input text-sm"
        value={minWords}
        onChange={(e) => setMinWords(Number(e.target.value))}
        placeholder="Số từ tối thiểu"
        min={20}
      />
      {error && <div className="text-xs text-rose-600">{error}</div>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onDone} className="btn-secondary text-xs py-1 px-2">
          Huỷ
        </button>
        <button disabled={submitting} className="btn-primary text-xs py-1 px-2">
          {submitting ? "..." : "Tạo bài tập"}
        </button>
      </div>
    </form>
  );
}
