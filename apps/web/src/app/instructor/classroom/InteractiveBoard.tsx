"use client";

import { useEffect, useRef, useState } from "react";
import { copyText } from "@/lib/clipboard";
import {
  StickyNote, RefreshCw, RotateCcw, EyeOff, Eye, Trash2, Pencil, Upload,
  Plus, X, QrCode, Link as LinkIcon, Image as ImageIcon, Video, Music,
  PanelLeftOpen, PanelLeftClose, LayoutGrid, Clipboard, ClipboardX,
} from "lucide-react";
import { toast } from "@/lib/toast";
import dynamic from "next/dynamic";
import { apiUrl, shareUrl } from "@/lib/apiUrl";
import { formatVN } from "@/lib/datetime";
import {
  BOARD_NOTE_COLORS,
  rotationForNote,
  detectMediaKind,
  isValidAttachmentUrl,
  groupNotesByColumn,
  columnHeaderColor,
  BOARD_ATTACHMENT_ACCEPT,
  BOARD_ATTACHMENT_MAX_BYTES,
} from "./boardNoteStyle";
import NoteAttachment from "./NoteAttachment";
import { LimeSliceIcon, WatermelonSliceIcon } from "@/components/BrandIcons";

const QRCode = dynamic(
  () => import("qrcode.react").then((mod) => mod.QRCodeSVG),
  {
    ssr: false,
    loading: () => (
      <div className="bg-white p-3 rounded-lg border border-token" style={{ width: 200, height: 200 }} />
    ),
  },
);

interface BoardNote {
  id: string;
  authorName: string;
  content: string;
  color: string | null;
  attachmentUrl: string | null;
  hidden: boolean;
  column: string | null;
  createdAt: string;
}

interface Board {
  id: string;
  code: string;
  title: string;
  prompt: string | null;
  status: string;
  columns: string[];
  blockPaste: boolean;
  drawingMode?: boolean;
  notes: BoardNote[];
}

interface BoardHistoryItem {
  id: string;
  code: string;
  title: string;
  status: string;
  drawingMode?: boolean;
  createdAt: string;
  _count: { notes: number };
}

interface InteractiveBoardProps {
  onExit?: () => void;
  /** Draw-it độc lập: học viên quét QR rồi vẽ hình, mỗi hình là 1 note ảnh trên bảng. */
  drawing?: boolean;
}

