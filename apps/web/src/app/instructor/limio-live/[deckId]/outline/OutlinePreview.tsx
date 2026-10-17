import type { CSSProperties, ReactNode } from "react";
import type { OutlineSlide } from "@/lib/limioLiveOutline";
import { OUTLINE_KIND_LABEL, splitPoint } from "@/lib/limioLiveOutlineUi";

// Bản xem trước 16:9 chỉ để hình dung cách chữ sắp xếp trong từng bố cục; màu sắc, phông chữ và hình
// minh hoạ do bước tạo slide quyết định. Cỡ chữ theo đơn vị cqw của khung nên co giãn theo bề rộng.
const pv = (v: number) => `${v}cqw`;
const card: CSSProperties = { background: "#f0f5e0", borderRadius: pv(1.6), padding: pv(2.2), fontSize: pv(2.7), lineHeight: 1.3 };
const cardHead: CSSProperties = { display: "block", fontSize: pv(3), marginBottom: pv(0.6) };
const h3: CSSProperties = { margin: 0, fontSize: pv(5.6), lineHeight: 1.18, fontWeight: 700 };
const p: CSSProperties = { margin: 0, fontSize: pv(3.5), lineHeight: 1.35 };
const ul: CSSProperties = { margin: 0, paddingLeft: pv(4.5), display: "grid", gap: pv(1.4), fontSize: pv(3.3), lineHeight: 1.32, listStyle: "disc" };
const tag: CSSProperties = { fontSize: pv(2.6), color: "#6b7660", fontWeight: 600 };

const BOARD_SUB: Partial<Record<OutlineSlide["kind"], string>> = {
  quiz: "Các lựa chọn sẽ do AI soạn ở bước tạo slide.",
  poll: "Các lựa chọn sẽ do AI soạn ở bước tạo slide.",
  word_cloud: "Học viên gõ từ khoá, kết quả hiện thành đám mây.",
  collaborate_board: "Học viên dán ghi chú lên bảng chung.",
  draw_it: "Mỗi học viên vẽ một hình rồi đăng lên bảng.",
  whiteboard: "Cả lớp cùng vẽ trên một khung.",
};

