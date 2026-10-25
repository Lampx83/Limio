"use client";

import { useEffect, useMemo, useRef } from "react";
import { ChevronUp, Navigation, Pause, Play, RotateCcw, SkipBack, SkipForward, X } from "lucide-react";
import type { LectureForLearner, PodcastForLearner } from "@feedbackme/core-lms";
import { getBrowserAudioPlayer } from "@/lib/exclusiveAudio";
import {
  NARRATION_SPEEDS,
  SPEED_KEY,
  anchorLabel,
  clearResume,
  clockText,
  formatClock,
  fractionWithin,
  isNarrationSpeed,
  listenedPercent,
  nextStart,
  previousStart,
  readResume,
  resolveAnchors,
  safeStorage,
  segmentIndexAt,
  speedLabel,
  weightedIndexAt,
  writeResume,
  type NarrationKind,
} from "@/lib/narration/learner";
import {
  getNarrationState,
  narrationCommands,
  patchNarration,
  resetNarration,
  setNarrationCommands,
  useNarration,
  type NarrationCommands,
} from "@/lib/narration/store";
import { LECTURER_NAME, NarrationAvatar, NarrationWave } from "./NarrationAvatar";
import PodcastTranscript from "./PodcastTranscript";
import "./narration.css";

const EVENTS_URL = "/api/me/narration-events";
const CONTENT_ID = "lesson-content";
const SAVE_EVERY_MS = 5000;

