"use client";

/**
 * A2.7 — Interactive transcript for YouTube video content: a synced panel
 * beside (lg:+) / below (mobile) the video that highlights the currently
 * spoken line and lets the learner click a line to seek.
 *
 * Only mounted by LessonContent when the video is YouTube AND transcriptUrl
 * points at a .vtt/.srt file (see isSyncableTranscriptUrl) — every other
 * combination (native upload, Vimeo/Loom/..., plain transcript link, no
 * transcript) keeps the existing VideoEmbed + static "Xem transcript" link.
 *
 * Falls back to that same plain rendering itself if the file fails to fetch
 * or parses to zero cues, so a malformed upload never breaks the lesson.
 */

import { useEffect, useRef, useState } from "react";
import { parseVideoUrl } from "@/lib/videoUrl";
import { parseTranscriptCues, type TranscriptCue } from "@/lib/transcript";
import { loadYouTubeIframeApi, type YTPlayer } from "@/lib/youtubeIframeApi";
import { Skeleton } from "@/components/Skeleton";

const POLL_MS = 250;
const MANUAL_SCROLL_PAUSE_MS = 4000;

function formatTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function findActiveIndex(cues: TranscriptCue[], t: number): number {
  for (let i = 0; i < cues.length; i++) {
    if (t >= cues[i]!.startSec && t < cues[i]!.endSec) return i;
  }
  return -1;
}

export default function YouTubeWithTranscript({
  url,
  transcriptUrl,
}: {
  url: string;
  transcriptUrl: string;
}) {
  const v = parseVideoUrl(url);

  const [cues, setCues] = useState<TranscriptCue[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const programmaticScroll = useRef(false);
  const suppressAutoScrollUntil = useRef(0);

  useEffect(() => {
    let cancelled = false;
    fetch(transcriptUrl)
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error("fetch_failed"))))
      .then((text) => {
        if (cancelled) return;
        const parsed = parseTranscriptCues(text);
        if (parsed.length === 0) setFailed(true);
        else setCues(parsed);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [transcriptUrl]);

  useEffect(() => {
    if (!cues || !v || v.kind !== "youtube" || !playerContainerRef.current) return;
    let destroyed = false;
    let poll: ReturnType<typeof setInterval> | null = null;

    loadYouTubeIframeApi().then((YT) => {
      if (destroyed || !playerContainerRef.current) return;
      playerRef.current = new YT.Player(playerContainerRef.current, {
        videoId: v.id,
        host: "https://www.youtube-nocookie.com",
        playerVars: { rel: 0, modestbranding: 1, ...(v.start ? { start: v.start } : {}) },
        events: {
          onReady: () => {
            poll = setInterval(() => {
              const t = playerRef.current?.getCurrentTime();
              if (t === undefined) return;
              setActiveIndex(findActiveIndex(cues, t));
            }, POLL_MS);
          },
        },
      });
    });

    return () => {
      destroyed = true;
      if (poll) clearInterval(poll);
      playerRef.current?.destroy();
      playerRef.current = null;
    };
    // v is derived from `url`, which is stable per content item — re-running
    // this on every parseVideoUrl() call (new object identity) would tear
    // down and remount the player pointlessly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cues, url]);

  useEffect(() => {
    if (activeIndex < 0) return;
    if (Date.now() < suppressAutoScrollUntil.current) return;
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIndex}"]`);
    if (!el) return;
    programmaticScroll.current = true;
    el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    window.setTimeout(() => {
      programmaticScroll.current = false;
    }, 600);
  }, [activeIndex]);

  if (!v || v.kind !== "youtube") return null; // caller only mounts this for youtube

  if (failed) {
    // File didn't fetch or parsed to 0 cues — fall back to exactly what
    // LessonContent renders when there's no interactive transcript at all,
    // link included, so a bad upload never silently drops it.
    return (
      <div>
        <PlainYouTubeEmbed embedUrl={v.embedUrl} providerName={v.providerName} />
        <a href={transcriptUrl} className="link mt-2 inline-block text-sm">
          Xem transcript
        </a>
      </div>
    );
  }

  if (!cues) {
    return (
      <div className="lg:flex lg:items-start lg:gap-4">
        <Skeleton className="aspect-video w-full lg:flex-1" rounded="rounded-xl" />
        <Skeleton className="mt-3 h-[280px] w-full lg:mt-0 lg:w-80 lg:shrink-0" rounded="rounded-xl" />
      </div>
    );
  }

  function handleCueClick(cue: TranscriptCue) {
    playerRef.current?.seekTo(cue.startSec, true);
    playerRef.current?.playVideo();
  }

  function onListScroll() {
    if (programmaticScroll.current) return;
    suppressAutoScrollUntil.current = Date.now() + MANUAL_SCROLL_PAUSE_MS;
  }

  return (
    <div className="lg:flex lg:items-start lg:gap-4">
      <div
        ref={playerContainerRef}
        className="aspect-video w-full overflow-hidden rounded-xl border border-token bg-black shadow-card lg:flex-1"
      />
      <div
        ref={listRef}
        onScroll={onListScroll}
        className="mt-3 max-h-[320px] overflow-y-auto rounded-xl border border-token bg-[rgb(var(--surface))] p-2 lg:mt-0 lg:aspect-video lg:w-80 lg:max-h-none lg:shrink-0"
        aria-label="Transcript"
      >
        {cues.map((c, idx) => (
          <button
            key={idx}
            type="button"
            data-idx={idx}
            onClick={() => handleCueClick(c)}
            className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm transition-colors ${
              idx === activeIndex
                ? "bg-brand-100 font-semibold text-brand-800 dark:bg-brand-950/50 dark:text-brand-200"
                : "text-muted hover:bg-[rgb(var(--surface-muted))]"
            }`}
          >
            <span className="mr-2 text-xs tabular-nums text-faint">{formatTime(c.startSec)}</span>
            {c.text}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Same markup as LessonContent's VideoEmbed youtube branch — kept local since that one isn't exported. */
function PlainYouTubeEmbed({ embedUrl, providerName }: { embedUrl: string; providerName: string }) {
  return (
    <iframe
      src={embedUrl}
      title={`${providerName} video`}
      loading="lazy"
      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      className="aspect-video w-full overflow-hidden rounded-xl border border-token bg-black shadow-card"
    />
  );
}
