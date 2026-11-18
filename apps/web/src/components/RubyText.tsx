import { alignReading, hanTokens, mainTextLang } from "@/lib/rolePlayView";

/** Một đơn vị hiển thị của câu (`hanTokens`/`compareSpoken`): `scored` = chữ Hán; `ok === false` = chữ bị đánh dấu thiếu. */
export interface RubyWord {
  text: string;
  scored?: boolean;
  ok?: boolean;
  sep?: string;
  /** Chữ thuộc từ cần nhấn (vd. từ mới trong câu ví dụ): tô màu riêng (`.rp-key`). */
  hl?: boolean;
}

/** Ghép sẵn: các đơn vị của câu và (nếu ghép được) âm tiết cho từng chữ Hán. Dùng để biết trước nên hiện pinyin thẳng hàng hay ở dòng riêng. */
export function rubyPlan(text: string, reading: string | undefined): { syllables: string[] | null; lang: ReturnType<typeof mainTextLang> } {
  return { syllables: reading ? alignReading(text, reading) : null, lang: mainTextLang(text) };
}

/** Class + lang cho đoạn chữ Hán: lang để trình duyệt chọn đúng kiểu nét, class để chọn font (globals.css `.han-text`). */
export function hanTextProps(lang: ReturnType<typeof mainTextLang>): { lang?: string; className: string } {
  return lang ? { lang, className: "han-text" } : { className: "" };
}

/**
 * Câu có chữ Hán, pinyin thẳng hàng DƯỚI từng chữ (ruby kiểu giáo trình). Dấu câu và khoảng trắng đi nguyên.
 * `masked`: làm mờ pinyin (học viên tự đoán cách đọc); `words` truyền sẵn (đã so khớp lời nói) hoặc để trống để tự cắt từ `text`.
 */
export default function RubyText({
  text,
  words,
  syllables,
  masked,
}: {
  text: string;
  words?: RubyWord[];
  syllables: string[];
  masked?: boolean;
}) {
  const list: RubyWord[] = words ?? hanTokens(text);
  // Dấu câu đi liền chữ đứng trước trong một nhóm không ngắt dòng, để dấu không rơi xuống đầu dòng một mình.
  const groups: RubyWord[][] = [];
  for (const w of list) {
    if (!w.scored && groups.length) groups[groups.length - 1]!.push(w);
    else groups.push([w]);
  }
  let k = 0;
  return (
    <>
      {groups.map((g, gi) => (
        <span key={gi} className="whitespace-nowrap">
          {g.map((w, j) => {
            const syl = w.scored ? syllables[k++] : undefined;
            const base = <span className={w.ok === false ? "rp-miss" : w.hl ? "rp-key" : undefined}>{w.text}</span>;
            return (
              <span key={j}>
                {syl ? (
                  <ruby className="ruby-han">
                    {base}
                    <rt data-masked={masked ? "true" : undefined}>{syl}</rt>
                  </ruby>
                ) : (
                  base
                )}
                {w.sep ?? ""}
              </span>
            );
          })}
        </span>
      ))}
    </>
  );
}
