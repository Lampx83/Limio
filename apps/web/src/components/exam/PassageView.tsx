"use client";

import { useEffect, useMemo, useState } from "react";

interface TiptapDoc {
  type: "doc";
  content: unknown[];
}

interface Props {
  passage: { id: string; title: string; contentJson: TiptapDoc };
  attemptId: string;
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
export default function PassageView({ passage, attemptId }: Props) {
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

  return (
    <div>
      <h2 className="mb-3 text-base font-semibold">{passage.title}</h2>
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

function renderDoc(doc: TiptapDoc): React.ReactNode {
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
      return (
        <img src={src} alt={alt ?? ""} className="rounded border border-default" />
      );
    }
    case "audio": {
      const src = node.attrs?.src as string | undefined;
      const alt = node.attrs?.alt as string | undefined;
      if (!src) return null;
      // Play-count enforcement is P1; for now render native controls and surface
      // alt text as a fallback caption so screen readers + users know what
      // they're hearing.
      return (
        <div className="my-3 rounded border border-default bg-slate-50 p-3">
          <audio src={src} controls preload="metadata" className="w-full">
            <track kind="captions" />
          </audio>
          {alt && (
            <p className="mt-1 text-xs text-faint" aria-label="Audio description">
              🎵 {alt}
            </p>
          )}
        </div>
      );
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
              🎬 {alt}
            </p>
          )}
        </div>
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
  if (/\.(mp4|webm|mov|m4v|ogv)(\?|#|$)/i.test(src)) {
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
      case "highlight":
        el = <mark className="bg-amber-100">{el}</mark>;
        break;
      case "underline":
        el = <u>{el}</u>;
        break;
    }
  }
  return <>{el}</>;
}
