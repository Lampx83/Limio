"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ExternalLink, Globe } from "lucide-react";
import { parseVideoUrl } from "@/lib/videoUrl";
import SafeHtml from "@/components/SafeHtml";

const PdfViewer = dynamic(() => import("@/components/PdfViewer"), { ssr: false });

export type ResourceType =
  | "richtext"
  | "markdown"
  | "video"
  | "pdf"
  | "file"
  | "external_link"
  | "embed"
  | "html_block";

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  richtext: "Văn bản",
  markdown: "Markdown",
  video: "Video",
  pdf: "PDF",
  file: "File đính kèm",
  external_link: "Link ngoài",
  embed: "Embed",
  html_block: "HTML tự tải lên",
};

/**
 * Render 1 tài nguyên slide "Nội dung" — cùng payload shape và cách hiển thị
 * với ContentItem của Lesson (xem LessonContent.tsx/ContentBlock), tái dùng
 * trực tiếp SafeHtml/ReactMarkdown/PdfViewer/parseVideoUrl vì các phần đó
 * không phụ thuộc Course/Lesson. Bỏ scorm/lti/h5p/teacher_note/video-cuepoint
 * — không áp dụng cho 1 slide trình chiếu tuần tự, không cần theo dõi tiến độ.
 */
export default function ResourceContent({
  type,
  payload,
}: {
  type: ResourceType;
  payload: Record<string, any>;
}) {
  switch (type) {
    case "markdown":
      return (
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              a: ({ href, children, ...rest }) => (
                <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
                  {children}
                </a>
              ),
            }}
          >
            {payload.body ?? ""}
          </ReactMarkdown>
        </div>
      );
    case "richtext":
      return <SafeHtml html={payload.html ?? ""} className="prose prose-sm max-w-none dark:prose-invert" />;
    case "video":
      return (
        <div>
          <VideoEmbed url={payload.url ?? ""} />
          {(payload.title || payload.caption) && (
            <figcaption className="mt-2 border-l-2 border-[#E3E0D3] pl-3">
              {payload.title && <div className="text-sm font-semibold leading-snug">{payload.title}</div>}
              {payload.caption && <p className="mt-0.5 text-xs leading-relaxed text-[#6B7268]">{payload.caption}</p>}
            </figcaption>
          )}
        </div>
      );
    case "pdf":
      return <PdfViewer url={payload.url ?? ""} title={payload.title} />;
    case "external_link":
      return (
        <a
          href={payload.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-xl border border-[#E3E0D3] bg-white px-4 py-2.5 text-sm font-medium transition-all hover:border-brand-300 hover:bg-brand-50"
        >
          {payload.title || payload.url}
        </a>
      );
    case "file":
      return (
        <a
          href={payload.url}
          download
          className="inline-flex items-center gap-2 rounded-xl border border-[#E3E0D3] bg-white px-4 py-2.5 text-sm font-medium transition-all hover:border-brand-300 hover:bg-brand-50"
        >
          {payload.filename || "Tải file"}
        </a>
      );
    case "embed":
      return (
        <iframe
          src={payload.url}
          height={payload.height ?? 480}
          className="w-full rounded-xl border border-[#E3E0D3] shadow-sm"
          allowFullScreen
        />
      );
    case "html_block":
      return (
        <div className="flex items-start gap-3 rounded-2xl border border-[#E3E0D3] bg-white p-4 shadow-sm">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
            <Globe className="h-5 w-5" aria-hidden />
          </span>
          <div className="min-w-0 flex-1 pt-1">
            <a
              href={payload.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group/link inline-flex items-center gap-1.5 text-base font-semibold text-[#20241F] hover:text-brand-700"
            >
              <span className="underline decoration-transparent decoration-2 underline-offset-4 transition-colors group-hover/link:decoration-brand-400">
                {payload.title || "Mở tài nguyên HTML"}
              </span>
              <ExternalLink className="h-4 w-4 shrink-0 text-[#9AA090] transition-colors group-hover/link:text-brand-600" aria-hidden />
            </a>
            {payload.body && (
              <SafeHtml
                html={payload.body}
                className="prose prose-sm mt-0.5 max-w-none leading-snug text-[#6B7268] dark:prose-invert"
              />
            )}
          </div>
        </div>
      );
    default:
      return <p className="text-sm text-[#9AA090]">Loại tài nguyên không xác định: {type}</p>;
  }
}

// Cùng logic với VideoEmbed trong LessonContent.tsx (không cuepoint — slide
// trình chiếu tuần tự, không cần theo dõi tiến độ học viên).
function VideoEmbed({ url }: { url: string }) {
  const v = parseVideoUrl(url);
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
        className="aspect-video w-full overflow-hidden rounded-xl border border-[#E3E0D3] bg-black shadow-sm"
      />
    );
  }
  return (
    <video src={url} controls className="aspect-video w-full rounded-xl bg-black shadow-sm" preload="metadata" />
  );
}
