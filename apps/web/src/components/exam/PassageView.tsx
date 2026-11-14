"use client";

import { useEffect, useMemo, useState } from "react";
import { PASSAGE_FONT_SIZE_VALUES } from "@/lib/passageFontSizes";
import { passageHighlightColor, passageTextColor } from "@/lib/passageColors";
import AudioTranscript, { AudioTranscriptContext } from "./AudioTranscript";
import PassageImage from "./PassageImage";
import ExamAudioPlayer, { ExamAudioContext, type ExamAudioContextValue } from "./ExamAudioPlayer";

export interface TiptapDoc {
  type: "doc";
  content: unknown[];
}

interface Props {
  passage: {
    id: string;
    title: string;
    contentJson: TiptapDoc;
    /** Transcript các audio của đoạn (tên tệp → chữ). Chỉ truyền ở chế độ cho phép xem; lượt thi thử đang làm thì không bao giờ có. */
    transcripts?: Record<string, string>;
  };
  attemptId: string;
  /** G5b — đề thi thử: giới hạn lượt nghe. Không truyền = trình phát gốc như cũ. */
  audio?: Omit<ExamAudioContextValue, "attemptId" | "passageId">;
}

/**
 * Renders a Tiptap doc-shaped passage. We avoid bringing in the full Tiptap
 * renderer client bundle and do a lightweight walk over the common node types
 * we use (paragraph, heading, image, hardBreak, marks for bold/italic/highlight).
 *
 * A7.4.6 — highlight tool persists user selections to localStorage under
 * `exam:{attemptId}:passage:{id}`. Notes (if needed later) can share the key.
 * No sync to server — explicit warning banner shown.
 */
export default function PassageView({ passage, attemptId, audio }: Props) {
  const lsKey = `exam:${attemptId}:passage:${passage.id}`;
  const [note, setNote] = useState("");

  // Restore note from localStorage on mount.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(lsKey);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as { note?: string };
        setNote(parsed.note ?? "");
      } catch {
        // ignore corrupt LS entry
      }
    }
  }, [lsKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(lsKey, JSON.stringify({ note }));
  }, [lsKey, note]);

  const rendered = useMemo(() => renderDoc(passage.contentJson), [passage.contentJson]);

  const audioCtx = useMemo<ExamAudioContextValue | null>(
    () => (audio ? { ...audio, attemptId, passageId: passage.id } : null),
    [audio, attemptId, passage.id],
  );

  return (
    <ExamAudioContext.Provider value={audioCtx}>
    <AudioTranscriptContext.Provider value={passage.transcripts ?? null}>
    <div>
      {/* Tiêu đề bài đọc: cỡ lớn, đậm, kèm vạch nhấn màu thương hiệu ngắn bên dưới (kiểu tiêu đề báo/sách), tách khỏi phần thân. */}
      {/* Tiêu đề rỗng (phiếu bài tập đã có tên bài ở trên) thì bỏ cả phần tiêu đề: không để lại vạch nhấn mồ côi. */}
      {passage.title.trim() && (
        <header className="mb-4">
          <h2 className="text-h3">{passage.title}</h2>
          <div className="mt-2 h-1 w-12 rounded-full bg-brand-gradient" aria-hidden />
        </header>
      )}
      <div className="prose prose-sm max-w-none select-text">{rendered}</div>
      <details className="mt-4 border-t border-default pt-3">
        <summary className="cursor-pointer text-xs text-faint">
          Ghi chú cá nhân (chỉ lưu trên thiết bị này)
        </summary>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={4}
          placeholder="Ghi chú tạm khi đọc bài… (không tính điểm)"
          className="mt-2 w-full rounded border border-default p-2 text-sm"
        />
      </details>
    </div>
    </AudioTranscriptContext.Provider>
    </ExamAudioContext.Provider>
  );
}

interface MarkSpec {
  type: string;
  attrs?: Record<string, unknown>;
}
interface TextNode {
  type: "text";
  text: string;
  marks?: MarkSpec[];
}
interface ElementNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: unknown[];
  text?: string;
  marks?: MarkSpec[];
}

