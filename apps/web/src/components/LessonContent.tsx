"use client";

import dynamic from "next/dynamic";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { parseVideoUrl, isNativeVideoUrl } from "@/lib/videoUrl";
import SafeHtml from "./SafeHtml";

const ScormPlayer = dynamic(() => import("./ScormPlayer"), { ssr: false });
const LtiLaunch = dynamic(() => import("./LtiLaunch"), { ssr: false });
const H5pPlayer = dynamic(() => import("./H5pPlayer"), { ssr: false });
const VideoWithCuepoints = dynamic(() => import("./VideoWithCuepoints"), {
  ssr: false,
});
const PdfViewer = dynamic(() => import("./PdfViewer"), { ssr: false });

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
  title?: string;
  caption?: string;
  transcriptUrl?: string;
  durationSec?: number;
  cuepoints?: Array<{ atSec: number; quizId: string }>;
}
interface MarkdownPayload {
  body: string;
}
interface RichTextPayload {
  html: string;
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
  interactive = true,
}: {
  items: ContentItem[];
  courseId?: string;
  lessonId?: string;
  /**
   * False for logged-out visitors on a public course. Content types whose player
   * needs an authenticated session (SCORM, H5P, LTI) render a sign-in prompt
   * instead of failing with a 401, and cuepoint gating is dropped — there is no
   * learner to gate. Everything readable still renders.
   */
  interactive?: boolean;
}) {
  return (
    <div className="space-y-6">
      {items.map((item) => (
        // data-item-id: mốc neo ổn định giữa cửa sổ điều khiển và màn chiếu.
        // Không đánh theo thứ tự được — cửa sổ điều khiển có thêm các khối ghi
        // chú giảng viên xen giữa, nên khối thứ 3 ở hai bên là hai thứ khác nhau.
        <div key={item.id} data-item-id={item.id}>
          <ContentBlock
            type={item.type}
            payload={item.payload}
            itemId={item.id}
            courseId={courseId}
            lessonId={lessonId}
            interactive={interactive}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Ghi chú giảng viên, gấp lại được.
 *
 * Mở sẵn vì đang dạy tới mục nào thì cần đọc ghi chú của mục đó ngay — bắt bấm
 * thêm một cái trước khi đọc là thừa. Nhưng ghi chú dài (chạy giờ cả buổi) đẩy
 * nội dung bài xuống rất xa, nên phải gấp lại được khi đã thuộc.
 *
 * Tiêu đề trên nút gấp lấy từ dòng đầu của chính ghi chú, để lúc thu gọn vẫn
 * biết đó là ghi chú của phần nào.
 */
function TeacherNote({ html }: { html: string }) {
  const label = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 64);
  return (
    <details
      open
      data-teacher-note
      className="rounded-xl border-l-4 border-accent-400 bg-accent-50 dark:bg-[rgb(var(--surface-muted))]"
    >
      <summary className="cursor-pointer px-4 py-3 text-xs font-bold uppercase tracking-wider text-accent-700 dark:text-accent-300">
        Ghi chú giảng viên · học viên không thấy
        <span className="ml-2 font-medium normal-case tracking-normal opacity-80">
          {label}
        </span>
      </summary>
      <SafeHtml
        html={html}
        className="prose prose-sm max-w-none px-4 pb-4 dark:prose-invert"
      />
    </details>
  );
}

/** Placeholder for players that cannot work without a session. */
function SignInRequired({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-6 text-center">
      <p className="text-sm font-semibold">{label}</p>
      <p className="mt-1 text-xs text-muted">
        Nội dung này cần tài khoản để ghi nhận kết quả học tập.
      </p>
      <a
        href="/signin"
        className="mt-3 inline-block rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
      >
        Đăng nhập để dùng
      </a>
    </div>
  );
}

function ContentBlock({
  type,
  payload,
  itemId,
  courseId,
  lessonId,
  interactive,
}: {
  type: string;
  payload: unknown;
  itemId: string;
  courseId?: string;
  lessonId?: string;
  interactive: boolean;
}) {
  switch (type) {
    case "video": {
      const p = payload as VideoPayload;
      // Cuepoints only fire on native <video> (uploaded files / direct
      // .mp4/.webm). Provider-iframe URLs (YouTube/Vimeo/...) pass back
      // through the standard VideoEmbed since we can't intercept their
      // playback without each provider's JS API.
      const isNativeVideo = isNativeVideoUrl(p.url);
      // Logged out, cuepoints are dropped rather than mounted: the gating player
      // fetches the quiz behind auth, and on failure it waves the learner through
      // anyway — so leaving it in would be gating theatre. There is no progress to
      // protect for an anonymous viewer regardless.
      const hasCuepoints = interactive && (p.cuepoints?.length ?? 0) > 0;
      return (
        <div>
          {isNativeVideo && hasCuepoints && lessonId ? (
            <VideoWithCuepoints
              url={p.url}
              cuepoints={p.cuepoints!}
              contentItemId={itemId}
              lessonId={lessonId}
            />
          ) : (
            <>
              <VideoEmbed url={p.url} />
              {hasCuepoints && !isNativeVideo && (
                <p className="mt-1 text-[11px] text-accent-700">
                  Lesson này có {p.cuepoints!.length} cuepoint quiz, nhưng player của
                  provider này không chặn được — học viên sẽ không bị bắt trả lời. Đổi
                  sang upload file để bật cuepoint.
                </p>
              )}
            </>
          )}
          {(p.title || p.caption) && (
            <figcaption className="mt-2 border-l-2 border-token pl-3">
              {p.title && (
                <div className="text-body font-semibold leading-snug">{p.title}</div>
              )}
              {p.caption && (
                <p className="text-meta mt-0.5 leading-relaxed text-muted">{p.caption}</p>
              )}
            </figcaption>
          )}
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
        <div className="prose prose-sm max-w-none rounded-xl border border-token bg-[rgb(var(--surface))] p-4 dark:prose-invert">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            // Render external links safely in a new tab.
            components={{
              a: ({ href, children, ...rest }) => (
                <a
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  {...rest}
                >
                  {children}
                </a>
              ),
            }}
          >
            {p.body}
          </ReactMarkdown>
        </div>
      );
    }
    case "richtext": {
      const p = payload as RichTextPayload;
      return (
        <SafeHtml
          html={p.html}
          className="prose prose-sm max-w-none rounded-xl border border-token bg-[rgb(var(--surface))] p-4 dark:prose-invert"
        />
      );
    }
    /**
     * Ghi chú giảng viên. Chỉ tới được đây khi trang đã xác nhận người xem có
     * quyền sửa khoá — component này không tự kiểm tra quyền, và không được
     * phép là nơi duy nhất kiểm tra.
     *
     * Trông phải KHÁC hẳn nội dung bài: đang dạy thì mắt chỉ liếc, nhầm ghi chú
     * thành nội dung rồi đọc to lên trước lớp là hỏng.
     */
    case "teacher_note": {
      const p = payload as RichTextPayload;
      return <TeacherNote html={p.html} />;
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
          {p.title ?? p.url}
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
          {p.filename}
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
      if (!interactive) return <SignInRequired label={p.title ?? "Nội dung SCORM"} />;
      return (
        <div>
          {p.title && (
            <p className="mb-2 inline-flex items-center gap-2 text-sm font-medium text-muted">
              <span></span>
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
      if (!interactive) return <SignInRequired label={p.title ?? "Công cụ LTI"} />;
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
      if (!interactive) return <SignInRequired label={p.title ?? "Nội dung H5P"} />;
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
      return <PdfViewer url={p.url} title={p.title} />;
    }
    default:
      return (
        <p className="rounded-lg border border-dashed border-token px-3 py-2 text-sm text-faint">
          Unknown content type: {type}
        </p>
      );
  }
}

/**
 * True when the URL will be played by the native <video> element rather
 * than a provider iframe. Cuepoints can only intercept native playback.
 *
 * Mirrors the fallthrough rules in VideoEmbed: same-origin paths,
 * unrecognized URLs, and recognized direct-file URLs all fall through
 * to <video src=...>; recognized providers (YouTube/Vimeo/...) render
 * an <iframe> instead.
 */
// isNativeVideoUrl moved to @/lib/videoUrl (server-safe). Re-exported here
// so existing imports don't break.
export { isNativeVideoUrl };

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
