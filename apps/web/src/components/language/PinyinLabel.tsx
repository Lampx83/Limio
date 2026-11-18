"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import RubyText from "@/components/RubyText";
import { sliceByHan } from "@/lib/promptRuby";

/**
 * Pinyin dưới chữ Hán cho các chỗ của Bài luyện không có pinyin do tác giả viết: phương án, ngân hàng từ, ô đã chọn, lời giải thích.
 * Phiếu bài tập (`PracticeSheet`) cấp bộ tính qua context khi khoá là tiếng Trung; không có context (khoá khác, thẻ câu cũ) thì chỉ hiện chữ trơn,
 * nên mọi nơi khác dùng `PinyinLabel` đều không đổi. Bộ tính (bảng ~140 KB) nạp lười, chỉ khi một phiếu tiếng Trung hiện ra.
 */
export type SyllableFn = (text: string) => string[] | null;

const PinyinContext = createContext<SyllableFn | null>(null);

let loading: Promise<SyllableFn> | null = null;
function loadSyllables(): Promise<SyllableFn> {
  loading ??= import("@/lib/hanPinyin").then((m) => m.hanSyllables);
  return loading;
}

/** Khoá tiếng Trung có bật pinyin? `zh` hoặc không ghi ngôn ngữ; các khoá dạy tiếng Trung cho người Việt ghi `vi`. Anh/Nhật/Hàn… không. */
export function courseWantsPinyin(courseLanguage: string | null | undefined): boolean {
  const l = (courseLanguage ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return l === "zh" || l === "vi" || l === "";
}

/** Nạp bộ tính pinyin khi `enabled`; trả null cho tới khi nạp xong (lúc đó chữ hiện trơn, rồi tự đổi sang có pinyin). */
export function useSyllableFn(enabled: boolean): SyllableFn | null {
  const [fn, setFn] = useState<SyllableFn | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    void loadSyllables().then((f) => alive && setFn(() => f));
    return () => {
      alive = false;
    };
  }, [enabled]);
  return enabled ? fn : null;
}

export function PinyinProvider({ value, children }: { value: SyllableFn | null; children: ReactNode }) {
  return <PinyinContext.Provider value={value}>{children}</PinyinContext.Provider>;
}

export function useSyllables(): SyllableFn | null {
  return useContext(PinyinContext);
}

/** Một cụm chữ Hán liền nhau (kèm dấu câu CJK đi sau): đơn vị đặt pinyin; phần còn lại của văn bản (chữ Việt, Anh) giữ nguyên để tự xuống dòng. */
const HAN_CHUNK = /([\u3400-\u9fff][\u3400-\u9fff\u3000-\u303f\uff00-\uffef\u2018-\u201d\u2026]*)/;

/**
 * Nhãn không đặt pinyin: một trợ từ đơn 的/地/得 (bài chọn trợ từ: âm "dì/dé" của chữ lẻ sai với vai trò trợ từ, còn "de de de" thì vô nghĩa), và nhãn tham chiếu hình "图 A".
 */
const NO_RUBY_LABEL = /^(?:[的地得]|[\u3400-\u9fff]\s*[A-Za-z0-9]{1,2})$/;

const bareLetters = (t: string) =>
  t
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
const TRAILING_GLOSS = /^(.*[\u3400-\u9fff])\s*[·•]\s*([^\u3400-\u9fff]+)$/s;

/** Bỏ "· pinyin" cuối nhãn nếu đúng là pinyin của chính các chữ Hán đứng trước (so theo chữ cái, bỏ dấu thanh); nghĩa tiếng Việt sau dấu chấm giữa thì giữ. */
export function withoutTrailingGloss(text: string, syllables: string[]): string {
  const m = TRAILING_GLOSS.exec(text.trim());
  if (!m) return text;
  const head = m[1]!;
  const hanCount = (head.match(/[\u3400-\u9fff]/g) ?? []).length;
  if (hanCount !== syllables.length) return text;
  return bareLetters(m[2]!) === bareLetters(syllables.join("")) ? head : text;
}

/**
 * Văn bản có chữ Hán kèm pinyin dưới từng chữ (kiểu giáo trình) khi có bộ tính; không thì chữ trơn. Văn bản lẫn chữ Việt (lời giải thích) chỉ đặt pinyin
 * cho từng cụm chữ Hán, phần chữ Việt vẫn xuống dòng bình thường. Chữ không tra được âm giữ nguyên, không có pinyin.
 */
export default function PinyinLabel({ text: raw }: { text: string }) {
  const fn = useSyllables();
  const syl = fn && !NO_RUBY_LABEL.test(raw.trim()) ? fn(raw) : null;
  if (!syl) return <>{raw}</>;
  // Nhãn tác giả ghi sẵn "钥匙 · yàoshi": khi đã có pinyin dưới chữ thì bỏ phần ghi thêm ở sau, kẻo pinyin hiện hai lần.
  const text = withoutTrailingGloss(raw, syl);
  const parts = text.split(HAN_CHUNK);
  const slices = sliceByHan(
    syl,
    parts.map((p, i) => (i % 2 ? p : "")),
  );
  return (
    <>
      {parts.map((p, i) =>
        i % 2 ? (
          <span key={i} className="han-text ruby-line ps-han" lang="zh-Hans">
            <RubyText text={p} syllables={slices[i]!} />
          </span>
        ) : (
          p
        ),
      )}
    </>
  );
}

/**
 * Đề lẫn chữ Hán và chữ Việt/Anh ("Màn hình đang 播放 một đoạn video…") có pinyin dưới chữ Hán: chỉ CỤM CHỮ HÁN mới đi theo ruby và font Hán; chữ Việt giữ font và cỡ của bài
 * (`.ps-latin`) và tự xuống dòng giữa các từ. Cụm Hán ngắn (≤ 4 chữ, thường là một từ) là một khối không ngắt giữa chừng; cụm dài ngắt được giữa các chữ.
 * Đề toàn chữ Hán chỉ có một cụm nên hiện như `RubyText`. `syllables`: âm tiết cho từng chữ Hán của cả `text`, theo thứ tự.
 */
export function RubyRun({ text, syllables }: { text: string; syllables: string[] }) {
  const parts = text.split(HAN_CHUNK);
  const slices = sliceByHan(
    syllables,
    parts.map((p, i) => (i % 2 ? p : "")),
  );
  return (
    <>
      {parts.map((p, i) => {
        if (!p) return null;
        if (i % 2 === 0) return /\S/.test(p) ? <span key={i} className="ps-latin">{p}</span> : p;
        const unit = (p.match(/[\u3400-\u9fff]/g) ?? []).length <= 4;
        return (
          <span key={i} className={unit ? "whitespace-nowrap" : undefined}>
            <RubyText text={p} syllables={slices[i]!} />
          </span>
        );
      })}
    </>
  );
}
