"use client";

import dynamic from "next/dynamic";

const ScormPlayer = dynamic(() => import("./ScormPlayer"), { ssr: false });
const LtiLaunch = dynamic(() => import("./LtiLaunch"), { ssr: false });
const H5pPlayer = dynamic(() => import("./H5pPlayer"), { ssr: false });

interface ContentItem {
  id: string;
  type: string;
  payload: unknown;
  orderIndex: number;
}

interface ScormPayload {
  packageId: string;
  title?: string;
  entryHref?: string;
}

interface LtiPayloadType {
  toolId: string;
  title?: string;
  resourceLinkId?: string;
}

interface H5pPayloadType {
  packageId: string;
  title?: string;
}

interface VideoPayload {
  url: string;
  transcriptUrl?: string;
  durationSec?: number;
}
interface MarkdownPayload {
  body: string;
}
interface FilePayload {
  url: string;
  filename: string;
  sizeBytes?: number;
}
interface ExternalLinkPayload {
  url: string;
  title?: string;
}
interface EmbedPayload {
  url: string;
  height?: number;
}
interface PdfPayload {
  url: string;
  title?: string;
  totalPages?: number;
}

export default function LessonContent({
  items,
  courseId,
  lessonId,
}: {
  items: ContentItem[];
  courseId?: string;
  lessonId?: string;
}) {
  return (
    <div className="space-y-6">
      {items.map((item) => (
        <div key={item.id}>
          <ContentBlock
            type={item.type}
            payload={item.payload}
            itemId={item.id}
            courseId={courseId}
            lessonId={lessonId}
          />
        </div>
      ))}
    </div>
  );
}

function ContentBlock({
  type,
  payload,
  itemId,
  courseId,
  lessonId,
}: {
  type: string;
  payload: unknown;
  itemId: string;
  courseId?: string;
  lessonId?: string;
}) {
  switch (type) {
    case "video": {
      const p = payload as VideoPayload;
      return (
        <div>
          <video
            src={p.url}
            controls
            className="w-full rounded bg-black"
            preload="metadata"
          />
          {p.transcriptUrl && (
            <a href={p.transcriptUrl} className="mt-2 inline-block text-sm underline">
              Xem transcript
            </a>
          )}
        </div>
      );
    }
    case "markdown": {
      const p = payload as MarkdownPayload;
      // Simple text rendering — full Markdown parsing is post-Phase 0.
      return <pre className="whitespace-pre-wrap text-sm leading-relaxed">{p.body}</pre>;
    }
    case "external_link": {
      const p = payload as ExternalLinkPayload;
      return (
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block rounded border border-slate-300 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          🔗 {p.title ?? p.url}
        </a>
      );
    }
    case "file": {
      const p = payload as FilePayload;
      return (
        <a
          href={p.url}
          download
          className="inline-block rounded border border-slate-300 px-3 py-2 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
        >
          📎 {p.filename}
        </a>
      );
    }
    case "embed": {
      const p = payload as EmbedPayload;
      return (
        <iframe
          src={p.url}
          height={p.height ?? 480}
          className="w-full rounded border border-slate-300 dark:border-slate-700"
          allowFullScreen
        />
      );
    }
    case "scorm": {
      const p = payload as ScormPayload;
      return (
        <div>
          {p.title && (
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              📦 {p.title}
            </p>
          )}
          <ScormPlayer
            packageId={p.packageId}
            entryHref={p.entryHref}
            courseId={courseId}
            lessonId={lessonId}
          />
        </div>
      );
    }
    case "lti": {
      const p = payload as LtiPayloadType;
      return (
        <LtiLaunch
          toolId={p.toolId}
          resourceLinkId={p.resourceLinkId ?? itemId}
          title={p.title}
          courseId={courseId}
          lessonId={lessonId}
        />
      );
    }
    case "h5p": {
      const p = payload as H5pPayloadType;
      return (
        <H5pPlayer
          packageId={p.packageId}
          title={p.title}
          courseId={courseId}
          lessonId={lessonId}
        />
      );
    }
    case "pdf": {
      const p = payload as PdfPayload;
      // Browsers' built-in PDF viewer renders inline via <iframe>. Always
      // include a download fallback in case the browser blocks (e.g. mobile
      // Safari without a viewer extension).
      return (
        <div>
          {p.title && (
            <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
              📄 {p.title}
            </p>
          )}
          <iframe
            src={p.url}
            className="h-[80vh] w-full rounded border border-slate-300 dark:border-slate-700"
            title={p.title ?? "PDF"}
          />
          <p className="mt-2 text-xs text-slate-500">
            Không xem được?{" "}
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              Mở PDF trong tab mới
            </a>
          </p>
        </div>
      );
    }
    default:
      return <p className="text-sm text-slate-500">Unknown content type: {type}</p>;
  }
}