function Art({ kind }: { kind: OutlineSlide["kind"] }) {
  if (kind === "collaborate_board")
    return (
      <div style={{ display: "flex", gap: pv(1.6) }}>
        {["#fde68a", "#bfdbfe", "#bbf7d0", "#fbcfe8"].map((c) => (
          <i key={c} style={{ width: pv(9), height: pv(7), background: c, borderRadius: pv(1) }} />
        ))}
      </div>
    );
  if (kind === "draw_it")
    return (
      <svg viewBox="0 0 120 30" style={{ width: pv(30), height: pv(7) }} aria-hidden>
        <path d="M4 22 C20 2, 34 2, 48 16 S80 30, 116 6" fill="none" stroke="#5b6b9a" strokeWidth="4" strokeLinecap="round" />
      </svg>
    );
  if (kind === "whiteboard")
    return (
      <svg viewBox="0 0 120 30" style={{ width: pv(30), height: pv(7) }} aria-hidden>
        <path d="M4 26 L30 6 L58 22 L84 4 L116 18" fill="none" stroke="#5b6b9a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  return null;
}

export default function OutlinePreview({ slide }: { slide: Pick<OutlineSlide, "kind" | "layout" | "title" | "points"> }) {
  const t = slide.title.trim() || "Tiêu đề slide";
  const P = slide.points.map((x) => x.trim()).filter(Boolean);
  const interactive = slide.kind !== "content";
  let body: ReactNode = null;

  if (interactive) {
    body = (
      <>
        <span style={tag}>{OUTLINE_KIND_LABEL[slide.kind]}</span>
        <h3 style={h3}>{t}</h3>
        <Art kind={slide.kind} />
        <p style={{ ...p, color: "#5b6b9a" }}>{BOARD_SUB[slide.kind]}</p>
      </>
    );
  } else {
    const cards = (n: number) => (
      <div style={{ display: "grid", gap: pv(2.6), gridTemplateColumns: `repeat(${n}, 1fr)` }}>
        {P.slice(0, n).map((q, i) => {
          const [a, b] = splitPoint(q);
          return (
            <div key={i} style={card}>
              <b style={cardHead}>{a}</b>
              {b || (a ? "" : q)}
            </div>
          );
        })}
      </div>
    );
    switch (slide.layout) {
      case "cover":
        body = (<><h3 style={{ ...h3, fontSize: pv(7.6) }}>{t}</h3>{P[0] && <p style={p}>{P[0]}</p>}</>);
        break;
      case "section":
        body = (<><span style={tag}>Phần mới</span><h3 style={{ ...h3, fontSize: pv(7.6) }}>{t}</h3>{P[0] && <p style={p}>{P[0]}</p>}</>);
        break;
      case "cards":
        body = (<><h3 style={h3}>{t}</h3>{cards(3)}</>);
        break;
      case "compare":
        body = (<><h3 style={h3}>{t}</h3>{cards(2)}</>);
        break;
      case "steps":
        body = (
          <>
            <h3 style={h3}>{t}</h3>
            <div style={{ display: "grid", gap: pv(2.6), gridTemplateColumns: `repeat(${Math.max(P.length, 1)}, 1fr)` }}>
              {P.map((q, i) => {
                const [a, b] = splitPoint(q);
                return (
                  <div key={i}>
                    <div style={{ width: pv(5), height: pv(5), borderRadius: "50%", background: "#65a30d", color: "#fff", fontWeight: 700, fontSize: pv(2.8), display: "grid", placeItems: "center", marginBottom: pv(1) }}>{i + 1}</div>
                    <div style={{ ...card, padding: pv(1.6) }}>
                      <b style={cardHead}>{a}</b>
                      {b || (a ? "" : q)}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        );
        break;
      case "stats":
        body = (
          <>
            <h3 style={h3}>{t}</h3>
            <div style={{ display: "grid", gap: pv(2.6), gridTemplateColumns: `repeat(${Math.max(P.length, 1)}, 1fr)` }}>
              {P.map((q, i) => (
                <div key={i}>
                  <div style={{ fontSize: pv(7), fontWeight: 700, color: "#3f6212", lineHeight: 1 }}>{/\d[\d.,%]*/.exec(q)?.[0] ?? "?"}</div>
                  <p style={{ ...p, fontSize: pv(2.7) }}>{q}</p>
                </div>
              ))}
            </div>
          </>
        );
        break;
      case "quote":
        body = (
          <>
            <span style={tag}>{t}</span>
            <div style={{ fontSize: pv(5), lineHeight: 1.3, fontWeight: 600, borderLeft: `${pv(1)} solid #65a30d`, paddingLeft: pv(3) }}>{P[0] || "Câu trích dẫn"}</div>
          </>
        );
        break;
      case "summary":
        body = (<><h3 style={h3}>{t}</h3><ul style={ul}>{P.map((q, i) => <li key={i}>{q}</li>)}</ul></>);
        break;
      default:
        body = (
          <div style={{ display: "grid", gridTemplateColumns: "1.25fr 1fr", gap: pv(3), alignItems: "center" }}>
            <div style={{ display: "grid", gap: pv(2) }}>
              <h3 style={h3}>{t}</h3>
              {P[0] && <p style={p}>{P[0]}</p>}
              {P.length > 1 && <ul style={ul}>{P.slice(1).map((q, i) => <li key={i}>{q}</li>)}</ul>}
            </div>
            <div style={{ aspectRatio: "4 / 3", borderRadius: pv(1.6), background: "repeating-linear-gradient(135deg, #e3ebcf 0 1.6cqw, #edf3dc 1.6cqw 3.2cqw)" }} />
          </div>
        );
    }
  }

  return (
    <div
      style={{
        containerType: "inline-size",
        aspectRatio: "16 / 9",
        width: "100%",
        borderRadius: 12,
        border: "1px solid rgb(var(--border))",
        background: interactive ? "#eef2ff" : "#fffdf7",
        color: "#24301a",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", inset: 0, padding: `${pv(6)} ${pv(6.5)}`, display: "flex", flexDirection: "column", justifyContent: "safe center", gap: pv(2.4) }}>
        {body}
      </div>
    </div>
  );
}