export function renderDoc(doc: TiptapDoc): React.ReactNode {
  return (doc.content ?? []).map((c, i) => (
    <RenderNode key={i} node={c as ElementNode} />
  ));
}

function RenderNode({ node }: { node: ElementNode }) {
  switch (node.type) {
    case "paragraph":
      return (
        <p>
          {(node.content ?? []).map((c, i) => (
            <RenderInline key={i} node={c as ElementNode | TextNode} />
          ))}
        </p>
      );
    case "heading": {
      const level = ((node.attrs?.level as number) ?? 2) as 1 | 2 | 3 | 4 | 5 | 6;
      const Tag = `h${level}` as keyof JSX.IntrinsicElements;
      return (
        <Tag>
          {(node.content ?? []).map((c, i) => (
            <RenderInline key={i} node={c as ElementNode | TextNode} />
          ))}
        </Tag>
      );
    }
    case "bulletList":
      return (
        <ul>
          {(node.content ?? []).map((c, i) => (
            <RenderNode key={i} node={c as ElementNode} />
          ))}
        </ul>
      );
    case "orderedList":
      return (
        <ol>
          {(node.content ?? []).map((c, i) => (
            <RenderNode key={i} node={c as ElementNode} />
          ))}
        </ol>
      );
    case "listItem":
      return (
        <li>
          {(node.content ?? []).map((c, i) => (
            <RenderNode key={i} node={c as ElementNode} />
          ))}
        </li>
      );
    case "image": {
      const src = node.attrs?.src as string | undefined;
      const alt = node.attrs?.alt as string | undefined;
      if (!src) return null;
      return <PassageImage src={src} alt={alt} />;
    }
    case "audio": {
      const src = node.attrs?.src as string | undefined;
      const alt = node.attrs?.alt as string | undefined;
      if (!src) return null;
      // G5b: trong đề thi thử có giới hạn lượt thì ExamAudioPlayer xin lượt từ máy chủ;
      // ngoài ra (đề thường, free_replay) là trình phát gốc.
      return <ExamAudioPlayer src={src} alt={alt} />;
    }
    case "video": {
      const src = node.attrs?.src as string | undefined;
      const alt = node.attrs?.alt as string | undefined;
      if (!src) return null;
      const embed = resolveVideoEmbed(src);
      return (
        <div className="my-3 rounded border border-default bg-slate-50 p-3">
          {embed.kind === "iframe" ? (
            <div className="relative aspect-video w-full overflow-hidden rounded">
              <iframe
                src={embed.url}
                title={alt ?? "Video"}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                className="absolute inset-0 h-full w-full"
              />
            </div>
          ) : embed.kind === "file" ? (
            <video src={embed.url} controls preload="metadata" className="w-full rounded">
              <track kind="captions" />
            </video>
          ) : (
            <a href={src} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 underline">
              {alt || src}
            </a>
          )}
          {alt && (
            <p className="mt-1 text-xs text-faint" aria-label="Video description">
              {alt}
            </p>
          )}
          <AudioTranscript src={src} kind="video" />
        </div>
      );
    }
    case "table":
      // Bảng rộng cuộn ngang trong khung, không làm tràn trang (đoạn văn nằm trong cột hẹp cạnh câu hỏi, và trên điện thoại).
      return (
        <div className="passage-table-wrap">
          <table className="passage-table">
            <tbody>
              {(node.content ?? []).map((c, i) => (
                <RenderNode key={i} node={c as ElementNode} />
              ))}
            </tbody>
          </table>
        </div>
      );
    case "tableRow":
      return (
        <tr>
          {(node.content ?? []).map((c, i) => (
            <RenderNode key={i} node={c as ElementNode} />
          ))}
        </tr>
      );
    case "tableHeader":
    case "tableCell": {
      const Tag = node.type === "tableHeader" ? "th" : "td";
      return (
        <Tag>
          {(node.content ?? []).map((c, i) => (
            <RenderNode key={i} node={c as ElementNode} />
          ))}
        </Tag>
      );
    }
    case "hardBreak":
      return <br />;
    case "text":
      return <RenderInline node={node as unknown as TextNode} />;
    default:
      return null;
  }
}