/** Gửi rồi quên: lỗi mạng, chặn quảng cáo… đều bị nuốt, và không bao giờ được làm chậm việc phát. */
function sendEvent(body: Record<string, unknown>): void {
  try {
    void fetch(EVENTS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* bỏ qua */
  }
}

const prefersReducedMotion = (): boolean => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Các cách đọc chữ của một thẻ h2: đầy đủ, và bỏ huy hiệu số thứ tự (xem LessonSectionNav). */
function headingCandidates(h: HTMLElement): string[] {
  const full = h.textContent ?? "";
  const last = h.querySelector("span:last-of-type")?.textContent;
  return last && last !== full ? [full, last] : [full];
}

interface Resolved {
  /** Khối cần tô sáng cho từng đoạn lời giảng (null = không có mục tương ứng). */
  targets: (HTMLElement | null)[];
  /** Thẻ h2 của từng đoạn — để bấm tiêu đề thì nghe từ đó. */
  headings: (HTMLElement | null)[];
  /** Các khối con (đoạn văn, hình, hộp…) của từng đoạn, theo thứ tự đọc — để tô sáng và cuộn theo trong một mục dài. */
  subs: HTMLElement[][];
}

const NOT_A_BLOCK = /^(H1|H2|HR|SCRIPT|STYLE)$/;
const ATOMIC = /^(P|FIGURE|LI|ASIDE|DETAILS|TABLE|BLOCKQUOTE|PRE)$/;
const hasContent = (e: HTMLElement): boolean => !!e.textContent?.trim() || !!e.querySelector("img,svg,video,iframe");

/**
 * Các khối con để theo dõi bên trong `el`: con trực tiếp (bỏ tiêu đề mục), danh sách trải thành từng mục, và đi xuyên qua
 * lớp vỏ chỉ có một con. Đoạn văn, hình, hộp, bảng… là một khối nguyên, không xẻ nhỏ thêm.
 */
function leafBlocks(el: HTMLElement, depth = 0): HTMLElement[] {
  const kids = [...el.children]
    .filter((c): c is HTMLElement => c instanceof HTMLElement && !NOT_A_BLOCK.test(c.tagName) && hasContent(c))
    .flatMap((k) => (k.tagName === "UL" || k.tagName === "OL" ? ([...k.children].filter((c) => c instanceof HTMLElement && hasContent(c)) as HTMLElement[]) : [k]));
  if (kids.length === 1 && depth < 3 && !ATOMIC.test(kids[0]!.tagName)) {
    const inner = leafBlocks(kids[0]!, depth + 1);
    if (inner.length > 1) return inner;
  }
  return kids;
}

/** Hàng huy hiệu "15 phút · 6 phần · 7 câu" và khung "Mục tiêu bài học": lời mở đầu không nói về chúng nên không tô sáng. */
const isMetaOrObjectives = (e: HTMLElement): boolean => /^\s*(\d+\s*phút|mục tiêu bài học)/i.test(e.textContent ?? "");

/**
 * Tìm trong DOM thật khối ứng với từng đoạn lời giảng. Làm lúc cần chứ không lưu: nội dung bài được làm sạch trong
 * useEffect (SafeHtml) nên DOM đổi sau lần dựng đầu, và lưu phần tử cũ sẽ trỏ vào thứ đã bị thay.
 */
function resolveTargets(root: HTMLElement, anchors: string[]): Resolved {
  const h2s = [...root.querySelectorAll<HTMLElement>("h2")];
  const resolved = resolveAnchors(anchors, h2s.map(headingCandidates));
  const items = [...root.querySelectorAll<HTMLElement>("[data-item-id]")];
  const summary = root.querySelector<HTMLElement>('section[aria-label="Tổng kết bài học"]');
  const targets: (HTMLElement | null)[] = [];
  const headings: (HTMLElement | null)[] = [];
  const subs: HTMLElement[][] = [];
  for (const r of resolved) {
    if (r.type === "intro") {
      // Phần mở đầu nói về những gì đứng trước mục đầu tiên (vd khung trò chuyện minh hoạ), không nói về mục tiêu bài học.
      const firstWithHeading = items.findIndex((it) => it.querySelector("h2"));
      const before = firstWithHeading < 0 ? items.slice(0, 1) : items.slice(0, firstWithHeading);
      let blocks = before.flatMap((it) => leafBlocks(it)).filter((b) => !isMetaOrObjectives(b));
      if (blocks.length === 0) {
        // Bài không có gì ngoài mục tiêu ở đầu: tô tiêu đề bài thay vì khung mục tiêu.
        const header = document.querySelector<HTMLElement>("main header");
        blocks = header ? [header] : [];
      }
      targets.push(null);
      headings.push(null);
      subs.push(blocks);
    } else if (r.type === "outro") {
      const box = summary ?? items[items.length - 1] ?? null;
      targets.push(box);
      headings.push(null);
      subs.push(box ? leafBlocks(box) : []);
    } else if (r.type === "heading") {
      const h = h2s[r.index]!;
      const item = h.closest<HTMLElement>("[data-item-id]");
      // Mục bố cục có khối riêng; bài viết liền một khối nhiều h2 thì chỉ tô tiêu đề, không tô cả bài.
      const block = h.closest<HTMLElement>(".lesson-section") ?? (item && item.querySelectorAll("h2").length === 1 ? item : null) ?? h;
      targets.push(block);
      headings.push(h);
      subs.push(block === h ? [] : leafBlocks(block));
    } else {
      targets.push(null);
      headings.push(null);
      subs.push([]);
    }
  }
  return { targets, headings, subs };
}

function scrollIntoComfort(el: HTMLElement): void {
  const top = el.getBoundingClientRect().top;
  // Đã nằm ở nửa trên màn hình, dưới thanh đầu trang: không cuộn thêm cho đỡ giật.
  if (top >= 72 && top <= window.innerHeight * 0.55) return;
  window.scrollTo({ top: window.scrollY + top - 96, behavior: prefersReducedMotion() ? "auto" : "smooth" });
}

interface Props {
  lessonId: string;
  lessonTitle: string;
  lecture: LectureForLearner | null;
  podcast: PodcastForLearner | null;
}

/**
 * Trình phát Nghe giảng / Podcast của trang bài học: giữ thẻ <audio>, đăng ký các lệnh cho nút Nghe giảng / Podcast,
 * tô sáng + tự cuộn theo mục đang giảng, nhớ vị trí nghe dở, ghi sự kiện đo lường, và vẽ thanh phát cố định ở cuối màn hình.
 * Xem docs/tieu-chi/nghe-giang-podcast.md (AC3–AC6).
 */
export default function NarrationPlayer({ lessonId, lessonTitle, lecture, podcast }: Props) {
  const ui = useNarration();
  const audioRef = useRef<HTMLAudioElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const dataRef = useRef({ lecture, podcast });
  dataRef.current = { lecture, podcast };

  const kind = ui.kind;
  const data = kind === "lecture" ? lecture : kind === "podcast" ? podcast : null;
  const items = useMemo(() => (kind === "lecture" ? lecture?.segments ?? [] : kind === "podcast" ? podcast?.turns ?? [] : []), [kind, lecture, podcast]);
  const activeIdx = ui.open ? segmentIndexAt(items, ui.time) : -1;
  const lectureOn = ui.open && kind === "lecture";
  const lectureIdx = lectureOn ? activeIdx : -1;

  // ── Động cơ: thẻ audio, lệnh, sự kiện, nhớ vị trí ───────────────────────────────
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const store = safeStorage();
    const dataOf = (k: NarrationKind) => (k === "lecture" ? dataRef.current.lecture : dataRef.current.podcast);
    const itemsOf = (k: NarrationKind) => (k === "lecture" ? dataRef.current.lecture?.segments ?? [] : dataRef.current.podcast?.turns ?? []);

    let loadedKind: NarrationKind | null = null;
    let pendingSeek: number | null = null;
    let lastSave = 0;
    const sess = { started: false, resumed: false, maxPos: 0 };

    const storedSpeed = Number(store?.getItem(SPEED_KEY));
    const speed = isNarrationSpeed(storedSpeed) ? storedSpeed : 1;
    audio.defaultPlaybackRate = speed;
    audio.playbackRate = speed;
    patchNarration({ speed });

    const currentKind = () => getNarrationState().kind;

    function savePosition() {
      const k = currentKind();
      const d = k ? dataOf(k) : null;
      if (!k || !d || !sess.started) return;
      writeResume(store, lessonId, k, d.version, audio!.currentTime);
    }

    /** Khép một lượt nghe: ghi `narration.stopped` nếu đã nghe được và chưa nghe hết. */
    function endSession() {
      const k = currentKind();
      const d = k ? dataOf(k) : null;
      if (k && d && sess.started) {
        savePosition();
        sendEvent({
          type: "stopped",
          lessonId,
          kind: k,
          percent: listenedPercent(sess.maxPos, d.durationSec),
          speed: getNarrationState().speed,
        });
      }
      sess.started = false;
    }

    function applySeek(sec: number) {
      if (audio!.readyState >= 1) {
        audio!.currentTime = sec;
        pendingSeek = null;
      } else {
        pendingSeek = sec;
      }
      patchNarration({ time: sec });
    }

    function play() {
      patchNarration({ loading: audio!.readyState < 3 });
      const p = audio!.play();
      if (p && typeof p.catch === "function") {
        p.catch((e: unknown) => {
          // AbortError: bị tạm dừng / đổi nguồn ngay sau khi bấm phát — không phải lỗi.
          if (e instanceof DOMException && e.name === "AbortError") return;
          patchNarration({ playing: false, loading: false });
        });
      }
    }

    function show(k: NarrationKind, time: number, offerSec: number | null) {
      const d = dataOf(k)!;
      if (loadedKind !== k) {
        endSession();
        audio!.pause();
        audio!.src = `/api/lessons/${lessonId}/narration/${k}?v=${d.version}`;
        audio!.load();
        loadedKind = k;
      }
      patchNarration({
        open: true,
        kind: k,
        playing: false,
        loading: false,
        ended: false,
        error: false,
        follow: true,
        expanded: false,
        duration: d.durationSec,
        offerSec,
      });
      sess.started = false;
      sess.maxPos = time;
      applySeek(time);
    }

    function restart() {
      if (!currentKind()) return;
      sess.resumed = false;
      sess.maxPos = 0;
      patchNarration({ ended: false, offerSec: null, error: false });
      applySeek(0);
      play();
    }

    const commands: NarrationCommands = {
      open(k) {
        const d = dataOf(k);
        if (!d) return;
        const st = getNarrationState();
        if (st.open && st.kind === k) return;
        const resume = readResume(store, lessonId, k, d.version, d.durationSec);
        if (resume !== null) {
          show(k, resume, resume);
        } else {
          sess.resumed = false;
          show(k, 0, null);
          play();
        }
      },
      playFrom(k, sec) {
        if (!dataOf(k)) return;
        const st = getNarrationState();
        if (!(st.open && st.kind === k)) {
          sess.resumed = false;
          show(k, sec, null);
        } else {
          patchNarration({ offerSec: null, ended: false, error: false });
          applySeek(sec);
        }
        play();
      },
      toggle() {
        const st = getNarrationState();
        if (!st.open) return;
        if (st.ended) return restart();
        if (st.offerSec !== null) return commands.resumeOffer();
        if (audio.paused) play();
        else audio.pause();
      },
      resumeOffer() {
        sess.resumed = true;
        patchNarration({ offerSec: null });
        play();
      },
      restart,
      seek(sec) {
        const st = getNarrationState();
        const target = Math.min(Math.max(0, sec), st.duration || sec);
        sess.maxPos = Math.max(sess.maxPos, target);
        patchNarration({ ended: false, offerSec: null });
        applySeek(target);
      },
      close() {
        endSession();
        audio.pause();
        patchNarration({ open: false, playing: false, loading: false, offerSec: null, expanded: false });
      },
      setSpeed(s) {
        if (!isNarrationSpeed(s)) return;
        audio.defaultPlaybackRate = s;
        audio.playbackRate = s;
        patchNarration({ speed: s });
        try {
          store?.setItem(SPEED_KEY, String(s));
        } catch {
          /* bỏ qua */
        }
      },
      previous() {
        const k = currentKind();
        if (!k) return;
        patchNarration({ follow: true });
        commands.seek(previousStart(itemsOf(k), getNarrationState().time));
      },
      next() {
        const k = currentKind();
        if (!k) return;
        const to = nextStart(itemsOf(k), getNarrationState().time);
        if (to === null) return;
        patchNarration({ follow: true });
        commands.seek(to);
      },
      refollow() {
        patchNarration({ follow: true });
      },
      setExpanded(expanded) {
        patchNarration({ expanded });
      },
      retry() {
        pendingSeek = getNarrationState().time;
        patchNarration({ error: false });
        audio.load();
        play();
      },
    };
    setNarrationCommands(commands);

    // Audio → trạng thái
    const offs: Array<() => void> = [];
    const on = (type: string, fn: () => void) => {
      audio.addEventListener(type, fn);
      offs.push(() => audio.removeEventListener(type, fn));
    };
    on("loadedmetadata", () => {
      audio.playbackRate = getNarrationState().speed;
      if (pendingSeek !== null) {
        audio.currentTime = pendingSeek;
        pendingSeek = null;
      }
    });
    on("timeupdate", () => {
      const t = audio.currentTime;
      sess.maxPos = Math.max(sess.maxPos, t);
      patchNarration({ time: t });
      const now = Date.now();
      if (sess.started && now - lastSave > SAVE_EVERY_MS) {
        lastSave = now;
        savePosition();
      }
    });
    on("play", () => {
      patchNarration({ playing: true, ended: false });
      // Một âm thanh một lúc: video, ô nghe phát âm, trình phát khác trong bài đều tạm dừng.
      document.querySelectorAll<HTMLMediaElement>("audio, video").forEach((m) => {
        if (m !== audio && !m.paused) m.pause();
      });
      getBrowserAudioPlayer().stop();
    });
    on("playing", () => {
      patchNarration({ loading: false });
      if (!sess.started) {
        sess.started = true;
        const k = currentKind();
        if (k) sendEvent({ type: "started", lessonId, kind: k, resumed: sess.resumed });
      }
    });
    on("pause", () => {
      patchNarration({ playing: false });
      savePosition();
    });
    on("waiting", () => patchNarration({ loading: true }));
    on("canplay", () => patchNarration({ loading: false }));
    on("ended", () => {
      const k = currentKind();
      patchNarration({ playing: false, ended: true, time: getNarrationState().duration, loading: false });
      if (k) {
        clearResume(store, lessonId, k);
        if (sess.started) sendEvent({ type: "completed", lessonId, kind: k });
      }
      sess.started = false;
    });
    on("error", () => patchNarration({ error: true, playing: false, loading: false }));

    // Âm thanh khác trong trang bắt đầu phát thì tạm dừng bài giảng. Bỏ qua phương tiện đang tắt tiếng (video trang trí tự phát).
    const onOtherPlay = (e: Event) => {
      const t = e.target;
      if (t instanceof HTMLMediaElement && t !== audio && !t.muted && !audio.paused) audio.pause();
    };
    document.addEventListener("play", onOtherPlay, true);
    // Ô nghe phát âm của bài ngoại ngữ dùng thẻ Audio không gắn vào trang nên không có sự kiện `play` để bắt: nghe qua kho riêng của nó.
    const unsubscribeOther = getBrowserAudioPlayer().subscribe(() => {
      if (getBrowserAudioPlayer().playingId() !== null && !audio.paused) audio.pause();
    });

    const onPageHide = () => endSession();
    const onVisibility = () => {
      if (document.visibilityState === "hidden") savePosition();
    };
    window.addEventListener("pagehide", onPageHide);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      endSession();
      audio.pause();
      offs.forEach((off) => off());
      document.removeEventListener("play", onOtherPlay, true);
      unsubscribeOther();
      window.removeEventListener("pagehide", onPageHide);
      document.removeEventListener("visibilitychange", onVisibility);
      setNarrationCommands(null);
      resetNarration();
    };
  }, [lessonId]);

  // ── Tô sáng mục đang giảng + tự cuộn ───────────────────────────────────────────
  const prevIdx = useRef(-1);
  const prevFollow = useRef(true);
  const needScroll = useRef(false);
  // Theo dõi khối con bên trong mục đang giảng (xem leafBlocks): giá trị mới nhất để hàm vẽ không phụ thuộc lần dựng nào.
  const subsRef = useRef<HTMLElement[]>([]);
  const subIdxRef = useRef(-1);
  const subOwnerRef = useRef(-2);
  const liveRef = useRef<{ time: number; seg: LectureForLearner["segments"][number] | null; follow: boolean; offer: number | null; hasTarget: boolean }>({
    time: 0,
    seg: null,
    follow: true,
    offer: null,
    hasTarget: false,
  });
  liveRef.current = {
    ...liveRef.current,
    time: ui.time,
    seg: lectureIdx >= 0 ? lecture?.segments[lectureIdx] ?? null : null,
    follow: ui.follow,
    offer: ui.offerSec,
  };

  const paintSub = () => {
    const { time, seg, follow, offer, hasTarget } = liveRef.current;
    const blocks = subsRef.current;
    const want = seg && blocks.length > 0 ? weightedIndexAt(blocks.map((b) => (b.textContent ?? "").trim().length), fractionWithin(seg, time)) : -1;
    if (want === subIdxRef.current) return;
    const prev = subIdxRef.current;
    subIdxRef.current = want;
    document.querySelectorAll(".narration-sub").forEach((n) => {
      if (n !== blocks[want]) n.classList.remove("narration-sub");
    });
    const el = want >= 0 ? blocks[want] : undefined;
    if (!el) return;
    el.classList.add("narration-sub");
    // Khối đầu của một mục có khung riêng: để lần cuộn tới mục lo, tránh hai lần cuộn chồng nhau.
    const sectionScrolls = want === 0 && hasTarget;
    if (prev !== want && follow && offer === null && !sectionScrolls) scrollIntoComfort(el);
  };

  useEffect(() => {
    const root = document.getElementById(CONTENT_ID);
    if (!root) return;
    if (!lectureOn || !lecture) {
      root.removeAttribute("data-narration-on");
      root.querySelectorAll(".narration-active").forEach((n) => n.classList.remove("narration-active"));
      document.querySelectorAll(".narration-sub").forEach((n) => n.classList.remove("narration-sub"));
      subsRef.current = [];
      subIdxRef.current = -1;
      subOwnerRef.current = -2;
      prevIdx.current = -1;
      return;
    }
    root.setAttribute("data-narration-on", "1");
    const anchors = lecture.segments.map((s) => s.anchor);

    if (lectureIdx !== prevIdx.current || (ui.follow && !prevFollow.current)) {
      needScroll.current = ui.follow && ui.offerSec === null;
      subIdxRef.current = -1; // cuộn lại tới khối con hiện tại
    }
    prevIdx.current = lectureIdx;
    prevFollow.current = ui.follow;

    const apply = () => {
      const { targets, subs } = resolveTargets(root, anchors);
      const el = lectureIdx >= 0 ? targets[lectureIdx] ?? null : null;
      root.querySelectorAll(".narration-active").forEach((n) => {
        if (n !== el) n.classList.remove("narration-active");
      });
      el?.classList.add("narration-active");
      if (el && needScroll.current) {
        needScroll.current = false;
        scrollIntoComfort(el);
      }
      // Đổi mục: dựng lại danh sách khối con; DOM chỉ dựng lại giữa chừng thì giữ vị trí đang theo.
      subsRef.current = lectureIdx >= 0 ? subs[lectureIdx] ?? [] : [];
      liveRef.current.hasTarget = !!el;
      if (subOwnerRef.current !== lectureIdx) {
        subOwnerRef.current = lectureIdx;
        subIdxRef.current = -1;
      }
      paintSub();
    };
    apply();

    // Nội dung bài được đổ vào DOM muộn (SafeHtml làm sạch trong useEffect) hoặc dựng lại: gắn lại tô sáng khi DOM đổi.
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(apply);
    });
    mo.observe(root, { childList: true, subtree: true });
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [lectureOn, lectureIdx, ui.follow, ui.offerSec, lecture]);

  // Mỗi nhịp phát: tô sáng và cuộn theo khối con đang được giảng trong mục.
  useEffect(() => {
    if (lectureOn) paintSub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lectureOn, ui.time]);

  // Bấm tiêu đề một mục thì nghe từ đầu mục đó.
  useEffect(() => {
    if (!lectureOn || !lecture) return;
    const root = document.getElementById(CONTENT_ID);
    if (!root) return;
    const onClick = (e: MouseEvent) => {
      const h = e.target instanceof Element ? e.target.closest<HTMLElement>("h2") : null;
      if (!h || !root.contains(h)) return;
      const { headings } = resolveTargets(
        root,
        lecture.segments.map((s) => s.anchor),
      );
      const i = headings.findIndex((x) => x === h);
      if (i < 0) return;
      patchNarration({ follow: true });
      narrationCommands()?.playFrom("lecture", lecture.segments[i]!.startSec);
    };
    root.addEventListener("click", onClick);
    return () => root.removeEventListener("click", onClick);
  }, [lectureOn, lecture]);

  // Học viên tự cuộn thì trang thôi tự cuộn theo (tô sáng vẫn chạy).
  useEffect(() => {
    if (!lectureOn || !ui.follow) return;
    const insideBar = (t: EventTarget | null) => t instanceof Element && t.closest("[data-narration-bar]") !== null;
    const stop = (e: Event) => {
      if (!insideBar(e.target)) patchNarration({ follow: false });
    };
    const onKey = (e: KeyboardEvent) => {
      if (insideBar(e.target) || (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]"))) return;
      if (["PageUp", "PageDown", "Home", "End", "ArrowUp", "ArrowDown"].includes(e.key)) patchNarration({ follow: false });
    };
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchmove", stop, { passive: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchmove", stop);
      window.removeEventListener("keydown", onKey);
    };
  }, [lectureOn, ui.follow]);

  // ── Thanh phát đẩy các nút nổi của trang lên ──────────────────────────────────
  useEffect(() => {
    const bar = barRef.current;
    const root = document.documentElement;
    if (!ui.open || !bar) return;
    const update = () => {
      const h = Math.max(0, window.innerHeight - bar.getBoundingClientRect().top);
      root.style.setProperty("--narration-bar-h", `${Math.round(h + 8)}px`);
    };
    update();
    root.setAttribute("data-narration-open", "1");
    const ro = new ResizeObserver(update);
    ro.observe(bar);
    window.addEventListener("resize", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      root.style.removeProperty("--narration-bar-h");
      root.removeAttribute("data-narration-open");
    };
  }, [ui.open, ui.expanded, ui.offerSec, ui.ended, ui.error, kind]);

  // ── Phím điều khiển trên màn hình khoá / tai nghe ─────────────────────────────
  useEffect(() => {
    if (!ui.open || !kind || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    const title = kind === "podcast" ? podcast?.title ?? lessonTitle : lessonTitle;
    try {
      ms.metadata = new MediaMetadata({ title, artist: kind === "podcast" ? "Podcast · Limio" : `${LECTURER_NAME} · Limio`, album: lessonTitle });
      const c = () => narrationCommands();
      ms.setActionHandler("play", () => c()?.toggle());
      ms.setActionHandler("pause", () => c()?.toggle());
      ms.setActionHandler("seekbackward", () => c()?.seek(getNarrationState().time - 10));
      ms.setActionHandler("seekforward", () => c()?.seek(getNarrationState().time + 10));
      ms.setActionHandler("previoustrack", () => c()?.previous());
      ms.setActionHandler("nexttrack", () => c()?.next());
    } catch {
      /* trình duyệt không hỗ trợ đủ — bỏ qua */
    }
    return () => {
      try {
        for (const a of ["play", "pause", "seekbackward", "seekforward", "previoustrack", "nexttrack"] as const) ms.setActionHandler(a, null);
      } catch {
        /* bỏ qua */
      }
    };
  }, [ui.open, kind, lessonTitle, podcast]);

  // ── Giao diện thanh phát ──────────────────────────────────────────────────────
  const c = narrationCommands;
  const showBar = ui.open && kind !== null && data !== null;
  const cur = activeIdx >= 0 ? items[activeIdx] : undefined;
  let title: string = LECTURER_NAME;
  let subline = "";
  if (kind === "lecture") {
    const seg = cur as LectureForLearner["segments"][number] | undefined;
    subline = seg ? anchorLabel(seg.anchor) : lessonTitle;
  } else if (kind === "podcast") {
    const turn = cur as PodcastForLearner["turns"][number] | undefined;
    title = podcast?.title ?? "Podcast";
    subline = turn ? `${turn.speakerName} đang nói` : lessonTitle;
  }
  if (ui.ended) subline = "Đã nghe xong";
  else if (ui.loading && ui.playing) subline = "Đang tải…";
  const unit = kind === "podcast" ? "lượt" : "mục";
  const duration = ui.duration || data?.durationSec || 0;
  const pct = duration > 0 ? Math.min(100, (ui.time / duration) * 100) : 0;
  const canNext = nextStart(items, ui.time) !== null;
  const speakerNow = kind === "podcast" ? (cur as PodcastForLearner["turns"][number] | undefined)?.speaker : undefined;

  return (
    <>
      {/* Thẻ audio ẩn: không có `controls` nên không có menu "Tải xuống"; `nodownload` cho chắc. Nguồn chỉ nạp khi học viên bấm nghe. */}
      <audio ref={audioRef} preload="none" className="hidden" controlsList="nodownload noplaybackrate" />
      {showBar && (
        <div
          ref={barRef}
          data-narration-bar
          role="region"
          aria-label={kind === "podcast" ? "Thanh phát podcast" : "Thanh phát nghe giảng"}
          onKeyDown={(e) => {
            // Phím cách phát/dừng khi tiêu điểm ở thanh phát (nút bấm tự xử lý phím cách của chính nó).
            if (e.key === " " && !(e.target instanceof HTMLButtonElement)) {
              e.preventDefault();
              c()?.toggle();
            }
          }}
          className="narration-bar fixed inset-x-0 bottom-0 z-30 border-t border-token bg-[rgb(var(--surface))] pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_24px_rgba(0,0,0,0.12)] print:hidden sm:inset-x-4 sm:bottom-3 sm:mx-auto sm:max-w-3xl sm:rounded-2xl sm:border sm:pb-0"
        >
          <div className="flex items-center gap-3 px-3 py-2 sm:px-4 sm:py-3">
            {kind === "podcast" && podcast ? (
              <span className="flex shrink-0 -space-x-3">
                <NarrationAvatar who="A" name={podcast.hosts.A} size="sm" speaking={ui.playing && speakerNow === "A"} />
                <NarrationAvatar who="B" name={podcast.hosts.B} size="sm" speaking={ui.playing && speakerNow === "B"} />
              </span>
            ) : (
              <NarrationAvatar who="lecturer" speaking={ui.playing} />
            )}
            <button
              type="button"
              className="min-w-0 flex-1 text-left sm:pointer-events-none"
              onClick={() => c()?.setExpanded(!ui.expanded)}
              aria-expanded={ui.expanded}
              aria-label={`${title}. ${subline}. Bấm để ${ui.expanded ? "thu gọn" : "mở rộng"} thanh phát`}
            >
              <span className="block truncate text-sm font-semibold">{title}</span>
              <span className="block truncate text-xs text-muted" aria-live="off">
                {subline}
              </span>
            </button>
            <NarrationWave playing={ui.playing && !ui.loading} className="hidden text-[rgb(var(--brand))] sm:inline-flex" />
            <span className="hidden shrink-0 tabular-nums text-xs text-muted sm:block">
              {formatClock(ui.time)} / {formatClock(duration)}
            </span>
            <button
              type="button"
              onClick={() => c()?.toggle()}
              aria-label={ui.ended ? "Nghe lại" : ui.playing ? "Tạm dừng" : "Phát"}
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[rgb(var(--brand))] text-white shadow transition-transform hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[rgb(var(--brand))]"
            >
              {ui.ended ? <RotateCcw size={20} /> : ui.playing ? <Pause size={20} /> : <Play size={20} className="ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={() => c()?.setExpanded(!ui.expanded)}
              aria-label={ui.expanded ? "Thu gọn thanh phát" : "Mở rộng thanh phát"}
              aria-expanded={ui.expanded}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-[rgb(var(--surface-muted))] sm:hidden"
            >
              <ChevronUp size={18} className={ui.expanded ? "rotate-180" : ""} />
            </button>
            <button
              type="button"
              onClick={() => c()?.close()}
              aria-label="Đóng thanh phát"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-[rgb(var(--surface-muted))]"
            >
              <X size={18} />
            </button>
          </div>

          {ui.offerSec !== null && (
            <div className="flex flex-wrap items-center gap-2 border-t border-token px-3 py-2 sm:px-4">
              <button type="button" className="btn-primary" onClick={() => c()?.resumeOffer()}>
                <Play size={16} />
                Nghe tiếp từ {formatClock(ui.offerSec)}
              </button>
              <button type="button" className="btn-pill" onClick={() => c()?.restart()}>
                Nghe từ đầu
              </button>
            </div>
          )}

          {kind === "lecture" && !ui.follow && ui.offerSec === null && (
            <div className="flex items-center gap-2 border-t border-token px-3 py-2 sm:px-4">
              <button type="button" className="btn-pill" onClick={() => c()?.refollow()}>
                <Navigation size={14} />
                Theo giảng viên
              </button>
              <span className="text-xs text-muted">Trang không còn tự cuộn theo bài giảng.</span>
            </div>
          )}

          {ui.error && (
            <div role="alert" className="flex flex-wrap items-center gap-2 border-t border-token px-3 py-2 text-sm sm:px-4">
              <span className="text-[rgb(var(--text))]">Không phát được âm thanh lúc này.</span>
              <button type="button" className="btn-pill" onClick={() => c()?.retry()}>
                Thử lại
              </button>
            </div>
          )}

          {kind === "podcast" && podcast && <PodcastTranscript podcast={podcast} />}

          <div className={`${ui.expanded ? "block" : "hidden"} border-t border-token px-3 pb-3 pt-2 sm:block sm:px-4`}>
            <div className="flex items-center gap-2">
              <span className="w-10 shrink-0 text-right tabular-nums text-xs text-muted sm:hidden">{formatClock(ui.time)}</span>
              <input
                type="range"
                className="narration-range min-w-0 flex-1"
                min={0}
                max={Math.max(1, Math.floor(duration))}
                step={1}
                value={Math.min(Math.floor(ui.time), Math.max(1, Math.floor(duration)))}
                style={{ ["--p" as string]: `${pct}%` }}
                aria-label="Vị trí phát"
                aria-valuetext={clockText(ui.time, duration)}
                onChange={(e) => c()?.seek(Number(e.target.value))}
              />
              <span className="w-10 shrink-0 tabular-nums text-xs text-muted sm:hidden">{formatClock(duration)}</span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => c()?.previous()}
                  aria-label={`${kind === "podcast" ? "Lượt" : "Mục"} trước`}
                  className="flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted hover:bg-[rgb(var(--surface-muted))]"
                >
                  <SkipBack size={16} />
                  Trước
                </button>
                <button
                  type="button"
                  onClick={() => c()?.next()}
                  disabled={!canNext}
                  aria-label={`${kind === "podcast" ? "Lượt" : "Mục"} sau`}
                  className="flex h-9 items-center gap-1 rounded-full px-3 text-xs font-medium text-muted hover:bg-[rgb(var(--surface-muted))] disabled:opacity-40"
                >
                  Sau
                  <SkipForward size={16} />
                </button>
              </div>
              <div role="group" aria-label="Tốc độ phát" className="flex items-center gap-1">
                {NARRATION_SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={ui.speed === s}
                    onClick={() => c()?.setSpeed(s)}
                    className={`h-8 rounded-full px-2.5 text-xs font-medium tabular-nums ${
                      ui.speed === s ? "bg-[rgb(var(--brand))] text-white" : "text-muted hover:bg-[rgb(var(--surface-muted))]"
                    }`}
                  >
                    {speedLabel(s)}
                  </button>
                ))}
              </div>
              {kind === "lecture" && ui.follow && <span className="ml-auto hidden text-xs text-muted md:inline">Bấm tiêu đề một {unit} để nghe từ đó</span>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
