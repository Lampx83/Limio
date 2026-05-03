"use client";

import dynamic from "next/dynamic";
import { parseVideoUrl } from "@/lib/videoUrl";

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
          <VideoEmbed url={p.url} />
          {p.transcriptUrl && (
            <a href={p.transcriptUrl} className="link mt-2 inline-block text-sm">
              Xem transcript
            </a>
          )}
        </div>
      );
    }
    case "markdown": {
      const p = payload as MarkdownPayload;
      return (
        <pre className="whitespace-pre-wrap rounded-xl border border-token bg-[rgb(var(--surface))] p-4 text-sm leading-relaxed font-sans">
          {p.body}
        </pre>
      );
    }
    case "external_link": {
      const p = payload as ExternalLinkPayload;
      return (
        <a
          href={p.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-2.5 text-sm font-medium transition-all hover:border-brand-200 hover:bg-brand-soft hover:text-brand-700"
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
          className="inline-flex items-center gap-2 rounded-xl border border-token bg-[rgb(var(--surface))] px-4 py-2.5 text-sm font-medium transition-all hover:border-brand-200 hover:bg-brand-soft hover:text-brand-700"
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
          className="w-full rounded-xl border border-token shadow-card"
          allowFullScreen
        />
      );
    }
    case "scorm": {
      const p = payload as ScormPayload;
      return (
        <div>
          {p.title && (
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-muted">
              <span>📦</span>
              {p.title}
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
      return (
        <div>
          {p.title && (
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-muted">
              <span>📄</span>
              {p.title}
            </p>
          )}
          <iframe
            src={p.url}
            className="h-[80vh] w-full rounded-xl border border-token shadow-card"
            title={p.title ?? "PDF"}
          />
          <p className="mt-2 text-xs text-faint">
            Không xem được?{" "}
            <a
              href={p.url}
              target="_blank"
              rel="noopener noreferrer"
              className="link"
            >
              Mở PDF trong tab mới
            </a>
          </p>
        </div>
      );
    }
    default:
      return (
        <p className="rounded-lg border border-dashed border-token px-3 py-2 text-sm text-faint">
          Unknown content type: {type}
        </p>
      );
  }
}

function VideoEmbed({ url }: { url: string }) {
  const v = parseVideoUrl(url);

  // Recognized provider — render iframe embed.
  if (v && v.kind !== "file") {
    const allow =
      v.kind === "youtube"
        ? "accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
        : v.kind === "vimeo"
          ? "autoplay; fullscreen; picture-in-picture"
          : "fullscreen";
    return (
      <iframe
        src={v.embedUrl}
        title={`${v.providerName} video`}
        loading="lazy"
        allow={allow}
        allowFullScreen
        className="aspect-video w-full overflow-hidden rounded-xl border border-token bg-black shadow-card"
      />
    );
  }

  // Recognized direct file or fallback for unknown URL — try native <video>.
  return (
    <video
      src={url}
      controls
      className="aspect-video w-full rounded-xl bg-black shadow-card"
      preload="metadata"
    />
  );
}
