"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Eraser, Eye, List, Maximize, Minimize, Pause, PenLine, NotebookPen, Palette, Pencil, Target, Undo2, Volume2, X } from "lucide-react";
import HanFontLoader from "@/components/HanFontLoader";
import RubyText, { hanTextProps, rubyPlan } from "@/components/RubyText";
import LessonRichText from "@/components/lesson/LessonRichText";
import HanziStrokeDialog from "@/components/lesson/HanziStrokeDialog";
import { hasHanChars } from "@/lib/hskVocab";
import { splitHanWords } from "@/lib/keyTerms";
import { teachSyncName, type TeachSyncMessage } from "./TeachingPresenter";
import TeachingInk, { type InkHandle, type InkTool } from "@/components/lesson/TeachingInk";
import { apiUrl } from "@/lib/apiUrl";
import { frameAccent, frameHeading, frameSections, type PassageBlock, type TeachingFrame } from "@/lib/teachingFrames";
import "./teachingDeck.css";

/**
 * Chế độ "Chiếu lớp" của một bài học HSK (docs/tieu-chi/hsk-che-do-chieu-lop.md): mỗi màn một phần nội dung, chữ lớn, pinyin dưới chữ Hán.
 * Màn dựng ở máy chủ (`buildTeachingFrames`); ở đây chỉ hiển thị, điều khiển và phát âm thanh. Không ghi gì về học viên.
 * Mỗi mục của bài có một màu nhấn riêng (`frameAccent`), CSS đọc qua `data-accent`.
 */

interface AnswerKey {
  lines: string[];
  explanation: string | null;
  open: boolean;
}
type AnswerState = AnswerKey | "loading" | "error";
/**
 * Một đoạn âm thanh. `lit` = chỉ số dòng sáng lên khi đoạn này phát (hội thoại từng lượt); `marks` = giây bắt đầu của từng dòng trong MỘT tệp dài
 * (dòng nào có mốc lớn nhất ≤ giây hiện tại thì sáng).
 */
type AudioPart = { url: string; start?: number; end?: number; lit?: number; marks?: Array<number | undefined> };
type PlayFn = (key: string, parts: AudioPart[], group?: string) => void;
type Lit = { group: string; index: number } | null;
type VocabFrame = Extract<TeachingFrame, { kind: "vocab" }>;

/** Dòng đang đọc theo mốc thời gian: mốc lớn nhất không quá `sec`; chưa tới mốc nào thì null. */
export function litByMarks(marks: Array<number | undefined>, sec: number): number | null {
  let best: number | null = null;
  marks.forEach((m, i) => {
    if (typeof m === "number" && m <= sec + 0.05 && (best === null || m >= (marks[best] as number))) best = i;
  });
  return best;
}

/** Câu chữ Hán có pinyin thẳng hàng (nếu ghép được), không thì chữ thường kèm dòng pinyin riêng; mọi pinyin bị ẩn khi tắt "Pinyin". */
function HanLine({ text, reading, size, keys }: { text: string; reading?: string; size: "hero" | "xl" | "lg" | "md"; keys?: string[] }) {
  const plan = rubyPlan(text, reading);
  // Từ quan trọng (từ mới của bài) được tô nổi bật bằng màu nhấn thứ hai (`.rp-key`).
  const words = keys && keys.length ? splitHanWords(text, keys) : undefined;
  const cls = `teach-han teach-han-${size} ${hanTextProps(plan.lang).className} ${plan.syllables ? "ruby-line" : ""}`;
  return (
    <>
      <HanFontLoader lang={plan.lang} />
      <p className={cls} lang={plan.lang}>
        {plan.syllables ? (
          <RubyText text={text} syllables={plan.syllables} words={words} />
        ) : words ? (
          words.map((w, i) => (w.hl ? <span key={i} className="rp-key">{w.text}</span> : <span key={i}>{w.text}</span>))
        ) : (
          text
        )}
      </p>
      {!plan.syllables && reading ? <p className="teach-py py-latin">{reading}</p> : null}
    </>
  );
}

/** Ba cỡ chữ người dạy chọn (a / A / A): hệ số nhân lên cỡ gốc của màn. */
const SIZES = [
  { id: "s", scale: 0.85, label: "Chữ nhỏ" },
  { id: "m", scale: 1, label: "Chữ vừa" },
  { id: "l", scale: 1.3, label: "Chữ lớn" },
] as const;
type SizeId = (typeof SIZES)[number]["id"];
const SIZE_KEY = "limio-teach-size";

/** Giao diện màu của màn chiếu (CSS đặt lại các biến màu theo `data-theme`); nhớ theo trình duyệt. */
const THEMES = [
  { id: "paper", label: "Giấy nhám (mặc định)", chip: "#f0e7d1", ink: "#65a30d" },
  { id: "light", label: "Sáng (Limio)", chip: "#fafafc", ink: "#65a30d" },
  { id: "sage", label: "Xanh dịu", chip: "#e9f0e6", ink: "#38784a" },
  { id: "board", label: "Bảng xanh", chip: "#1c342c", ink: "#a3e635" },
] as const;
type ThemeId = (typeof THEMES)[number]["id"];
const THEME_KEY = "limio-teach-theme";

/** Màu bút vẽ: đỏ, xanh dương, xanh lá, đen (đủ tương phản trên nền trắng và trên chữ). */
const PEN_COLORS = [
  { id: "#dc2626", label: "Bút đỏ" },
  { id: "#2563eb", label: "Bút xanh dương" },
  { id: "#16a34a", label: "Bút xanh lá" },
  { id: "#111827", label: "Bút đen" },
] as const;
/** Trên bảng xanh đậm, bút đen không thấy nên thay bằng bút trắng. */
const BOARD_PEN = { id: "#f8fafc", label: "Bút trắng (phấn)" } as const;

