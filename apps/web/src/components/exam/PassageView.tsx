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
    case "hardBreak":
      return <br />;
    case "text":
      return <RenderInline node={node as unknown as TextNode} />;
    default:
      return null;
  }
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