export default function InteractiveBoard({ onExit, drawing = false }: InteractiveBoardProps) {
  const [current, setCurrent] = useState<Board | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  // Mặc định full-screen ngay khi vào phiên board — che luôn top nav +
  // sidebar + "← Quay lại" của trang cha (xem TeachingToolsClient.tsx),
  // tránh 2 nút exit cùng hiển thị. Nút "⛶ Thoát" vẫn cho phép thu nhỏ lại.
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrPanelOpen, setQrPanelOpen] = useState(true);
  const [history, setHistory] = useState<BoardHistoryItem[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  // Grid theo nhóm — tùy chọn lúc tạo board, mặc định TẮT (masonry tự do như trước).
  const [gridEnabled, setGridEnabled] = useState(false);
  const [columnsInput, setColumnsInput] = useState<string[]>(["Nhóm 1", "Nhóm 2"]);
  // Chặn dán khi HV viết note — tùy chọn lúc tạo board, mặc định TẮT (cho phép dán như cũ).
  const [blockPasteEnabled, setBlockPasteEnabled] = useState(false);
  const [savingBlockPaste, setSavingBlockPaste] = useState(false);
  const esRef = useRef<EventSource | null>(null);

  // Immersive: ẩn left sidebar của instructor layout khi board mở,
  // toggle qua body class (CSS rule trong globals.css).
  const [menuHidden, setMenuHidden] = useState(true);

  // Modal post-note state (instructor cũng có thể post để demo / seed)
  const [modalOpen, setModalOpen] = useState(false);
  const [instructorName, setInstructorName] = useState("Giảng viên");
  const [noteContent, setNoteContent] = useState("");
  const [noteColor, setNoteColor] = useState<string | null>(null);
  const [noteAttachmentUrl, setNoteAttachmentUrl] = useState("");
  const [noteGroupColumn, setNoteGroupColumn] = useState("");
  const [posting, setPosting] = useState(false);
  const [postInfo, setPostInfo] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);

  // Modal sửa note — GV sửa được bất kỳ note nào (không chỉ note của mình).
  const [editingNote, setEditingNote] = useState<BoardNote | null>(null);
  const [editContent, setEditContent] = useState("");
  const [editAttachmentUrl, setEditAttachmentUrl] = useState("");
  const [editColor, setEditColor] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editInfo, setEditInfo] = useState<string | null>(null);
  // Dùng chung cho cả 2 modal (post/edit) — chỉ 1 modal mở tại 1 thời điểm.
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  // Panel quản lý cột (grid theo nhóm) trên board đang mở — GV bật/sửa/xoá cột giữa buổi.
  const [columnsPanelOpen, setColumnsPanelOpen] = useState(false);
  const [columnsDraft, setColumnsDraft] = useState<string[]>([]);
  const [savingColumns, setSavingColumns] = useState(false);

  // Toggle body class để CSS ẩn left sidebar (xem globals.css)
  useEffect(() => {
    if (!current) return;
    if (menuHidden) document.body.classList.add("board-immersive");
    else document.body.classList.remove("board-immersive");
    return () => {
      document.body.classList.remove("board-immersive");
    };
  }, [current, menuHidden]);

  // Fetch instructor's display name 1 lần
  useEffect(() => {
    fetch(apiUrl("/api/me"))
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.name) setInstructorName(d.name);
        else if (d?.email) setInstructorName(d.email.split("@")[0]);
      })
      .catch(() => {});
  }, []);

  // Helper apply 1 event vào current state
  const applyEvent = (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const ev = data as { type?: string; note?: BoardNote; noteId?: string; hidden?: boolean };
    setCurrent((b) => {
      if (!b) return b;
      if (ev.type === "note.created" && ev.note) {
        if (b.notes.some((n) => n.id === ev.note!.id)) return b;
        return { ...b, notes: [...b.notes, { ...ev.note, hidden: false }] };
      }
      if (ev.type === "note.moderated" && ev.noteId) {
        return {
          ...b,
          notes: b.notes.map((n) =>
            n.id === ev.noteId ? { ...n, hidden: ev.hidden ?? n.hidden } : n,
          ),
        };
      }
      if (ev.type === "note.updated" && ev.note) {
        return {
          ...b,
          notes: b.notes.map((n) => (n.id === ev.note!.id ? { ...n, ...ev.note } : n)),
        };
      }
      if (ev.type === "note.deleted" && ev.noteId) {
        return { ...b, notes: b.notes.filter((n) => n.id !== ev.noteId) };
      }
      if (ev.type === "board.reset") {
        return { ...b, notes: [] };
      }
      return b;
    });
  };

  // SSE live update
  useEffect(() => {
    if (!current) return;
    const code = current.code;
    const es = new EventSource(apiUrl(`/api/public/boards/${code}/stream`));
    esRef.current = es;
    es.onmessage = (e) => {
      try {
        applyEvent(JSON.parse(e.data));
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => {
      /* EventSource auto-reconnect */
    };
    return () => {
      es.close();
      esRef.current = null;
    };
  }, [current?.id]);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Vui lòng nhập tiêu đề");
      return;
    }
    const columns = gridEnabled
      ? [...new Set(columnsInput.map((c) => c.trim()).filter(Boolean))]
      : [];
    if (gridEnabled && columns.length === 0) {
      toast.error("Nhập ít nhất 1 nhóm hoặc tắt grid theo nhóm");
      return;
    }
    setIsCreating(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/boards"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          prompt: prompt.trim() || undefined,
          columns,
          blockPaste: drawing ? false : blockPasteEnabled,
          drawingMode: drawing,
        }),
      });
      if (!res.ok) {
        toast.error((await res.json()).error || "Lỗi tạo board");
        return;
      }
      const created = await res.json();
      // Fetch full detail (gồm notes rỗng)
      const detail = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${created.id}`));
      if (!detail.ok) {
        toast.error("Lỗi tải board");
        return;
      }
      setCurrent(await detail.json());
      setTitle("");
      setPrompt("");
      setGridEnabled(false);
      setColumnsInput(["Nhóm 1", "Nhóm 2"]);
      setBlockPasteEnabled(false);
      toast.success("Board tạo thành công");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsCreating(false);
    }
  };

  // Đóng modal khi Escape
  useEffect(() => {
    if (!modalOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [modalOpen]);

  useEffect(() => {
    if (!editingNote) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setEditingNote(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingNote]);

  // Giữ noteGroupColumn hợp lệ theo danh sách cột hiện tại (mặc định cột đầu tiên).
  useEffect(() => {
    const cols = current?.columns ?? [];
    if (cols.length === 0) {
      if (noteGroupColumn !== "") setNoteGroupColumn("");
    } else if (!cols.includes(noteGroupColumn)) {
      setNoteGroupColumn(cols[0]!);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.columns]);

  const handlePostNote = async () => {
    if (!current) return;
    if (!instructorName.trim()) {
      setPostInfo("Vui lòng nhập tên hiển thị");
      return;
    }
    if (!noteContent.trim() && !noteAttachmentUrl.trim()) {
      setPostInfo("Nhập nội dung hoặc đính kèm link");
      return;
    }
    if (noteAttachmentUrl.trim() && !isValidAttachmentUrl(noteAttachmentUrl.trim())) {
      setPostInfo("URL không hợp lệ (chỉ http/https)");
      return;
    }
    if (current.columns.length > 0 && !noteGroupColumn) {
      setPostInfo("Vui lòng chọn nhóm");
      return;
    }
    setPosting(true);
    setPostInfo(null);
    try {
      const res = await fetch(apiUrl(`/api/public/boards/${current.code}/notes`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          authorName: instructorName.trim(),
          content: noteContent.trim() || "",
          ...(noteColor ? { color: noteColor } : {}),
          ...(noteAttachmentUrl.trim() ? { attachmentUrl: noteAttachmentUrl.trim() } : {}),
          ...(current.columns.length > 0 ? { column: noteGroupColumn } : {}),
        }),
      });
      if (res.status === 429) {
        setPostInfo("Gửi quá nhanh — chờ vài giây.");
        return;
      }
      if (!res.ok) {
        setPostInfo("Lỗi gửi note");
        return;
      }
      setNoteContent("");
      setNoteAttachmentUrl("");
      setNoteColor(null);
      setModalOpen(false);
      // SSE sẽ broadcast → applyEvent thêm vào state
    } catch {
      setPostInfo("Lỗi mạng");
    } finally {
      setPosting(false);
    }
  };

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch(apiUrl("/api/instructor/teaching-tools/boards"));
      if (res.ok) {
        const all = (await res.json()) as BoardHistoryItem[];
        setHistory(all.filter((b) => !!b.drawingMode === drawing));
      }
    } catch {
      toast.error("Lỗi tải lịch sử");
    } finally {
      setIsLoadingHistory(false);
    }
  };

  const handleLoadBoard = async (item: BoardHistoryItem) => {
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${item.id}`));
      if (res.ok) setCurrent(await res.json());
    } catch {
      toast.error("Lỗi tải board");
    }
  };

  const handleToggleHidden = async (note: BoardNote) => {
    if (!current) return;
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/notes/${note.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ hidden: !note.hidden }),
        },
      );
      if (!res.ok) toast.error("Lỗi ẩn note");
      // SSE sẽ broadcast event note.moderated → applyEvent cập nhật state
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const handleDeleteNote = async (note: BoardNote) => {
    if (!current) return;
    if (!confirm(`Xóa note "${note.content.slice(0, 30)}..."?`)) return;
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/notes/${note.id}`),
        { method: "DELETE" },
      );
      if (!res.ok) toast.error("Lỗi xóa note");
    } catch {
      toast.error("Lỗi mạng");
    }
  };

  const openEditNote = (note: BoardNote) => {
    setEditingNote(note);
    setEditContent(note.content);
    setEditAttachmentUrl(note.attachmentUrl || "");
    setEditColor(note.color);
    setEditInfo(null);
  };

  const handleSaveEditNote = async () => {
    if (!current || !editingNote) return;
    if (!editContent.trim() && !editAttachmentUrl.trim()) {
      setEditInfo("Nhập nội dung hoặc đính kèm link");
      return;
    }
    if (editAttachmentUrl.trim() && !isValidAttachmentUrl(editAttachmentUrl.trim())) {
      setEditInfo("URL không hợp lệ (chỉ http/https)");
      return;
    }
    setEditSubmitting(true);
    setEditInfo(null);
    try {
      const res = await fetch(
        apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/notes/${editingNote.id}`),
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: editContent.trim(),
            attachmentUrl: editAttachmentUrl.trim(),
            ...(editColor ? { color: editColor } : {}),
          }),
        },
      );
      if (!res.ok) {
        setEditInfo("Lỗi lưu note");
        return;
      }
      setEditingNote(null);
      // SSE sẽ broadcast event note.updated → applyEvent cập nhật state
    } catch {
      setEditInfo("Lỗi mạng");
    } finally {
      setEditSubmitting(false);
    }
  };

  // Upload file trực tiếp làm đính kèm (chỉ GV — học viên vẫn chỉ dán URL).
  // Trả về URL TUYỆT ĐỐI (qua shareUrl) để khớp isValidAttachmentUrl (http/https)
  // dùng chung ở cả note create/edit — dán URL ngoài hay upload nội bộ đều
  // đi qua cùng 1 validation.
  const uploadAttachmentFile = async (file: File): Promise<string> => {
    if (!current) throw new Error("Chưa mở board");
    if (file.size > BOARD_ATTACHMENT_MAX_BYTES) {
      throw new Error(`File quá lớn — tối đa ${Math.round(BOARD_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB`);
    }
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(
      apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/attachments`),
      { method: "POST", body: form },
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      if (err.error === "file_too_large") {
        throw new Error(`File quá lớn — tối đa ${Math.round(BOARD_ATTACHMENT_MAX_BYTES / (1024 * 1024))}MB`);
      }
      if (err.error === "unsupported_media_type") {
        throw new Error("Định dạng không hỗ trợ (chỉ ảnh hoặc PDF)");
      }
      throw new Error("Lỗi tải file lên");
    }
    const data = (await res.json()) as { url: string };
    return shareUrl(data.url);
  };

  const handlePostAttachmentUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAttachment(true);
    setPostInfo(null);
    try {
      setNoteAttachmentUrl(await uploadAttachmentFile(file));
    } catch (err) {
      setPostInfo(err instanceof Error ? err.message : "Lỗi tải file lên");
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleEditAttachmentUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAttachment(true);
    setEditInfo(null);
    try {
      setEditAttachmentUrl(await uploadAttachmentFile(file));
    } catch (err) {
      setEditInfo(err instanceof Error ? err.message : "Lỗi tải file lên");
    } finally {
      setUploadingAttachment(false);
    }
  };

  // Xoá hết note hiện tại nhưng giữ nguyên board (id + code + title/prompt) —
  // dùng lại được cho lớp nhỏ tiếp theo mà không cần tạo board mới.
  const handleReset = async () => {
    if (!current) return;
    if (!confirm("Xoá toàn bộ note hiện tại để bắt đầu phiên mới? Không thể hoàn tác.")) return;
    setIsResetting(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${current.id}/reset`), {
        method: "POST",
      });
      if (!res.ok) { toast.error("Không thể reset"); return; }
      setCurrent((b) => (b ? { ...b, notes: [] } : b));
      toast.success("Đã reset board");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setIsResetting(false);
    }
  };

  // Mở panel quản lý cột — nạp draft từ board hiện tại (hoặc 2 slot rỗng gợi ý nếu board
  // chưa từng bật grid).
  const openColumnsPanel = () => {
    if (!current) return;
    setColumnsDraft(current.columns.length > 0 ? [...current.columns] : ["", ""]);
    setColumnsPanelOpen(true);
  };

  const handleSaveColumns = async () => {
    if (!current) return;
    const columns = [...new Set(columnsDraft.map((c) => c.trim()).filter(Boolean))];
    setSavingColumns(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${current.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
      if (!res.ok) {
        toast.error("Lỗi lưu danh sách nhóm");
        return;
      }
      setCurrent((b) => (b ? { ...b, columns } : b));
      setColumnsPanelOpen(false);
      toast.success(columns.length > 0 ? "Đã lưu danh sách nhóm" : "Đã tắt grid theo nhóm");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setSavingColumns(false);
    }
  };

  // Bật/tắt chặn dán ngay trên board đang mở — chỉ 1 boolean nên không cần modal riêng.
  const handleToggleBlockPaste = async () => {
    if (!current) return;
    const next = !current.blockPaste;
    setSavingBlockPaste(true);
    try {
      const res = await fetch(apiUrl(`/api/instructor/teaching-tools/boards/${current.id}`), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ blockPaste: next }),
      });
      if (!res.ok) {
        toast.error("Lỗi lưu cài đặt");
        return;
      }
      setCurrent((b) => (b ? { ...b, blockPaste: next } : b));
      toast.success(next ? "Đã chặn dán khi học viên viết note" : "Đã cho phép dán trở lại");
    } catch {
      toast.error("Lỗi mạng");
    } finally {
      setSavingBlockPaste(false);
    }
  };

  // Xem shareUrl trong lib/apiUrl.ts — production chạy dưới một tiền tố.
  const joinUrl = current ? shareUrl(`/join/${current.code}`) : null;

  // showColumnTag: hiện pill nhỏ ghi tên nhóm trên note — dùng khi board KHÔNG còn ở chế
  // độ grid (cột đã tắt/xoá) nhưng note cũ vẫn giữ nhãn cột gốc, để không mất thông tin.
  const NoteCard = ({ n, showColumnTag }: { n: BoardNote; showColumnTag?: boolean }) => {
    const rot = rotationForNote(n.id);
    return (
      <div
        className={`group relative rounded-xl p-4 shadow-md hover:shadow-xl transition-all duration-200 hover:scale-[1.03] hover:z-10 hover:!rotate-0 animate-note-pop-in mb-4 break-inside-avoid overflow-hidden ${n.hidden ? "opacity-40" : ""}`}
        style={{
          backgroundColor: n.color || "#FEF3C7",
          transform: `rotate(${rot})`,
          ["--note-rot" as string]: rot,
        }}
      >
        {showColumnTag && n.column && (
          <span className="inline-block text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-black/10 text-gray-800 mb-1.5">
            {n.column}
          </span>
        )}
        {n.attachmentUrl && <NoteAttachment url={n.attachmentUrl} />}
        <p className="text-sm font-medium text-gray-900 whitespace-pre-wrap break-words leading-relaxed">
          {n.content}
        </p>
        <p className="text-xs text-gray-700 mt-3 font-semibold tracking-wide">— {n.authorName}</p>
        <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 backdrop-blur rounded-md shadow-sm">
          <button
            onClick={() => openEditNote(n)}
            className="p-1.5 hover:bg-white rounded-md"
            title="Sửa"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={() => handleToggleHidden(n)}
            className="p-1.5 hover:bg-white rounded-md"
            title={n.hidden ? "Hiện" : "Ẩn"}
          >
            {n.hidden ? <Eye size={14} /> : <EyeOff size={14} />}
          </button>
          <button
            onClick={() => handleDeleteNote(n)}
            className="p-1.5 hover:bg-white rounded-md text-red-600"
            title="Xóa"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    );
  };

  const NotesGrid = ({ notes, columns }: { notes: BoardNote[]; columns: string[] }) => {
    const visible = notes; // host thấy hết, kể cả hidden

    // Grid theo nhóm — hiện đủ cột GV đã đặt NGAY khi khởi tạo (kể cả 0 note),
    // không đợi có note đầu tiên mới lộ ra. Mỗi cột 1 dải dọc, cuộn ngang nếu nhiều nhóm.
    if (columns.length > 0) {
      const groups = groupNotesByColumn(visible, columns);
      return (
        <div className="flex gap-4 overflow-x-auto px-2 pb-4 items-start">
          {groups.map((g) => {
            const color = columnHeaderColor(columns.indexOf(g.label));
            return (
              <div
                key={g.label}
                className="w-72 shrink-0 flex flex-col rounded-2xl overflow-hidden ring-1 ring-black/5 shadow-sm bg-white/60 dark:bg-white/[0.03]"
              >
                <div
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                  style={{ backgroundColor: color }}
                >
                  <p className="text-sm font-bold text-gray-900 truncate">{g.label}</p>
                  <span className="text-[11px] font-bold text-gray-800 bg-white/70 rounded-full px-2 py-0.5 shrink-0">
                    {g.notes.length}
                  </span>
                </div>
                <div className="flex-1 flex flex-col gap-0 p-3 min-h-[96px]">
                  {g.notes.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center rounded-xl border-2 border-dashed border-black/10 dark:border-white/10 text-xs text-muted italic py-6">
                      Chưa có note
                    </div>
                  ) : (
                    g.notes.map((n) => <NoteCard key={n.id} n={n} />)
                  )}
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    if (visible.length === 0) {
      return (
        <div className="text-center py-16">
          <StickyNote size={56} className="mx-auto text-brand-300 mb-3" strokeWidth={1.5} />
          <p className="text-muted text-sm">
            Chưa có note nào. Sinh viên truy cập <code className="font-mono px-1.5 py-0.5 bg-accent-100 rounded">/join/{current?.code}</code> để post.
          </p>
        </div>
      );
    }

    return (
      <div className="columns-1 sm:columns-2 md:columns-3 lg:columns-4 gap-4 px-2 pb-4 [column-fill:_balance]">
        {visible.map((n) => (
          <NoteCard key={n.id} n={n} showColumnTag />
        ))}
      </div>
    );
  };

  // ── Active board view — same layout as student /join page + moderation ──
  if (current) {
    const visibleCount = current.notes.filter((n) => !n.hidden).length;
    const wrapper = isFullscreen
      ? "fixed inset-0 z-50 isolate overflow-y-auto bg-brand-gradient-soft dark:bg-none dark:bg-zinc-900"
      : "relative isolate rounded-2xl overflow-hidden border border-brand-200/60 bg-brand-gradient-soft dark:bg-none dark:bg-zinc-900 shadow-card pb-24";
    const previewKind = noteAttachmentUrl.trim() && isValidAttachmentUrl(noteAttachmentUrl.trim())
      ? detectMediaKind(noteAttachmentUrl.trim())
      : null;
    return (
      <div className={wrapper} data-board="container">
        {/* Trái cây trang trí như trang chủ Limio — nằm sau nội dung, không bắt chuột */}
        <LimeSliceIcon
          className="pointer-events-none absolute -left-4 top-32 -z-10 hidden h-28 w-28 -rotate-12 opacity-50 drop-shadow-xl md:block lg:left-6 lg:h-36 lg:w-36"
          aria-hidden
        />
        <WatermelonSliceIcon
          className="pointer-events-none absolute -right-4 bottom-32 -z-10 hidden h-32 w-32 rotate-12 opacity-50 drop-shadow-xl md:block lg:right-6 lg:h-40 lg:w-40"
          aria-hidden
        />
        {/* Compact gradient banner — giống student /join page */}
        <header className="relative bg-gradient-to-br from-brand-600 via-brand-600 to-brand-700 text-white px-4 py-5">
          <div className="absolute inset-0 opacity-30 mix-blend-overlay"
            style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "20px 20px" }} />
          <div className="relative max-w-6xl mx-auto flex items-center justify-between gap-4 flex-wrap">
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-[0.3em] font-semibold opacity-90 mb-0.5">
                {current.drawingMode ? "Draw-it · GIẢNG VIÊN" : "Bảng tương tác · GIẢNG VIÊN"}
              </p>
              <h1 className="text-xl sm:text-2xl font-extrabold drop-shadow-sm break-words leading-tight">
                {current.title}
                {current.status === "closed" && (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded-full bg-white/30 backdrop-blur font-semibold align-middle">Đã đóng</span>
                )}
              </h1>
              {current.prompt && (
                <p className="mt-1 text-sm italic opacity-95 max-w-2xl">{current.prompt}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setMenuHidden((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur p-2 text-xs font-semibold transition-colors hidden lg:flex"
                title={menuHidden ? "Hiện menu trái" : "Ẩn menu trái (tối ưu không gian)"}
              >
                {menuHidden ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
              </button>
              <button
                onClick={() => setQrPanelOpen((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title={qrPanelOpen ? "Ẩn khung QR" : "Hiện khung QR"}
              >
                <QrCode size={14} />
                {current.code}
              </button>
              <button
                onClick={openColumnsPanel}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Bật/sửa grid theo nhóm"
              >
                <LayoutGrid size={14} />
                {current.columns.length > 0 ? `${current.columns.length} nhóm` : "Nhóm"}
              </button>
              {!current.drawingMode && (
              <button
                onClick={handleToggleBlockPaste}
                disabled={savingBlockPaste}
                className={`rounded-lg backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5 disabled:opacity-50 ${current.blockPaste ? "bg-red-500/40 hover:bg-red-500/50" : "bg-white/20 hover:bg-white/30"}`}
                title={current.blockPaste ? "Đang chặn dán khi HV viết note — bấm để cho phép lại" : "Cho phép dán khi HV viết note — bấm để chặn"}
              >
                {current.blockPaste ? <ClipboardX size={14} /> : <Clipboard size={14} />}
                {current.blockPaste ? "Đã chặn dán" : "Cho dán"}
              </button>
              )}
              <button
                onClick={() => setIsFullscreen((v) => !v)}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors"
              >
                {isFullscreen ? "⛶ Thoát" : "⛶ Full"}
              </button>
              <button
                onClick={handleReset}
                disabled={isResetting}
                className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors flex items-center gap-1.5"
                title="Xoá toàn bộ note, bắt đầu phiên mới"
              >
                <RotateCcw size={14} className={isResetting ? "animate-spin" : ""} />
                {isResetting ? "..." : "Reset"}
              </button>
              {onExit && (
                <button
                  onClick={onExit}
                  className="rounded-lg bg-white/20 hover:bg-white/30 backdrop-blur px-3 py-2 text-xs font-semibold transition-colors"
                >
                  ✕ Exit
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Note count info bar */}
        <div className="max-w-6xl mx-auto px-4 pt-3 text-xs text-muted">
          {visibleCount} note hiển thị · {current.notes.length} tổng (gồm note ẩn)
        </div>

        {/* Masonry — đúng layout student */}
        <main className="max-w-6xl mx-auto p-4">
          <NotesGrid notes={current.notes} columns={current.columns} />
        </main>

        {/* FAB add note — instructor cũng dùng được để demo */}
        {current.status === "open" && !current.drawingMode && (
          <button
            onClick={() => {
              setModalOpen(true);
              setPostInfo(null);
            }}
            className={`${isFullscreen ? "fixed" : "absolute"} bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-2xl hover:shadow-brand-300/50 flex items-center justify-center transition-all hover:scale-110 active:scale-95`}
            title="Thêm note"
            aria-label="Thêm note"
          >
            <Plus size={32} strokeWidth={3} />
          </button>
        )}

        {/* Khung QR nhỏ, đứng yên góc màn hình — luôn thấy được cùng lúc với các note đổ về,
            khác với modal full-screen cũ vốn che mất NotesGrid. Bấm vào QR để phóng to khi cần
            (vd. lớp đông, học viên ngồi xa). */}
        {qrPanelOpen && joinUrl && (
          <div
            className={`${isFullscreen ? "fixed" : "absolute"} bottom-6 left-6 z-40 flex flex-col items-center gap-1 rounded-xl bg-white p-2.5 shadow-2xl ring-2 ring-brand-200 animate-fade-in-up`}
          >
            <button
              onClick={() => setQrPanelOpen(false)}
              className="absolute -top-2 -right-2 rounded-full bg-white p-1 shadow ring-1 ring-gray-200 hover:bg-gray-100"
              aria-label="Ẩn khung QR"
              title="Ẩn khung QR"
            >
              <X size={12} />
            </button>
            <button
              onClick={() => setShowQrModal(true)}
              title="Bấm để phóng to"
              className="rounded-lg overflow-hidden hover:opacity-90 transition-opacity"
            >
              <QRCode value={joinUrl} size={110} level="H" includeMargin />
            </button>
            <p className="text-sm font-extrabold font-mono tracking-[0.15em] text-brand-700">{current.code}</p>
          </div>
        )}

        {/* QR Modal phóng to — bấm vào khung QR góc màn hình hoặc nút mã để hiện QR to hơn */}
        {showQrModal && joinUrl && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm animate-fade-in-up p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setShowQrModal(false); }}
          >
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl max-w-md text-center">
              <button
                onClick={() => setShowQrModal(false)}
                className="absolute top-3 right-3 p-2 rounded-lg hover:bg-gray-100"
                aria-label="Đóng"
              >
                <X size={20} />
              </button>
              <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">Quét để tham gia</p>
              <div className="inline-block bg-white p-4 rounded-xl ring-2 ring-brand-200">
                <QRCode value={joinUrl} size={280} level="H" includeMargin />
              </div>
              <p className="mt-4 text-4xl font-extrabold font-mono tracking-[0.3em] text-brand-700">{current.code}</p>
              <p className="mt-2 text-sm text-gray-600">
                Hoặc truy cập: <code className="font-mono px-1.5 py-0.5 bg-brand-50 rounded">/join/{current.code}</code>
              </p>
              <button
                onClick={async () => {
                  const ok = await copyText(joinUrl);
                  if (ok) toast.success("Đã copy link");
                  else toast.error("Không sao chép được — bạn chọn link rồi copy tay giúp");
                }}
                className="mt-3 text-sm text-brand-600 hover:text-brand-700 font-medium underline"
              >
                Copy link tham gia
              </button>
            </div>
          </div>
        )}

        {/* Panel quản lý cột (grid theo nhóm) — bật/sửa/xoá cột ngay giữa buổi */}
        {columnsPanelOpen && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-up"
            onClick={(e) => { if (e.target === e.currentTarget) setColumnsPanelOpen(false); }}
          >
            <div className="w-full sm:max-w-sm rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 bg-white dark:bg-zinc-900 ring-1 ring-brand-200/60 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                  <LayoutGrid size={18} /> Grid theo nhóm
                </h2>
                <button
                  onClick={() => setColumnsPanelOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10"
                  aria-label="Đóng"
                >
                  <X size={20} />
                </button>
              </div>
              <p className="text-xs text-muted mb-4">
                Bật để chia board thành các cột theo nhóm — học viên chọn đúng nhóm mình khi post.
                Để trống hết (xoá sạch) để tắt, quay lại board tự do.
              </p>
              <div className="space-y-2">
                {columnsDraft.map((label, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={label}
                      onChange={(e) => {
                        const next = [...columnsDraft];
                        next[idx] = e.target.value;
                        setColumnsDraft(next);
                      }}
                      placeholder={`Nhóm ${idx + 1}`}
                      maxLength={30}
                      className="flex-1 border border-gray-300 dark:border-gray-700 bg-transparent rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <button
                      onClick={() => setColumnsDraft(columnsDraft.filter((_, i) => i !== idx))}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500"
                      aria-label="Xoá cột"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setColumnsDraft([...columnsDraft, ""])}
                disabled={columnsDraft.length >= 12}
                className="mt-2 text-xs font-semibold text-brand-700 dark:text-brand-500 hover:text-brand-800 flex items-center gap-1 disabled:opacity-40"
              >
                <Plus size={12} /> Thêm nhóm
              </button>
              <button
                onClick={handleSaveColumns}
                disabled={savingColumns}
                className="mt-5 w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg shadow disabled:opacity-50 transition-all"
              >
                {savingColumns ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        )}

        {/* Modal sửa note — GV sửa nội dung/link/màu của bất kỳ note nào */}
        {editingNote && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-up"
            onClick={(e) => { if (e.target === e.currentTarget) setEditingNote(null); }}
          >
            <div
              className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 ring-1 ring-brand-200/60 max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: editColor || "#FEF3C7" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Pencil size={18} /> Sửa note
                </h2>
                <button
                  onClick={() => setEditingNote(null)}
                  className="p-1.5 rounded-lg hover:bg-white/40"
                  aria-label="Đóng"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nội dung
                  </label>
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Viết note (có thể bỏ trống nếu chỉ đính link)"
                    maxLength={500}
                    rows={3}
                    autoFocus
                    className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Đính kèm <span className="text-gray-500 font-medium normal-case tracking-normal">(tùy chọn)</span>
                  </label>
                  <input
                    type="url"
                    value={editAttachmentUrl}
                    onChange={(e) => setEditAttachmentUrl(e.target.value)}
                    placeholder="Ảnh / video / audio / YouTube / link"
                    maxLength={2000}
                    className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                  <label className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
                    <input
                      type="file"
                      accept={BOARD_ATTACHMENT_ACCEPT}
                      className="hidden"
                      disabled={uploadingAttachment}
                      onChange={(e) => {
                        handleEditAttachmentUpload(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                    <Upload size={12} />
                    {uploadingAttachment ? "Đang tải lên..." : "hoặc tải ảnh/PDF lên (≤5MB)"}
                  </label>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mr-1">Màu:</span>
                  {BOARD_NOTE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${editColor === c ? "border-gray-900 scale-110" : "border-white"} shadow`}
                      style={{ backgroundColor: c }}
                      aria-label={`Chọn màu ${c}`}
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-gray-700">{editContent.length}/500</p>
                  <button
                    onClick={handleSaveEditNote}
                    disabled={editSubmitting}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2 rounded-lg shadow disabled:opacity-50 transition-all"
                  >
                    {editSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
                  </button>
                </div>
                {editInfo && <p className="text-sm text-gray-800 font-medium">{editInfo}</p>}
              </div>
            </div>
          </div>
        )}

        {/* Modal post note */}
        {modalOpen && current.status === "open" && (
          <div
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm animate-fade-in-up"
            onClick={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}
          >
            <div
              className="w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl shadow-2xl p-5 sm:p-6 ring-1 ring-brand-200/60 max-h-[90vh] overflow-y-auto"
              style={{ backgroundColor: noteColor || "#FEF3C7" }}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900">📌 Thêm note</h2>
                <button
                  onClick={() => setModalOpen(false)}
                  className="p-1.5 rounded-lg hover:bg-white/40"
                  aria-label="Đóng"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Tên hiển thị
                  </label>
                  <input
                    type="text"
                    value={instructorName}
                    onChange={(e) => setInstructorName(e.target.value)}
                    placeholder="Vd. Giảng viên"
                    maxLength={40}
                    className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  />
                </div>
                {current.columns.length > 0 && (
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Thuộc nhóm
                    </label>
                    <select
                      value={noteGroupColumn}
                      onChange={(e) => setNoteGroupColumn(e.target.value)}
                      className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm font-medium text-gray-900 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    >
                      {current.columns.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Nội dung
                  </label>
                  <textarea
                    value={noteContent}
                    onChange={(e) => setNoteContent(e.target.value)}
                    placeholder="Viết note (có thể bỏ trống nếu chỉ đính link)"
                    maxLength={500}
                    rows={3}
                    autoFocus
                    className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg px-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-700 uppercase tracking-wider mb-1">
                    Đính kèm <span className="text-gray-500 font-medium normal-case tracking-normal">(tùy chọn)</span>
                  </label>
                  <div className="relative">
                    <input
                      type="url"
                      value={noteAttachmentUrl}
                      onChange={(e) => setNoteAttachmentUrl(e.target.value)}
                      placeholder="Ảnh / video / audio / YouTube / link"
                      maxLength={2000}
                      className="w-full bg-white/70 backdrop-blur border border-white/80 rounded-lg pl-9 pr-3 py-2 text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500">
                      {previewKind === "image" ? <ImageIcon size={16} /> :
                       previewKind === "video" || previewKind === "youtube" || previewKind === "vimeo" ? <Video size={16} /> :
                       previewKind === "audio" ? <Music size={16} /> :
                       <LinkIcon size={16} />}
                    </span>
                  </div>
                  {previewKind && (
                    <p className="text-[11px] text-gray-700 mt-1 ml-1">
                      Sẽ hiển thị dạng: <span className="font-semibold">{previewKind === "youtube" ? "YouTube embed" : previewKind === "vimeo" ? "Vimeo embed" : previewKind === "image" ? "Ảnh" : previewKind === "video" ? "Video player" : previewKind === "audio" ? "Audio player" : "Link"}</span>
                    </p>
                  )}
                  <label className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-brand-700 hover:text-brand-800 cursor-pointer">
                    <input
                      type="file"
                      accept={BOARD_ATTACHMENT_ACCEPT}
                      className="hidden"
                      disabled={uploadingAttachment}
                      onChange={(e) => {
                        handlePostAttachmentUpload(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                    <Upload size={12} />
                    {uploadingAttachment ? "Đang tải lên..." : "hoặc tải ảnh/PDF lên (≤5MB)"}
                  </label>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wider mr-1">Màu:</span>
                  {BOARD_NOTE_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNoteColor(c)}
                      className={`w-7 h-7 rounded-full border-2 transition-transform ${noteColor === c ? "border-gray-900 scale-110" : "border-white"} shadow`}
                      style={{ backgroundColor: c }}
                      aria-label={`Chọn màu ${c}`}
                    />
                  ))}
                  {noteColor && (
                    <button type="button" onClick={() => setNoteColor(null)} className="text-xs text-gray-700 underline ml-1">
                      Random
                    </button>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 pt-1">
                  <p className="text-xs text-gray-700">{noteContent.length}/500</p>
                  <button
                    onClick={handlePostNote}
                    disabled={posting}
                    className="bg-brand-600 hover:bg-brand-700 text-white font-semibold px-5 py-2 rounded-lg shadow disabled:opacity-50 transition-all"
                  >
                    {posting ? "Đang gửi..." : "📌 Dán note"}
                  </button>
                </div>
                {postInfo && <p className="text-sm text-gray-800 font-medium">{postInfo}</p>}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ── Create form — vẫn giữ cảm giác Padlet (tờ note hơi nghiêng, băng dính, note
  // pastel) nhưng đổi sang tông lime của bộ style `tool-*` cho hài hoà với Vote /
  // Word Cloud, thay cho gradient cam-hồng trước đây.
  return (
    <div className="tool-panel rounded-none">
      <div className="tool-header">
        <div className="flex items-center gap-2">
          <span className="tool-icon">{drawing ? <Pencil size={20} strokeWidth={1.75} /> : <StickyNote size={20} strokeWidth={1.75} />}</span>
          <h3 className="tool-title">{drawing ? "Tạo phiên Draw-it" : "Tạo bảng mới"}</h3>
        </div>
        {onExit && (
          <button onClick={onExit} className="tool-action">
            ✕ Thoát
          </button>
        )}
      </div>

      {/* Tờ note: giấy lime nhạt, nghiêng nhẹ, có mảnh băng dính ở mép trên */}
      <div
        className="relative mt-2 space-y-4 bg-brand-50 p-5 shadow-md ring-1 ring-brand-200 dark:bg-brand-900/30 dark:ring-brand-800/60"
        style={{ transform: "rotate(-0.3deg)" }}
      >
        <span
          className="absolute -top-2.5 left-1/2 h-5 w-20 -translate-x-1/2 rotate-2 rounded-sm bg-brand-200/80 shadow-sm dark:bg-brand-700/50"
          aria-hidden
        />

        <div>
          <label className="tool-section-label">Tiêu đề</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Vd. Phản hồi buổi học hôm nay"
            maxLength={120}
            className="input w-full"
          />
        </div>
        <div>
          <label className="tool-section-label">
            Câu hỏi gợi ý <span className="font-normal text-faint">(tùy chọn)</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Vd. Điều bạn nhớ nhất từ buổi học?"
            maxLength={500}
            rows={3}
            className="input w-full resize-none"
          />
        </div>

        {/* Grid theo nhóm — tùy chọn, mặc định TẮT (masonry tự do như trước) */}
        <div className="rounded-xl bg-white/70 p-3.5 ring-1 ring-brand-200/70 dark:bg-white/5">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <LayoutGrid size={14} className="text-brand-700" /> Đăng theo nhóm (grid)
            </span>
            <input
              type="checkbox"
              checked={gridEnabled}
              onChange={(e) => setGridEnabled(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
          </label>
          {gridEnabled && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-muted">
                Học viên sẽ chọn đúng nhóm mình khi post — mỗi nhóm hiện thành 1 cột riêng.
              </p>
              {columnsInput.map((label, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={label}
                    onChange={(e) => {
                      const next = [...columnsInput];
                      next[idx] = e.target.value;
                      setColumnsInput(next);
                    }}
                    placeholder={`Nhóm ${idx + 1}`}
                    maxLength={30}
                    className="input flex-1"
                  />
                  <button
                    type="button"
                    onClick={() => setColumnsInput(columnsInput.filter((_, i) => i !== idx))}
                    className="rounded-lg p-1.5 text-faint transition-colors hover:bg-white/70"
                    aria-label="Xoá nhóm"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setColumnsInput([...columnsInput, `Nhóm ${columnsInput.length + 1}`])}
                disabled={columnsInput.length >= 12}
                className="flex items-center gap-1 text-xs font-semibold text-brand-700 hover:text-brand-800 disabled:opacity-40"
              >
                <Plus size={12} /> Thêm nhóm
              </button>
            </div>
          )}
        </div>

        {/* Chặn dán — tùy chọn, mặc định TẮT (cho phép dán như bình thường); Draw-it không có ô chữ nên bỏ */}
        {!drawing && (
        <div className="rounded-xl bg-white/70 p-3.5 ring-1 ring-brand-200/70 dark:bg-white/5">
          <label className="flex cursor-pointer items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <ClipboardX size={14} className="text-brand-700" /> Chặn dán (paste) khi HV viết note
            </span>
            <input
              type="checkbox"
              checked={blockPasteEnabled}
              onChange={(e) => setBlockPasteEnabled(e.target.checked)}
              className="h-4 w-4 accent-brand-600"
            />
          </label>
          {blockPasteEnabled && (
            <p className="mt-2 text-xs text-muted">
              Học viên không dán (paste) được text vào ô nội dung khi đăng/sửa note — chỉ áp dụng phía học viên, GV vẫn dán bình thường.
            </p>
          )}
        </div>

        )}

        <button onClick={handleCreate} disabled={isCreating} className="btn-primary w-full">
          {isCreating ? "Đang tạo..." : drawing ? "Tạo phiên vẽ" : "Tạo Bảng"}
        </button>
      </div>

      {/* History — mỗi bảng cũ là một tờ note pastel (tông dịu, cùng họ với lime) */}
      <div className="mt-6 border-t border-token pt-4">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-medium text-muted">Bảng đã tạo trước đây</p>
          <button onClick={loadHistory} disabled={isLoadingHistory} className="tool-action">
            <RefreshCw size={11} className={isLoadingHistory ? "animate-spin" : ""} />
            {isLoadingHistory ? "Đang tải..." : "Tải lịch sử"}
          </button>
        </div>
        {history.length === 0 && !isLoadingHistory && (
          <p className="py-2 text-center text-xs text-muted">Bấm "Tải lịch sử" để xem các bảng cũ</p>
        )}
        <div className="grid max-h-72 gap-3 overflow-y-auto p-1 sm:grid-cols-2">
          {history.map((item, idx) => {
            const noteColors = ["#F7FEE7", "#ECFCCB", "#E0F2FE", "#D1FAE5", "#FEF9C3", "#EDE9FE"];
            const bg = noteColors[idx % noteColors.length];
            const tilt = idx % 2 === 0 ? -0.5 : 0.5;
            return (
              <button
                key={item.id}
                onClick={() => handleLoadBoard(item)}
                className="rounded-xl p-3.5 text-left shadow-sm ring-1 ring-black/5 transition-all hover:scale-[1.02] hover:shadow-md"
                style={{ backgroundColor: bg, transform: `rotate(${tilt}deg)` }}
              >
                <div className="mb-1 flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{item.title}</p>
                  <span className="shrink-0 rounded-md bg-white/70 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-800">
                    {item.code}
                  </span>
                </div>
                <p className="text-xs text-gray-700">
                  {item._count.notes} note · {formatVN(item.createdAt, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                  {item.status === "closed" && " · 🔒 Đã đóng"}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