/** Cỡ chữ nhỏ nhất khi co cho vừa màn (so với cỡ gốc); dài hơn nữa thì cuộn. */
const MIN_FIT = 0.8;

/** Đoạn chữ có tô nổi bật từ quan trọng (gom các chữ liền nhau cùng trạng thái thành một đoạn). */
function Highlighted({ text, keys }: { text: string; keys: string[] }) {
  if (!keys.length) return <>{text}</>;
  const parts: Array<{ text: string; hl: boolean }> = [];
  for (const w of splitHanWords(text, keys)) {
    const last = parts[parts.length - 1];
    if (last && last.hl === w.hl) last.text += w.text;
    else parts.push({ text: w.text, hl: w.hl });
  }
  return (
    <>
      {parts.map((p, i) => (p.hl ? <span key={i} className="rp-key">{p.text}</span> : <span key={i}>{p.text}</span>))}
    </>
  );
}

const hanClass = (text: string) => hanTextProps(rubyPlan(text, undefined).lang).className;

export default function TeachingDeck({
  frames,
  lessonTitle,
  courseTitle,
  levelLabel,
  unitTitle,
  unitLabel,
  backHref,
  lessonId,
}: {
  frames: TeachingFrame[];
  lessonTitle: string;
  courseTitle: string;
  /** Tên đầy đủ của chủ đề (module) chứa bài, vd. "Chủ đề 1 · 搬进新家 — Dọn về nhà mới". */
  unitTitle?: string;
  /** Số chủ đề, vd. "Chủ đề 1" (rút từ tên module); null = không rút được. */
  unitLabel?: string | null;
  /** Cấp độ hiện trên màn chiếu, vd. "Limio HSK 4" (rút từ tên khoá); null = chỉ hiện tên khoá. */
  levelLabel?: string | null;
  backHref: string;
  /** Khoá đồng bộ với cửa sổ "Màn giảng viên" (ghi chú, đồng hồ, màn kế tiếp) đặt ở màn hình của thầy/cô. */
  lessonId: string;
}) {
  const [idx, setIdx] = useState(0);
  const [pinyin, setPinyin] = useState(true);
  const [translation, setTranslation] = useState(false);
  const [size, setSize] = useState<SizeId>("m");
  const [theme, setTheme] = useState<ThemeId>("paper");
  const [themeMenu, setThemeMenu] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [stroke, setStroke] = useState<VocabFrame | null>(null);
  // Hộp "Cách viết" mở: bỏ qua phím của trang. Tắt trễ một nhịp để chính phím Esc đóng hộp không lọt sang xử lý "thoát bài".
  const strokeOpen = useRef(false);
  const openStroke = useCallback((f: VocabFrame) => {
    strokeOpen.current = true;
    setStroke(f);
  }, []);
  const closeStroke = useCallback(() => {
    setStroke(null);
    window.setTimeout(() => {
      strokeOpen.current = false;
    }, 80);
  }, []);
  const [tool, setTool] = useState<InkTool>("none");
  const [penColor, setPenColor] = useState<string>(PEN_COLORS[0].id);
  const inkRef = useRef<InkHandle>(null);
  const [full, setFull] = useState(false);
  const [menu, setMenu] = useState(false);
  const [answers, setAnswers] = useState<Record<string, AnswerState>>({});
  const [playing, setPlaying] = useState<string | null>(null);
  const [lit, setLit] = useState<Lit>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const seqRef = useRef<{ cancelled: boolean } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const total = frames.length;
  const frame = frames[idx]!;
  const sections = useMemo(() => frameSections(frames), [frames]);
  const accent = frameAccent(frame);
  const notesTotal = useMemo(() => frames.reduce((n, f) => n + (f.notes?.length ?? 0), 0), [frames]);
  const frameHasNotes = (frame.notes?.length ?? 0) > 0;

  // ---- âm thanh: một nguồn một lúc; đổi màn thì dừng ----
  const stopAudio = useCallback(() => {
    if (seqRef.current) seqRef.current.cancelled = true;
    seqRef.current = null;
    const a = audioRef.current;
    if (a) {
      a.onended = null;
      a.ontimeupdate = null;
      a.pause();
    }
    setPlaying(null);
    setLit(null);
  }, []);

  const playOne = useCallback((a: HTMLAudioElement, url: string, start?: number, end?: number, onTime?: (sec: number) => void) => {
    return new Promise<void>((resolve) => {
      a.onended = () => resolve();
      a.onerror = () => resolve();
      a.ontimeupdate = () => {
        onTime?.(a.currentTime);
        if (end !== undefined && a.currentTime >= end) {
          a.pause();
          resolve();
        }
      };
      a.src = url;
      const go = () => {
        if (start) a.currentTime = start;
        a.play().catch(() => resolve());
      };
      if (start) a.addEventListener("loadedmetadata", go, { once: true });
      else go();
    });
  }, []);

  const play: PlayFn = useCallback(
    async (key, parts, group) => {
      if (playing === key) {
        stopAudio();
        return;
      }
      stopAudio();
      if (!parts.length) return;
      if (!audioRef.current) audioRef.current = new Audio();
      const a = audioRef.current;
      const token = { cancelled: false };
      seqRef.current = token;
      setPlaying(key);
      for (const p of parts) {
        if (token.cancelled) return;
        if (group && p.lit !== undefined) setLit({ group, index: p.lit });
        const marks = p.marks;
        await playOne(a, p.url, p.start, p.end, group && marks ? (sec) => setLit((cur) => {
          const i = litByMarks(marks, sec);
          return i === null ? cur : cur && cur.group === group && cur.index === i ? cur : { group, index: i };
        }) : undefined);
      }
      if (!token.cancelled) {
        seqRef.current = null;
        setPlaying(null);
        setLit(null);
      }
    },
    [playing, playOne, stopAudio],
  );

  useEffect(() => () => stopAudio(), [stopAudio]);

  // ---- điều hướng ----
  const go = useCallback(
    (n: number) => {
      const next = Math.max(0, Math.min(total - 1, n));
      stopAudio();
      setFlipped(false);
      setIdx(next);
      try {
        window.history.replaceState(null, "", `#${next + 1}`);
      } catch {
        /* bỏ qua */
      }
    },
    [total, stopAudio],
  );

  // ---- đồng bộ với cửa sổ "Màn giảng viên" (BroadcastChannel cùng trình duyệt; không qua máy chủ) ----
  const syncRef = useRef<BroadcastChannel | null>(null);
  const idxRef = useRef(0);
  idxRef.current = idx;
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const c = new BroadcastChannel(teachSyncName(lessonId));
    syncRef.current = c;
    c.onmessage = (e: MessageEvent<TeachSyncMessage>) => {
      const m = e.data;
      if (m?.type === "hello") c.postMessage({ type: "idx", idx: idxRef.current } satisfies TeachSyncMessage);
      else if (m?.type === "goto" && Number.isInteger(m.idx)) go(m.idx);
    };
    return () => {
      c.close();
      syncRef.current = null;
    };
  }, [lessonId, go]);
  useEffect(() => {
    syncRef.current?.postMessage({ type: "idx", idx } satisfies TeachSyncMessage);
  }, [idx]);
  const openPresenter = useCallback(() => {
    const url = `${window.location.pathname}?presenter=1`;
    window.open(url, "limio-presenter", "popup=yes,width=1100,height=780");
  }, []);

  // Cỡ chữ nhớ theo trình duyệt (tiện cho máy chiếu của phòng); chặn lưu trữ thì dùng cỡ vừa.
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(SIZE_KEY);
      if (v === "s" || v === "m" || v === "l") setSize(v);
    } catch {
      /* bỏ qua */
    }
  }, []);
  useEffect(() => {
    try {
      const v = window.localStorage.getItem(THEME_KEY);
      if (THEMES.some((x) => x.id === v)) setTheme(v as ThemeId);
    } catch {
      /* bỏ qua */
    }
  }, []);
  const chooseTheme = useCallback((id: ThemeId) => {
    setTheme(id);
    setThemeMenu(false);
    try {
      window.localStorage.setItem(THEME_KEY, id);
    } catch {
      /* bỏ qua */
    }
  }, []);
  const penColors = useMemo(() => (theme === "board" ? [...PEN_COLORS.slice(0, 3), BOARD_PEN] : [...PEN_COLORS]), [theme]);
  const chooseSize = useCallback((s: SizeId) => {
    setSize(s);
    try {
      window.localStorage.setItem(SIZE_KEY, s);
    } catch {
      /* bỏ qua */
    }
  }, []);

  useEffect(() => {
    const n = Number(window.location.hash.replace("#", ""));
    if (Number.isInteger(n) && n >= 1 && n <= total) setIdx(n - 1);
  }, [total]);

  const reveal = useCallback(
    async (questionId: string) => {
      if (answers[questionId] && answers[questionId] !== "error") return;
      setAnswers((s) => ({ ...s, [questionId]: "loading" }));
      try {
        const r = await fetch(apiUrl(`/api/teaching/answer/${questionId}`), { cache: "no-store" });
        if (!r.ok) throw new Error(String(r.status));
        const key = (await r.json()) as AnswerKey;
        setAnswers((s) => ({ ...s, [questionId]: key }));
      } catch {
        setAnswers((s) => ({ ...s, [questionId]: "error" }));
      }
    },
    [answers],
  );

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  useEffect(() => {
    const onFs = () => setFull(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (strokeOpen.current) return; // hộp "Cách viết" đang mở: nó tự xử lý phím (Esc đóng hộp, không thoát bài)
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
        case " ":
          e.preventDefault();
          go(idx + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          go(idx - 1);
          break;
        case "Home":
          go(0);
          break;
        case "End":
          go(total - 1);
          break;
        case "f":
        case "F":
          toggleFull();
          break;
        case "p":
        case "P":
          setPinyin((v) => !v);
          break;
        case "t":
        case "T":
          setTranslation((v) => !v);
          break;
        case "a":
        case "A":
        case "Enter":
          if (frame.kind === "question" && frame.type !== "essay") {
            e.preventDefault();
            void reveal(frame.questionId);
          } else if (frame.kind === "vocab" && e.key === "Enter") {
            e.preventDefault();
            setFlipped((v) => !v);
          }
          break;
        case "ArrowUp":
        case "ArrowDown":
          if (frame.kind === "vocab") {
            e.preventDefault();
            setFlipped((v) => !v);
          }
          break;
        case "n":
        case "N":
          openPresenter();
          break;
        case "l":
        case "L":
          setTool((v) => (v === "laser" ? "none" : "laser"));
          break;
        case "d":
        case "D":
          setTool((v) => (v === "pen" ? "none" : "pen"));
          break;
        case "u":
        case "U":
          inkRef.current?.undo();
          break;
        case "c":
        case "C":
          inkRef.current?.clear();
          break;
        case "Escape":
          if (themeMenu) setThemeMenu(false);
          else if (menu) setMenu(false);
          else if (tool !== "none") setTool("none");
          else if (!document.fullscreenElement) window.location.assign(backHref);
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [idx, total, frame, go, reveal, toggleFull, menu, themeMenu, backHref, tool, openPresenter]);

  // Màn dài hơn khung thì co chữ nhưng KHÔNG nhỏ hơn MIN_FIT (80%): quá mức đó thì giữ cỡ chữ và cho cuộn (thầy chốt 26/11). Chạy lại khi nội dung màn đổi
  // (bài viết dựng bằng SafeHtml xong muộn) hoặc đổi cỡ cửa sổ.
  const stageRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    let raf = 0;
    const fit = () => {
      raf = 0;
      let f = 1;
      stage.style.setProperty("--fit", "1");
      for (let i = 0; i < 6 && f > MIN_FIT && stage.scrollHeight > stage.clientHeight + 1; i++) {
        f = Math.max(MIN_FIT, f * 0.93);
        stage.style.setProperty("--fit", String(f));
      }
    };
    const schedule = () => {
      if (!raf) raf = requestAnimationFrame(fit);
    };
    fit();
    const mo = new MutationObserver(schedule);
    mo.observe(stage, { childList: true, subtree: true, characterData: true });
    window.addEventListener("resize", schedule);
    return () => {
      mo.disconnect();
      window.removeEventListener("resize", schedule);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [idx, pinyin, translation, answers, size]);

  // Vuốt trái/phải trên cảm ứng.
  const touchX = useRef<number | null>(null);

  return (
    <div
      ref={rootRef}
      className="teach-root lesson-han lesson-hsk"
      data-theme={theme}
      data-accent={accent}
      data-kind={frame.kind}
      data-rd-pinyin={pinyin ? "show" : "off"}
      data-rd-translation={translation ? "show" : "off"}
      onTouchStart={(e) => {
        touchX.current = e.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(e) => {
        const x0 = touchX.current;
        touchX.current = null;
        const x1 = e.changedTouches[0]?.clientX;
        if (x0 === null || x1 === undefined || Math.abs(x1 - x0) < 60) return;
        go(x1 < x0 ? idx + 1 : idx - 1);
      }}
    >
      <HanFontLoader lang="zh-Hans" />
      <header className="teach-bar">
        <Link href={backHref} className="teach-btn" aria-label="Thoát về bài học" title="Thoát (Esc)">
          <X className="h-5 w-5" />
        </Link>
        {levelLabel || unitLabel ? (
          <span className="teach-level" title={`${courseTitle}${unitTitle ? ` · ${unitTitle}` : ""}`}>
            {[levelLabel, unitLabel].filter(Boolean).join(" · ")}
          </span>
        ) : null}
        <div className="teach-title">
          <span className="teach-title-main">{lessonTitle}</span>
          <span className="teach-title-sub">{unitTitle ?? courseTitle}</span>
        </div>
        <div className="teach-bar-actions">
          {/* Nhóm giảng viên: mở "Màn giảng viên" ở cửa sổ riêng (ghi chú + đồng hồ + màn kế tiếp). Ghi chú không bao giờ hiện trên cửa sổ này vì cửa sổ này có thể đang lên máy chiếu. */}
          <div className="teach-group" role="group" aria-label="Công cụ giảng viên">
            <button
              type="button"
              className="teach-btn"
              onClick={openPresenter}
              title="Mở màn giảng viên ở cửa sổ riêng: ghi chú, đồng hồ, màn kế tiếp. Cửa sổ này đưa sang máy chiếu (N)"
              aria-label="Mở màn giảng viên"
              data-testid="open-presenter"
            >
              <NotebookPen className="h-5 w-5" />
              <span className="teach-btn-label">Màn giảng viên</span>
              {frameHasNotes ? <span className="teach-dot" aria-hidden /> : null}
            </button>
          </div>
          <span className="teach-sep" aria-hidden />
          {/* Nhóm 1: hiện/ẩn chữ trong lớp (dùng nhiều nhất) */}
          <div className="teach-group" role="group" aria-label="Hiển thị chữ">
            <button type="button" className="teach-btn teach-btn-text" data-on={pinyin} aria-pressed={pinyin} onClick={() => setPinyin((v) => !v)} title="Bật/tắt pinyin (P)">
              Pinyin
            </button>
            <button type="button" className="teach-btn teach-btn-text" data-on={translation} aria-pressed={translation} onClick={() => setTranslation((v) => !v)} title="Bật/tắt bản dịch tiếng Việt (T)">
              Dịch
            </button>
          </div>
          <span className="teach-sep" aria-hidden />
          {/* Nhóm 2: bút */}
          <div className="teach-group" role="group" aria-label="Bút">
            <button type="button" className="teach-btn" data-on={tool === "laser"} aria-pressed={tool === "laser"} onClick={() => setTool((v) => (v === "laser" ? "none" : "laser"))} title="Bút laser (L)" aria-label="Bút laser">
              <Target className="h-5 w-5" />
              <span className="teach-btn-label">Laser</span>
            </button>
            <button type="button" className="teach-btn" data-on={tool === "pen"} aria-pressed={tool === "pen"} onClick={() => setTool((v) => (v === "pen" ? "none" : "pen"))} title="Bút vẽ (D)" aria-label="Bút vẽ">
              <PenLine className="h-5 w-5" />
              <span className="teach-btn-label">Vẽ</span>
            </button>
          </div>
          <span className="teach-sep" aria-hidden />
          {/* Nhóm 3: giao diện (ít đổi) */}
          <div className="teach-group" role="group" aria-label="Giao diện">
            <div className="teach-sizes" role="group" aria-label="Cỡ chữ">
              {SIZES.map((s, i) => (
                <button key={s.id} type="button" data-on={size === s.id} aria-pressed={size === s.id} title={s.label} aria-label={s.label} onClick={() => chooseSize(s.id)} style={{ fontSize: `${[0.95, 1.35, 1.85][i]}rem` }}>
                  {i === 0 ? "a" : "A"}
                </button>
              ))}
            </div>
            <div className="relative">
              <button type="button" className="teach-btn" onClick={() => setThemeMenu((v) => !v)} aria-expanded={themeMenu} title="Màu nền" aria-label="Màu nền">
                <Palette className="h-5 w-5" />
              </button>
              {themeMenu && (
                <ul className="teach-menu teach-theme-menu" role="menu">
                  {THEMES.map((th) => (
                    <li key={th.id}>
                      <button type="button" role="menuitemradio" aria-checked={theme === th.id} onClick={() => chooseTheme(th.id)}>
                        <span className="teach-theme-chip" style={{ background: th.chip, boxShadow: `inset 0 -0.35rem 0 ${th.ink}` }} />
                        {th.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <span className="teach-sep" aria-hidden />
          {/* Nhóm 4: xem */}
          <div className="teach-group" role="group" aria-label="Xem">
            <button type="button" className="teach-btn" onClick={toggleFull} title="Toàn màn hình (F)" aria-label="Toàn màn hình">
              {full ? <Minimize className="h-5 w-5" /> : <Maximize className="h-5 w-5" />}
            </button>
            <div className="relative">
              <button type="button" className="teach-btn" onClick={() => setMenu((v) => !v)} aria-expanded={menu} title="Mục lục" aria-label="Mục lục">
                <List className="h-5 w-5" />
              </button>
              {menu && (
                <ul className="teach-menu" role="menu">
                  {sections.map((s) => (
                    <li key={`${s.index}-${s.label}`}>
                      <button
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setMenu(false);
                          go(s.index);
                        }}
                      >
                        {s.label}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="teach-stage-wrap">
      <main className="teach-stage" ref={stageRef} key={`f${idx}`} aria-live="polite" style={{ ["--size" as string]: String(SIZES.find((s) => s.id === size)!.scale) }}>
        <FrameView
          frame={frame}
          lessonTitle={lessonTitle}
          courseTitle={courseTitle}
          levelLabel={levelLabel ?? null}
          unitTitle={unitTitle ?? null}
          unitLabel={unitLabel ?? null}
          playing={playing}
          play={play}
          lit={lit}
          flipped={flipped}
          onFlip={() => setFlipped((v) => !v)}
          onStroke={openStroke}
          answer={frame.kind === "question" ? answers[frame.questionId] : undefined}
          reveal={reveal}
        />
      </main>
      {tool !== "none" ? (
        <div className="teach-toolpanel" role="toolbar" aria-label={tool === "pen" ? "Bút vẽ" : "Bút laser"}>
          {tool === "pen" ? (
            <>
              <span className="teach-toolpanel-name">Bút vẽ</span>
              {penColors.map((c) => {
                const cur = penColors.some((x) => x.id === penColor) ? penColor : penColors[0]!.id;
                return <button key={c.id} type="button" className="teach-swatch" data-on={cur === c.id} aria-pressed={cur === c.id} aria-label={c.label} title={c.label} style={{ background: c.id }} onClick={() => setPenColor(c.id)} />;
              })}
              <button type="button" className="teach-btn" onClick={() => inkRef.current?.undo()} title="Hoàn tác nét cuối (U)" aria-label="Hoàn tác">
                <Undo2 className="h-5 w-5" />
              </button>
              <button type="button" className="teach-btn" onClick={() => inkRef.current?.clear()} title="Xoá hết nét vẽ của màn này (C)" aria-label="Xoá nét vẽ">
                <Eraser className="h-5 w-5" />
              </button>
            </>
          ) : (
            <span className="teach-toolpanel-name">Bút laser</span>
          )}
          <button type="button" className="teach-toolpanel-done" onClick={() => setTool("none")} title="Tắt bút (Esc)">
            Xong · Esc
          </button>
        </div>
      ) : null}
      <TeachingInk ref={inkRef} tool={tool} color={penColors.some((c) => c.id === penColor) ? penColor : penColors[0]!.id} frameKey={`f${idx}`} onWheel={(dy) => stageRef.current?.scrollBy({ top: dy })} />
      </div>

      <footer className="teach-foot">
        <button type="button" className="teach-nav" onClick={() => go(idx - 1)} disabled={idx === 0} aria-label="Màn trước">
          <ChevronLeft className="h-6 w-6" />
        </button>
        <div className="teach-progress" aria-hidden>
          <span style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        <span className="teach-count">
          {idx + 1}/{total}
          <span className="teach-count-name"> · {frameHeading(frame)}</span>
        </span>
        <button type="button" className="teach-nav teach-nav-next" onClick={() => go(idx + 1)} disabled={idx === total - 1} aria-label="Màn sau">
          <ChevronRight className="h-6 w-6" />
        </button>
      </footer>
      {stroke ? (
        <HanziStrokeDialog
          term={stroke.term}
          lang="vi"
          onClose={closeStroke}
          head={
            <div className="teach-wd-head">
              {stroke.reading ? <p className="teach-wd-py">{stroke.reading}</p> : null}
              <p className="teach-wd-mean">{stroke.meaning}</p>
            </div>
          }
          foot={
            stroke.example ? (
              <div className="teach-wd-ex">
                <HanLine text={stroke.example} reading={stroke.exampleReading} size="md" />
                {stroke.exampleMeaning ? <p className="teach-fc-ex-tr">{stroke.exampleMeaning}</p> : null}
              </div>
            ) : null
          }
        />
      ) : null}
    </div>
  );
}

function PlayButton({ id, playing, onClick, label }: { id: string; playing: string | null; onClick: () => void; label: string }) {
  const on = playing === id;
  return (
    <button type="button" className="teach-play" data-on={on} onClick={onClick} aria-label={on ? "Dừng" : label} title={label}>
      {on ? <Pause className="h-6 w-6" /> : <Volume2 className="h-6 w-6" />}
      <span>{on ? "Dừng" : label}</span>
    </button>
  );
}

/** Nút loa tròn nhỏ đứng cạnh một dòng (lượt hội thoại, âm thanh của bài đọc). */
function DotPlay({ id, playing, onClick, label }: { id: string; playing: string | null; onClick: () => void; label: string }) {
  const on = playing === id;
  return (
    <button type="button" className="teach-dotplay" data-on={on} onClick={onClick} aria-label={on ? "Dừng" : label} title={label}>
      {on ? <Pause className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
    </button>
  );
}

/** Dòng của danh sách; khi `on` thì sáng lên và tự cuộn vào tầm nhìn (khung màn có thể đang cuộn). */
function LitItem({ on, children, ...rest }: { on: boolean; children: React.ReactNode } & React.LiHTMLAttributes<HTMLLIElement>) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    if (on) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [on]);
  return (
    <li ref={ref} className={on ? "teach-lit" : undefined} {...rest}>
      {children}
    </li>
  );
}

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="teach-kicker">{children}</p>;
}

function FrameView({
  frame,
  lessonTitle,
  courseTitle,
  levelLabel,
  unitTitle,
  unitLabel,
  playing,
  play,
  lit,
  flipped,
  onFlip,
  onStroke,
  answer,
  reveal,
}: {
  frame: TeachingFrame;
  lessonTitle: string;
  courseTitle: string;
  levelLabel: string | null;
  unitTitle: string | null;
  unitLabel: string | null;
  playing: string | null;
  play: PlayFn;
  lit: Lit;
  flipped: boolean;
  onFlip: () => void;
  onStroke: (f: VocabFrame) => void;
  answer: AnswerState | undefined;
  reveal: (questionId: string) => void;
}) {
  switch (frame.kind) {
    case "cover": {
      const watermark = (lessonTitle.match(/[㐀-鿿]+/g) ?? []).join("");
      return (
        <div className="teach-cover">
          {watermark ? (
            <span className="teach-watermark han-text" lang="zh-Hans" aria-hidden>
              {watermark}
            </span>
          ) : null}
          <p className="teach-cover-kicker">{[levelLabel, unitLabel].filter(Boolean).join(" · ") || courseTitle}</p>
          <h1 className="teach-cover-title">{lessonTitle}</h1>
          {levelLabel || unitLabel ? <p className="teach-cover-course">{[unitTitle, courseTitle].filter(Boolean).join(" · ")}</p> : null}
          <p className="teach-cover-hint">Bấm → hoặc phím cách để bắt đầu</p>
        </div>
      );
    }

    case "html":
      return (
        <div className="teach-card teach-html">
          {frame.cont && frame.label ? <Kicker>{frame.label}</Kicker> : null}
          {/* Không truyền hskKind: giữ nguyên kiểu chữ nội tuyến của bài tác giả (màu mục, số chip, hộp Ghi nhớ…) như trang bài học, không dựng lại bằng giao diện HSK thẻ. */}
          <LessonRichText html={frame.html} className="!border-0 !bg-transparent !p-0" />
        </div>
      );

    case "dialogue": {
      // Có âm thanh từng lượt đủ cho mọi lượt thì phát lần lượt (dòng đang đọc sáng lên chính xác); không thì phát tệp cả đoạn và sáng theo mốc `startSec`.
      const perTurn = frame.turns.every((t) => t.audioUrl);
      const timed = !!frame.audioUrl && frame.turns.every((t) => typeof t.startSec === "number");
      const parts: AudioPart[] = perTurn
        ? frame.turns.map((t, i) => ({ url: t.audioUrl!, lit: i }))
        : timed
          ? [{ url: frame.audioUrl!, marks: frame.turns.map((t) => t.startSec) }]
          : frame.audioUrl
            ? [{ url: frame.audioUrl }]
            : frame.turns.filter((t) => t.audioUrl).map((t) => ({ url: t.audioUrl! }));
      return (
        <div className="teach-card teach-dialogue">
          <Kicker>{frame.label}</Kicker>
          <h2 className="teach-h2">{frame.title}</h2>
          {parts.length > 0 && <PlayButton id="dlg" playing={playing} label="Nghe cả đoạn" onClick={() => play("dlg", parts, "dlg")} />}
          <ol className="teach-turns">
            {frame.turns.map((t, i) => (
              <LitItem key={t.id} on={lit?.group === "dlg" && lit.index === i}>
                <span className="teach-speaker">{t.speaker}</span>
                <HanLine text={t.text} reading={t.reading} size="md" keys={frame.keys} />
              </LitItem>
            ))}
          </ol>
        </div>
      );
    }

    case "turn":
      return (
        <div className="teach-card teach-turn">
          <Kicker>
            {frame.title} · lượt {frame.turnNo}/{frame.turnTotal}
          </Kicker>
          <div className="teach-who">
            {frame.avatarUrl ? <img src={frame.avatarUrl} alt="" className="teach-avatar" /> : <span className="teach-avatar teach-avatar-letter">{[...frame.speaker][0]}</span>}
            <span className="teach-speaker teach-speaker-lg">{frame.speaker}</span>
          </div>
          <HanLine text={frame.text} reading={frame.reading} size="xl" keys={frame.keys} />
          {frame.translation ? (
            <p className="teach-tr" data-rd-tr="">
              {frame.translation}
            </p>
          ) : null}
          {frame.audioUrl ? <PlayButton id={`turn${frame.turnNo}`} playing={playing} label="Nghe" onClick={() => play(`turn${frame.turnNo}`, [{ url: frame.audioUrl! }])} /> : null}
        </div>
      );

    case "vocab": {
      const wordParts: AudioPart[] = frame.track ? [{ url: frame.track.url, start: frame.track.startSec, end: frame.track.endSec }] : frame.audioUrl ? [{ url: frame.audioUrl }] : [];
      return (
        <div className="teach-card teach-vocab">
          <div className="teach-vocab-top">
            <Kicker>
              {frame.label} · {frame.no}/{frame.total}
            </Kicker>
            <div className="teach-vocab-actions">
            {wordParts.length ? <PlayButton id={`w${frame.no}`} playing={playing} label="Nghe từ" onClick={() => play(`w${frame.no}`, wordParts)} /> : null}
            {frame.exampleAudioUrl ? <PlayButton id={`e${frame.no}`} playing={playing} label="Nghe câu" onClick={() => play(`e${frame.no}`, [{ url: frame.exampleAudioUrl! }])} /> : null}
            {hasHanChars(frame.term) ? (
              <button type="button" className="teach-play" onClick={() => onStroke(frame)}>
                <Pencil className="h-6 w-6" />
                <span>Cách viết</span>
              </button>
            ) : null}
          </div>
          </div>
          {/* Thẻ lật giống tab Từ vựng của bài học: mặt trước chữ Hán, bấm để lật sang pinyin · nghĩa · ví dụ. */}
          <div className="flip-card teach-fc" data-flipped={flipped ? "true" : "false"}>
            <div
              role="button"
              tabIndex={-1}
              className="flip-card-inner teach-fc-inner"
              aria-label={flipped ? "Lật về mặt trước" : "Lật thẻ"}
              onMouseDown={(e) => {
                if (e.detail > 1) e.preventDefault();
              }}
              onClick={onFlip}
            >
              <div aria-hidden={flipped} className="flip-face teach-fc-face teach-fc-front">
                <HanLine text={frame.term} reading={frame.reading} size="hero" />
                <span className="teach-fc-hint">Bấm để lật thẻ · Enter</span>
              </div>
              <div aria-hidden={!flipped} className="flip-face flip-back teach-fc-face teach-fc-back">
                <HanLine text={frame.term} reading={frame.reading} size="lg" />
                <p className="teach-fc-mean">{frame.meaning}</p>
                {frame.example ? (
                  <div className="teach-example">
                    <HanLine text={frame.example} reading={frame.exampleReading} size="md" keys={[frame.term]} />
                    {frame.exampleMeaning ? <p className="teach-fc-ex-tr">{frame.exampleMeaning}</p> : null}
                  </div>
                ) : null}
                {frame.note ? <p className="teach-note">{frame.note}</p> : null}
              </div>
            </div>
          </div>
        </div>
      );
    }

    case "question":
      return <QuestionView frame={frame} answer={answer} reveal={reveal} playing={playing} play={play} lit={lit} />;
  }
}

function PassageView({ blocks, title, playing, play, keys }: { blocks: PassageBlock[]; title: string; playing: string | null; play: PlayFn; keys: string[] }) {
  return (
    <aside className="teach-passage" aria-label={title || "Bài đọc"}>
      {title ? <Kicker>{title}</Kicker> : null}
      {blocks.map((b, i) => {
        if (b.kind === "image") return <img key={i} src={b.url} alt={b.alt ?? ""} className="teach-passage-img" />;
        if (b.kind === "audio")
          return (
            <div key={i} className="teach-audio-row">
              <DotPlay id={`pa${i}`} playing={playing} label="Nghe" onClick={() => play(`pa${i}`, [{ url: b.url }])} />
              <span>{b.label || "Nghe đoạn âm thanh"}</span>
            </div>
          );
        if (b.kind === "table")
          return (
            <table key={i} className="teach-table">
              <tbody>
                {b.rows.map((r, ri) => (
                  <tr key={ri}>{r.map((c, ci) => (c.head ? <th key={ci}>{c.text}</th> : <td key={ci}>{c.text}</td>))}</tr>
                ))}
              </tbody>
            </table>
          );
        const flat = b.runs.map((r) => r.text).join("");
        return (
          <p key={i} className={`teach-han teach-han-md ${hanClass(flat)} ${b.heading ? "font-bold" : ""}`}>
            {b.runs.map((r, ri) => (r.bold ? <strong key={ri} className="teach-pb">{r.text}</strong> : <span key={ri}><Highlighted text={r.text} keys={keys} /></span>))}
          </p>
        );
      })}
    </aside>
  );
}

/**
 * Đề câu hỏi. Có phiên âm (`promptAid.reading`) thì hiện câu chữ Hán với pinyin dưới từng chữ; ô trống `[[n]]` của câu kéo thả hiện thành （n） tô nổi bật
 * (pinyin đi kèm có "____" ở đúng chỗ nên vẫn ghép được). Không có phiên âm (đề viết bằng tiếng Việt) thì giữ như cũ.
 */
function QuestionPrompt({ prompt, reading }: { prompt: string; reading?: string }) {
  const blanks = [...prompt.matchAll(/\[\[(\d+)\]\]/g)].map((m) => `（${m[1]}）`);
  const shown = prompt.replace(/\[\[(\d+)\]\]/g, "（$1）");
  if (!reading) return <p className="teach-prompt">{shown}</p>;
  return (
    <div className="teach-prompt-han">
      <HanLine text={shown} reading={reading.replace(/_{2,}/g, "____")} size="lg" keys={blanks} />
    </div>
  );
}

function QuestionView({
  frame,
  answer,
  reveal,
  playing,
  play,
  lit,
}: {
  frame: Extract<TeachingFrame, { kind: "question" }>;
  answer: AnswerState | undefined;
  reveal: (questionId: string) => void;
  playing: string | null;
  play: PlayFn;
  lit: Lit;
}) {
  const key = answer && typeof answer === "object" ? answer : null;
  const correct = new Set(key?.lines ?? []);
  const lettered = frame.type === "mcq" || frame.type === "multi";
  const rp = frame.roleplay;
  const fc = frame.freechat;
  const side = frame.passage || rp;
  return (
    <div className={`teach-card teach-question ${side ? "teach-question-split" : ""}`}>
      {frame.passage ? <PassageView blocks={frame.passage.blocks} title={frame.passage.title} playing={playing} play={play} keys={frame.keys} /> : null}
      {rp ? (
        <aside className="teach-roleplay" aria-label="Hội thoại đóng vai">
          <Kicker>Hội thoại đóng vai</Kicker>
          {rp.turns.some((t) => t.audioUrl) ? (
            <PlayButton id="rp" playing={playing} label="Nghe cả đoạn" onClick={() => play("rp", rp.turns.flatMap((t, i) => (t.audioUrl ? [{ url: t.audioUrl, lit: i }] : [])), "rp")} />
          ) : null}
          <ol>
            {rp.turns.map((t, i) => (
              <LitItem key={i} on={lit?.group === "rp" && lit.index === i} data-side={t.speaker}>
                <span className="teach-role">{t.roleName}</span>
                <div>
                  <HanLine text={t.main} reading={t.reading} size="md" keys={rp.keys} />
                </div>
                {t.audioUrl ? <DotPlay id={`rp${i}`} playing={playing} label="Nghe" onClick={() => play(`rp${i}`, [{ url: t.audioUrl!, lit: i }], "rp")} /> : null}
              </LitItem>
            ))}
          </ol>
        </aside>
      ) : null}
      <div className="teach-question-main">
        <Kicker>
          {frame.label} · câu {frame.no}/{frame.total}
        </Kicker>
        <QuestionPrompt prompt={frame.prompt} reading={frame.promptReading} />
        {frame.promptTranslation ? (
          <p className="teach-tr teach-tr-sm" data-rd-tr="">
            {frame.promptTranslation}
          </p>
        ) : null}

        {fc ? (
          <div className="teach-freechat">
            {fc.scenario ? <p>{fc.scenario}</p> : null}
            {fc.opening ? (
              <div className="teach-fc-open">
                <HanLine text={fc.opening} reading={fc.openingReading} size="md" />
              </div>
            ) : null}
            {fc.targets.length ? (
              <p className="teach-fc-targets">
                Cụm gợi ý:{" "}
                {fc.targets.map((t, i) => (
                  <span key={i} className={`teach-chip ${hanClass(t)}`}>
                    {t}
                  </span>
                ))}
              </p>
            ) : null}
          </div>
        ) : null}

        {frame.type === "matching" ? (
          <div className="teach-match">
            <ul>
              {frame.leftSide.map((l, i) => (
                <li key={i}>
                  <span className="teach-letter">{i + 1}</span>
                  <span className={hanClass(l)}>{l}</span>
                </li>
              ))}
            </ul>
            <ul>
              {frame.choices.map((c, i) => (
                <li key={i}>
                  <span className="teach-letter">{String.fromCharCode(65 + i)}</span>
                  <span className={hanClass(c)}>{c}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : frame.choices.length > 0 ? (
          <>
            {frame.type === "drag_drop_fill" ? <p className="teach-hint">Chọn từ điền vào các ô trống (1), (2)…</p> : null}
            <ul className={`teach-choices ${frame.type === "ordering" || frame.type === "drag_drop_fill" ? "teach-chips" : ""}`}>
            {frame.choices.map((c, i) => (
              <li key={i} data-correct={lettered && correct.has(c) ? "true" : undefined}>
                {lettered ? <span className="teach-letter">{String.fromCharCode(65 + i)}</span> : null}
                <span className={hanClass(c)}>{c}</span>
              </li>
            ))}
            </ul>
          </>
        ) : null}

        {/* Câu mở (đóng vai, nói, viết) không có đáp án cố định nên không có nút "Hiện đáp án". */}
        {frame.type === "essay" ? null : (
        <div className="teach-reveal">
          {!key ? (
            <button type="button" className="teach-play" onClick={() => reveal(frame.questionId)} disabled={answer === "loading"}>
              <Eye className="h-6 w-6" />
              <span>{answer === "loading" ? "Đang tải…" : "Hiện đáp án"}</span>
            </button>
          ) : (
            <div className="teach-answer">
              {key.open ? (
                <p className="teach-answer-title">Câu mở: không có đáp án cố định, giáo viên nhận xét theo bài làm.</p>
              ) : (
                <>
                  <p className="teach-answer-title">Đáp án</p>
                  <ul>
                    {key.lines.map((l, i) => (
                      <li key={i} className={hanClass(l)}>
                        {l}
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {key.explanation ? <p className="teach-explain">{key.explanation}</p> : null}
            </div>
          )}
          {answer === "error" ? <p className="teach-error">Không tải được đáp án. Bấm lại để thử lần nữa.</p> : null}
        </div>
        )}
      </div>
    </div>
  );
}