type VideoEmbed =
  | { kind: "iframe"; url: string }
  | { kind: "file"; url: string }
  | { kind: "link"; url: string };

function resolveVideoEmbed(src: string): VideoEmbed {
  // YouTube
  const yt = src.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/)([A-Za-z0-9_-]{11})/,
  )?.[1];
  if (yt) return { kind: "iframe", url: `https://www.youtube.com/embed/${yt}` };

  // Vimeo
  const vimeo = src.match(/vimeo\.com\/(\d+)/)?.[1];
  if (vimeo) return { kind: "iframe", url: `https://player.vimeo.com/video/${vimeo}` };

  // Google Drive — chấp nhận:
  //   drive.google.com/file/d/{ID}/view|preview|edit
  //   drive.google.com/open?id={ID}
  //   docs.google.com/uc?id={ID}
  const gdriveId =
    src.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/)?.[1] ||
    src.match(/[?&]id=([A-Za-z0-9_-]+)/)?.[1];
  if (gdriveId && /drive\.google\.com|docs\.google\.com/.test(src)) {
    return { kind: "iframe", url: `https://drive.google.com/file/d/${gdriveId}/preview` };
  }

  // OneDrive / SharePoint embed — nếu user đã dán URL dạng /embed thì dùng thẳng.
  // Với share link thường (1drv.ms hoặc onedrive.live.com/?...) ta thử ép sang /embed
  // bằng cách thay path; với SharePoint thì cần URL embed sẵn (Share → Embed).
  if (/onedrive\.live\.com\/embed/i.test(src) || /sharepoint\.com\/.+embed/i.test(src)) {
    return { kind: "iframe", url: src };
  }
  if (/onedrive\.live\.com\//i.test(src)) {
    try {
      const u = new URL(src);
      u.pathname = "/embed";
      return { kind: "iframe", url: u.toString() };
    } catch {
      /* fallthrough */
    }
  }

  // Direct file
  if (/\.(mp4|webm|mov|m4v|ogv|mkv)(\?|#|$)/i.test(src)) {
    return { kind: "file", url: src };
  }

  return { kind: "link", url: src };
}

function RenderInline({ node }: { node: ElementNode | TextNode }) {
  if (!("text" in node) || typeof node.text !== "string") {
    if ("type" in node) return <RenderNode node={node as ElementNode} />;
    return null;
  }
  let el: React.ReactNode = node.text;
  for (const mark of node.marks ?? []) {
    switch (mark.type) {
      case "bold":
        el = <strong>{el}</strong>;
        break;
      case "italic":
        el = <em>{el}</em>;
        break;
      case "highlight": {
        // Màu tô nổi: chỉ vẽ màu trong bảng; không có hoặc lạ thì giữ màu mặc định.
        const bg = passageHighlightColor((mark.attrs as { color?: unknown } | undefined)?.color);
        el = bg ? <mark style={{ backgroundColor: bg, color: "inherit" }}>{el}</mark> : <mark className="bg-amber-100">{el}</mark>;
        break;
      }
      case "underline":
        el = <u>{el}</u>;
        break;
      case "strike":
        el = <s>{el}</s>;
        break;
      case "textStyle": {
        // Cỡ chữ của đoạn chữ được chọn: chỉ vẽ bốn mức cố định (lib/passageDoc.ts), giá trị khác bỏ qua.
        const attrs = mark.attrs as { fontSize?: unknown; color?: unknown } | undefined;
        const size = typeof attrs?.fontSize === "string" && PASSAGE_FONT_SIZE_VALUES.has(attrs.fontSize) ? attrs.fontSize : undefined;
        const color = passageTextColor(attrs?.color) ?? undefined;
        if (size || color) el = <span style={{ fontSize: size, color }}>{el}</span>;
        break;
      }
    }
  }
  return <>{el}</>;
}
